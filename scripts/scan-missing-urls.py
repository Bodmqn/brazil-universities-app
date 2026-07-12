"""
Scan only URLs not yet tracked in program-status.json and merge results.
"""
import json, sys, os, time, re, warnings
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from urllib3.exceptions import InsecureRequestWarning
warnings.filterwarnings('ignore', category=InsecureRequestWarning)

BASE = Path(__file__).resolve().parent.parent
SRC_DATA = BASE / "src" / "assets" / "data"
STATUS_FILE = SRC_DATA / "program-status.json"
PROGRAMS_FILE = SRC_DATA / "programs.json"

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
TIMEOUT = 6
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


def main():
    with open(PROGRAMS_FILE, 'r', encoding='utf-8') as f:
        all_programs = json.load(f)
    with open(STATUS_FILE, 'r', encoding='utf-8') as f:
        status_data = json.load(f)

    existing = status_data.get('programs', {})
    tracked_urls = set(existing.keys())

    all_urls = set()
    url_to_progs = {}
    for region in all_programs:
        for state in region.get('states', []):
            for uni in state.get('universities', []):
                for prog in uni.get('programs', []):
                    url = normalize_url(prog.get('url', ''))
                    if url:
                        all_urls.add(url)
                        if url not in url_to_progs:
                            url_to_progs[url] = []
                        url_to_progs[url].append(f"{uni.get('acronym','')} - {prog.get('program','')}")

    missing = all_urls - tracked_urls
    print(f"All unique URLs in programs.json: {len(all_urls)}")
    print(f"Already tracked in program-status.json: {len(tracked_urls)}")
    print(f"Missing URLs to scan: {len(missing)}")

    if not missing:
        print("Nothing to scan.")
        sys.exit(0)

    new_results = {}
    scanned = 0
    for url in sorted(missing):
        scanned += 1
        label = url_to_progs.get(url, [url])
        print(f"  [{scanned}/{len(missing)}] {label[0][:60]}")

        html, error = fetch_page(url)
        if error:
            new_results[url] = {
                'status': 'error',
                'error': error,
                'last_checked': datetime.now(timezone.utc).isoformat(),
            }
            print(f"    -> ERROR: {error}")
        else:
            score = score_page(html, url)
            new_results[url] = {
                **score,
                'last_checked': datetime.now(timezone.utc).isoformat(),
            }
            icon = {'likely_open': 'OPEN', 'possible': 'MAYBE', 'unknown': '?'}.get(score['status'], '?')
            print(f"    -> [{icon}] {score['status']} (conf: {score['confidence']})")

        time.sleep(0.3)

    # Merge into existing
    existing.update(new_results)
    by_status = {}
    for v in existing.values():
        s = v.get('status', 'unknown')
        by_status[s] = by_status.get(s, 0) + 1

    output = {
        'last_run': datetime.now(timezone.utc).isoformat(),
        'total_urls': len(existing),
        'by_status': by_status,
        'programs': existing,
    }

    with open(STATUS_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nMerged {len(new_results)} new results into {STATUS_FILE}")
    print(f"Updated by_status: {json.dumps(by_status, indent=2)}")


if __name__ == '__main__':
    main()
