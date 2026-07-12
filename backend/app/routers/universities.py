from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from ..database import get_db
from ..models import University, Call

router = APIRouter(prefix="/api/universities", tags=["universities"])

@router.get("")
def list_universities(
    category: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    has_calls: Optional[bool] = Query(None, description="Filter by universities with open calls"),
    call_year: Optional[int] = Query(None),
    sort_by: Optional[str] = Query("name"),
    sort_order: Optional[str] = Query("asc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(University)

    if category:
        query = query.filter(University.category == category)
    if region:
        query = query.filter(University.region == region)
    if state:
        query = query.filter(University.state == state.upper())
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (University.name.ilike(search_term)) |
            (University.acronym.ilike(search_term)) |
            (University.city.ilike(search_term))
        )
    if has_calls:
        subquery = db.query(Call.university_id).filter(Call.status == "open").distinct()
        if call_year:
            subquery = subquery.filter(Call.call_year == call_year)
        query = query.filter(University.id.in_(subquery))

    total = query.count()

    sort_col = getattr(University, sort_by, University.name)
    if sort_order == "desc":
        sort_col = sort_col.desc()
    query = query.order_by(sort_col)

    offset = (page - 1) * per_page
    universities = query.offset(offset).limit(per_page).all()

    result = []
    for uni in universities:
        open_calls_count = db.query(func.count(Call.id)).filter(
            Call.university_id == uni.id,
            Call.status == "open"
        ).scalar()
        uni_data = {
            "id": uni.id,
            "name": uni.name,
            "acronym": uni.acronym,
            "category": uni.category,
            "state": uni.state,
            "state_name": uni.state_name,
            "city": uni.city,
            "region": uni.region,
            "website": uni.website,
            "academic_system_url": uni.academic_system_url,
            "academic_system_name": uni.academic_system_name,
            "qs_ranking": uni.qs_ranking,
            "the_ranking": uni.the_ranking,
            "graduate_page_url": uni.graduate_page_url,
            "masters_count": uni.masters_count,
            "phd_count": uni.phd_count,
            "english_programmes": uni.english_programmes,
            "int_office_email": uni.int_office_email,
            "int_office_phone": uni.int_office_phone,
            "int_office_url": uni.int_office_url,
            "open_calls_count": open_calls_count,
        }
        result.append(uni_data)

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
        "data": result,
    }


@router.get("/{university_id}")
def get_university(university_id: int, db: Session = Depends(get_db)):
    uni = db.query(University).filter(University.id == university_id).first()
    if not uni:
        raise HTTPException(status_code=404, detail="University not found")

    calls = db.query(Call).filter(
        Call.university_id == university_id
    ).order_by(Call.call_year.desc(), Call.call_semester.desc()).all()

    uni_data = {
        "id": uni.id,
        "name": uni.name,
        "acronym": uni.acronym,
        "category": uni.category,
        "state": uni.state,
        "state_name": uni.state_name,
        "city": uni.city,
        "region": uni.region,
        "website": uni.website,
        "academic_system_url": uni.academic_system_url,
        "academic_system_name": uni.academic_system_name,
        "qs_ranking": uni.qs_ranking,
        "the_ranking": uni.the_ranking,
        "graduate_page_url": uni.graduate_page_url,
        "masters_count": uni.masters_count,
        "phd_count": uni.phd_count,
        "english_programmes": uni.english_programmes,
        "int_office_email": uni.int_office_email,
        "int_office_phone": uni.int_office_phone,
        "int_office_url": uni.int_office_url,
    }

    calls_data = []
    for call in calls:
        calls_data.append({
            "id": call.id,
            "university_id": call.university_id,
            "call_year": call.call_year,
            "call_semester": call.call_semester,
            "call_type": call.call_type,
            "status": call.status,
            "description": call.description,
            "application_deadline": call.application_deadline,
            "call_url": call.call_url,
            "detected_at": call.detected_at.isoformat() if call.detected_at else None,
        })

    return {"university": uni_data, "calls": calls_data}


@router.get("/stats/overview")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(University.id)).scalar()
    by_category = db.query(University.category, func.count(University.id)).group_by(University.category).all()
    by_region = db.query(University.region, func.count(University.id)).group_by(University.region).all()
    by_state = db.query(University.state, func.count(University.id)).group_by(University.state).all()
    total_open_calls = db.query(func.count(Call.id)).filter(Call.status == "open").scalar()

    return {
        "total_universities": total,
        "total_open_calls": total_open_calls,
        "by_category": {cat: count for cat, count in by_category},
        "by_region": {reg: count for reg, count in by_region},
        "by_state": {st: count for st, count in by_state},
    }
