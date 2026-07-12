from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class University(Base):
    __tablename__ = "universities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    acronym = Column(String(20), nullable=False, index=True)
    category = Column(String(20), nullable=False)
    state = Column(String(2), nullable=False, index=True)
    state_name = Column(String(100))
    city = Column(String(150), nullable=False)
    region = Column(String(20), nullable=False, index=True)
    website = Column(String(500))
    academic_system_url = Column(String(500))
    academic_system_name = Column(String(100))
    qs_ranking = Column(String(100))
    the_ranking = Column(String(100))
    graduate_page_url = Column(String(500))
    masters_count = Column(Integer)
    phd_count = Column(Integer)
    english_programmes = Column(Text)
    int_office_email = Column(String(255))
    int_office_phone = Column(String(100))
    int_office_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    programs = relationship("Program", back_populates="university", lazy="dynamic")

class Program(Base):
    __tablename__ = "programs"

    id = Column(Integer, primary_key=True, index=True)
    university_id = Column(Integer, ForeignKey("universities.id"), nullable=False, index=True)
    name = Column(String(500), nullable=False)
    level = Column(String(50), nullable=False, comment="Mestrado / Doutorado / Mestrado/Doutorado")
    url = Column(String(500))
    city = Column(String(150))
    campus = Column(String(300))
    master_required = Column(String(10), comment="SIM if master's is prerequisite for doctorate")
    start_date = Column(String(20), comment="DD/MM/YYYY")
    duration_months = Column(Integer)
    language_requirement = Column(String(300))

    scan_status = Column(String(20), default="unknown", comment="likely_open / possible / error / unknown")
    scan_confidence = Column(Float, default=0.0)
    scan_keywords = Column(Text, comment="JSON array of matched keywords")
    scan_dates_found = Column(Text, comment="JSON array of dates extracted")
    scan_title = Column(String(500))
    scan_last_checked = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    university = relationship("University", back_populates="programs")


class Call(Base):
    __tablename__ = "calls"

    id = Column(Integer, primary_key=True, index=True)
    university_id = Column(Integer, ForeignKey("universities.id"), nullable=False, index=True)
    call_year = Column(Integer, nullable=False, index=True)
    call_semester = Column(Integer, nullable=False, comment="1 = first semester, 2 = second semester")
    call_type = Column(String(30), nullable=False, comment="sisu / vestibular / graduate / international")
    status = Column(String(20), nullable=False, default="open", comment="open / closed / upcoming")
    description = Column(Text)
    application_deadline = Column(String(100))
    call_url = Column(String(500))
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    last_confirmed_at = Column(DateTime(timezone=True), onupdate=func.now())

class ScanLog(Base):
    __tablename__ = "scan_logs"

    id = Column(Integer, primary_key=True, index=True)
    university_id = Column(Integer, ForeignKey("universities.id"), nullable=False, index=True)
    scanned_at = Column(DateTime(timezone=True), server_default=func.now())
    http_status = Column(Integer)
    result_summary = Column(Text)
    error_message = Column(Text)
