import asyncio, logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from .engine import run_full_scan

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

async def scheduled_scan():
    logger.info("Starting scheduled scan...")
    try:
        await run_full_scan()
        logger.info("Scheduled scan completed.")
    except Exception as e:
        logger.error(f"Scheduled scan failed: {e}")

def start_scheduler():
    """Start the background scheduler that runs scans every 24 hours."""
    if scheduler.running:
        return

    scheduler.add_job(
        scheduled_scan,
        trigger=IntervalTrigger(hours=24),
        id="university_scan",
        name="Scan all universities for open calls",
        next_run_time=None,
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scanner scheduler started (runs every 24 hours).")
