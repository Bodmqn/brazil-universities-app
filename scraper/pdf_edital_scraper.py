"""
PDF Edital Scraper for Brazilian graduate programs.
Visits program pages, follows edital/selection links, downloads PDFs,
extracts text with PyMuPDF, and applies metadata patterns.

Usage:
  from pdf_edital_scraper import scrape_program_for_editais
  result = scrape_program_for_editais("https://www.ufac.br/...")
"""

import re, time, io, json, warnings
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from urllib3.exceptions import InsecureRequestWarning
warnings.filterwarnings('ignore', category=InsecureRequestWarning)

# Try importing PyMuPDF
try:
    import fitz
    HAS_PDF_SUPPORT = True
except ImportError:
    HAS_PDF_SUPPORT = False

try:
    from deep_scraper import FIELDS
except ImportError:
    from scraper.deep_scraper import FIELDS

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) '
                  'Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
})
TIMEOUT = 8
MAX_RETRIES = 1

# Edital/selection link keywords
EDITAL_KEYWORDS = [
    'edital', 'processo seletivo', 'seleção', 'selecao', 'inscrição', 'inscricao',
    'inscrições', 'inscricoes', 'calendário', 'calendario', 'cronograma',
    'ingresso', 'admissão', 'admissao', 'chamada pública', 'chamada publica',
    'open call', 'call for', 'admission', 'enrollment',
]

# PDF filename keywords (to identify the main edital PDF vs resultados/adendos)
MAIN_EDITAL_KEYWORDS = ['edital', 'processo', 'seletivo', 'mestrado', 'doutorado', 'turma']
RESULT_KEYWORDS = ['resultado', 'classificação', 'classificacao', 'convocação', 'convocacao',
                   'gabarito', 'homologação', 'homologacao', 'adendo', 'lista']

# Year pattern for finding current editais
YEAR_PATTERN = re.compile(r'(202[4-8])')


def _fetch_page(url):
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


def _resolve_url(base, href):
    if not href or href.startswith('#') or href.startswith('javascript') or href.startswith('mailto'):
        return None
    return urljoin(base, href)


def _has_edital_keyword(text):
    text_lower = text.lower()
    for kw in EDITAL_KEYWORDS:
        if kw in text_lower:
            return True
    return False


def _extract_metadata_from_text(full_text):
    """Apply deep_scraper patterns to raw text (instead of BeautifulSoup tags)."""
    # Normalize whitespace: replace newlines and multiple spaces with single space
    clean = re.sub(r'\s+', ' ', full_text)

    results = {}
    for field_name, field_def in FIELDS.items():
        best = {'value': None, 'confidence': 0.0, 'source': None}
        for pattern, confidence in field_def['patterns']:
            for m in re.finditer(pattern, clean, re.IGNORECASE):
                captured = m.group(0).strip()[:200]
                if m.lastindex and m.lastindex >= 1:
                    if m.lastindex >= 2 and m.group(2):
                        value = '%s - %s' % (m.group(1).strip(), m.group(2).strip())
                    else:
                        value = m.group(1).strip()
                else:
                    value = captured
                if field_name == 'campus' and len(value) > 60:
                    value = value[:60]
                if confidence > best['confidence']:
                    best = {
                        'value': value,
                        'confidence': round(confidence, 2),
                        'source': pattern,
                    }
        results[field_name] = best
    return results


def find_edital_links_on_page(url, html):
    """Find all links on a page that contain edital/selection keywords."""
    soup = BeautifulSoup(html, 'lxml')
    links = []
    seen_hrefs = set()

    for a in soup.find_all('a', href=True):
        text = a.get_text(strip=True)
        href = a['href']
        abs_url = _resolve_url(url, href)
        if not abs_url or abs_url in seen_hrefs:
            continue
        seen_hrefs.add(abs_url)

        combined = f"{text} {abs_url}".lower()
        if _has_edital_keyword(combined):
            is_pdf = '.pdf' in abs_url.lower()
            has_year = bool(YEAR_PATTERN.search(combined))

            # Detect if this is a result/classificação page (usually not the main edital)
            is_result = any(kw in combined for kw in RESULT_KEYWORDS)

            # Score: prefer links with current year and strong keywords
            score = 0
            if 'edital' in combined:
                score += 4
            if 'processo seletivo' in combined:
                score += 3
            if has_year:
                score += 2
            if 'inscri' in combined and 'resultado' not in combined and 'classifica' not in combined:
                score += 1
            if 'mestrado' in combined or 'doutorado' in combined or 'pós-gradua' in combined or 'pos-gradua' in combined:
                score += 1
            if 'calendário' in combined or 'calendario' in combined or 'cronograma' in combined:
                score += 1
            if 'bolsista' in combined or 'bolsistas' in combined:
                score -= 2
            if is_result:
                score -= 3
            # Strong signal: "todas as publicações" or "publicações oficiais" means master edital page
            if 'todas as publica' in combined or 'publica' in combined:
                score += 3
            if '2026' in combined:
                score += 2
            # Prefer menu/navigation links for the main selection page
            if a.find_parent('nav') or a.find_parent('ul', class_=re.compile(r'(nav|menu|list)', re.I)):
                score += 1

            links.append({
                'text': text[:200],
                'url': abs_url,
                'is_pdf': is_pdf,
                'score': score,
            })

    return links


def find_pdfs_on_page(url, html):
    """Find all PDF links on a page."""
    soup = BeautifulSoup(html, 'lxml')
    pdfs = []
    seen_hrefs = set()

    for a in soup.find_all('a', href=True):
        href = a['href']
        if '.pdf' not in href.lower():
            continue
        abs_url = _resolve_url(url, href)
        if not abs_url or abs_url in seen_hrefs:
            continue
        seen_hrefs.add(abs_url)

        text = a.get_text(strip=True)[:200]
        combined = f"{text} {abs_url}".lower()

        # Classify the PDF
        is_main = any(kw in combined for kw in MAIN_EDITAL_KEYWORDS)
        is_result = any(kw in combined for kw in RESULT_KEYWORDS)
        has_year = bool(YEAR_PATTERN.search(combined))

        # Score: prefer main edital PDFs with current year
        score = 0
        if is_main:
            score += 3
        if has_year:
            score += 2
        if 'mestrado' in combined or 'doutorado' in combined:
            score += 1
        if '2026' in combined:
            score += 1
        if is_result:
            score -= 2  # De-prioritize result/adendo PDFs

        pdfs.append({
            'text': text,
            'url': abs_url,
            'is_main': is_main,
            'score': score,
        })

    return pdfs


def download_and_parse_pdf(pdf_url):
    """Download a PDF and extract text content."""
    if not HAS_PDF_SUPPORT:
        return None, 'PyMuPDF not installed'

    for verify in [True, False]:
        try:
            resp = SESSION.get(pdf_url, timeout=TIMEOUT, allow_redirects=True, verify=verify)
            resp.raise_for_status()
            content = resp.content
            break
        except Exception:
            if verify:
                continue
            return None, 'download_failed'
    else:
        return None, 'download_failed'

    try:
        doc = fitz.open('pdf', content)
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        full_text = '\n'.join(text_parts)
        return full_text, None
    except Exception as e:
        return None, f'pdf_parse_error: {e}'


def scrape_program_for_editais(program_url, max_pdfs=5, follow_depth=4):
    """
    Main function: given a program URL, find and scrape edital PDFs.

    Returns dict with:
      - 'status': 'found' | 'no_editais' | 'error'
      - 'editais': list of discovered edital pages
      - 'pdfs': list of discovered PDFs
      - 'metadata': extracted metadata from best PDF
      - 'error': error message if any
    """
    result = {
        'program_url': program_url,
        'status': 'unknown',
        'editais': [],
        'pdfs': [],
        'metadata': {},
        'metadata_source': None,
        'error': None,
        'last_checked': datetime.now(timezone.utc).isoformat(),
    }

    # Step 1: Check if URL itself is a PDF
    if '.pdf' in program_url.lower():
        text, err = download_and_parse_pdf(program_url)
        if err:
            result['status'] = 'error'
            result['error'] = err
            return result
        result['status'] = 'found'
        result['metadata'] = _extract_metadata_from_text(text)
        result['metadata_source'] = program_url
        result['pdfs'].append({'url': program_url, 'source': 'direct_pdf'})
        return result

    # Step 2: Fetch program page
    html, err = _fetch_page(program_url)
    if err:
        result['status'] = 'error'
        result['error'] = f'fetch_error: {err}'
        return result

    # Step 3: Find edital links
    edital_links = find_edital_links_on_page(program_url, html)
    result['editais'] = edital_links

    if not edital_links:
        # No edital links found on the program page
        result['status'] = 'no_editais'
        return result

    # Step 4: Follow edital links to find PDFs
    all_pdfs = []
    checked_urls = set()

    # Sort by score descending
    edital_links.sort(key=lambda x: x['score'], reverse=True)

    for edital in edital_links[:follow_depth]:
        edital_url = edital['url']

        if edital_url in checked_urls:
            continue
        checked_urls.add(edital_url)

        if edital['is_pdf']:
            all_pdfs.append({
                'url': edital_url,
                'text': edital['text'],
                'score': edital['score'],
            })
            continue

        # Fetch the edital page
        edital_html, fetch_err = _fetch_page(edital_url)
        if fetch_err:
            continue

        # Find PDFs on this page
        pdfs = find_pdfs_on_page(edital_url, edital_html)
        all_pdfs.extend(pdfs)

        # If we already found PDFs, skip recursion (this page has direct PDF links)
        if pdfs:
            continue

        # If the page is very large (>150KB or >500 links), it's likely a portal
        # aggregating many editais; skip deep recursion
        est_links = edital_html.count('<a ')
        if est_links > 200 or len(edital_html) > 150000:
            continue

        # Recursively follow sub-editais only if no PDFs found directly
        sub_editais = find_edital_links_on_page(edital_url, edital_html)
        for sub in sub_editais[:2]:  # Limit sub-editais to max 2
            if sub['url'] in checked_urls:
                continue
            checked_urls.add(sub['url'])

            if sub['is_pdf']:
                all_pdfs.append({
                    'url': sub['url'],
                    'text': sub['text'],
                    'score': sub['score'],
                })
                continue

            # One more level
            sub_html, sub_err = _fetch_page(sub['url'])
            if sub_err:
                continue
            sub_pdfs = find_pdfs_on_page(sub['url'], sub_html)
            all_pdfs.extend(sub_pdfs)

    result['pdfs'] = all_pdfs

    if not all_pdfs:
        result['status'] = 'no_pdfs'
        return result

    # Step 5: Sort PDFs by score and try to parse the best ones
    all_pdfs.sort(key=lambda x: x['score'], reverse=True)
    best_pdfs = all_pdfs[:max_pdfs]

    best_metadata = None
    best_meta_source = None
    best_meta_fields = 0

    for pdf in best_pdfs:
        text, err = download_and_parse_pdf(pdf['url'])
        if err or not text:
            continue

        metadata = _extract_metadata_from_text(text)

        # Count non-null fields
        fields_found = sum(1 for v in metadata.values() if v['value'] is not None)

        if fields_found > best_meta_fields:
            best_metadata = metadata
            best_meta_source = pdf['url']
            best_meta_fields = fields_found

    if best_metadata:
        result['status'] = 'found'
        result['metadata'] = best_metadata
        result['metadata_source'] = best_meta_source
    else:
        result['status'] = 'pdfs_found_but_no_metadata'

    return result
