"""
Deep metadata scraper for graduate program pages.
Extracts structured fields (start date, duration, campus, language, prerequisites)
from program HTML pages using Portuguese and English patterns.

Usage:
  from deep_scraper import extract_metadata
  meta = extract_metadata(soup)
"""

import re


FIELDS = {
    'startDate': {
        'label': 'Start Date',
        'patterns': [
            # Portuguese
            (r'in[ií]cio\s*(?:das\s*aulas\s*)?[:\-]\s*(\d{1,2}[/]\d{1,2}[/]\d{4})', 0.9),
            (r'data\s*de\s*in[ií]cio[:\-]\s*(\d{1,2}[/]\d{1,2}[/]\d{4})', 0.9),
            (r'previs[ãa]o\s*de\s*in[ií]cio[:\-]\s*(\d{1,2}[/]\d{1,2}[/]\d{4})', 0.8),
            (r'in[ií]cio\s*(?:previsto\s*)?[:\-]\s*(?:para\s+)?(\d{1,2}[/]\d{1,2}[/]\d{4})', 0.8),
            (r'(?:semestre|ano)\s*letivo[:\-]\s*(\d{4})', 0.5),
            (r'in[ií]cio\s*(?:previsto\s*)?[:\-]\s*(20\d\d)[./](\d{1,2})', 0.6),
            # English
            (r'start\s*date[:\-]\s*(\d{1,2}[/]\d{1,2}[/]\d{4})', 0.9),
            (r'program\s*start[:\-]\s*(\d{1,2}[/]\d{1,2}[/]\d{4})', 0.9),
            (r'beginning\s*[:\-]\s*(\d{1,2}[/]\d{1,2}[/]\d{4})', 0.8),
        ],
    },
    'duration': {
        'label': 'Duration',
        'patterns': [
            # Portuguese
            (r'dura[çc][ãa]o\s*(?:do\s*curso\s*)?[:\-]\s*(\d+)\s*(?:meses|anos)', 0.9),
            (r'dura[çc][ãa]o[:\-]\s*(\d+)\s*(?:meses|anos)', 0.9),
            (r'per[ií]odo[:\-]\s*(\d+)\s*(?:meses|anos)', 0.7),
            (r'carga\s*hor[áa]ria[:\-]\s*(\d+)\s*h', 0.5),
            # English
            (r'duration[:\-]\s*(\d+)\s*(?:months|years)', 0.9),
            (r'length[:\-]\s*(\d+)\s*(?:months|years)', 0.8),
            (r'(\d+)[-]\s*year\s*program', 0.8),
            (r'(\d+)[-]\s*month\s*program', 0.8),
        ],
    },
    'campus': {
        'label': 'Campus',
        'patterns': [
            (r'c[âa]mpus[:\-]\s*(.+?)(?:\.|$|\d)', 0.9),
            (r'campus\s+de\s+(.+?)(?:\.|$|\d)', 0.8),
            (r'campus\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[-–—]', 0.7),
            (r'unidade[:\-]\s*(.+?)(?:\.|$|\d)', 0.7),
            (r'local[:\-]\s*(.+?)(?:\.|$|\d)', 0.6),
            (r'oferecido\s*em[:\-]\s*(.+?)(?:\.|$|\d)', 0.7),
            (r'campus\s+universit[aá]rio\s*(?:de\s*)?(.+?)(?:\.|$)', 0.6),
        ],
    },
    'languageRequirement': {
        'label': 'Language Requirement',
        'patterns': [
            (r'idioma[:\-]\s*(portugu[êe]s|ingl[êe]s|espanhol|franc[êe]s)(?:\s*e\s*(portugu[êe]s|ingl[êe]s|espanhol|franc[êe]s))?', 0.9),
            (r'l[ií]ngua[:\-]\s*(portugu[êe]s|ingl[êe]s|espanhol|franc[êe]s)', 0.9),
            (r'(?:profici[êe]ncia|requisito\s*de\s*idioma)[:\-]\s*(.+?)(?:\.|$|\d)', 0.8),
            (r'language\s*requirement[:\-]\s*(.+?)(?:\.|$|\d)', 0.9),
            (r'language[:\-]\s*(portuguese|english|spanish|french)', 0.9),
            (r'teaching\s*language[:\-]\s*(.+?)(?:\.|$|\d)', 0.8),
            (r'(?:classes|instruction)\s*in\s*(portuguese|english)', 0.7),
            (r'proficiência\s*exigida[:\-]\s*(.+?)(?:\.|$|\d)', 0.7),
        ],
    },
    'masterRequired': {
        'label': 'Requires Master',
        'patterns': [
            (r'(?:exige|exig[eê]|necessita\s*de)\s*mestrado[:\-]\s*(sim|n[aã]o|yes|no)', 0.9),
            (r'mestrado\s*(?:é\s*)?(pr[ée])-requisito[:\-]\s*(sim|n[aã]o|yes|no)', 0.9),
            (r'requisito[:\-]\s*(sim|n[aã]o|yes|no).*mestrado', 0.8),
            (r"master's\s*(?:degree\s*)?required[:\-]\s*(yes|no)", 0.9),
            (r"requires\s*a\s*master's\s*(?:degree)[:\-]\s*(yes|no)", 0.9),
            (r"master's\s*prerequisite[:\-]\s*(yes|no)", 0.9),
            (r"prerequisite[:\-]\s*(master's|mestrado)", 0.8),
            (r'para\s*(?:ser|candidatar)[-\w\s]*\s*(?:exigido|necess[áa]rio)\s*(?:ter\s*)?mestrado', 0.7),
            (r"(?:only\s*for|open\s*to)\s*master's\s*holders", 0.7),
            (r'(?:n[aã]o\s*)?exige\s*mestrado', 0.7),
        ],
    },
}


def _text_near_keyword(tag, keyword, max_chars=300):
    text = tag.get_text(' ', strip=True)
    idx = text.lower().find(keyword.lower())
    if idx == -1:
        return None
    start = max(0, idx - 30)
    end = min(len(text), idx + max_chars)
    return text[start:end]


def extract_metadata(soup):
    """
    Extract structured metadata from a program page's BeautifulSoup object.

    Returns dict:
      {
        'startDate': {'value': str, 'confidence': float, 'source': str},
        'duration': {'value': str, 'confidence': float, 'source': str},
        ...
      }
    Fields not found will have value=None, confidence=0.
    """
    if not soup:
        return {field: {'value': None, 'confidence': 0.0, 'source': None}
                for field in FIELDS}

    results = {}

    for field_name, field_def in FIELDS.items():
        best = {'value': None, 'confidence': 0.0, 'source': None}

        for tag_name in ['p', 'li', 'span', 'div', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            for tag in soup.find_all(tag_name):
                text = tag.get_text(' ', strip=True)
                if not text:
                    continue

                full = text.lower()

                for pattern, confidence in field_def['patterns']:
                    m = re.search(pattern, text, re.IGNORECASE)
                    if m:
                        captured = m.group(0).strip()[:200]
                        value = m.group(1).strip() if m.lastindex and m.lastindex >= 1 else captured

                        # Truncate long captures for campus
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


def extract_metadata_from_html(html):
    """Convenience: parse HTML string and extract metadata."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'lxml')
    return extract_metadata(soup)
