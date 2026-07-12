from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .database import engine, Base, SessionLocal
from .models import University, Program
from .routers import universities, calls, programs
from .seed import seed_database
from .seed_programs import seed_programs

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_database()
    seed_programs()
    from .scanner.scheduler import start_scheduler
    start_scheduler()
    yield

app = FastAPI(
    title="Brazil Public Universities & Application Calls API",
    description="Database of all Brazilian public universities with call-for-application scanner",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(universities.router)
app.include_router(calls.router)
app.include_router(programs.router)

@app.get("/api/health")
def health_check():
    db = SessionLocal()
    try:
        uni_count = db.query(University).count()
        prog_count = db.query(Program).count()
    except Exception:
        uni_count = None
        prog_count = None
    finally:
        db.close()
    return {
        "status": "ok",
        "universities_count": uni_count,
        "programs_count": prog_count,
        "version": "1.0.0",
    }
