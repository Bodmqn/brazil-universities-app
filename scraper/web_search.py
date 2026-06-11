"""
Web search layer for Edital Scanner.
Backends: DuckDuckGo (primary) -> Direct scrape Bing -> Direct scrape Google

Usage from check_editais.py:
  from web_search import web_search_for_editais
  discovered = web_search_for_editais()
"""

import re, time, json, warnings
from datetime import datetime, timezone
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup
from urllib3.exceptions import InsecureRequestWarning

warnings.filterwarnings('ignore', category=InsecureRequestWarning)

SEARCH_QUERIES = [
    # Portuguese
    '"edital mestrado" 2026',
    '"edital seleção mestrado" 2026',
    '"inscrições abertas mestrado" 2026',
    '"processo seletivo mestrado" 2026',
    '"vagas mestrado" 2026',
    '"vagas abertas mestrado" 2026',
    '"pós-graduação inscrições abertas" 2026',
    '"seleção pós-graduação stricto sensu" 2026',
    '"ingresso mestrado" 2026',
    '"edital PPG mestrado" 2026',
    '"chamada pública mestrado" 2026',
    '"chamada para seleção mestrado" 2026',
    '"edital mestrado aberto" 2026',
    '"aberta seleção mestrado" 2026',
    '"candidatos mestrado inscrição" 2026',
    '"turma mestrado" 2026',
    '"prazo inscrição mestrado" 2026',
    '"mestrado profissional inscrições" 2026',
    '"mestrado acadêmico vagas" 2026',
    '"edital CAPES mestrado" 2026',
    '"SIGAA processo seletivo mestrado" 2026',
    '"pró-reitoria pós-graduação edital" 2026',
    '"universidade federal mestrado inscrições" 2026',
    # English
    '"masters admission Brazil" open 2026',
    '"call for applications" masters Brazil 2026',
    '"open for applications" masters Brazil 2026',
    '"Brazil university masters admissions" 2026',
    '"graduate programme applications open" Brazil',
    '"Brazil masters degree application deadline" 2026',
    '"apply for masters in Brazil" 2026',
    '"Brazilian university graduate enrollment" open',
    '"mestrado selection process" English',
    '"Brazil postgraduate admission notice" 2026',
    '"open call masters program" Brazil',
    '"vacancies masters Brazil university" 2026',
    '"Brazil federal university masters intake" 2026',
    '"now accepting masters applications" Brazil 2026',
    # Mixed
    '"edital mestrado open" 2026',
    '"inscrições abertas" masters Brazil 2026',
    '"mestrado admission open" Brazil 2026',
    '"pós-graduação" masters application Brazil 2026',
    '"processo seletivo" masters 2026',
    '"Brazil mestrado call for applications" 2026',
    # University-specific
    '"USP mestrado inscrições abertas" 2026',
    '"UFRJ edital seleção mestrado" 2026',
    '"UNICAMP processo seletivo pós-graduação" 2026',
    '"UnB mestrado vagas abertas" 2026',
    '"UNESP edital mestrado inscrições" 2026',
    '"UFMG seleção mestrado" 2026',
]

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
})
TIMEOUT = 6


def normalize_url(url):
    if not url:
        return None
    url = url.strip()
    if url.startswith('http://') or url.startswith('https://'):
        return url
    return f'https://{url}'


def is_likely_academic(url):
    url_lower = url.lower()
    edu_domains = ['.edu.', '.edu.br', 'capes.', 'gov.br']
    return any(d in url_lower for d in edu_domains)


def score_page(html):
    if not html:
        return {'status': 'unknown', 'confidence': 0, 'keywords_found': [], 'dates_found': [], 'title': ''}

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


def fetch_page(url):
    try:
        resp = SESSION.get(url, timeout=TIMEOUT, allow_redirects=True)
        resp.raise_for_status()
        return resp.text, None
    except Exception as e:
        return None, str(e)[:60]


def collect_urls_from_results(results, known_urls):
    collected = []
    for url, title, snippet in results:
        url = normalize_url(url)
        if not url:
            continue
        if url in known_urls:
            continue
        known_urls.add(url)
        collected.append({'url': url, 'title': title, 'snippet': snippet})
    return collected


def search_duckduckgo(query, known_urls):
    try:
        from duckduckgo_search import DDGS
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=15):
                results.append((r.get('href', ''), r.get('title', ''), r.get('body', '')))
        time.sleep(1)
        return collect_urls_from_results(results, known_urls)
    except Exception as e:
        print(f'    [DDG] error: {e}')
        return []


def scrape_bing(query, known_urls):
    try:
        url = f'https://www.bing.com/search?q={quote(query)}&count=15'
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36'}
        resp = requests.get(url, headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'lxml')
        results = []
        for li in soup.select('li.b_algo'):
            a = li.find('a')
            p = li.find('p')
            if a and a.get('href'):
                href = a['href']
                title = a.get_text(strip=True)
                snippet = p.get_text(strip=True) if p else ''
                results.append((href, title, snippet))
        time.sleep(1.5)
        out = collect_urls_from_results(results, known_urls)
        print(f'    [Bing] scraped {len(out)} results')
        return out
    except Exception as e:
        print(f'    [Bing] scrape error: {e}')
        return []


def scrape_google(query, known_urls):
    try:
        url = f'https://www.google.com/search?q={quote(query)}&num=15&hl=pt-BR'
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        }
        resp = requests.get(url, headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'lxml')
        results = []
        for g in soup.select('div.g'):
            a = g.select_one('a[href^="http"]')
            h3 = g.select_one('h3')
            span = g.select_one('div.VwiC3b, span.st')
            if a and a.get('href'):
                href = a['href']
                title = h3.get_text(strip=True) if h3 else ''
                snippet = span.get_text(strip=True) if span else ''
                if not title and not snippet:
                    continue
                results.append((href, title, snippet))
        time.sleep(2.5)
        out = collect_urls_from_results(results, known_urls)
        print(f'    [Google] scraped {len(out)} results')
        return out
    except Exception as e:
        print(f'    [Google] scrape error: {e}')
        return []


def web_search_for_editais(programs=None, limit_queries=None):
    print('\n=== Web Search for Open Calls ===')

    known_urls = set()
    if programs:
        for region in programs:
            for state in region.get('states', []):
                for uni in state.get('universities', []):
                    for prog in uni.get('programs', []):
                        url = normalize_url(prog.get('url', ''))
                        if url:
                            known_urls.add(url)

    print(f'  Known program URLs: {len(known_urls)}')
    print(f'  Running {len(SEARCH_QUERIES)} queries...\n')

    all_discovered = {}
    queries_to_run = SEARCH_QUERIES[:limit_queries] if limit_queries else SEARCH_QUERIES

    for i, query in enumerate(queries_to_run, 1):
        print(f'  [{i}/{len(queries_to_run)}] Search: {query}')

        discovered = []

        urls = search_duckduckgo(query, known_urls)
        discovered.extend(urls)
        print(f'    [DDG] total: {len(urls)}')

        if len(discovered) < 5:
            urls = scrape_bing(query, known_urls)
            discovered.extend(urls)

        if len(discovered) < 3:
            urls = scrape_google(query, known_urls)
            discovered.extend(urls)

        for item in discovered:
            url = item['url']
            print(f'    Fetching: {url[:80]}...')
            html, err = fetch_page(url)
            if err:
                all_discovered[url] = {
                    'status': 'error',
                    'error': err,
                    'source': 'web_search',
                    'query_used': query,
                    'title': item.get('title', ''),
                    'snippet': item.get('snippet', ''),
                    'last_checked': datetime.now(timezone.utc).isoformat(),
                }
                print(f'      -> error: {err}')
                continue

            score = score_page(html)
            all_discovered[url] = {
                'status': score['status'],
                'confidence': score['confidence'],
                'keywords_found': score['keywords_found'],
                'dates_found': score['dates_found'],
                'title': score['title'],
                'snippet': item.get('snippet', ''),
                'source': 'web_search',
                'query_used': query,
                'last_checked': datetime.now(timezone.utc).isoformat(),
            }
            icon = {'likely_open': 'OPEN', 'possible': 'MAYBE', 'unknown': '?'}.get(score['status'], '?')
            print(f'      -> [{icon}] {score["status"]} (conf: {score["confidence"]})')

        print()

    print(f'\n  Web search complete. Found {len(all_discovered)} new URLs.')
    by_status = {}
    for v in all_discovered.values():
        s = v.get('status', 'unknown')
        by_status[s] = by_status.get(s, 0) + 1
    print(f'  Results: {json.dumps(by_status)}')

    return all_discovered


if __name__ == '__main__':
    discovered = web_search_for_editais(limit_queries=2)
