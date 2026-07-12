"""
Targeted deep-scrape script for PhD (Doutorado) program pages.
Visits each PhD program URL, extracts metadata (campus, duration, start date,
language requirement, master prerequisite), and writes results to
program-status.json alongside existing scan data.

Usage:
  python scripts/deep-scrape-phd.py
  python scripts/deep-scrape-phd.py --limit 10
  python scripts/deep-scrape-phd.py --dry-run
"""

import json, os, sys, time, warnings
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup
from urllib3.exceptions import InsecureRequestWarning
warnings.filterwarnings('ignore', category=InsecureRequestWarning)

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scraper"))
from deep_scraper import extract_metadata

SRC_DATA = os.path.join(BASE, "src", "assets", "data")
PROGRAMS_FILE = os.path.join(SRC_DATA, "programs.json")
STATUS_FILE = os.path.join(SRC_DATA, "program-status.json")

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
})
TIMEOUT = 8


def fetch(url):
    for verify in [True, False]:
        try:
            r = SESSION.get(url, timeout=TIMEOUT, allow_redirects=True, verify=verify)
            r.raise_for_status()
            return r.text, None
        except requests.Timeout:
            return None, 'timeout'
        except requests.SSLError:
            if verify:
                continue
            return None, 'ssl_error'
        except requests.HTTPError as e:
            return None, f'http_{e.response.status_code}'
        except requests.ConnectionError:
            return None, 'connection_error'
        except requests.RequestException as e:
            return None, str(e)[:60]
    return None, 'max_retries'


def deep_scrape_url(url):
    html, error = fetch(url)
    if error or not html:
        return None, error
    soup = BeautifulSoup(html, 'lxml')
    meta = extract_metadata(soup)
    return meta, None


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Deep-scrape PhD program pages')
    parser.add_argument('--limit', type=int, default=None)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--workers', type=int, default=5)
    args = parser.parse_args()

    programs = json.load(open(PROGRAMS_FILE, 'r', encoding='utf-8'))

    # Collect all PhD (Doutorado) program URLs
    targets = []
    for region in programs:
        for state in region.get('states', []):
            for uni in state.get('universities', []):
                acro = uni.get('acronym', '') or ''
                for prog in uni.get('programs', []):
                    if prog.get('level') != 'Doutorado':
                        continue
                    url = (prog.get('url') or '').strip()
                    if url:
                        targets.append({
                            'acronym': acro,
                            'name': prog.get('program', ''),
                            'url': url,
                            'university_name': uni.get('name', ''),
                        })

    if args.limit:
        targets = targets[:args.limit]

    print(f'Found {len(targets)} Doutorado programs to scan')

    if args.dry_run:
        print('\nDry run — would scan:')
        for t in targets:
            print(f'  [{t["acronym"]}] {t["name"][:60]}')
            print(f'    {t["url"]}')
        return

    # Load existing status
    status_data = {}
    if os.path.exists(STATUS_FILE):
        status_data = json.load(open(STATUS_FILE, 'r', encoding='utf-8'))
    programs_status = status_data.get('programs', {})

    results = {}
    scanned = 0

    def process_one(t):
        nonlocal scanned
        meta, error = deep_scrape_url(t['url'])
        scanned += 1
        extracted = sum(1 for v in meta.values() if v and v.get('value')) if meta else 0
        print(f'  [{scanned}] {t["acronym"]} - {t["name"][:50]}')
        if error:
            print(f'    -> ERROR: {error}')
        elif meta:
            fields = []
            for k, v in meta.items():
                if v and v.get('value'):
                    fields.append(f'{k}={v["value"][:30]}')
            print(f'    -> extracted {extracted}/5: {", ".join(fields)}')
        return t['url'], meta, error

    if args.workers > 1:
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = {pool.submit(process_one, t): t for t in targets}
            for f in as_completed(futures):
                url, meta, error = f.result()
                results[url] = meta
    else:
        for t in targets:
            url, meta, error = process_one(t)
            results[url] = meta
            time.sleep(0.3)

    # Merge results into existing status
    updated_count = 0
    for url, meta in results.items():
        if meta is None:
            # Page fetch failed
            if url not in programs_status:
                programs_status[url] = {
                    'status': 'error',
                    'last_checked': datetime.now(timezone.utc).isoformat(),
                }
            else:
                programs_status[url]['last_checked'] = datetime.now(timezone.utc).isoformat()
            continue

        if url not in programs_status:
            programs_status[url] = {
                'status': 'unknown',
                'confidence': 0,
                'last_checked': datetime.now(timezone.utc).isoformat(),
            }
        else:
            programs_status[url]['last_checked'] = datetime.now(timezone.utc).isoformat()

        programs_status[url]['metadata'] = meta
        updated_count += 1

    # Update by_status counts
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

    total_extracted = sum(
        1 for v in results.values() if v
        for fv in v.values() if fv and fv.get('value')
    )
    print(f'\nDone. Updated {updated_count} URLs with metadata.')
    print(f'Total metadata fields extracted: {total_extracted}')
    print(f'Results saved to {STATUS_FILE}')

    # Now regenerate frontend data
    print('\n--- Regenerating frontend data ---')
    gen_script = os.path.join(BASE, 'scripts', 'generate-data.py')
    if os.path.exists(gen_script):
        os.system(f'python "{gen_script}"')
    else:
        print(f'WARNING: {gen_script} not found')


if __name__ == '__main__':
    main()
