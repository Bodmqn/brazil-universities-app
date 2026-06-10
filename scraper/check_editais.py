"""
Brazilian Universities - Edital Scanner
Visits program websites and checks for open calls (Editais Abertos).

Usage:
  python scraper/check_editais.py                    # scan all programs
  python scraper/check_editais.py --limit 10          # scan first 10
  python scraper/check_editais.py --sample            # scan first 5
  python scraper/check_editais.py --url "https://..." # scan one URL
"""

import json, re, sys, os, time, warnings, signal
from datetime import datetime, timezone
from pathlib import Path

signal_results = None

import requests
from bs4 import BeautifulSoup
from urllib3.exceptions import InsecureRequestWarning
warnings.filterwarnings('ignore', category=InsecureRequestWarning)

DATA_DIR = Path(__file__).resolve().parent.parent / "src" / "assets" / "data"
PROGRAMS_FILE = DATA_DIR / "programs.json"
STATUS_FILE = DATA_DIR / "program-status.json"

STRONG_KEYWORDS = [
    r'edital\s+aberto',
    r'inscri[cç][oõ]es\s+abertas',
    r'processo\s+seletivo\s*aberto',
    r'vagas\s+abertas',
    r'inscreva-se',
    r'inscri[cç][aã]o\s+aberta',
    r'sele[cç][aã]o\s+aberta',
    r'editais?\s+abertos?',
    r'candidaturas?\s+abertas?',
    r'call\s+for\s+applications',
    r'apply\s+now',
    r'open\s+calls?',
]

MEDIUM_KEYWORDS = [
    r'edital',
    r'processo\s+seletivo',
    r'sele[cç][aã]o',
    r'inscri[cç][aã]o',
    r'mestrado',
    r'doutorado',
    r'p[sβ][-]gradua[cç][aã]o',
    r'vagas?',
    r'calend[aá]rio',
    r'cronograma',
    r'resultado',
    r'homologa[cç][aã]o',
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
    'Accept-Encoding': 'gzip, deflate',
})
TIMEOUT = 4
MAX_RETRIES = 1


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
        return {'status': 'error', 'confidence': 0, 'keywords': []}

    soup = BeautifulSoup(html, 'lxml')

    texts = []
    if soup.title:
        texts.append(soup.title.get_text(strip=True))
    for tag in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
        texts.append(tag.get_text(strip=True))
    for tag in soup.find_all(['p', 'li', 'a', 'span', 'div']):
        texts.append(tag.get_text(strip=True))

    full_text = ' '.join(texts).lower()

    strong_found = []
    for pattern in STRONG_KEYWORDS:
        if re.search(pattern, full_text):
            strong_found.append(pattern)

    medium_found = []
    for pattern in MEDIUM_KEYWORDS:
        if re.search(pattern, full_text):
            medium_found.append(pattern)

    dates_found = DATE_PATTERN.findall(full_text)

    confidence = 0
    status = 'unknown'

    if len(strong_found) >= 2:
        confidence = 0.8 + min(len(strong_found) * 0.05, 0.15)
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
        'confidence': round(confidence, 2),
        'keywords_found': strong_found + medium_found[:3],
        'dates_found': [f'{d[0]}/{d[1]}/{d[2]}' for d in dates_found[:5]],
        'title': soup.title.get_text(strip=True)[:120] if soup.title else '',
    }


def scan_programs(programs, url_filter=None, limit=None):
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
                    if url_filter and url_filter not in url:
                        continue

                    seen_urls.add(url)
                    if limit and scanned >= limit:
                        break

                    print(f'  [{scanned + 1}] {uni.get("acronym", "")} - {prog.get("program", "")[:50]}...')
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
                        results[url] = {
                            **score,
                            'last_checked': datetime.now(timezone.utc).isoformat(),
                        }
                        icon = {'likely_open': 'OPEN', 'possible': 'MAYBE', 'unknown': '?', 'error': 'ERR'}.get(
                            score['status'], '?'
                        )
                        print(f'    -> [{icon}] {score["status"]} (conf: {score["confidence"]})')

                    scanned += 1

                    if scanned % 50 == 0:
                        save_status(results, is_temp=True)
                        print(f'  [CHECKPOINT] Saved {len(results)} results so far')

                    time.sleep(0.3)

                if limit and scanned >= limit:
                    break
            if limit and scanned >= limit:
                break
        if limit and scanned >= limit:
            break

    return results


def load_programs():
    if not PROGRAMS_FILE.exists():
        print(f'ERROR: Programs file not found at {PROGRAMS_FILE}')
        print('Run "npm run parse:csv" first.')
        sys.exit(1)

    with open(PROGRAMS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_status(results, is_temp=False, discovered=None):
    STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)

    all_items = dict(results)
    if discovered:
        all_items.update(discovered)

    output = {
        'last_run': datetime.now(timezone.utc).isoformat(),
        'total_urls': len(results),
        'by_status': {},
        'programs': results,
    }

    if discovered:
        output['discovered'] = discovered

    for v in all_items.values():
        s = v.get('status', 'unknown')
        output['by_status'][s] = output['by_status'].get(s, 0) + 1

    with open(STATUS_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    label = 'Checkpoint' if is_temp else 'Final'
    print(f'\n{label} results saved to {STATUS_FILE}')
    print(f'Summary: {json.dumps(output["by_status"], indent=2)}')


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Check program websites for open calls')
    parser.add_argument('--limit', type=int, default=None, help='Max URLs to scan')
    parser.add_argument('--sample', action='store_true', help='Scan just 5 programs')
    parser.add_argument('--url', type=str, default=None, help='Scan a specific URL only')
    parser.add_argument('--skip-web-search', action='store_true', help='Skip web search layer')
    args = parser.parse_args()

    limit = 5 if args.sample else args.limit
    programs = load_programs()

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

    global signal_results
    results = scan_programs(programs, url_filter=args.url, limit=limit)
    signal_results = results

    discovered = None
    if not args.skip_web_search:
        from web_search import web_search_for_editais
        discovered = web_search_for_editais(programs=programs)

    save_status(results, discovered=discovered)


def signal_handler(sig, frame):
    global signal_results
    print('\n\nInterrupted! Saving current results...')
    if signal_results is not None:
        save_status(signal_results, is_temp=True)
    sys.exit(0)


signal.signal(signal.SIGINT, signal_handler)


if __name__ == '__main__':
    main()
