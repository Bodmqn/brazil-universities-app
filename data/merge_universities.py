import json, csv, os, re

# Load all 5 regional files
files = {
    "norte": "north_brazil_universities.json",
    "nordeste": "northeast_universities_data.json",
    "centro_oeste": "universities_centro_oeste.json",
    "sudeste": "sudeste_public_universities.json",
    "sul": "brazil_south_universities.json"
}

base_dir = os.path.dirname(os.path.abspath(__file__))
all_universities = []

state_name_to_code = {
    "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM",
    "Bahia": "BA", "Ceará": "CE", "Distrito Federal": "DF", "Espírito Santo": "ES",
    "Goiás": "GO", "Maranhão": "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS",
    "Minas Gerais": "MG", "Pará": "PA", "Paraíba": "PB", "Paraná": "PR",
    "Pernambuco": "PE", "Piauí": "PI", "Rio de Janeiro": "RJ", "Rio Grande do Norte": "RN",
    "Rio Grande do Sul": "RS", "Rondônia": "RO", "Roraima": "RR", "Santa Catarina": "SC",
    "São Paulo": "SP", "Sergipe": "SE", "Tocantins": "TO"
}

def normalize_state(state_val):
    if not state_val:
        return None, None
    state_val = state_val.strip()
    # If already a 2-letter code
    if len(state_val) == 2 and state_val.upper() == state_val:
        return state_val, None
    # Look up full name -> code
    if state_val in state_name_to_code:
        return state_name_to_code[state_val], state_val
    # Try reverse
    for full, code in state_name_to_code.items():
        if state_val == code:
            return code, full
    return state_val, state_val

def normalize_category(cat):
    if not cat:
        return None
    cat = cat.strip().lower()
    if "federal" in cat:
        return "Federal"
    if "estadual" in cat or "state" in cat or "distrital" in cat:
        return "State"
    if "municipal" in cat or "centro universitário" in cat:
        return "Municipal"
    return cat.title()

def clean_ranking(val):
    if not val:
        return None
    val = str(val).strip()
    if val.upper() in ["N/A", "NA", "NULL", "NONE", "-", ""]:
        return None
    return val

for region, fname in files.items():
    fpath = os.path.join(base_dir, fname)
    if not os.path.exists(fpath):
        print(f"WARNING: {fname} not found")
        continue
    with open(fpath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    # Handle both list and {universities: [...]} formats
    if isinstance(data, dict) and "universities" in data:
        universities = data["universities"]
    elif isinstance(data, list):
        universities = data
    else:
        print(f"WARNING: Unknown format in {fname}")
        continue
    
    for uni in universities:
        state_code, state_name = normalize_state(uni.get("state"))
        
        entry = {
            "name": uni.get("name"),
            "acronym": uni.get("acronym", "").upper(),
            "category": normalize_category(uni.get("category")),
            "state": state_code,
            "state_name": state_name or state_code,
            "city": uni.get("city"),
            "region": region.capitalize().replace("_", "-"),
            "website": uni.get("website"),
            "academic_system_url": uni.get("academic_system_url"),
            "academic_system_name": uni.get("academic_system_name"),
            "qs_ranking": clean_ranking(uni.get("qs_ranking")),
            "the_ranking": clean_ranking(uni.get("the_ranking")),
            "graduate_page_url": uni.get("graduate_page_url"),
            "masters_count": uni.get("masters_count"),
            "phd_count": uni.get("phd_count"),
            "english_programmes": str(uni.get("english_programmes", "")) if uni.get("english_programmes") else "",
            "int_office_email": uni.get("int_office_email"),
            "int_office_phone": uni.get("int_office_phone"),
            "int_office_url": uni.get("int_office_url")
        }
        all_universities.append(entry)

# Fix region names to proper Portuguese
region_map = {
    "Norte": "Norte",
    "Nordeste": "Nordeste",
    "Centro_oeste": "Centro-Oeste",
    "Centro-oeste": "Centro-Oeste",
    "Sudeste": "Sudeste",
    "Sul": "Sul"
}

for uni in all_universities:
    if uni["region"] in region_map:
        uni["region"] = region_map[uni["region"]]

# Sort by region, then state, then name
sort_order = {"Norte": 0, "Nordeste": 1, "Centro-Oeste": 2, "Sudeste": 3, "Sul": 4}
all_universities.sort(key=lambda u: (sort_order.get(u["region"], 99), u.get("state", ""), u.get("name", "")))

# Write JSON
json_path = os.path.join(base_dir, "brazil_universities_master.json")
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(all_universities, f, ensure_ascii=False, indent=2)
print(f"Master JSON saved: {len(all_universities)} universities to {json_path}")

# Write CSV
csv_path = os.path.join(base_dir, "brazil_universities.csv")
fieldnames = [
    "name", "acronym", "category", "state", "state_name", "city", "region",
    "website", "academic_system_url", "academic_system_name",
    "qs_ranking", "the_ranking", "graduate_page_url",
    "masters_count", "phd_count", "english_programmes",
    "int_office_email", "int_office_phone", "int_office_url"
]
with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(all_universities)
print(f"CSV saved: {csv_path}")

# Print summary
categories = {}
regions = {}
for uni in all_universities:
    cat = uni["category"]
    reg = uni["region"]
    categories[cat] = categories.get(cat, 0) + 1
    regions[reg] = regions.get(reg, 0) + 1

print("\n=== SUMMARY ===")
print(f"Total universities: {len(all_universities)}")
print("By category:", dict(sorted(categories.items())))
print("By region:", dict(sorted(regions.items(), key=lambda x: sort_order.get(x[0], 99))))
