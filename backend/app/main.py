from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .database import engine, Base
from .routers import universities, calls
from .seed import seed_database

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_database()
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

@app.get("/api/health")
def health_check():
    return {"status": "ok", "universities_count": 124, "version": "1.0.0"}
