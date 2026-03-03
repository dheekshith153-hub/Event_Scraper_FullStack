# -*- coding: utf-8 -*-
"""
Townscript scraper — mirrors townscript.go.
Scrapes upcoming tech events from townscript.com/in/india/tech using Chrome.
"""

import re
import time as time_mod
from datetime import datetime

from bs4 import BeautifulSoup

from base_scraper import BaseScraper, fetch_with_chrome, SELENIUM_AVAILABLE
from models import Event
from utils import is_upcoming, is_offline_event

TOWNSCRIPT_BASE = "https://www.townscript.com"
TOWNSCRIPT_PAGES_URL = "https://www.townscript.com/in/india/tech?page=%d"
TOWNSCRIPT_MAX_PAGES = 25
TOWNSCRIPT_MAX_EMPTY = 2
MIN_HTML_SIZE = 8000

# Non-event blocklist
_TS_NON_EVENT_KEYWORDS = [
    "training", "course", "coaching", "tuition", "tutorial",
    "certification exam", "certification course",
    "real estate", "property", "plot", "flat",
    "machinery", "cnc", "lathe", "boiler", "compressor",
    "dental", "physiotherapy", "homeopathy", "ayurveda",
    "mutual fund", "stock market", "insurance", "forex",
    "visa", "immigration",
    "wedding", "bridal", "jewellery", "beauty", "makeup",
    "cooking", "baking", "food festival", "bakery",
    "yoga", "meditation", "spiritual", "astrology",
    "dance", "music", "singing", "drama", "theatre",
    "cricket", "football", "marathon", "cycling",
    "pet", "veterinary", "farming", "agriculture",
]

# Tech signal keywords
_TS_TECH_SIGNALS = [
    "tech", "developer", "devops", "hackathon", "startup",
    "ai", "ml", "data science", "machine learning", "deep learning",
    "python", "javascript", "react", "angular", "node", "java", "golang",
    "cloud", "aws", "azure", "gcp", "kubernetes", "docker",
    "blockchain", "web3", "crypto", "nft", "defi",
    "cybersecurity", "security", "infosec", "pentest",
    "iot", "robotics", "automation", "embedded",
    "saas", "api", "microservices", "serverless",
    "fintech", "biotech", "healthtech", "edtech", "agritech",
    "product", "design thinking", "ux", "ui",
    "open source", "linux", "git", "github",
    "conference", "summit", "meetup", "community",
    "innovation", "incubator", "accelerator",
]


def _is_ts_non_event(title: str) -> bool:
    lower = title.lower()
    return any(kw in lower for kw in _TS_NON_EVENT_KEYWORDS)


def _has_tech_signal(title: str) -> bool:
    lower = title.lower()
    return any(kw in lower for kw in _TS_TECH_SIGNALS)


class TownscriptScraper(BaseScraper):
    def __init__(self, timeout=30, retries=3):
        super().__init__(timeout, retries)

    def name(self) -> str:
        return "townscript"

    def scrape(self) -> list[Event]:
        if not SELENIUM_AVAILABLE:
            print("Townscript: Selenium not available, skipping")
            return []

        all_events = []
        empty_count = 0
        seen = set()

        for page in range(1, TOWNSCRIPT_MAX_PAGES + 1):
            url = TOWNSCRIPT_PAGES_URL % page
            page_events = self._scrape_page(url, seen)

            if not page_events:
                empty_count += 1
                if empty_count >= TOWNSCRIPT_MAX_EMPTY:
                    break
                continue

            empty_count = 0
            all_events.extend(page_events)
            time_mod.sleep(0.5)

        print(f"Townscript: Found {len(all_events)} upcoming tech events")
        return all_events

    def _scrape_page(self, url: str, seen: set) -> list[Event]:
        html = fetch_with_chrome(url, timeout=20)
        if not html or len(html) < MIN_HTML_SIZE:
            return []

        doc = BeautifulSoup(html, "html.parser")
        events = []

        # Find event cards
        for a in doc.select("a[href*='/e/'], a[href*='/events/']"):
            ev = self._extract_event(a, seen)
            if ev:
                events.append(ev)

        return events

    def _extract_event(self, a_tag, seen: set) -> Event | None:
        href = (a_tag.get("href") or "").strip()
        if not href:
            return None

        website = _normalize_ts_url(href)
        if not website or website in seen:
            return None

        # Title from heading
        title = ""
        for tag in ["h2", "h3", "h4", "h5"]:
            h = a_tag.select_one(tag)
            if h:
                title = _ts_cleaned(h.get_text())
                break
        if not title:
            title = _ts_cleaned(a_tag.get_text())
        title = _ts_first_line(title)
        if len(title) < 3:
            return None

        # Blocklist / tech signal check
        if _is_ts_non_event(title):
            return None
        if not _has_tech_signal(title):
            return None

        # Date
        date_str = ""
        parent = a_tag.find_parent(["div", "li", "article"])
        if parent:
            for el in parent.select("[class*='date'], [class*='time'], time"):
                text = _ts_cleaned(el.get_text())
                if text:
                    date_str = text
                    break

        if date_str and not _is_upcoming_ts(date_str):
            return None

        # Location
        location = ""
        if parent:
            for el in parent.select("[class*='location'], [class*='venue'], [class*='city']"):
                text = _ts_cleaned(el.get_text())
                if text:
                    location = text
                    break
        if not location:
            location = "N/A"

        if not is_offline_event("", location, title):
            return None

        seen.add(website)

        return Event(
            event_name=title,
            date_time=date_str,
            date=date_str,
            location=location,
            website=website,
            event_type="Offline",
            platform="townscript",
        )


def _normalize_ts_url(href: str) -> str:
    href = href.strip()
    if not href:
        return ""
    if href.startswith("http"):
        return href
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        return TOWNSCRIPT_BASE + href
    return ""


def _ts_cleaned(s: str) -> str:
    s = s.replace("\u00a0", " ")
    return " ".join(s.split()).strip()


def _ts_first_line(s: str) -> str:
    if "\n" in s:
        s = s[:s.index("\n")]
    return s.strip()


def _is_upcoming_ts(date_str: str) -> bool:
    return is_upcoming(date_str)
