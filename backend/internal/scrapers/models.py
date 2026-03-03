# -*- coding: utf-8 -*-
"""
Data models for the Event Scraper.
Mirrors the Go structs in internal/models/event.go.
"""

import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════════
#  CITY EXTRACTION
# ═══════════════════════════════════════════════════════════════════════════════

VENUE_TO_CITY = {
    "hitex": "Hyderabad", "hicc": "Hyderabad", "shilpakala": "Hyderabad",
    "t-hub": "Hyderabad", "iiit hyderabad": "Hyderabad", "hitech city": "Hyderabad",
    "gachibowli": "Hyderabad", "madhapur": "Hyderabad", "banjara hills": "Hyderabad",
    "biec": "Bengaluru", "palace grounds": "Bengaluru", "koramangala": "Bengaluru",
    "indiranagar": "Bengaluru", "whitefield": "Bengaluru", "hsr layout": "Bengaluru",
    "electronic city": "Bengaluru", "ub city": "Bengaluru", "mg road": "Bengaluru",
    "bombay exhibition": "Mumbai", "bkc": "Mumbai", "nesco": "Mumbai",
    "powai": "Mumbai", "andheri": "Mumbai", "lower parel": "Mumbai",
    "pragati maidan": "Delhi", "india expo": "Delhi", "dwarka": "Delhi",
    "connaught place": "Delhi", "gurugram": "Gurugram", "gurgaon": "Gurugram",
    "noida": "Noida", "greater noida": "Noida",
    "anna salai": "Chennai", "tidel park": "Chennai", "omr": "Chennai",
    "chennai trade centre": "Chennai", "nandambakkam": "Chennai",
    "hinjawadi": "Pune", "kharadi": "Pune", "magarpatta": "Pune",
    "viman nagar": "Pune", "baner": "Pune", "auto cluster": "Pune",
    "salt lake": "Kolkata", "sector v": "Kolkata", "new town": "Kolkata",
}

CITY_ALIASES = {
    "bengaluru": "Bengaluru", "bangalore": "Bengaluru", "blr": "Bengaluru",
    "hyderabad": "Hyderabad", "hyd": "Hyderabad", "secunderabad": "Hyderabad",
    "mumbai": "Mumbai", "bombay": "Mumbai",
    "delhi": "Delhi", "new delhi": "Delhi",
    "chennai": "Chennai", "madras": "Chennai",
    "pune": "Pune", "kolkata": "Kolkata", "calcutta": "Kolkata",
    "gurugram": "Gurugram", "gurgaon": "Gurugram",
    "noida": "Noida", "greater noida": "Noida",
    "ahmedabad": "Ahmedabad", "kochi": "Kochi", "cochin": "Kochi",
    "jaipur": "Jaipur", "lucknow": "Lucknow", "chandigarh": "Chandigarh",
    "indore": "Indore", "bhopal": "Bhopal", "coimbatore": "Coimbatore",
    "thiruvananthapuram": "Thiruvananthapuram", "trivandrum": "Thiruvananthapuram",
    "nagpur": "Nagpur", "visakhapatnam": "Visakhapatnam", "vizag": "Visakhapatnam",
    "mysuru": "Mysuru", "mysore": "Mysuru", "mangalore": "Mangalore",
    "karnataka": "Bengaluru", "telangana": "Hyderabad",
    "maharashtra": "Mumbai", "tamil Nadu": "Chennai",
}

_GARBAGE_RE = re.compile(
    r"(n/a|tba|tbd|to be announced|online|virtual|zoom|webinar|"
    r"google meet|microsoft teams|anywhere|remote)", re.I
)


def extract_city(raw_location: str) -> str:
    """Derive a canonical city name from a raw location string."""
    if not raw_location or not raw_location.strip():
        return "Unknown"
    if _GARBAGE_RE.search(raw_location):
        return "Unknown"

    norm = re.sub(r"\s+", " ", raw_location.lower()).strip()

    # Step 1: venue substring match (prefer longest)
    best_venue, best_city = "", ""
    for venue, city in VENUE_TO_CITY.items():
        if venue in norm and len(venue) > len(best_venue):
            best_venue, best_city = venue, city
    if best_city:
        return best_city

    # Step 2: city alias token match
    parts = [p.strip() for p in norm.split(",")]
    parts.append(norm)
    for part in parts:
        if part in CITY_ALIASES:
            return CITY_ALIASES[part]
        for word in part.split():
            if word in CITY_ALIASES:
                return CITY_ALIASES[word]
        words = part.split()
        for i in range(len(words) - 1):
            two_word = words[i] + " " + words[i + 1]
            if two_word in CITY_ALIASES:
                return CITY_ALIASES[two_word]

    return "Unknown"


# ═══════════════════════════════════════════════════════════════════════════════
#  EVENT MODEL
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class Event:
    event_name: str = ""
    location: str = ""
    city_normalized: str = ""
    date_time: str = ""
    date: str = ""
    time: str = ""
    website: str = ""
    description: str = ""
    address: str = ""
    event_type: str = ""
    platform: str = ""
    hash: str = ""
    id: int = 0

    def generate_hash(self):
        website = self.website.strip().lower()
        if "?" in website:
            website = website[: website.index("?")]
        website = website.rstrip("/")

        if website:
            key = website
        else:
            name = self.event_name.strip().lower()
            platform = self.platform.strip().lower()
            key = f"{name}|{platform}"

        self.hash = hashlib.sha256(key.encode()).hexdigest()

    def normalize(self):
        self.event_name = self.event_name.strip()
        self.location = self.location.strip()
        self.address = self.address.strip()
        self.date_time = self.date_time.strip()
        self.date = self.date.strip()
        self.time = self.time.strip()
        self.website = self.website.strip()
        self.description = self.description.strip()
        self.event_type = self.event_type.strip()
        self.platform = self.platform.strip()

        if not self.location:
            self.location = "N/A"

        if not self.event_type:
            combined = (self.location + " " + self.address).lower()
            if "online" in combined:
                self.event_type = "Online"
            else:
                self.event_type = "Offline"

        if not self.city_normalized or self.city_normalized == "Unknown":
            city = extract_city(self.location)
            if city == "Unknown" and self.address:
                city = extract_city(self.address)
            self.city_normalized = city

    def is_valid(self) -> bool:
        return bool(self.event_name) and bool(self.platform)


# ═══════════════════════════════════════════════════════════════════════════════
#  SCRAPED DETAIL MODEL
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class ScrapedDetail:
    event_id: int = 0
    full_description: str = ""
    organizer: str = ""
    organizer_contact: str = ""
    image_url: str = ""
    tags: str = ""
    price: str = ""
    registration_url: str = ""
    external_url: str = ""
    duration: str = ""
    agenda_html: str = ""
    speakers_json: str = ""
    prerequisites: str = ""
    max_attendees: int = 0
    attendees_count: int = 0
    scraped_body: str = ""


@dataclass
class EventFromDB:
    id: int = 0
    name: str = ""
    website: str = ""
    platform: str = ""
    location: str = ""
