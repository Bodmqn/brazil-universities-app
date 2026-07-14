"""
Standalone scanner - visits program websites, scores for open calls.
Writes to src/assets/data/program-status.json, then regenerates frontend data.

Usage:
  python scripts/scan-programs.py
  python scripts/scan-programs.py --limit 10
  python scripts/scan-programs.py --sample
  python scripts/scan-programs.py --year 2027
"""

import json, re, sys, os, time, warnings
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup
from urllib3.exceptions import InsecureRequestWarning
warnings.filterwarnings('ignore', category=InsecureRequestWarning)

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE, "src", "assets", "data")
PROGRAMS_FILE = os.path.join(DATA_DIR, "programs.json")
STATUS_FILE = os.path.join(DATA_DIR, "program-status.json")

# Deep-scrape metadata extraction
sys.path.insert(0, os.path.join(BASE, "scraper"))
from deep_scraper import extract_metadata

STRONG_KEYWORDS = [
    r'edital\s+aberto',
    r'edital\s+mestrado\s+aberto',
    r'inscri[cç][oõ]es\s+abertas',
    r'processo\s+seletivo\s*aberto',
    r'vagas\s+abertas',
    r'vagas?\s+mestrado\s+20\d{2}',
    r'inscreva-se',
    r'inscri[cç][aã]o\s+aberta',
    r'sele[cç][aã]o\s+aberta',
    r'editais?\s+abertos?',
    r'candidaturas?\s+abertas?',
    r'call\s+for\s+applications',
    r'apply\s+now',
    r'open\s+calls?',
    r'chamada\s+p[uú]blica',
    r'chamada\s+para\s+sele[cç][aã]o',
    r'now\s+accepting\s+applications',
    r'admission\s+open',
    r'enrollment\s+open',
    r'turma\s+mestrado\s+20\d{2}',
    r'ingresso\s+mestrado',
    r'aberta\s+sele[cç][aã]o\s+mestrado',
    r'prazo\s+inscri[cç][aã]o\s+mestrado',
    r'aplicativos?\s+abertos?',
]

MEDIUM_KEYWORDS = [
    r'edital',
    r'edital\s+mestrado',
    r'processo\s+seletivo',
    r'sele[cç][aã]o',
    r'inscri[cç][aã]o',
    r'inscri[cç][oõ]es',
    r'mestrado',
    r'doutorado',
    r'p[sβ][-]gradua[cç][aã]o',
    r'vagas?',
    r'calend[aá]rio',
    r'cronograma',
    r'resultado',
    r'homologa[cç][aã]o',
    r'p[sr][oó]-reitoria\s+p[sβ][-]gradua[cç][aã]o',
    r'sele[cç][aã]o\s+p[sβ][-]gradua[cç][aã]o\s+stricto\s+sensu',
    r'mestrado\s+profissional',
    r'mestrado\s+acad[eê]mico',
    r'sigaa',
    r'capes',
    r'bolsas?',
    r'candidatos?\s+mestrado',
    r'deadline',
    r'intake',
    r'admissions?',
    r'ingresso',
    r'concurso',
    r'resolu[cç][aã]o',
    r'portaria',
    r'regulamento',
    r'abaixo',
    r'anexo',
    r'dispensa\s+de\s+concurso',
    r'exame\s+de\s+qualifica[cç][aã]o',
    r'banca\s+examinadora',
    r'orientador',
    r'projeto\s+de\s+pesquisa',
]

DATE_PATTERN = re.compile(
    r'\b(0?[1-9]|[12]\d|3[01])[/](0?[1-9]|1[0-2])[/](20\d\d|202[4-8])\b'
)

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/125.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
})
TIMEOUT = 8
MAX_RETRIES = 2


def normalize_url(url):
    if not url:
        return None
    url = url.strip()
    if url.startswith('http://') or url.startswith('https://'):
        return url
    return f'https://{url}'


def fetch_page(url):
    for attempt in range(MAX_RETRIES):
        for verify in [True, False]:
            try:
                resp = SESSION.get(url, timeout=TIMEOUT, allow_redirects=True, verify=verify)
                resp.raise_for_status()
                return resp.text, None
            except requests.exceptions.Timeout:
                if attempt == MAX_RETRIES - 1:
                    return None, 'timeout'
                time.sleep(2)
            except requests.exceptions.SSLError:
                if verify:
                    continue
                return None, 'ssl_error'
            except requests.exceptions.HTTPError as e:
                return None, f'http_{e.response.status_code}'
            except requests.exceptions.ConnectionError:
                return None, 'connection_error'
            except requests.exceptions.RequestException as e:
                return None, str(e)[:60]
    return None, 'max_retries'


def score_page(html, url):
    if html is None:
        return {'status': 'error', 'confidence': 0, 'keywords_found': []}

    soup = BeautifulSoup(html, 'lxml')
    texts = []
    if soup.title:
        texts.append(soup.title.get_text(strip=True))
    for tag in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
        texts.append(tag.get_text(strip=True))
    for tag in soup.find_all(['p', 'li', 'a', 'span', 'div']):
        texts.append(tag.get_text(strip=True))

    full_text = ' '.join(texts).lower()

    strong_found = [p for p in STRONG_KEYWORDS if re.search(p, full_text)]
    medium_found = [p for p in MEDIUM_KEYWORDS if re.search(p, full_text)]
    dates_found = DATE_PATTERN.findall(full_text)

    if len(strong_found) >= 2:
        confidence = round(0.8 + min(len(strong_found) * 0.05, 0.15), 2)
        status = 'likely_open'
    elif len(strong_found) == 1:
        confidence = 0.6
        status = 'likely_open'
    elif len(medium_found) >= 3:
        confidence = 0.4
        status = 'possible'
    elif len(medium_found) >= 1:
        confidence = 0.2
        status = 'possible'
    else:
        confidence = 0.05
        status = 'unknown'

    return {
        'status': status,
        'confidence': confidence,
        'keywords_found': strong_found + medium_found[:3],
        'dates_found': [f'{d[0]}/{d[1]}/{d[2]}' for d in dates_found[:5]],
        'title': soup.title.get_text(strip=True)[:120] if soup.title else '',
    }


def clean_spa_url(url):
    if not url:
        return None
    cleaned = re.sub(r'#!/.*$', '', url)
    if cleaned != url and cleaned.startswith('http'):
        return cleaned
    return None


def scan_programs(programs, limit=None):
    results = {}
    seen_urls = set()
    scanned = 0

    for region in programs:
        for state in region.get('states', []):
            for uni in state.get('universities', []):
                for prog in uni.get('programs', []):
                    url = normalize_url(prog.get('url', ''))
                    if not url or url in seen_urls:
                        continue
                    seen_urls.add(url)
                    if limit and scanned >= limit:
                        break

                    acronym = uni.get('acronym', '')
                    pname = prog.get('program', '')[:50]
                    print(f'  [{scanned + 1}] {acronym} - {pname}...')

                    html, error = fetch_page(url)
                    if error:
                        results[url] = {
                            'status': 'error',
                            'error': error,
                            'last_checked': datetime.now(timezone.utc).isoformat(),
                        }
                        print(f'    -> ERROR: {error}')
                    else:
                        score = score_page(html, url)

                        if score['status'] == 'unknown' and '#!' in url:
                            cleaned = clean_spa_url(url)
                            if cleaned:
                                print(f'    -> SPA detected, retrying clean URL: {cleaned}')
                                html2, err2 = fetch_page(cleaned)
                                if not err2:
                                    score2 = score_page(html2, cleaned)
                                    if score2['status'] != 'unknown':
                                        score = score2
                                        print(f'    -> CLEAN URL gave: {score2["status"]} (conf: {score2["confidence"]})')

                        soup = BeautifulSoup(html, 'lxml')
                        meta = extract_metadata(soup)
                        results[url] = {
                            **score,
                            'metadata': meta,
                            'last_checked': datetime.now(timezone.utc).isoformat(),
                        }
                        icon = {'likely_open': 'OPEN', 'possible': 'MAYBE', 'unknown': '?', 'error': 'ERR'}.get(
                            score['status'], '?'
                        )
                        extracted = sum(1 for v in meta.values() if v['value'] is not None)
                        print(f'    -> [{icon}] {score["status"]} (conf: {score["confidence"]}) | meta: {extracted}/5')

                    scanned += 1
                    if scanned % 50 == 0:
                        print(f'  [CHECKPOINT] {len(results)} results so far')
                    time.sleep(0.3)

                if limit and scanned >= limit:
                    break
            if limit and scanned >= limit:
                break
        if limit and scanned >= limit:
            break

    return results


def save_status(results):
    os.makedirs(DATA_DIR, exist_ok=True)
    by_status = {}
    for v in results.values():
        s = v.get('status', 'unknown')
        by_status[s] = by_status.get(s, 0) + 1

    output = {
        'last_run': datetime.now(timezone.utc).isoformat(),
        'total_urls': len(results),
        'by_status': by_status,
        'programs': results,
    }

    with open(STATUS_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f'\nResults saved to {STATUS_FILE}')
    print(f'Summary: {json.dumps(by_status, indent=2)}')


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Scan program websites for open calls')
    parser.add_argument('--limit', type=int, default=None, help='Max URLs to scan')
    parser.add_argument('--sample', action='store_true', help='Scan just 5 programs')
    parser.add_argument('--year', type=str, default='2026', help='Year filter (unused in scan, for compatibility)')
    args = parser.parse_args()

    limit = 5 if args.sample else args.limit

    if not os.path.exists(PROGRAMS_FILE):
        print(f'ERROR: Programs file not found at {PROGRAMS_FILE}')
        sys.exit(1)

    with open(PROGRAMS_FILE, 'r', encoding='utf-8') as f:
        programs = json.load(f)

    total_urls = sum(
        1
        for r in programs
        for s in r.get('states', [])
        for u in s.get('universities', [])
        for p in u.get('programs', [])
        if normalize_url(p.get('url', ''))
    )
    print(f'Loaded {len(programs)} regions, {total_urls} unique URLs')
    print(f'Scanning{"" if not limit else f" (limit: {limit})"}...\n')

    results = scan_programs(programs, limit=limit)
    save_status(results)

    # Regenerate frontend data files
    print('\n--- Regenerating frontend data ---')
    generate_script = os.path.join(BASE, 'scripts', 'generate-data.py')
    if os.path.exists(generate_script):
        os.system(f'python "{generate_script}"')
    else:
        print(f'WARNING: {generate_script} not found, skipping frontend data regeneration')


if __name__ == '__main__':
    main()
