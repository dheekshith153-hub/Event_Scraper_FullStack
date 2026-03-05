# -*- coding: utf-8 -*-
"""
HasGeek scraper — mirrors hasgeek.go.
Scrapes upcoming offline events from https://hasgeek.com.
"""

from bs4 import BeautifulSoup

from base_scraper import BaseScraper
from models import Event
from utils import is_upcoming, is_offline_event


class HasGeekScraper(BaseScraper):
    def __init__(self, timeout=30, retries=3):
        super().__init__(timeout, retries)
        self.url = "https://hasgeek.com"

    def name(self) -> str:
        return "hasgeek"

    def scrape(self) -> list[Event]:
        resp = self.fetch_with_retry(self.url)
        if not resp:
            print("HasGeek: Failed to fetch page")
            return []

        doc = BeautifulSoup(resp.text, "html.parser")
        events = []

        # Only scrape inside: <ul class="mui-list--unstyled grid upcoming">
        upcoming_list = doc.select("ul.mui-list--unstyled.grid.upcoming > li[role='listitem']")
        for li in upcoming_list:
            ev = self._parse_upcoming_item(li)
            if ev:
                print(f"  HasGeek: ✅ {ev.event_name} | {ev.date} | {ev.location}")
                events.append(ev)

        print(f"HasGeek: Found {len(events)} upcoming offline events")
        return events

    def _parse_upcoming_item(self, li) -> Event | None:
        a = li.select_one("a.card.card--upcoming")
        if not a:
            return None

        # Title
        title = (a.get("aria-label") or "").strip()
        if not title:
            tag = a.select_one(".card__image__tagline")
            title = tag.get_text(strip=True) if tag else ""
        if not title:
            tag = a.select_one("[data-cy-title]")
            title = (tag.get("data-cy-title") or "").strip() if tag else ""
        title = _clean_space(title)
        if not title:
            return None

        # Website
        href = (a.get("href") or "").strip()
        if not href:
            return None
        website = href
        if not website.startswith("http"):
            website = self.url + ("" if website.startswith("/") else "/") + website

        # Date + Location from aria-label="21 Feb 2026, Bangalore"
        aria_meta = _clean_space(
            (a.select_one("div[aria-label]") or {}).get("aria-label", "")
        )
        date = ""
        location = ""
        if aria_meta:
            parts = aria_meta.split(",", 1)
            date = parts[0].strip()
            if len(parts) == 2:
                location = parts[1].strip()

        # Fallbacks
        if not date:
            time_tag = a.select_one("time")
            date = _clean_space(time_tag.get_text()) if time_tag else ""
        if not location:
            loc_tag = a.select_one(".card__body__location")
            if not loc_tag:
                loc_tag = a.select_one(".location, .venue, [itemprop='location']")
            location = _clean_space(loc_tag.get_text()) if loc_tag else ""
        if not location:
            location = "N/A"

        # Skip online/virtual
        if not is_offline_event("", location, title):
            return None

        # Skip past events
        if date and not is_upcoming(date):
            return None

        return Event(
            event_name=title,
            location=location,
            date=date,
            website=website,
            event_type="Offline",
            platform="hasgeek",
        )


def _clean_space(s: str) -> str:
    s = s.replace("\u00a0", " ")
    return " ".join(s.split())
        