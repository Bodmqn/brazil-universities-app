import json, os, re
from .database import SessionLocal
from .models import University, Program

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_DIR = os.path.dirname(BASE_DIR)

def find_programs_json():
    paths = [
        os.path.join(PROJECT_DIR, "src", "assets", "data", "programs.json"),
        os.path.join(PROJECT_DIR, "..", "src", "assets", "data", "programs.json"),
    ]
    for p in paths:
        if os.path.exists(p):
            return p
    return None

def find_status_json():
    paths = [
        os.path.join(PROJECT_DIR, "src", "assets", "data", "program-status.json"),
        os.path.join(PROJECT_DIR, "..", "src", "assets", "data", "program-status.json"),
    ]
    for p in paths:
        if os.path.exists(p):
            return p
    return None

def extract_duration_months(duration_str):
    if not duration_str:
        return None
    match = re.search(r"(\d+)", str(duration_str))
    return int(match.group(1)) if match else None

def seed_programs():
    db = SessionLocal()
    try:
        existing = db.query(Program).count()
        if existing > 0:
            print(f"Database already has {existing} programs, skipping seed.")
            return

        json_path = find_programs_json()
        if not json_path:
            print("ERROR: programs.json not found. Skipping program seed.")
            return

        status_path = find_status_json()
        status_map = {}
        if status_path:
            with open(status_path, "r", encoding="utf-8") as f:
                status_data = json.load(f)
                status_map = status_data.get("programs", {})

        universities = {u.acronym.upper(): u for u in db.query(University).all()}
        universities_by_name = {u.name.strip().lower(): u for u in db.query(University).all()}

        with open(json_path, "r", encoding="utf-8") as f:
            regions_data = json.load(f)

        count = 0
        skipped_no_match = 0

        for region in regions_data:
            for state in region.get("states", []):
                for uni_entry in state.get("universities", []):
                    uni_acronym = (uni_entry.get("acronym") or "").upper()
                    uni_name = (uni_entry.get("name") or "").strip()

                    uni = universities.get(uni_acronym) or universities_by_name.get(uni_name.lower())
                    if not uni:
                        skipped_no_match += 1
                        continue

                    for prog in uni_entry.get("programs", []):
                        program_url = (prog.get("url") or "").strip()
                        scan_info = status_map.get(program_url, {})

                        master_required_val = prog.get("masterRequired") or prog.get("master_required") or ""

                        program = Program(
                            university_id=uni.id,
                            name=prog.get("program", ""),
                            level=prog.get("level", ""),
                            url=program_url,
                            city=prog.get("city"),
                            campus=prog.get("campus"),
                            master_required=master_required_val if master_required_val else None,
                            start_date=prog.get("startDate"),
                            duration_months=extract_duration_months(prog.get("duration")),
                            language_requirement=prog.get("languageRequirement"),
                            scan_status=scan_info.get("status", "unknown"),
                            scan_confidence=scan_info.get("confidence", 0.0),
                            scan_keywords=json.dumps(scan_info.get("keywords_found", []), ensure_ascii=False),
                            scan_dates_found=json.dumps(scan_info.get("dates_found", []), ensure_ascii=False),
                            scan_title=scan_info.get("title"),
                        )
                        db.add(program)
                        count += 1

        db.commit()
        print(f"Seeded {count} programs into database.")
        if skipped_no_match:
            print(f"Skipped {skipped_no_match} university entries (no match in database).")
    finally:
        db.close()


if __name__ == "__main__":
    seed_programs()
