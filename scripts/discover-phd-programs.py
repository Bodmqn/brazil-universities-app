"""
Discover PhD (Doutorado) programs from university graduate portals.
Appends found programs to src/assets/data/programs.json in nested format,
creating entries for universities not yet in the file.

Usage:
  python scripts/discover-phd-programs.py             # all candidates
  python scripts/discover-phd-programs.py --limit 5   # first N only
"""

import json, os, re, warnings
from urllib.parse import urlparse, urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup
from urllib3.exceptions import InsecureRequestWarning
warnings.filterwarnings('ignore', category=InsecureRequestWarning)

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE, "data")
SRC_DATA_DIR = os.path.join(BASE, "src", "assets", "data")
MASTER_FILE = os.path.join(DATA_DIR, "brazil_universities_master.json")
PROGRAMS_FILE = os.path.join(SRC_DATA_DIR, "programs.json")

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
})
TIMEOUT = 10

SKIP_TEXT = [
    'edital', 'processo seletivo', 'inscri', 'noticia', 'capes', 'proap',
    'formulario', 'egresso', 'dissertacao', 'banca',
    'financiador', 'repositorio', 'simposio',
    'secretaria', 'localizacao',
    'calendario', 'apresentacao', 'financiadore',
    'politica de acompanhamento', 'etica na pesquisa',
    'especializa', 'pos-doutorado', 'pós-doutorado', 'graduacao',
    'residencia medica', 'bolsa',
    'intranet', 'vpn', 'sappg',
    'orientacoes para matricula',
    'seguro de vida', 'regimento interno',
    'normas de atendimento', 'acesso',
    'carta de servico',
    'ato autorizativo', 'projeto pedagogico',
    'avaliacao do mec', 'norma academica',
    'sobre as aulas',
    'plataforma sucupira', 'portal carolina bori',
    'canal do ppgsc', 'youtube',
    'artigo de doutoranda',
    'noticias sobre', 'processo de pos-doutorado',
    'bolsas de mestrado e doutorado',
    'recém-doutor', 'recém-contratado',
    'espec.', 'pg-e ', 'pg-em ',
    'área de apoio ao p',
    'pró-reitoria de pesquisa',
    'cursos de doutorado e mestrado',
    'a pós-graduação', 'mestrado e doutorado acadêmico',
    'doutorado e mestrado acadêmico',
    'ingresso na pós-graduação', 'catálogos', 'catalogo',
    'professor e estudante do', 'informações:ingresso',
    'proppi - pós-graduação', 'pesquisa e pós-graduação',
]
URL_SKIP = [
    '/formularios/', '/editais/', '/processo-seletivo/', '/dissertacoes/',
    '/coordenacao/', '/egressos/', '/bancas/', '/sobre-o-programa/',
    '/calendario/', '/o-programa/', '/discentes/', '/docentes/',
    '/noticias/', '/avaliacao/', '/avaliacoes/',
    '/regimento/', '/normas/', '/projeto-pedagogico/',
    '/estrutura-curricular/', '/matricula/',
    '/atuacao/', '/laboratorio/', '/infraestrutura/',
    '/biblioteca/', '/documentos/', '/convocacoes/',
    '/vagas/', '/polo/', '/estagio/', '/tcc/',
    '/atendimento/', '/nucleo/', '/ligas-academicas/',
    '/atividades-complementares/', '/atividades-de-extensao/',
    '/campos-de-atuacao/', '/sobre-o-curso/',
    '/fale-conosco/', '/ouvidoria/', '/acesso-a-informacao/',
    '/pos-doutorado/', '/pos-doutor/',
    '/especializacao/', '/residencia-medica/',
    '/selecoes/', '/noticias/', '/producao-audiovisual/', '/simposio/',
    'pdf',
]
SKIP_NAMES = {
    'doutorado', 'pos-graduação', 'stricto sensu', 'lato sensu',
    'cursos de pós-graduação', 'pós-graduação', 'mestrados e doutorados',
    'mestrado e doutorado', 'programas de pós-graduação',
    'mestrado', 'pós-graduação stricto sensu', 'pós-graduação lato sensu',
    'voltar', 'início', 'programas', 'cursos', 'página inicial', 'home',
}


def fetch(url):
    try:
        r = SESSION.get(url, timeout=TIMEOUT, allow_redirects=True)
        r.raise_for_status()
        return r.text
    except Exception:
        return None


def classify_level(url):
    u = url.lower()
    if '/doutorado/' in u or '/doutor/' in u:
        return 'D'
    return 'M+D'


def discover_links(grad_url):
    html = fetch(grad_url)
    if not html:
        return []

    soup = BeautifulSoup(html, 'lxml')
    seen_urls = set()
    found = []

    for a in soup.find_all('a', href=True):
        text = a.get_text(strip=True)
        href = a['href'].strip()
        if not text or not href:
            continue

        full = urljoin(grad_url, href).split('#')[0].rstrip('/')
        if not full or full in seen_urls:
            continue
        # Skip if url is the grad page itself or a direct parent
        if full.rstrip('/') == grad_url.rstrip('/'):
            continue
        seen_urls.add(full)

        lower_text = text.lower()
        lower_href = href.lower()

        has_doutorado = 'doutorado' in lower_text or 'doutor' in lower_text
        in_grad_path = any(p in lower_href for p in [
            '/doutorado/', '/doutor/',
            '/mestrado-e-doutorado/', '/mestrados-e-doutorados/',
            '/mestrado/', '/mestrados/',
            '/pos-graduacao/', '/posgraduacao/',
            '/stricto/', '/ppg', '/programa-de-pos',
        ])
        is_program_text = 'programa de pós' in lower_text or 'ppg' in lower_text

        if not has_doutorado and not in_grad_path and not is_program_text:
            continue

        # Skip by text keywords
        if any(k in lower_text for k in SKIP_TEXT):
            continue
        # Skip by URL patterns
        if any(k in lower_href for k in URL_SKIP) or any(k in href.lower() for k in URL_SKIP):
            continue

        name_lower = text.strip().lower()
        if name_lower in SKIP_NAMES:
            continue

        if len(text.strip()) < 8:
            continue

        found.append({
            'name': text.strip()[:200],
            'url': full,
        })

    # Deduplicate by URL (using same url as key)
    final = []
    dedup_urls = set()
    for l in found:
        if l['url'] not in dedup_urls:
            dedup_urls.add(l['url'])
            final.append(l)

    return final


def ensure_university_entry(programs, uni):
    """Find or create the university entry in the nested programs JSON.
    Returns the entry dict and whether it was newly created."""
    acro = (uni.get('acronym') or '').strip().upper()
    region_name = uni.get('region', '')
    state_uf = uni.get('state', '')

    # Map region names expected in programs.json
    region_map = {
        'Norte': 'Norte', 'Nordeste': 'Nordeste', 'Centro-Oeste': 'Centro-Oeste',
        'Sudeste': 'Sudeste', 'Sul': 'Sul',
    }
    region_key = region_map.get(region_name, 'Outro')

    for region in programs:
        if region.get('region') != region_key:
            continue
        for state in region.get('states', []):
            if state.get('uf') != state_uf:
                continue
            for entry in state.get('universities', []):
                if (entry.get('acronym') or '').strip().upper() == acro:
                    return entry, False
    # Not found — need to create
    # Find/create region
    target_region = None
    for region in programs:
        if region.get('region') == region_key:
            target_region = region
            break
    if target_region is None:
        target_region = {'region': region_key, 'states': []}
        programs.append(target_region)

    # Find/create state
    target_state = None
    for state in target_region.get('states', []):
        if state.get('uf') == state_uf:
            target_state = state
            break
    if target_state is None:
        target_state = {'uf': state_uf, 'universities': []}
        target_region.setdefault('states', []).append(target_state)

    new_entry = {
        'acronym': uni.get('acronym', ''),
        'name': uni.get('name', ''),
        'city': uni.get('city', ''),
        'state': uni.get('state', ''),
        'region': uni.get('region', ''),
        'programs': [],
    }
    target_state['universities'].append(new_entry)
    return new_entry, True


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=None)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    master = json.load(open(MASTER_FILE, 'r', encoding='utf-8'))
    candidates = [
        u for u in master
        if u.get('phd_count') and str(u['phd_count']).strip() and int(u['phd_count']) > 0
        and u.get('graduate_page_url')
    ]
    if args.limit:
        candidates = candidates[:args.limit]

    # Build index by acronym
    master_by_acro = {}
    for u in master:
        acro = (u.get('acronym') or '').strip().upper()
        if acro:
            master_by_acro[acro] = u

    print(f"Candidate universities: {len(candidates)}")

    results = {}
    with ThreadPoolExecutor(max_workers=5) as pool:
        future_map = {pool.submit(discover_links, u['graduate_page_url']): u for u in candidates}
        for f in as_completed(future_map):
            uni = future_map[f]
            acro = (uni.get('acronym') or '').strip().upper()
            links = f.result()
            if links:
                print(f"  {uni['name'][:50]} ({acro}): {len(links)} links")
            else:
                print(f"  {uni['name'][:50]} ({acro}): 0 links (skipping)")
            results[acro] = {'uni': uni, 'links': links}

    programs = json.load(open(PROGRAMS_FILE, 'r', encoding='utf-8'))

    existing_urls = {}
    for region in programs:
        for state in region.get('states', []):
            for entry in state.get('universities', []):
                acro = (entry.get('acronym') or '').strip().upper()
                urls = set()
                for p in entry.get('programs', []):
                    u = (p.get('url') or '').rstrip('/')
                    if u:
                        urls.add(u)
                existing_urls[acro] = urls

    total_added = 0

    for acro, data in results.items():
        links = data['links']
        if not links:
            continue
        uni = data['uni']
        existing = existing_urls.get(acro, set())

        entry, created = ensure_university_entry(programs, uni)
        if created:
            print(f"  [!] Created new entry for {uni['name'][:50]} ({acro})")

        for l in links:
            if l['url'] in existing:
                continue
            existing.add(l['url'])

            level = classify_level(l['url'])

            if level == 'D':
                entry['programs'].append({
                    'level': 'Doutorado',
                    'program': l['name'], 'url': l['url'],
                    'city': entry.get('city', ''), 'campus': '',
                    'startDate': '', 'duration': '',
                    'languageRequirement': '', 'masterRequired': '',
                })
                total_added += 1
                print(f"  + [{acro}] [D] {l['name'][:70]}")
            else:
                entry['programs'].append({
                    'level': 'Doutorado',
                    'program': l['name'], 'url': l['url'],
                    'city': entry.get('city', ''), 'campus': '',
                    'startDate': '', 'duration': '',
                    'languageRequirement': '', 'masterRequired': '',
                })
                entry['programs'].append({
                    'level': 'Mestrado',
                    'program': l['name'], 'url': l['url'],
                    'city': entry.get('city', ''), 'campus': '',
                    'startDate': '', 'duration': '',
                    'languageRequirement': '', 'masterRequired': '',
                })
                total_added += 2
                print(f"  + [{acro}] [M+D] {l['name'][:70]}")

    if total_added:
        with open(PROGRAMS_FILE, 'w', encoding='utf-8') as f:
            json.dump(programs, f, ensure_ascii=False, indent=2)
        print(f"\nAdded {total_added} new program entries to {PROGRAMS_FILE}")
    else:
        print("\nNo new programs discovered.")


if __name__ == '__main__':
    main()
