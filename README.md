# Brazilian Universities — Graduate Programs Directory

A bilingual (PT/EN) directory of Master's and Doctorate programs at Brazilian universities. Search, filter, and explore programs by region, state, or university. Includes an automated scanner that checks program websites for open calls for applications (Editais Abertos).

## Features

- **5 regions** — Norte, Nordeste, Centro-Oeste, Sudeste, Sul
- **59 universities** — 463 graduate programs across 22 states
- **Search** — by university name, acronym, program name, or city
- **Language toggle** — switch between Portuguese and English (UI + data)
- **Open calls scanner** — Python bot detects "Editais Abertos" on program websites
- **Mobile responsive** — works on phones and tablets

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + Vite 8 |
| Routing | React Router 7 |
| Styling | Plain CSS (Brasil colors) |
| Data | JSON (parsed from CSV) |
| Scanner | Python 3 + requests + BeautifulSoup |
| Automation | GitHub Actions (cron: Mon/Thu) |

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Data

The data was originally provided as a CSV file. To re-parse after editing:

```bash
npm run parse:csv
```

## Scraper (Open Calls Detection)

Checks program websites for keywords like "Edital Aberto", "Inscrições Abertas", etc.

```bash
# Quick test (5 URLs)
python scraper/check_editais.py --sample

# Full scan (all 450+ URLs)
python scraper/check_editais.py

# Windows batch shortcut
./scan-editais.bat
```

Results are saved to `src/assets/data/program-status.json`.

## Build

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── assets/data/          # JSON data files
├── components/           # Layout, SearchBar, LanguageToggle, ErrorBoundary
├── pages/                # HomePage, RegionPage, UniversityPage, SearchPage
├── context/              # LanguageContext (PT/EN state)
├── hooks/                # usePrograms (data loading + translation)
└── utils/                # translations (UI), translations-data (data content)
scraper/                  # Python edital scanner
scripts/                  # CSV → JSON parser
.github/workflows/        # GitHub Actions automation
```

## License

MIT
