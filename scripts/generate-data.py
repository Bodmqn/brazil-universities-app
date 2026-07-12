import json, os, re
from collections import OrderedDict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SRC_DATA = os.path.join(BASE, "src", "assets", "data")
ROOT_DATA = os.path.join(BASE, "data")
OUT_DIR = os.path.join(BASE, "frontend", "src", "data")


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(data, name):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  Wrote {path} ({len(data)} items)")


def extract_duration(d):
    if not d:
        return None
    m = re.search(r"(\d+)", str(d))
    return int(m.group(1)) if m else None


def main():
    print("Loading source data...")
    programs_nested = load_json(os.path.join(SRC_DATA, "programs.json"))
    status_map_raw = {}
    status_path = os.path.join(SRC_DATA, "program-status.json")
    if os.path.exists(status_path):
        sm = load_json(status_path)
        status_map_raw = sm.get("programs", {})
        print(f"  program-status.json: {sm.get('total_urls', '?')} URLs tracked")

    master_path = os.path.join(ROOT_DATA, "brazil_universities_master.json")
    if not os.path.exists(master_path):
        master_path = os.path.join(BASE, "backend", "data", "brazil_universities_master.json")
    master_data = load_json(master_path)
    print(f"  master JSON: {len(master_data)} universities")

    # Build university lookup by acronym and name
    uni_by_acronym = {}
    uni_by_name = {}
    for u in master_data:
        ac = (u.get("acronym") or "").strip().upper()
        nm = (u.get("name") or "").strip().lower()
        if ac:
            uni_by_acronym[ac] = u
        if nm:
            uni_by_name[nm] = u

    # Flatten programs and assign IDs
    programs_flat = []
    uni_flat_map = {}  # {uni_key: {id, name, acronym, ...}}
    uni_id_counter = 1
    prog_id_counter = 1
    skip_count = 0

    for region in programs_nested:
        region_name = region.get("name", "")
        for state in region.get("states", []):
            state_name = state.get("name", "")
            for uni_entry in state.get("universities", []):
                uni_name = (uni_entry.get("name") or "").strip()
                uni_acro = (uni_entry.get("acronym") or "").strip().upper()

                # Find matching master record
                master = uni_by_acronym.get(uni_acro) or uni_by_name.get(uni_name.lower())

                uni_id = None
                for uo in uni_flat_map.values():
                    if uo["name"] == uni_name or uo["acronym"] == uni_acro:
                        uni_id = uo["id"]
                        break

                if not uni_id:
                    uni_id = uni_id_counter
                    uni_id_counter += 1
                    uni_flat_map[uni_id] = {
                        "id": uni_id,
                        "name": uni_name,
                        "acronym": uni_acro,
                        "region": region_name,
                        "state": state_name,
                        "city": master.get("city") if master else (uni_entry.get("city") or ""),
                        "category": master.get("category") if master else "",
                        "website": master.get("website") if master else "",
                        "graduate_page_url": master.get("graduate_page_url") if master else "",
                        "qs_ranking": master.get("qs_ranking") if master else None,
                        "the_ranking": master.get("the_ranking") if master else None,
                        "masters_count": master.get("masters_count") if master else None,
                        "phd_count": master.get("phd_count") if master else None,
                        "english_programmes": master.get("english_programmes") if master else None,
                        "int_office_email": master.get("int_office_email") if master else None,
                        "int_office_phone": master.get("int_office_phone") if master else None,
                        "int_office_url": master.get("int_office_url") if master else None,
                    }

                for prog in uni_entry.get("programs", []):
                    url = (prog.get("url") or "").strip()
                    scan_info = status_map_raw.get(url, {})
                    programs_flat.append({
                        "id": prog_id_counter,
                        "university_id": uni_id,
                        "name": prog.get("program", ""),
                        "level": prog.get("level", ""),
                        "url": url,
                        "city": prog.get("city"),
                        "campus": prog.get("campus"),
                        "master_required": prog.get("masterRequired") or "",
                        "start_date": prog.get("startDate"),
                        "duration_months": extract_duration(prog.get("duration")),
                        "language_requirement": prog.get("languageRequirement"),
                        "scan_status": scan_info.get("status", "unknown"),
                        "scan_confidence": scan_info.get("confidence", 0.0),
                        "scan_keywords": scan_info.get("keywords_found", []),
                        "scan_dates_found": scan_info.get("dates_found", []),
                        "scan_title": scan_info.get("title"),
                    })
                    prog_id_counter += 1

    universities = sorted(uni_flat_map.values(), key=lambda u: u["name"])
    print(f"\nParsed {len(universities)} universities, {len(programs_flat)} programs")

    # Save
    print("\nWriting static data files...")
    save_json(universities, "universities.json")
    save_json(programs_flat, "programs.json")
    save_json([], "calls.json")  # empty placeholder

    # Write a summary file
    status_counts = {}
    for p in programs_flat:
        status_counts[p["scan_status"]] = status_counts.get(p["scan_status"], 0) + 1

    summary = {
        "total_universities": len(universities),
        "total_programs": len(programs_flat),
        "by_region": {},
        "by_category": {},
        "by_scan_status": status_counts,
    }
    for u in universities:
        r = u["region"]
        c = u["category"]
        summary["by_region"][r] = summary["by_region"].get(r, 0) + 1
        summary["by_category"][c] = summary["by_category"].get(c, 0) + 1

    save_json(summary, "_summary.json")
    print("\nDone! Data files ready for static import.")


if __name__ == "__main__":
    main()
