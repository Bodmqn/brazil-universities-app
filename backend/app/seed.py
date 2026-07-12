import json, os
from .database import SessionLocal, engine, Base
from .models import University

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    existing = db.query(University).count()
    if existing > 0:
        print(f"Database already has {existing} universities, skipping seed.")
        db.close()
        return

    json_path = os.path.join(BASE_DIR, "data", "brazil_universities_master.json")
    if not os.path.exists(json_path):
        print(f"ERROR: Data file not found at {json_path}")
        db.close()
        return

    with open(json_path, "r", encoding="utf-8") as f:
        universities_data = json.load(f)

    count = 0
    for item in universities_data:
        uni = University(
            name=item.get("name"),
            acronym=item.get("acronym"),
            category=item.get("category"),
            state=item.get("state"),
            state_name=item.get("state_name"),
            city=item.get("city"),
            region=item.get("region"),
            website=item.get("website"),
            academic_system_url=item.get("academic_system_url"),
            academic_system_name=item.get("academic_system_name"),
            qs_ranking=item.get("qs_ranking"),
            the_ranking=item.get("the_ranking"),
            graduate_page_url=item.get("graduate_page_url"),
            masters_count=item.get("masters_count"),
            phd_count=item.get("phd_count"),
            english_programmes=item.get("english_programmes"),
            int_office_email=item.get("int_office_email"),
            int_office_phone=item.get("int_office_phone"),
            int_office_url=item.get("int_office_url"),
        )
        db.add(uni)
        count += 1

    db.commit()
    db.close()
    print(f"Seeded {count} universities into database.")


if __name__ == "__main__":
    seed_database()
