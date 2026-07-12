"""
PDF Edital Scraper for PhD (Doutorado) programs.
Visits each PhD program URL, discovers edital PDFs, extracts metadata,
and saves results alongside existing scan data.

Usage:
  python scripts/pdf-scrape-phd.py
  python scripts/pdf-scrape-phd.py --limit 10
  python scripts/pdf-scrape-phd.py --dry-run
  python scripts/pdf-scrape-phd.py --workers 5
"""

import json, os, sys, time, warnings
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

warnings.filterwarnings('ignore')

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scraper"))
from pdf_edital_scraper import scrape_program_for_editais

SRC_DATA = os.path.join(BASE, "src", "assets", "data")
PROGRAMS_FILE = os.path.join(SRC_DATA, "programs.json")
STATUS_FILE = os.path.join(SRC_DATA, "program-status.json")
PDF_RESULTS_FILE = os.path.join(SRC_DATA, "pdf-scrape-results.json")

PER_URL_TIMEOUT = 45  # max seconds per URL


def main():
    import argparse
    parser = argparse.ArgumentParser(description='PDF-scrape PhD program editais')
    parser.add_argument('--limit', type=int, default=None)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--workers', type=int, default=3)
    args = parser.parse_args()

    programs = json.load(open(PROGRAMS_FILE, 'r', encoding='utf-8'))

    targets = []
    for r in programs:
        region_name = r.get('name', '')
        for state in r.get('states', []):
            state_name = state.get('name', '')
            for uni in state.get('universities', []):
                acro = uni.get('acronym', '') or ''
                uni_name = uni.get('name', '')
                for prog in uni.get('programs', []):
                    if prog.get('level') != 'Doutorado':
                        continue
                    url = (prog.get('url') or '').strip()
                    if url:
                        targets.append({
                            'acronym': acro,
                            'program_name': prog.get('program', ''),
                            'url': url,
                            'university_name': uni_name,
                            'region': region_name,
                            'state': state_name,
                        })

    if args.limit:
        targets = targets[:args.limit]

    print(f'Found {len(targets)} Doutorado programs to scan for editais')
    print()

    if args.dry_run:
        print('Dry run — would scan:')
        for t in targets:
            print(f'  [{t["acronym"]}] {t["program_name"][:60]}')
            print(f'    {t["url"]}')
        return

    results = {}
    scanned = 0
    start_time = time.time()
    checkpoint_interval = max(10, len(targets) // 10)

    def process_one(t):
        nonlocal scanned
        scanned += 1
        idx = scanned

        t0 = time.time()
        try:
            res = scrape_program_for_editais(t['url'])
            elapsed = time.time() - t0
        except Exception as e:
            res = {
                'status': 'error',
                'error': f'python_exception: {e}',
                'last_checked': datetime.now(timezone.utc).isoformat(),
                'program_url': t['url'],
            }
            elapsed = time.time() - t0

        res['acronym'] = t['acronym']
        res['program_name'] = t['program_name']
        res['university_name'] = t['university_name']
        res['region'] = t['region']
        res['state'] = t['state']
        res['elapsed'] = round(elapsed, 1)

        # Summarize
        extras = []
        if res.get('pdfs'):
            extras.append(f'{len(res["pdfs"])} PDFs')
        if res.get('editais'):
            extras.append(f'{len(res["editais"])} links')
        meta_count = sum(1 for v in res.get('metadata', {}).values() if v and v.get('value'))
        if meta_count:
            extras.append(f'{meta_count} meta fields')

        status_icon = {
            'found': 'FOUND',
            'no_editais': 'NONE',
            'no_pdfs': 'NOPDF',
            'pdfs_found_but_no_metadata': 'NOMETA',
            'error': 'ERR',
        }.get(res['status'], '?')

        print(f'  [{idx}/{len(targets)}] {status_icon} {t["acronym"]} - {t["program_name"][:50]}  ({elapsed:.0f}s)')
        if extras:
            print(f'       {", ".join(extras)}')
        if res.get('error'):
            print(f'       Error: {res["error"]}')
        sys.stdout.flush()

        return t['url'], res

    if args.workers > 1:
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = {pool.submit(process_one, t): t for t in targets}
            for f in as_completed(futures):
                url, res = f.result()
                results[url] = res
    else:
        for t in targets:
            url, res = process_one(t)
            results[url] = res
            time.sleep(0.2)

            # Checkpoint save
            if scanned % checkpoint_interval == 0 and scanned < len(targets):
                _save_checkpoint(results, scanned, start_time)

    # Final save
    _save_final(results, start_time)

    # Merge PDF metadata into program-status.json
    _merge_into_status(results)

    # Regenerate frontend data
    print('\n--- Regenerating frontend data ---')
    gen_script = os.path.join(BASE, 'scripts', 'generate-data.py')
    if os.path.exists(gen_script):
        os.system(f'python "{gen_script}"')
    else:
        print(f'WARNING: {gen_script} not found')

    print('\nDone!')


def _save_checkpoint(results, scanned, start_time):
    elapsed = time.time() - start_time
    print(f'\n  [CHECKPOINT] Scanned {scanned} in {elapsed:.0f}s — saving...')
    _do_save(results, is_temp=True)
    print()


def _save_final(results, start_time):
    elapsed = time.time() - start_time
    print(f'\nFinal save — {len(results)} URLs in {elapsed:.0f}s')
    _do_save(results)


def _do_save(results, is_temp=False):
    os.makedirs(SRC_DATA, exist_ok=True)

    # Statistics
    by_status = {}
    total_pdfs = 0
    total_meta = 0
    for res in results.values():
        s = res.get('status', 'unknown')
        by_status[s] = by_status.get(s, 0) + 1
        total_pdfs += len(res.get('pdfs', []))
        total_meta += sum(1 for v in res.get('metadata', {}).values() if v and v.get('value'))

    output = {
        'last_run': datetime.now(timezone.utc).isoformat(),
        'total_urls': len(results),
        'total_pdfs_found': total_pdfs,
        'total_meta_fields': total_meta,
        'by_status': by_status,
        'programs': results,
    }

    with open(PDF_RESULTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    label = 'Checkpoint' if is_temp else 'Final results'
    print(f'  {label} saved to {PDF_RESULTS_FILE}')
    print(f'  Summary: {json.dumps(by_status)}')


def _merge_into_status(pdf_results):
    """Merge PDF-extracted metadata back into program-status.json."""
    if not os.path.exists(STATUS_FILE):
        print(f'\n  [SKIP] {STATUS_FILE} not found, skipping merge')
        return

    status_data = json.load(open(STATUS_FILE, 'r', encoding='utf-8'))
    programs_status = status_data.get('programs', {})
    merged_count = 0

    for url, res in pdf_results.items():
        meta = res.get('metadata')
        if not meta:
            continue

        if url not in programs_status:
            programs_status[url] = {
                'status': 'unknown',
                'confidence': 0,
                'last_checked': datetime.now(timezone.utc).isoformat(),
            }

        pdf_info = {
            'pdf_source': res.get('metadata_source'),
            'pdf_status': res.get('status'),
            'pdf_pdfs_found': len(res.get('pdfs', [])),
        }

        existing_meta = programs_status[url].get('metadata', {})
        if not existing_meta:
            programs_status[url]['metadata'] = {}
            existing_meta = programs_status[url]['metadata']

        for field_name, field_data in meta.items():
            if field_data and field_data.get('value'):
                existing_meta[field_name] = field_data

        existing_meta['_pdf_source'] = pdf_info['pdf_source']
        programs_status[url]['metadata'] = existing_meta
        programs_status[url]['last_checked'] = datetime.now(timezone.utc).isoformat()
        merged_count += 1

    by_status = {}
    for v in programs_status.values():
        s = v.get('status', 'unknown')
        by_status[s] = by_status.get(s, 0) + 1

    output = {
        'last_run': datetime.now(timezone.utc).isoformat(),
        'total_urls': len(programs_status),
        'by_status': by_status,
        'programs': programs_status,
    }

    with open(STATUS_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f'\n  Merged PDF metadata into {STATUS_FILE} for {merged_count} URLs')


if __name__ == '__main__':
    main()
