# -*- coding: utf-8 -*-
"""
AllEvents scraper — mirrors allevents.go.
Scrapes upcoming tech events from allevents.in/{city}/technology
with "View More" pagination.

URL pattern: https://allevents.in/{city}/technology
HTML structure:
  <li class="event-card event-card-link" data-link="https://allevents.in/...">
    <div class="meta">
      <div class="date">Sat, 14 Mar, 2026 - 09:00 AM</div>
      <div class="title"><h3>Event Name</h3></div>
      <div class="location">Venue Name</div>
    </div>
  </li>
"""

import html as html_lib
import json
import random
import re
import time as time_mod
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from base_scraper import BaseScraper, HEADERS
from models import Event
from utils import (
    is_upcoming, is_offline_event, is_tech_relevant, is_online_location,
    classify_tech_event,
)
import requests as http_requests

ALLEVENTS_BASE = "https://allevents.in"
ALLEVENTS_MAX_PAGES = 6
PER_REQUEST_TIMEOUT = 15

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36",
]

# Maps AllEvents URL slug → clean display name stored in city_normalized column.
# Indian cities already handled by models.Event.normalize(); US cities need
# explicit mapping here since normalize() doesn't know them.
CITY_DISPLAY_NAMES = {
    # ── India (existing) ─────────────────────────────────────────────────────
    "bangalore":    "Bengaluru",
    "mumbai":       "Mumbai",
    "delhi":        "Delhi",
    "hyderabad":    "Hyderabad",
    "chennai":      "Chennai",
    "pune":         "Pune",
    "kolkata":      "Kolkata",
    "ahmedabad":    "Ahmedabad",
    # ── USA (new) ────────────────────────────────────────────────────────────
    "new-york":     "New York",
    "san-francisco":"San Francisco",
    "seattle":      "Seattle",
    "austin":       "Austin",
    "boston":       "Boston",
    "chicago":      "Chicago",
    "los-angeles":  "Los Angeles",
    "denver":       "Denver",
    "atlanta":      "Atlanta",
    "miami":        "Miami",
}


class AllEventsScraper(BaseScraper):
    CITIES = [
        # ── India ────────────────────────────────────────────────────────────
        "bangalore",
        "mumbai",
        "delhi",
        "hyderabad",
        "chennai",
        "pune",
        "kolkata",
        "ahmedabad",
        # ── USA ──────────────────────────────────────────────────────────────
        "new-york",
        "san-francisco",
        "seattle",
        "austin",
        "boston",
        "chicago",
        "los-angeles",
        "denver",
        "atlanta",
        "miami",
    ]

    def __init__(self, timeout=30, retries=3):
        super().__init__(timeout, retries)
        self._ua_index = 0

    def name(self) -> str:
        return "allevents"

    def scrape(self) -> list[Event]:
        all_events = []
        seen = set()

        for city in self.CITIES:
            time_mod.sleep(2 + random.randint(0, 2))
            display = CITY_DISPLAY_NAMES.get(city, city)
            print(f"  AllEvents: Scraping {city}/technology ({display}) ...")

            evs = self._scrape_city(city)

            new_count = 0
            for e in evs:
                key = e.website.strip() or f"{e.event_name}|{e.date_time}"
                if key not in seen:
                    seen.add(key)
                    all_events.append(e)
                    new_count += 1

            print(f"  AllEvents: {display} → {len(evs)} scraped, {new_count} new")

        print(f"AllEvents: Found {len(all_events)} unique upcoming events")
        return all_events

    def _scrape_city(self, city: str) -> list[Event]:
        ua = USER_AGENTS[self._ua_index % len(USER_AGENTS)]
        self._ua_index += 1

        list_url = f"{ALLEVENTS_BASE}/{city}/technology"

        try:
            resp = self._session.get(
                list_url, headers={"User-Agent": ua}, timeout=PER_REQUEST_TIMEOUT
            )
            if resp.status_code != 200:
                print(f"    AllEvents: HTTP {resp.status_code} for {list_url}")
                return []
        except Exception as e:
            print(f"    AllEvents: Error fetching {list_url}: {e}")
            return []

        body = resp.content
        doc = BeautifulSoup(body, "html.parser")
        collected = _parse_event_cards(doc, city)
        print(f"    AllEvents: Page 1 → {len(collected)} events")

        body_str = body.decode("utf-8", errors="replace")
        endpoint = _detect_view_more_endpoint(body_str)
        if not endpoint:
            endpoint = "https://allevents.in/api/events/list"

        for page in range(2, ALLEVENTS_MAX_PAGES + 1):
            time_mod.sleep(0.5 + random.random())

            more_events = self._fetch_view_more(endpoint, city, page, ua, list_url)
            if not more_events:
                break
            collected.extend(more_events)
            print(f"    AllEvents: Page {page} → {len(more_events)} events")
            if len(more_events) < 5:
                break

        collected = self._filter_and_normalize(collected, city)
        return _dedupe_by_website(collected)

    def _fetch_view_more(self, endpoint: str, city: str,
                         page: int, ua: str, referer: str) -> list[Event]:
        payload = {
            "city": city,
            "category": "technology",
            "page": page,
            "rows": 20,
            "event_type": "upcoming",
        }

        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "Accept": "application/json, text/plain, */*",
            "Origin": ALLEVENTS_BASE,
            "Referer": referer,
            "User-Agent": ua,
            "X-Requested-With": "XMLHttpRequest",
        }

        try:
            resp = http_requests.post(endpoint, json=payload, headers=headers,
                                      timeout=PER_REQUEST_TIMEOUT)
            if resp.status_code != 200:
                return []
        except Exception:
            return []

        body = resp.content
        trim = body.strip()

        if trim and trim[0:1] == b"<":
            doc = BeautifulSoup(body, "html.parser")
            return _parse_event_cards(doc, city)

        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            doc = BeautifulSoup(body, "html.parser")
            return _parse_event_cards(doc, city)

        if parsed.get("error", 0) != 0:
            return []

        if "html" in parsed and parsed["html"].strip():
            doc = BeautifulSoup(parsed["html"], "html.parser")
            return _parse_event_cards(doc, city)

        if "data" in parsed and isinstance(parsed["data"], list):
            return _parse_data_array(parsed["data"], city)

        return []

    def _filter_and_normalize(self, events: list[Event], city: str) -> list[Event]:
        # Resolve the clean display name once for this city
        city_normalized = CITY_DISPLAY_NAMES.get(city, city.replace("-", " ").title())

        out = []
        for e in events:
            name = e.event_name.strip()
            if not name:
                continue

            loc = e.location.strip() or city_normalized
            e.location = loc

            # Always stamp city_normalized so US cities store correctly in DB
            e.city_normalized = city_normalized

            if is_online_location(loc):
                continue

            if not is_tech_relevant(name):
                is_tech, reason = classify_tech_event(name, e.description)
                if not is_tech:
                    continue
                print(f"    AllEvents: 🤖 RESCUED: {name} ({reason})")

            date_str = e.date_time or e.date
            if not is_upcoming(date_str):
                continue

            out.append(e)
        return out


# ═══════════════════════════════════════════════════════════════════════════════
#  PARSING HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _parse_event_cards(doc: BeautifulSoup, city: str) -> list[Event]:
    events = []
    city_normalized = CITY_DISPLAY_NAMES.get(city, city.replace("-", " ").title())

    for li in doc.select("li.event-card.event-card-link[data-link]"):
        data_link = li.get("data-link", "").strip()
        if not data_link:
            continue

        title_el = li.select_one("div.title h3") or li.select_one("div.title a")
        title = title_el.get_text(strip=True) if title_el else ""
        if len(title) < 3:
            continue

        date_el = li.select_one("div.date")
        date_str = date_el.get_text(strip=True) if date_el else ""

        location_el = li.select_one("div.location")
        location = location_el.get_text(strip=True) if location_el else city_normalized

        events.append(Event(
            event_name=title,
            date_time=date_str,
            location=location,
            city_normalized=city_normalized,   # ← set here so DB always has clean name
            website=_absolute_url(data_link),
            event_type="Offline",
            platform="allevents",
        ))
    return events


def _parse_data_array(data: list, city: str) -> list[Event]:
    """Parse JSON data array into events (from View More response)."""
    events = []
    city_normalized = CITY_DISPLAY_NAMES.get(city, city.replace("-", " ").title())

    for row in data:
        if not isinstance(row, dict):
            continue
        name = row.get("eventname", "").strip()
        link = row.get("event_url", "").strip()
        if not link:
            continue
        start = row.get("start_time_display", "")
        loc   = row.get("location", "") or city_normalized

        events.append(Event(
            event_name=name,
            date_time=start,
            location=loc,
            city_normalized=city_normalized,   # ← set here too
            website=_absolute_url(link),
            event_type="Offline",
            platform="allevents",
        ))
    return events


def _detect_view_more_endpoint(page_html: str) -> str:
    if re.search(r"https://allevents\.in/api/events/list", page_html):
        return "https://allevents.in/api/events/list"
    return ""


def _absolute_url(href: str) -> str:
    href = href.strip()
    if not href:
        return ""
    if href.startswith("http"):
        return href
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        return ALLEVENTS_BASE + href
    return ALLEVENTS_BASE + "/" + href


def _dedupe_by_website(events: list[Event]) -> list[Event]:
    seen = set()
    out = []
    for e in events:
        key = e.website.strip() or f"{e.event_name}|{e.date_time}"
        if key not in seen:
            seen.add(key)
            out.append(e)
    return out