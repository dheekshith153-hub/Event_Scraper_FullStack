# -*- coding: utf-8 -*-
"""
BIEC scraper — mirrors biec.go.
Scrapes upcoming tech events from https://www.biec.in/events

HTML structure (2026):
  <div class="box">
    <div class="box-top">
      <img class="box-image" ...>
      <div class="title-flex">
        <h3 class="box-title"><a href="Calendar_event/..." class="button event-tit">Title</a></h3>
        <small><b>Organizer</b></small>
        <span class="event-date"><p>January 15 - 17, 2026</p></span>
        <span class="event-time"><p>9:00am - 6:00pm</p></span>
        <span class="event-loc"><p>Bengaluru, Karnataka</p></span>
      </div>
    </div>
    <a href="Calendar_event/..." class="button event-btn">Read More</a>
  </div>
"""

import re
import time as time_mod
from datetime import datetime, date

from bs4 import BeautifulSoup

from base_scraper import BaseScraper
from models import Event
from utils import (
    is_biec_tech_event, classify_tech_event,
    BIEC_NON_TECH_BLOCK,
)

BIEC_URL = "https://www.biec.in/events"
BIEC_BASE = "https://www.biec.in"

MONTHS = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
]
# Short months too
SHORT_MONTHS = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
]

_YEAR_OLD_RE = re.compile(r"\b(201[0-9]|202[0-4])\b")


def _clean_space(s: str) -> str:
    return " ".join(s.split())


def _abs_url(base: str, href: str) -> str:
    href = href.strip()
    if not href:
        return ""
    if href.startswith("http"):
        return href
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        return base + href
    return base + "/" + href


def _parse_month(month_str: str) -> int | None:
    """Convert month name to number (1-12)."""
    m = month_str.lower().strip().rstrip(".")
    for i, name in enumerate(MONTHS):
        if name.startswith(m[:3]):
            return i + 1
    return None


def _parse_biec_date_range(raw: str) -> tuple[date | None, date | None]:
    """Parse BIEC date formats like:
    - 'January 15 - 17, 2026'
    - 'February 26 - March 01, 2026'
    - 'April 9, 2026'
    - 'Apr 23 - 25, 2026'
    - 'April 6- 8, 2026' (no space before dash)
    Returns (start_date, end_date)
    """
    raw = _clean_space(raw)
    # Remove day suffix like st, nd, rd, th
    raw = re.sub(r"(\d+)(st|nd|rd|th)\b", r"\1", raw, flags=re.I)

    # Pattern 1: "Month DD - DD, YYYY" or "Month DD- DD, YYYY"
    m = re.match(
        r"(\w+)\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s*(\d{4})", raw, re.I
    )
    if m:
        month = _parse_month(m.group(1))
        if month:
            try:
                start = date(int(m.group(4)), month, int(m.group(2)))
                end = date(int(m.group(4)), month, int(m.group(3)))
                return start, end
            except ValueError:
                pass

    # Pattern 2: "Month DD - Month DD, YYYY"
    m = re.match(
        r"(\w+)\s+(\d{1,2})\s*[-–]\s*(\w+)\s+(\d{1,2}),?\s*(\d{4})", raw, re.I
    )
    if m:
        month1 = _parse_month(m.group(1))
        month2 = _parse_month(m.group(3))
        if month1 and month2:
            try:
                start = date(int(m.group(5)), month1, int(m.group(2)))
                end = date(int(m.group(5)), month2, int(m.group(4)))
                return start, end
            except ValueError:
                pass

    # Pattern 3: "Month DD, YYYY" (single date)
    m = re.match(r"(\w+)\s+(\d{1,2}),?\s*(\d{4})", raw, re.I)
    if m:
        month = _parse_month(m.group(1))
        if month:
            try:
                d = date(int(m.group(3)), month, int(m.group(2)))
                return d, d
            except ValueError:
                pass

    return None, None


def _biec_is_upcoming(date_str: str, now: datetime) -> bool:
    _, end_date = _parse_biec_date_range(date_str)
    if end_date is None:
        return True  # benefit of doubt
    return end_date >= now.date()


class BIECScraper(BaseScraper):
    def __init__(self, timeout=30, retries=3):
        super().__init__(timeout, retries)
        self.url = BIEC_URL

    def name(self) -> str:
        return "biec"

    def scrape(self) -> list[Event]:
        resp = self.fetch_with_retry(self.url)
        if not resp:
            print("BIEC: Failed to fetch page")
            return []

        doc = BeautifulSoup(resp.text, "html.parser")
        events = []
        now = datetime.now()

        # Find all div.box cards
        boxes = doc.select("div.box")
        print(f"  BIEC: Found {len(boxes)} event cards on page")

        for box in boxes:
            # ── Title ──
            title_link = box.select_one("h3.box-title a.event-tit")
            if not title_link:
                title_link = box.select_one("h3.box-title a")
            if not title_link:
                continue

            title = _clean_space(title_link.get_text())
            if not title or len(title) < 3:
                continue

            # ── Website URL ──
            href = title_link.get("href", "")
            website = _abs_url(BIEC_BASE, href)

            # Also check the "Read More" button
            if not website:
                read_more = box.select_one("a.event-btn")
                if read_more:
                    website = _abs_url(BIEC_BASE, read_more.get("href", ""))

            # ── Date ──
            date_el = box.select_one("span.event-date p")
            if not date_el:
                date_el = box.select_one("span.event-date")
            date_str = _clean_space(date_el.get_text()) if date_el else ""

            # ── Time ──
            time_el = box.select_one("span.event-time p")
            if not time_el:
                time_el = box.select_one("span.event-time")
            time_str = _clean_space(time_el.get_text()) if time_el else ""

            # ── Location ──
            loc_el = box.select_one("span.event-loc p")
            if not loc_el:
                loc_el = box.select_one("span.event-loc")
            location = _clean_space(loc_el.get_text()) if loc_el else ""
            if not location:
                location = "BIEC, Bengaluru, Karnataka"

            # ── Organizer ──
            org_el = box.select_one("small b") or box.select_one("small")
            organizer = _clean_space(org_el.get_text()) if org_el else ""

            # ── Skip old years ──
            if date_str and _YEAR_OLD_RE.search(date_str):
                print(f"  BIEC: ⏭️  SKIPPED (old year): {title}")
                continue

            # ── Skip past events ──
            if date_str and not _biec_is_upcoming(date_str, now):
                print(f"  BIEC: ⏭️  SKIPPED (past): {title} ({date_str})")
                continue

            # ── Tech filter ──
            if not is_biec_tech_event(title, website):
                title_lower = _clean_space(title).lower()
                is_hard_blocked = any(bad in title_lower for bad in BIEC_NON_TECH_BLOCK)

                if is_hard_blocked:
                    print(f"  BIEC: ❌ BLOCKED: {title}")
                    continue

                # LLM second-chance
                is_tech, reason = classify_tech_event(title, "")
                if not is_tech:
                    print(f"  BIEC: 🤖 NON-TECH: {title} ({reason})")
                    continue
                print(f"  BIEC: 🤖 RESCUED: {title} ({reason})")
            else:
                print(f"  BIEC: ✅ TECH: {title}")

            events.append(Event(
                event_name=title,
                location=location,
                date_time=date_str,
                date=date_str,
                time=time_str,
                website=website,
                event_type="Offline",
                platform="biec",
            ))

        print(f"BIEC: Found {len(events)} upcoming tech events")
        return events
