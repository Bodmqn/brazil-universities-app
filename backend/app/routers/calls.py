from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from ..database import get_db
from ..models import Call, University

router = APIRouter(prefix="/api/calls", tags=["calls"])

@router.get("")
def list_calls(
    status: Optional[str] = Query(None),
    call_type: Optional[str] = Query(None),
    call_year: Optional[int] = Query(None),
    call_semester: Optional[int] = Query(None),
    university_id: Optional[int] = Query(None),
    region: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(Call, University).join(University, Call.university_id == University.id)

    if status:
        query = query.filter(Call.status == status)
    if call_type:
        query = query.filter(Call.call_type == call_type)
    if call_year:
        query = query.filter(Call.call_year == call_year)
    if call_semester:
        query = query.filter(Call.call_semester == call_semester)
    if university_id:
        query = query.filter(Call.university_id == university_id)
    if region:
        query = query.filter(University.region == region)
    if state:
        query = query.filter(University.state == state.upper())

    total = query.count()
    results = query.order_by(Call.call_year.desc(), Call.call_semester.desc(), Call.detected_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    data = []
    for call, uni in results:
        data.append({
            "id": call.id,
            "university_id": call.university_id,
            "university_name": uni.name,
            "university_acronym": uni.acronym,
            "university_state": uni.state,
            "university_region": uni.region,
            "call_year": call.call_year,
            "call_semester": call.call_semester,
            "call_type": call.call_type,
            "status": call.status,
            "description": call.description,
            "application_deadline": call.application_deadline,
            "call_url": call.call_url,
            "detected_at": call.detected_at.isoformat() if call.detected_at else None,
        })

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
        "data": data,
    }

@router.get("/stats/by-year")
def calls_by_year(db: Session = Depends(get_db)):
    results = db.query(
        Call.call_year, Call.call_semester, Call.status, func.count(Call.id)
    ).group_by(Call.call_year, Call.call_semester, Call.status).order_by(
        Call.call_year.desc(), Call.call_semester.desc()
    ).all()

    data = {}
    for year, semester, status, count in results:
        key = f"{year}/{semester}"
        if key not in data:
            data[key] = {"year": year, "semester": semester, "open": 0, "closed": 0, "upcoming": 0, "total": 0}
        data[key][status] = count
        data[key]["total"] += count

    return {"data": list(data.values())}
