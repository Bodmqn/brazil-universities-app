from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from typing import Optional
import json
from ..database import get_db
from ..models import Program, University

router = APIRouter(prefix="/api/programs", tags=["programs"])


def program_to_dict(prog: Program):
    return {
        "id": prog.id,
        "university_id": prog.university_id,
        "name": prog.name,
        "level": prog.level,
        "url": prog.url,
        "city": prog.city,
        "campus": prog.campus,
        "master_required": prog.master_required,
        "start_date": prog.start_date,
        "duration_months": prog.duration_months,
        "language_requirement": prog.language_requirement,
        "scan_status": prog.scan_status,
        "scan_confidence": prog.scan_confidence,
        "scan_keywords": json.loads(prog.scan_keywords) if prog.scan_keywords else [],
        "scan_dates_found": json.loads(prog.scan_dates_found) if prog.scan_dates_found else [],
        "scan_title": prog.scan_title,
        "scan_last_checked": prog.scan_last_checked.isoformat() if prog.scan_last_checked else None,
    }


@router.get("")
def list_programs(
    level: Optional[str] = Query(None),
    scan_status: Optional[str] = Query(None),
    university_id: Optional[int] = Query(None),
    region: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("name"),
    sort_order: Optional[str] = Query("asc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(Program).join(University, Program.university_id == University.id)

    if level:
        query = query.filter(Program.level == level)
    if scan_status:
        query = query.filter(Program.scan_status == scan_status)
    if university_id:
        query = query.filter(Program.university_id == university_id)
    if region:
        query = query.filter(University.region == region)
    if state:
        query = query.filter(University.state == state.upper())
    if city:
        query = query.filter(Program.city.ilike(f"%{city}%"))
    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(
                Program.name.ilike(term),
                University.name.ilike(term),
                University.acronym.ilike(term),
                Program.city.ilike(term),
            )
        )

    total = query.count()

    sort_col = getattr(Program, sort_by, Program.name)
    if sort_order == "desc":
        sort_col = sort_col.desc()
    query = query.order_by(sort_col)

    offset = (page - 1) * per_page
    programs = query.offset(offset).limit(per_page).all()

    result = []
    for prog in programs:
        d = program_to_dict(prog)
        d["university_name"] = prog.university.name
        d["university_acronym"] = prog.university.acronym
        d["university_region"] = prog.university.region
        d["university_state"] = prog.university.state
        result.append(d)

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
        "data": result,
    }


@router.get("/{program_id}")
def get_program(program_id: int, db: Session = Depends(get_db)):
    prog = db.query(Program).options(joinedload(Program.university)).filter(Program.id == program_id).first()
    if not prog:
        raise HTTPException(status_code=404, detail="Program not found")

    d = program_to_dict(prog)
    uni = prog.university
    d["university"] = {
        "id": uni.id,
        "name": uni.name,
        "acronym": uni.acronym,
        "category": uni.category,
        "state": uni.state,
        "state_name": uni.state_name,
        "city": uni.city,
        "region": uni.region,
        "website": uni.website,
        "graduate_page_url": uni.graduate_page_url,
        "qs_ranking": uni.qs_ranking,
        "the_ranking": uni.the_ranking,
    }
    return d


@router.get("/stats/overview")
def program_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(Program.id)).scalar()
    by_level = db.query(Program.level, func.count(Program.id)).group_by(Program.level).all()
    by_status = db.query(Program.scan_status, func.count(Program.id)).group_by(Program.scan_status).all()
    by_region = (
        db.query(University.region, func.count(Program.id))
        .join(University, Program.university_id == University.id)
        .group_by(University.region)
        .all()
    )

    return {
        "total_programs": total,
        "by_level": {level: count for level, count in by_level},
        "by_scan_status": {status: count for status, count in by_status},
        "by_region": {reg: count for reg, count in by_region},
    }
