"""Post-processing cleanup for discovered PhD programs."""
import json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILE = os.path.join(BASE, "src", "assets", "data", "programs.json")

sys.stdout.reconfigure(encoding='utf-8')

programs = json.load(open(FILE, encoding='utf-8'))

false_text = [
    'bolsa', 'recém-doutor', 'recém-contratado',
    'espec.', 'pg-e ', 'pg-em ',
    'área de apoio ao p', 'pró-reitoria de pesquisa',
    'cursos de doutorado e mestrado',
    'a pós-graduação', 'mestrado e doutorado acadêmico',
    'doutorado e mestrado acadêmico',
    'ingresso na pós-graduação', 'catálogos', 'catálogo',
    'professor e estudante do', 'informações:ingresso',
    'proppi - pós-graduação', 'pesquisa e pós-graduação',
    'plataforma sucupira', 'portal carolina bori',
    'canal do ppgsc', 'youtube',
    'artigo de doutoranda', 'notícias sobre',
    'processo de pós-doutorado', 'pós-doutorado',
    'orientações para pós-doutorado',
    'fap recém', 'linha i - recém',
    'apresentação: o programa de pós',
    'ações de avaliação e autoavaliação do ppga',
    'carta de serviços ao cidadão',
    'impactos do ppga:', 'projetos de pesquisa e ética',
    'repositório de dissertações',
    'notícias',
    'normas de atendimento de divulgação dos ppgs',
    'regimento interno p', 'seguro de vida',
    'sites ppg', 'prodoutor',
    'mestrado profissional em ensino de geografia',
    'mestrado profissional em matemática',
    'normas gerais', 'discentes', 'docentes',
    'pós graduação em gestão educacional',
    'pós-graduação em docência na educação infantil',
    'pós-graduação em educação ambiental',
    'pós-graduação em geomática',
    'pós graduação em saúde e ruralidade',
]

false_url = [
    '/o-mestrado-em-', '/8-etica-na-pesquisa',
    '/internacionalizacao-do-ppga', '/localizacao-e-contatos',
    '/acoes-de-avaliacao-e-autoavaliacao-do-ppga',
    '/formularios-regimento-resolucoes', '/noticias-2',
    '/selecoes', '/producao-audiovisual',
    '/simposio', '/orientacoes-para-pos-doutorado',
    '/normas-gerais', '/coordenacao-do-curso',
    '/concepcao-pedagogica',
]

removed = 0
for region in programs:
    for state in region.get('states', []):
        for entry in state.get('universities', []):
            prog = entry.get('programs', [])
            new_progs = []
            for p in prog:
                name_lower = (p.get('program', '') + '').lower()
                url_lower = (p.get('url', '') + '').lower()
                skip = False
                for pattern in false_text:
                    if pattern in name_lower:
                        skip = True
                        break
                if not skip:
                    for pattern in false_url:
                        if pattern in url_lower:
                            skip = True
                            break
                if skip:
                    removed += 1
                    acro = entry.get('acronym', '?') or '?'
                    pname = p.get('program', '?') or '?'
                    print(f'  - [{acro}] {pname[:60]}')
                else:
                    new_progs.append(p)
            entry['programs'] = new_progs

with open(FILE, 'w', encoding='utf-8') as f:
    json.dump(programs, f, ensure_ascii=False, indent=2)

print(f'Removed {removed} entries')
