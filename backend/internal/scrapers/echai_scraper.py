# -*- coding: utf-8 -*-
"""
eChai scraper — mirrors echai.go.
Scrapes upcoming events from https://echai.ventures/events.
"""

import re

from bs4 import BeautifulSoup

from base_scraper import BaseScraper
from models import Event
from utils import is_upcoming, is_offline_event


class EChaiScraper(BaseScraper):
    BASE_URL = "https://echai.ventures"

    def __init__(self, timeout=30, retries=3):
        super().__init__(timeout, retries)
        self.url = f"{self.BASE_URL}/events"

    def name(self) -> str:
        return "echai"

    def scrape(self) -> list[Event]:
        resp = self.fetch_with_retry(self.url)
        if not resp:
            print("eChai: Failed to fetch page")
            return []

        doc = BeautifulSoup(resp.text, "html.parser")
        events = []

        for container in doc.select("div.position-relative.border-bottom.pb-1"):
            # ── Title
            h6 = container.select_one("h6.event-title")
            title = h6.get_text(strip=True) if h6 else ""
            if not title:
                continue

            # ── Date
            raw_date = container.get("data-date", "")
            date = ""
            if raw_date:
                parts = raw_date.split("T")
                if parts:
                    date = parts[0]
            if not is_upcoming(date):
                continue

            # ── Website link
            website = ""
            a_link = container.select_one("a.stretched-link")
            if a_link:
                href = a_link.get("href", "")
                website = _resolve_url(self.BASE_URL, href)

            # ── Image
            image_url = ""
            for img in container.select("img"):
                src = img.get("src", "")
                if src and "logo" not in src:
                    image_url = _resolve_url(self.BASE_URL, src)
                    break
            if not image_url:
                for el in container.select("[style]"):
                    style = el.get("style", "")
                    idx = style.find("url(")
                    if idx >= 0:
                        raw = style[idx + 4:]
                        end = raw.find(")")
                        if end > 0:
                            u = raw[:end].strip("'\"")
                            if u:
                                image_url = _resolve_url(self.BASE_URL, u)
                                break

            # ── Location
            location = ""
            geo = container.select_one("svg.bi-geo")
            if geo and geo.parent:
                location = geo.parent.get_text(strip=True)
            if not location:
                loc_el = container.select_one("[class*='location'], [class*='venue'], [class*='city']")
                location = loc_el.get_text(strip=True) if loc_el else ""
            if not location:
                location = "N/A"

            event_type = "Offline"
            if "online" in location.lower() or "online" in title.lower():
                event_type = "Online"
            if not is_offline_event(event_type, location, title):
                continue

            # ── Description
            description = ""
            desc_el = container.select_one("[class*='description'], [class*='desc'], [class*='summary']")
            if desc_el:
                description = desc_el.get_text(strip=True)

            # Embed image URL in description marker
            if image_url:
                description = f"[img:{image_url}] {description}"

            events.append(Event(
                event_name=title,
                date=date,
                location=location,
                website=website,
                description=description.strip(),
                event_type="Offline",
                platform="echai",
            ))

        print(f"eChai: Found {len(events)} upcoming offline events")
        return events


def _resolve_url(base: str, href: str) -> str:
    href = href.strip()
    if href.startswith("http"):
        return href
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        return base + href
    return base + "/" + href
