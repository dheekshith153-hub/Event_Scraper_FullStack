# -*- coding: utf-8 -*-
"""
Meetup scraper — mirrors meetup.go.
Scrapes upcoming in-person tech events from meetup.com using Chrome + __NEXT_DATA__ JSON.
"""

import json
import time as time_mod

from bs4 import BeautifulSoup

from base_scraper import BaseScraper, fetch_with_chrome, SELENIUM_AVAILABLE
from models import Event
from utils import is_upcoming, is_offline_event, is_tech_relevant


class MeetupScraper(BaseScraper):
    CITIES = ["Bangalore", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune", "Kolkata"]

    def __init__(self, timeout=30, retries=3):
        super().__init__(timeout, retries)

    def name(self) -> str:
        return "meetup"

    def scrape(self) -> list[Event]:
        all_events = []
        tech_category_id = "546"

        for city in self.CITIES:
            city_code = f"in--{city}"
            find_url = (
                f"https://www.meetup.com/find/?source=EVENTS&eventType=inPerson"
                f"&sortField=DATETIME&location={city_code}&categoryId={tech_category_id}"
            )
            events = self._scrape_city(find_url, city)
            all_events.extend(events)
            time_mod.sleep(2)

        print(f"Meetup: Found {len(all_events)} upcoming offline events")
        return all_events

    def _scrape_city(self, url: str, city: str) -> list[Event]:
        # Fetch listing page with Chrome (Meetup is Next.js, needs JS)
        html = fetch_with_chrome(url, timeout=20)
        if not html:
            print(f"Meetup: Failed to load page for {city}")
            return []

        events = self._parse_listing_html(html, city)

        # Enrich missing locations from event pages
        for ev in events:
            if not ev.website.strip():
                continue
            loc = ev.location.strip()
            if loc and loc != "N/A":
                continue
            venue_loc, venue_addr = self._enrich_from_event_page(ev.website)
            if venue_loc:
                ev.location = venue_loc
            if venue_addr:
                ev.address = venue_addr
            if not ev.location.strip():
                ev.location = "N/A"

        return _dedupe_by_website(events)

    def _parse_listing_html(self, html: str, city: str) -> list[Event]:
        doc = BeautifulSoup(html, "html.parser")
        out = []
        seen = set()

        script = doc.select_one("script#__NEXT_DATA__")
        if not script:
            return out

        try:
            data = json.loads(script.string)
        except (json.JSONDecodeError, TypeError):
            return out

        props = data.get("props", {})
        page_props = props.get("pageProps", {})
        if not page_props:
            return out

        # Try usual containers first
        evts = _extract_events_from_page_props(page_props, city)
        if evts:
            for e in evts:
                key = e.website.strip() or f"{e.event_name}|{e.date_time}"
                if key not in seen:
                    seen.add(key)
                    out.append(e)
            return out

        # Apollo cache fallback
        apollo = page_props.get("__APOLLO_STATE__", {})
        if apollo:
            evts = _extract_events_from_apollo(apollo, city)
            for e in evts:
                key = e.website.strip() or f"{e.event_name}|{e.date_time}"
                if key not in seen:
                    seen.add(key)
                    out.append(e)

        return out

    def _enrich_from_event_page(self, event_url: str) -> tuple:
        event_url = _normalize_meetup_url(event_url)
        if not event_url:
            return "", ""

        html = fetch_with_chrome(event_url, timeout=15)
        if not html:
            return "", ""

        doc = BeautifulSoup(html, "html.parser")

        # Check "needs a location"
        needs_loc = doc.select_one('[data-testid="needs-location"]')
        if needs_loc and "needs a location" in needs_loc.get_text().lower():
            return "N/A", ""

        # Venue/location candidates
        location = ""
        for sel in [
            '[data-testid="venue-name"]',
            '[data-testid="event-info-venue"]',
            '[data-testid="location"]',
            '.venueDisplay',
            '.eventInfo-address',
            'address',
        ]:
            el = doc.select_one(sel)
            if el:
                txt = _clean_space(el.get_text())
                if txt:
                    location = txt
                    break

        address = ""
        for sel in [
            '[data-testid="venue-address"]',
            '.eventInfo-address',
            'address',
        ]:
            el = doc.select_one(sel)
            if el:
                txt = _clean_space(el.get_text())
                if txt:
                    address = txt
                    break

        if location.lower() == "location":
            location = ""

        return location, address


# ═══════════════════════════════════════════════════════════════════════════════
#  DATA EXTRACTION HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _extract_events_from_page_props(page_props: dict, city: str) -> list[Event]:
    events_list = page_props.get("events")
    if not events_list:
        sr = page_props.get("searchResults", {})
        events_list = sr.get("edges") if sr else None
    if not events_list:
        return []

    out = []
    for item in events_list:
        event_data = _meetup_node(item)
        if not event_data:
            continue
        ev = _event_from_map(event_data, city)
        if ev:
            out.append(ev)
    return out


def _extract_events_from_apollo(apollo: dict, city: str) -> list[Event]:
    out = []
    for v in apollo.values():
        if not isinstance(v, dict):
            continue
        typename = v.get("__typename", "")
        if typename and "event" not in typename.lower():
            continue

        title = v.get("title") or v.get("name", "")
        title = _clean_space(title)
        if not title:
            continue

        if not is_tech_relevant(title):
            continue

        event_url = v.get("eventUrl") or v.get("link") or v.get("url", "")
        event_url = _normalize_meetup_url(event_url)
        if not event_url:
            continue

        date_time = v.get("dateTime") or v.get("time") or v.get("localDateTime", "")
        if not is_upcoming(date_time):
            continue

        is_online = v.get("isOnline", False)
        if is_online:
            continue

        venue_name, venue_city, venue_addr = "", "", ""
        venue = v.get("venue")
        if isinstance(venue, dict):
            venue_name = venue.get("name", "")
            venue_city = venue.get("city", "")
            venue_addr = venue.get("address", "")

        location = _build_meetup_location(city, venue_name, venue_addr, venue_city)
        if not location.strip():
            location = "N/A"

        if not is_offline_event("", location, title):
            continue

        desc = v.get("description", "")

        out.append(Event(
            event_name=title,
            date_time=date_time,
            location=location,
            address=venue_addr,
            website=event_url,
            description=desc,
            event_type="Offline",
            platform="meetup",
        ))

    return out


def _meetup_node(item):
    if not isinstance(item, dict):
        return None
    node = item.get("node")
    if isinstance(node, dict):
        return node
    return item


def _event_from_map(event_data: dict, city: str) -> Event | None:
    title = event_data.get("title") or event_data.get("name", "")
    title = _clean_space(title)
    if not title:
        return None

    if not is_tech_relevant(title):
        return None

    date_time = event_data.get("dateTime") or event_data.get("time", "")
    if not is_upcoming(date_time):
        return None

    description = event_data.get("description", "")

    event_url = event_data.get("eventUrl") or event_data.get("link", "")
    event_url = _normalize_meetup_url(event_url)
    if not event_url:
        return None

    venue_name, venue_city, venue_addr = "", "", ""
    venue = event_data.get("venue")
    if isinstance(venue, dict):
        venue_name = venue.get("name", "")
        venue_city = venue.get("city", "")
        venue_addr = venue.get("address", "")

    location = _build_meetup_location(city, venue_name, venue_addr, venue_city)
    if not location.strip():
        location = "N/A"

    is_online = event_data.get("isOnline", False)
    if is_online:
        return None

    if not is_offline_event("", location, title):
        return None

    return Event(
        event_name=title,
        location=location,
        address=venue_addr,
        date_time=date_time,
        website=event_url,
        description=description,
        event_type="Offline",
        platform="meetup",
    )


def _build_meetup_location(fallback_city: str, venue_name: str,
                           venue_addr: str, venue_city: str) -> str:
    parts = []
    if venue_name.strip():
        parts.append(_clean_space(venue_name))
    if venue_addr.strip():
        parts.append(_clean_space(venue_addr))
    if venue_city.strip():
        parts.append(_clean_space(venue_city))
    elif fallback_city.strip():
        parts.append(_clean_space(fallback_city))
    return ", ".join(parts).strip()


def _normalize_meetup_url(href: str) -> str:
    href = href.strip()
    if not href:
        return ""
    if href.startswith("http://") or href.startswith("https://"):
        return href
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        return "https://www.meetup.com" + href
    if "meetup.com/" in href:
        return "https://" + href
    return ""


def _clean_space(s: str) -> str:
    s = s.replace("\u00a0", " ")
    return " ".join(s.split())


def _dedupe_by_website(events: list[Event]) -> list[Event]:
    seen = set()
    out = []
    for e in events:
        key = e.website.strip() or f"{e.event_name}|{e.date_time}"
        if key not in seen:
            seen.add(key)
            out.append(e)
    return out
