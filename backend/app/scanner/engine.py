import re, httpx, asyncio, logging, json
from datetime import datetime
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import University, Program, Call, ScanLog

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

SCAN_YEARS = [2027, 2028, 2029, 2030]

STRONG_KEYWORDS = [
    r"edital\s+aberto",
    r"inscri[cç][oõ]es\s+abertas",
    r"vagas\s+abertas",
    r"processo\s+seletivo\s+aberto",
    r"inscreva-se",
    r"inscri[cç][aã]o\s+aberta",
    r"candidaturas\s+abertas",
    r"apply\s+now",
    r"open\s+for\s+applications",
    r"applications\s+open",
]

MEDIUM_KEYWORDS = [
    r"mestrado",
    r"doutorado",
    r"p[oó]s[- ]gradua[cç][aã]o",
    r"edital",
    r"processo\s+seletivo",
    r"sele[cç][aã]o",
    r"selecao",
    r"inscri[cç][oõ]es",
    r"inscricoes",
    r"vestibular",
    r"calend[aá]rio",
    r"cronograma",
    r"resultado",
    r"homologa[cç][aã]o",
    r"matr[ií]cula",
    r"ingresso",
    r"admiss[aã]o",
]

SISU_MEC_URL = "https://sisu.mec.gov.br"
SISU_CALENDAR_URL = "https://www.gov.br/mec/pt-br/sisu"


def _score_page_text(text: str):
    """Score page text using keyword tiers. Returns (status, confidence, keywords_found, dates_found)."""
    strong_hits = []
    medium_hits = []

    for kw in STRONG_KEYWORDS:
        if re.search(kw, text, re.IGNORECASE):
            strong_hits.append(kw)

    for kw in MEDIUM_KEYWORDS:
        if re.search(kw, text, re.IGNORECASE):
            medium_hits.append(kw)

    dates_found = re.findall(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b", text)

    if strong_hits:
        confidence = min(1.0, 0.5 + len(strong_hits) * 0.15)
        return ("likely_open", confidence, strong_hits + medium_hits, dates_found)
    elif medium_hits:
        confidence = min(0.5, len(medium_hits) * 0.12)
        return ("possible", confidence, medium_hits, dates_found)
    else:
        return ("unknown", 0.0, [], dates_found)


# ── SISU ──────────────────────────────────────────────────────────────────

async def scan_sisu_mec():
    """Check centralized SISU calendar for national calls."""
    results = []
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(SISU_CALENDAR_URL)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "lxml")
                text = soup.get_text().lower()
                for year in SCAN_YEARS:
                    pattern = rf"{year}.*?(?:inscri[cç][aã]o|vestibular|sisu|edital|abertura)"
                    if re.search(pattern, text, re.DOTALL):
                        results.append({
                            "year": year,
                            "type": "sisu",
                            "source": "MEC",
                            "url": SISU_CALENDAR_URL,
                        })
    except Exception as e:
        logger.error(f"SISU scan error: {e}")
    return results


# ── UNIVERSITY-LEVEL SCANS ────────────────────────────────────────────────

async def scan_university_sigaa(uni: University):
    """Check a university's SIGAA public portal for open selection processes."""
    results = []
    base_url = uni.academic_system_url
    if not base_url:
        return results

    try:
        process_url = None
        if "sigaa" in (base_url or "").lower():
            if not base_url.endswith("/"):
                base_url += "/"
            process_url = f"{base_url}public/processo_seletivo/lista.jsf"
        elif "sig" in (base_url or "").lower():
            if not base_url.endswith("/"):
                base_url += "/"
            process_url = f"{base_url}public/processo_seletivo/lista.jsf"

        if not process_url:
            return results

        async with httpx.AsyncClient(timeout=30, follow_redirects=True, verify=False) as client:
            resp = await client.get(process_url)
            if resp.status_code != 200:
                return results

            soup = BeautifulSoup(resp.text, "lxml")
            page_text = soup.get_text().lower()

            for year in SCAN_YEARS:
                if str(year) in page_text:
                    semester = None
                    if "1" in page_text or "primeiro" in page_text or "1º" in page_text:
                        semester = 1
                    if "2" in page_text or "segundo" in page_text or "2º" in page_text:
                        semester = 2

                    types_found = set()
                    if any(w in page_text for w in ["mestrado", "doutorado", "pós-graduação", "pos-graduacao", "stricto"]):
                        types_found.add("graduate")
                    if any(w in page_text for w in ["graduação", "graduacao", "vestibular", "sisu"]):
                        types_found.add("vestibular")

                    call_type = "graduate" if "graduate" in types_found else "vestibular"
                    results.append({
                        "year": year,
                        "semester": semester,
                        "type": call_type,
                        "source": "SIGAA",
                        "url": process_url,
                    })
    except Exception as e:
        logger.error(f"SIGAA scan error for {uni.acronym}: {e}")

    return results


async def scan_university_website(uni: University):
    """Check the university's website for edital/processo seletivo announcements."""
    results = []
    base_url = uni.website
    if not base_url:
        return results

    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True, verify=False) as client:
            resp = await client.get(base_url)
            if resp.status_code != 200:
                return results

            soup = BeautifulSoup(resp.text, "lxml")
            page_text = soup.get_text().lower()

            for year in SCAN_YEARS:
                if str(year) in page_text:
                    keywords = ["processo seletivo", "edital", "seleção", "selecao", "inscrições", "inscricoes", "vestibular", "mestrado", "doutorado"]
                    if any(kw in page_text for kw in keywords):
                        semester = None
                        if any(p in page_text for p in [f"{year}/1", f"{year}.1", "primeiro semestre", "1º semestre", "1 semestre"]):
                            semester = 1
                        if any(p in page_text for p in [f"{year}/2", f"{year}.2", "segundo semestre", "2º semestre", "2 semestre"]):
                            semester = 2

                        call_type = "graduate"
                        if any(w in page_text for w in ["graduação", "graduacao", "vestibular"]):
                            call_type = "vestibular"

                        results.append({
                            "year": year,
                            "semester": semester,
                            "type": call_type,
                            "source": "website",
                            "url": base_url,
                        })
                        break
    except Exception as e:
        logger.error(f"Website scan error for {uni.acronym}: {e}")

    return results


async def scan_single_university(uni: University) -> list:
    """Run all scans for one university and return detected calls."""
    all_calls = []
    sigaa_results = await scan_university_sigaa(uni)
    website_results = await scan_university_website(uni)
    all_calls.extend(sigaa_results)
    all_calls.extend(website_results)
    return all_calls


def save_scan_results(uni_id: int, results: list, error: str = None):
    """Save detected calls and scan log to database."""
    db: Session = SessionLocal()
    try:
        scan_log = ScanLog(
            university_id=uni_id,
            http_status=200,
            result_summary=f"Detected {len(results)} calls" if results else "No calls detected",
            error_message=error,
        )
        db.add(scan_log)

        for call_data in results:
            existing = db.query(Call).filter(
                Call.university_id == uni_id,
                Call.call_year == call_data["year"],
                Call.call_type == call_data["type"],
            ).first()

            if existing:
                existing.last_confirmed_at = datetime.now()
                if existing.status == "closed":
                    existing.status = "open"
            else:
                new_call = Call(
                    university_id=uni_id,
                    call_year=call_data["year"],
                    call_semester=call_data.get("semester"),
                    call_type=call_data.get("type", "graduate"),
                    status="open",
                    description=f"Call detected via {call_data.get('source', 'scan')}",
                    call_url=call_data.get("url"),
                )
                db.add(new_call)

        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving scan results for uni {uni_id}: {e}")
    finally:
        db.close()


# ── PROGRAM-LEVEL SCANNING ────────────────────────────────────────────────

async def scan_single_program(prog: Program):
    """Visit a program's URL and classify it for open applications."""
    if not prog.url:
        return

    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True, verify=False) as client:
            resp = await client.get(prog.url)
            if resp.status_code != 200:
                prog.scan_status = "error"
                prog.scan_confidence = 0.0
                prog.scan_keywords = "[]"
                prog.scan_dates_found = "[]"
                prog.scan_title = None
                prog.scan_last_checked = datetime.now()
                return

            soup = BeautifulSoup(resp.text, "lxml")
            page_text = soup.get_text().lower()
            title_tag = soup.find("title")
            page_title = title_tag.get_text(strip=True) if title_tag is not None else None

            status, confidence, keywords, dates = _score_page_text(page_text)

            prog.scan_status = status
            prog.scan_confidence = confidence
            prog.scan_keywords = json.dumps(keywords, ensure_ascii=False)
            prog.scan_dates_found = json.dumps(dates, ensure_ascii=False)
            prog.scan_title = page_title
            prog.scan_last_checked = datetime.now()

    except Exception as e:
        logger.error(f"Program scan error for {prog.id} ({prog.url[:60]}...): {e}")
        prog.scan_status = "error"
        prog.scan_confidence = 0.0
        prog.scan_keywords = "[]"
        prog.scan_dates_found = "[]"
        prog.scan_title = None
        prog.scan_last_checked = datetime.now()


async def scan_all_programs():
    """Scan all programs for open application status."""
    db: Session = SessionLocal()
    try:
        programs = db.query(Program).filter(Program.url.isnot(None), Program.url != "").all()
        logger.info(f"Starting program scan: {len(programs)} programs...")

        batch_size = 20
        for i in range(0, len(programs), batch_size):
            batch = programs[i:i + batch_size]
            tasks = [scan_single_program(prog) for prog in batch]
            await asyncio.gather(*tasks, return_exceptions=True)
            db.commit()

            logger.info(f"Program scan progress: {min(i + batch_size, len(programs))}/{len(programs)}")

        # Log summary
        statuses = db.query(Program.scan_status, db.bind.func.count(Program.id)).group_by(Program.scan_status).all()
        summary = ", ".join(f"{s}: {c}" for s, c in statuses)
        logger.info(f"Program scan complete. {summary}")
    finally:
        db.close()


# ── FULL SCAN ─────────────────────────────────────────────────────────────

async def run_full_scan():
    """Scan all universities (calls) and programs (open status) for open applications."""
    db: Session = SessionLocal()
    try:
        universities = db.query(University).all()
        logger.info(f"Starting full scan of {len(universities)} universities...")

        batch_size = 10
        total_calls_found = 0

        for i in range(0, len(universities), batch_size):
            batch = universities[i:i + batch_size]
            tasks = [scan_single_university(uni) for uni in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for j, results in enumerate(batch_results):
                if isinstance(results, Exception):
                    save_scan_results(batch[j].id, [], str(results))
                    logger.error(f"Scan failed for {batch[j].acronym}: {results}")
                else:
                    save_scan_results(batch[j].id, results)
                    total_calls_found += len(results)

            logger.info(f"University scan progress: {min(i + batch_size, len(universities))}/{len(universities)}")

        sisu_calls = await scan_sisu_mec()
        logger.info(f"SISU central: {len(sisu_calls)} calls found")
        total_calls_found += len(sisu_calls)

        logger.info(f"University scan complete. Total calls detected: {total_calls_found}")

        # Now scan all programs
        await scan_all_programs()

    finally:
        db.close()
