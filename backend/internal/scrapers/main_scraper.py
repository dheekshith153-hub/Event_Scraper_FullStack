# -*- coding: utf-8 -*-
"""
Main scraper entry point — replaces cmd/scraper/main.go.
Runs all platform scrapers and inserts results into database.

Usage: python main_scraper.py
"""

import sys
import time
from datetime import datetime

from base_scraper import insert_batch
from models import Event
from utils import is_offline_event, is_upcoming

# Import all scrapers
from allevents_scraper import AllEventsScraper
from biec_scraper import BIECScraper
from meetup_scraper import MeetupScraper
from hasgeek_scraper import HasGeekScraper
from echai_scraper import EChaiScraper
from townscript_scraper import TownscriptScraper


def run_scraper(scraper) -> dict:
    """Run a single scraper and return status dict."""
    name = scraper.name()
    start = time.time()
    status = {"name": name, "success": False, "events_found": 0, "filtered": 0, "error": ""}

    try:
        print(f"\n{'=' * 60}")
        print(f"  Running: {name}")
        print(f"{'=' * 60}")

        events = scraper.scrape()

        # Filter: offline + upcoming
        clean_events = []
        filtered = 0
        for ev in events:
            if not is_offline_event(ev.event_type, ev.location, ev.event_name):
                filtered += 1
                continue
            date_str = ev.date_time or ev.date
            if not is_upcoming(date_str):
                filtered += 1
                continue
            clean_events.append(ev)

        # Insert into database
        inserted, skipped = 0, 0
        if clean_events:
            inserted, skipped = insert_batch(clean_events)

        status["success"] = True
        status["events_found"] = inserted
        status["filtered"] = filtered
        duration = time.time() - start
        print(f"\n  ✅ {name}: {inserted} inserted, {skipped} skipped, {filtered} filtered ({duration:.1f}s)")

    except Exception as e:
        status["error"] = str(e)
        duration = time.time() - start
        print(f"\n  ❌ {name}: ERROR - {e} ({duration:.1f}s)")

    return status


def main():
    print("=" * 60)
    print(f"  Event Scraper (Python) — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    scrapers = [
        HasGeekScraper(),
        EChaiScraper(),
        BIECScraper(),
        MeetupScraper(),
        AllEventsScraper(),
        TownscriptScraper(),
    ]

    results = []
    total_start = time.time()

    for scraper in scrapers:
        status = run_scraper(scraper)
        results.append(status)

    # Summary
    total_duration = time.time() - total_start
    total_found = sum(r["events_found"] for r in results)
    total_filtered = sum(r["filtered"] for r in results)
    successes = sum(1 for r in results if r["success"])
    failures = sum(1 for r in results if not r["success"])

    print(f"\n{'=' * 60}")
    print(f"  SUMMARY")
    print(f"{'=' * 60}")
    print(f"  Scrapers:  {successes} OK, {failures} failed")
    print(f"  Events:    {total_found} inserted, {total_filtered} filtered")
    print(f"  Duration:  {total_duration:.1f}s")
    print(f"{'=' * 60}")

    # Note: hitex.py runs separately (already Python)


if __name__ == "__main__":
    main()
