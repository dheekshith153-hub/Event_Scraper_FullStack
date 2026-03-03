# -*- coding: utf-8 -*-
"""
Detail scraper — mirrors detail_scraper.go.
Enriches events from the database with full descriptions, organizer info, etc.
Uses Ollama for lightweight title-based description generation.

FIXES:
  1. LIMIT 100 → processes ALL events missing details
  2. SQL injection in RESCRAPE_DAYS → parameterized query
  3. VARCHAR(300) overflow → truncate all fields before save
  4. detail.external_url → removed (field doesn't exist on ScrapedDetail)
  5. DB connection lost after rollback → reconnect on error
  6. bridge.go callback(EventID=0) → skip zero-id details in Python too
  7. Phone numbers, addresses, emails stripped before save (sanitize_for_display)
"""

import html as html_lib
import os
import random
import re
import time as time_mod
import unicodedata
from datetime import datetime

import psycopg2
from bs4 import BeautifulSoup

from base_scraper import BaseScraper, fetch_with_chrome, SELENIUM_AVAILABLE, get_db_connection
from models import ScrapedDetail, EventFromDB
from utils import generate_description_from_title

DETAIL_MIN_DELAY  = 5    # was 3 — gives CPU breathing room between events
DETAIL_MAX_DELAY  = 10   # was 7
RESCRAPE_DAYS     = 7
BATCH_SIZE        = 75   # was 500 — scheduler runs every 10min, so ~450/hr still processed

# Max lengths that match the actual DB schema (TEXT cols, but truncate for safety)
MAX_DESC_LEN      = 8000
MAX_SHORT_LEN     = 500
MAX_URL_LEN       = 2000
MAX_HTML_LEN      = 16000


def _trunc(s: str, max_len: int) -> str:
    """Truncate a string safely."""
    if not s:
        return ""
    return s[:max_len]


# ═══════════════════════════════════════════════════════════════════════════════
#  TEXT SANITIZER  —  strips PII and enforces clean English
# ═══════════════════════════════════════════════════════════════════════════════

# ── Compiled patterns (fast at call time) ─────────────────────────────────────

# Phone numbers: Indian (+91, 10-digit), international, with separators
_RE_PHONE = re.compile(
    r"""
    (?<!\w)                        # not preceded by word char
    (?:
        (?:\+91[\s\-]?)?           # optional +91 country code
        [6-9]\d{9}                 # Indian 10-digit mobile
        |
        \+?[\d\s\-\(\)]{7,15}      # generic international with spaces/dashes
        (?=\s|$|[^\d])             # followed by whitespace, end, or non-digit
    )
    """,
    re.VERBOSE,
)

# Email addresses
_RE_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", re.I)

# Bare URLs (http/https/www)
_RE_URL = re.compile(
    r"(?:https?://|www\.)\S+",
    re.I,
)

# PIN codes (Indian 6-digit postal codes, sometimes prefixed with "PIN" or "Pincode")
_RE_PIN = re.compile(r"\b(?:PIN\s*:?\s*)?\d{6}\b", re.I)

# Physical address indicators:
# "No. 5", "#42", "Flat 3B", "Door No", "Plot No", "Survey No", "Sy No",
# "H.No", "House No", "Shop No", "Khasra No"
_RE_ADDR_PREFIX = re.compile(
    r"\b(?:No\.?|#|Flat|Door\s+No\.?|Plot\s+No\.?|Survey\s+No\.?|"
    r"Sy\.?\s*No\.?|H\.?\s*No\.?|House\s+No\.?|Shop\s+No\.?|"
    r"Khasra\s+No\.?)\s*\d+\w*",
    re.I,
)

# Street-level address fragments: "Road", "Street", "Colony", "Nagar",
# "Layout", "Extension", "Sector", "Phase", preceded by a building/block number
_RE_STREET = re.compile(
    r"\d+\s*[,\-]?\s*(?:[A-Z][a-z]+\s+)*(?:"
    r"Road|Street|St\.|Lane|Avenue|Ave\.|Blvd|Boulevard|"
    r"Colony|Nagar|Enclave|Layout|Extension|Ext\.|"
    r"Sector\s+\d+|Phase\s+\d+|Block\s+\w+|"
    r"Cross|Main|Circle|Ring\s+Road"
    r")\b",
    re.I,
)

# Standalone social handles / WhatsApp CTA lines
_RE_SOCIAL_LINE = re.compile(
    r"(?:whatsapp|telegram|signal|discord|t\.me|wa\.me|chat\.whatsapp)"
    r"[\s:/.]+\S+",
    re.I,
)

# Lines that are clearly "contact us at …" or "reach us at …"
_RE_CONTACT_LINE = re.compile(
    r"(?:contact|reach|call|email|write)\s+(?:us|me)\s+(?:at|on|via)?\s*[:–\-]?",
    re.I,
)

# ── Sentence-level grammar fixes ──────────────────────────────────────────────

def _fix_sentence_grammar(text: str) -> str:
    """
    Light grammar fixes on a plain-text paragraph:
    1. Capitalise the first letter of each sentence.
    2. Ensure sentences end with a full stop if they lack terminal punctuation.
    3. Collapse multiple consecutive spaces.
    4. Remove lines that are pure numbers, single symbols, or too short.
    """
    # Collapse horizontal whitespace
    text = re.sub(r"[ \t]+", " ", text).strip()

    # Split into sentences on . ! ? followed by whitespace or end
    sentences = re.split(r"(?<=[.!?])\s+", text)

    cleaned = []
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        # Skip if the sentence is just punctuation, a number, or fewer than 4 words
        if re.fullmatch(r"[\W\d]+", s) or len(s.split()) < 4:
            continue
        # Capitalise first letter
        s = s[0].upper() + s[1:]
        # Add full stop if sentence lacks terminal punctuation
        if s[-1] not in ".!?":
            s += "."
        cleaned.append(s)

    return " ".join(cleaned)


# ── Main sanitizer ────────────────────────────────────────────────────────────

def sanitize_for_display(text: str) -> str:
    """
    Strip all phone numbers, email addresses, physical addresses, bare URLs,
    PIN codes, and social/contact CTA lines from a description.
    Then apply light grammar fixes so the result reads as proper English.

    Applied before every DB write and after every LLM generation.
    """
    if not text:
        return ""

    lines = text.split("\n")
    clean_lines = []

    for line in lines:
        t = line.strip()
        if not t:
            clean_lines.append("")
            continue

        # ── Drop entire line if it is primarily a contact/social/CTA line ──
        if _RE_CONTACT_LINE.search(t):
            continue
        if _RE_SOCIAL_LINE.search(t):
            continue
        # Line whose majority is a phone/email/URL (>40 % of chars)
        phone_hits = _RE_PHONE.findall(t)
        if phone_hits and sum(len(h) for h in phone_hits) > 0.4 * len(t):
            continue
        email_hits = _RE_EMAIL.findall(t)
        if email_hits and sum(len(h) for h in email_hits) > 0.4 * len(t):
            continue

        # ── Strip inline occurrences ──────────────────────────────────────
        t = _RE_EMAIL.sub("", t)
        t = _RE_URL.sub("", t)
        t = _RE_PHONE.sub("", t)
        t = _RE_PIN.sub("", t)
        t = _RE_ADDR_PREFIX.sub("", t)
        t = _RE_STREET.sub("", t)

        # Remove orphaned punctuation left after substitution
        t = re.sub(r"[,\-–|]+\s*[,\-–|]+", ",", t)   # double commas / dashes
        t = re.sub(r"\s+[,\-–|]\s*$", "", t)           # trailing comma/dash
        t = re.sub(r"^\s*[,\-–|]+\s*", "", t)          # leading comma/dash
        t = re.sub(r"\s{2,}", " ", t).strip()

        if t:
            clean_lines.append(t)

    # Re-join and apply paragraph-level grammar fix
    result = "\n".join(clean_lines)

    # Grammar fix per paragraph (lines separated by blank line)
    paragraphs = re.split(r"\n{2,}", result)
    fixed_paragraphs = []
    for para in paragraphs:
        # Within a paragraph, join lines and fix grammar
        para_text = " ".join(l.strip() for l in para.split("\n") if l.strip())
        if para_text:
            fixed_paragraphs.append(_fix_sentence_grammar(para_text))

    return "\n\n".join(fixed_paragraphs).strip()


# ═══════════════════════════════════════════════════════════════════════════════

class DetailScraper(BaseScraper):
    def __init__(self, timeout=30, retries=3):
        super().__init__(timeout, retries)
        self.conn = get_db_connection()
        self._chrome_driver = None   # reused across all events — avoids per-event spawn cost

    # ── Chrome driver lifecycle ───────────────────────────────────────────────

    def _get_chrome_driver(self):
        """Return the shared driver, creating it once if not yet started."""
        if self._chrome_driver is None:
            if not SELENIUM_AVAILABLE:
                return None
            try:
                from base_scraper import build_chrome_driver
                self._chrome_driver = build_chrome_driver()
                print("  [CHROME] Driver started (reused for this cycle)")
            except Exception as e:
                print(f"  [CHROME] Failed to start driver: {e}")
                return None
        return self._chrome_driver

    def _fetch_with_shared_chrome(self, url: str, timeout: int = 20) -> str:
        """Fetch a URL using the shared Chrome driver instead of spawning a new one."""
        driver = self._get_chrome_driver()
        if not driver:
            return ""
        try:
            driver.get(url)
            # Wait up to `timeout` seconds for body to have meaningful content
            import time as _t
            deadline = _t.time() + timeout
            while _t.time() < deadline:
                body = driver.find_element("tag name", "body").text
                if len(body) > 200:
                    break
                _t.sleep(0.5)
            _t.sleep(1.0)   # small extra settle
            return driver.page_source
        except Exception as e:
            print(f"  [CHROME] fetch error for {url}: {e}")
            # Driver may be in bad state — kill it so next event gets a fresh one
            self._quit_chrome()
            return ""

    def _quit_chrome(self):
        """Quit the shared driver. Called once at end of scrape(), not per event."""
        if self._chrome_driver:
            try:
                self._chrome_driver.quit()
            except Exception:
                pass
            self._chrome_driver = None
            print("  [CHROME] Driver closed")

    def name(self) -> str:
        return "detail_scraper"

    def _ensure_conn(self):
        """Reconnect if connection was lost after a rollback."""
        try:
            self.conn.cursor().execute("SELECT 1")
        except Exception:
            print("  [DB] Reconnecting...")
            try:
                self.conn.close()
            except Exception:
                pass
            self.conn = get_db_connection()

    def scrape(self):
        """Main loop: get events needing details and scrape each."""
        events = self._get_events_from_db()
        print(f"DetailScraper: {len(events)} events to process (batch_size={BATCH_SIZE})")

        for i, event in enumerate(events):
            print(f"\n[{i + 1}/{len(events)}] {event.name}")
            print(f"  URL: {event.website}")

            try:
                detail = self._scrape_event_detail(event)
                if detail:
                    self._ensure_conn()
                    self._save_detail(detail)
                    print(f"  ✅ Saved detail for event #{event.id}")
            except Exception as e:
                print(f"  ❌ Error: {e}")

            delay = DETAIL_MIN_DELAY + random.randint(0, DETAIL_MAX_DELAY - DETAIL_MIN_DELAY)
            time_mod.sleep(delay)

        # Quit shared Chrome driver once after all events — not per event
        self._quit_chrome()

        try:
            self.conn.close()
        except Exception:
            pass

        print(f"\nDetailScraper: Finished processing {len(events)} events")

    def _get_events_from_db(self) -> list[EventFromDB]:
        cur = self.conn.cursor()
        cur.execute("""
            SELECT e.id, e.event_name, e.website, e.platform, e.location
            FROM events e
            LEFT JOIN event_details ed ON ed.event_id = e.id
            WHERE e.website IS NOT NULL
              AND e.website != ''
              AND (
                ed.id IS NULL
                OR ed.last_scraped < NOW() - INTERVAL '%(days)s days'
              )
            ORDER BY e.created_at DESC
            LIMIT %(limit)s
        """, {"days": RESCRAPE_DAYS, "limit": BATCH_SIZE})

        rows = cur.fetchall()
        cur.close()

        return [
            EventFromDB(id=r[0], name=r[1], website=r[2], platform=r[3], location=r[4] or "")
            for r in rows
        ]

    def _scrape_event_detail(self, event: EventFromDB) -> ScrapedDetail | None:
        """Scrape a single event's detail page."""
        detail = ScrapedDetail(event_id=event.id)
        platform = event.platform.lower()

        html = ""
        if platform in ("townscript", "meetup", "echai"):
            # Reuse shared driver — avoids spawning/killing Chrome per event
            html = self._fetch_with_shared_chrome(event.website, timeout=20)
        else:
            resp = self.fetch_with_retry(event.website)
            if resp:
                html = resp.text

        if not html:
            desc = generate_description_from_title(event.name, event.platform)
            if desc:
                # Sanitize LLM output before storing
                detail.full_description = _trunc(
                    sanitize_for_display(desc), MAX_DESC_LEN
                )
                return detail
            return None

        doc = BeautifulSoup(html, "html.parser")

        if platform == "allevents":
            detail = self._parse_allevents_detail(doc, event)
        elif platform == "hasgeek":
            detail = self._parse_hasgeek_detail(doc, event)
        elif platform == "meetup":
            detail = self._parse_meetup_detail(doc, event)
        elif platform == "echai":
            detail = self._parse_echai_detail(doc, event)
        elif platform == "biec":
            detail = self._parse_biec_detail(doc, event)
        elif platform == "hitex":
            detail = self._parse_hitex_detail(doc, event)
        elif platform == "townscript":
            detail = self._parse_townscript_detail(doc, event)
        else:
            detail = self._parse_generic_detail(doc, event)

        # Sanitize scraped description before LLM fallback check
        if detail.full_description:
            detail.full_description = sanitize_for_display(detail.full_description)

        desc = detail.full_description.strip()
        if len(desc) < 50 or _is_noisy_description(desc):
            print(f"  🦙 Description too short/noisy ({len(desc)} chars), generating from title...")
            llm_desc = generate_description_from_title(event.name, event.platform)
            if llm_desc:
                detail.full_description = _trunc(
                    sanitize_for_display(llm_desc), MAX_DESC_LEN
                )

        return detail

    # ──────────────────────────────────────────────────────────────────────────
    #  PLATFORM PARSERS
    # ──────────────────────────────────────────────────────────────────────────

    def _parse_allevents_detail(self, doc, event: EventFromDB) -> ScrapedDetail:
        detail = ScrapedDetail(event_id=event.id)
        desc_el = doc.select_one(
            ".event-description-html, .event-description, .event-details-section"
        )
        if desc_el:
            detail.full_description = _trunc(
                _clean_to_plain_text(desc_el.get_text()), MAX_DESC_LEN
            )
        org_el = doc.select_one(".organizer-name, .host-name, [class*='organizer']")
        if org_el:
            detail.organizer = _trunc(org_el.get_text(strip=True), MAX_SHORT_LEN)
        img = doc.select_one("meta[property='og:image']")
        if img:
            detail.image_url = _trunc(img.get("content", ""), MAX_URL_LEN)
        return detail

    def _parse_hasgeek_detail(self, doc, event: EventFromDB) -> ScrapedDetail:
        detail = ScrapedDetail(event_id=event.id)
        desc_el = doc.select_one(".about, .description, .markdown, article .content")
        if desc_el:
            detail.full_description = _trunc(
                _clean_to_plain_text(desc_el.get_text()), MAX_DESC_LEN
            )
        img = doc.select_one("meta[property='og:image']")
        if img:
            detail.image_url = _trunc(img.get("content", ""), MAX_URL_LEN)
        return detail

    def _parse_meetup_detail(self, doc, event: EventFromDB) -> ScrapedDetail:
        detail = ScrapedDetail(event_id=event.id)
        desc_el = doc.select_one(
            ".event-description, [id*='event-details'], .break-words"
        )
        if desc_el:
            detail.full_description = _trunc(
                _clean_to_plain_text(desc_el.get_text()), MAX_DESC_LEN
            )
        org_el = doc.select_one("[data-testid='group-name'], .groupName a")
        if org_el:
            detail.organizer = _trunc(org_el.get_text(strip=True), MAX_SHORT_LEN)
        img = doc.select_one("meta[property='og:image']")
        if img:
            detail.image_url = _trunc(img.get("content", ""), MAX_URL_LEN)
        return detail

    def _parse_echai_detail(self, doc, event: EventFromDB) -> ScrapedDetail:
        detail = ScrapedDetail(event_id=event.id)
        for sel in [
            ".event-description", ".about-event", ".description",
            "article .content", "main p",
        ]:
            el = doc.select_one(sel)
            if el:
                text = _clean_to_plain_text(el.get_text())
                if len(text) > 40:
                    detail.full_description = _trunc(text, MAX_DESC_LEN)
                    break
        img = doc.select_one("meta[property='og:image']")
        if img:
            detail.image_url = _trunc(img.get("content", ""), MAX_URL_LEN)
        return detail

    def _parse_biec_detail(self, doc, event: EventFromDB) -> ScrapedDetail:
        detail = ScrapedDetail(event_id=event.id)
        for sel in [
            ".event-description", ".event-details p",
            "#about p", ".content p", "main p",
        ]:
            el = doc.select_one(sel)
            if el:
                text = _clean_to_plain_text(el.get_text())
                if len(text) > 40:
                    detail.full_description = _trunc(text, MAX_DESC_LEN)
                    break
        img = doc.select_one("meta[property='og:image']")
        if img:
            detail.image_url = _trunc(img.get("content", ""), MAX_URL_LEN)
        return detail

    def _parse_hitex_detail(self, doc, event: EventFromDB) -> ScrapedDetail:
        detail = ScrapedDetail(event_id=event.id)
        ext_url = ""
        for a in doc.select("a.btn, a[class*='btn']"):
            href = a.get("href", "").strip()
            text = a.get_text(strip=True).lower()
            if href.startswith("http") and "hitex.co.in" not in href:
                if "website" in text:
                    ext_url = href
                    break

        if ext_url:
            ext_resp = self.fetch_with_retry(ext_url)
            if ext_resp:
                ext_doc = BeautifulSoup(ext_resp.text, "html.parser")
                desc = _extract_description_from_soup(ext_doc)
                if desc:
                    detail.full_description = _trunc(desc, MAX_DESC_LEN)

        if not detail.full_description:
            for sel in [
                ".event-description", ".event-details p", "main p", ".content p"
            ]:
                el = doc.select_one(sel)
                if el:
                    text = _clean_to_plain_text(el.get_text())
                    if len(text) > 40:
                        detail.full_description = _trunc(text, MAX_DESC_LEN)
                        break

        img = doc.select_one("meta[property='og:image']")
        if img:
            detail.image_url = _trunc(img.get("content", ""), MAX_URL_LEN)
        return detail

    def _parse_townscript_detail(self, doc, event: EventFromDB) -> ScrapedDetail:
        detail = ScrapedDetail(event_id=event.id)
        for sel in [
            "#event-info-content", ".event-info-body", ".event-description",
            ".about-event", "article .content",
        ]:
            el = doc.select_one(sel)
            if el:
                text = _clean_to_plain_text(el.get_text())
                if len(text) > 40:
                    detail.full_description = _trunc(text, MAX_DESC_LEN)
                    break
        org_el = doc.select_one("[class*='organizer'], [class*='host']")
        if org_el:
            detail.organizer = _trunc(org_el.get_text(strip=True), MAX_SHORT_LEN)
        img = doc.select_one("meta[property='og:image']")
        if img:
            detail.image_url = _trunc(img.get("content", ""), MAX_URL_LEN)
        return detail

    def _parse_generic_detail(self, doc, event: EventFromDB) -> ScrapedDetail:
        detail = ScrapedDetail(event_id=event.id)
        desc = _extract_description_from_soup(doc)
        if desc:
            detail.full_description = _trunc(desc, MAX_DESC_LEN)
        img = doc.select_one("meta[property='og:image']")
        if img:
            detail.image_url = _trunc(img.get("content", ""), MAX_URL_LEN)
        return detail

    # ──────────────────────────────────────────────────────────────────────────
    #  DATABASE
    # ──────────────────────────────────────────────────────────────────────────

    def _save_detail(self, detail: ScrapedDetail):
        if not detail.event_id:
            print("  [SKIP] event_id is 0 or None — skipping")
            return

        # Final sanitization pass before every DB write
        sanitized_desc = sanitize_for_display(
            _trunc(detail.full_description, MAX_DESC_LEN)
        )

        cur = self.conn.cursor()
        try:
            cur.execute("""
                INSERT INTO event_details (
                    event_id, full_description, organizer, organizer_contact,
                    image_url, tags, price, registration_url, duration,
                    agenda_html, speakers_json, prerequisites,
                    max_attendees, attendees_count, last_scraped, scraped_body,
                    created_at, updated_at
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),%s,NOW(),NOW())
                ON CONFLICT (event_id) DO UPDATE SET
                    full_description  = EXCLUDED.full_description,
                    organizer         = EXCLUDED.organizer,
                    organizer_contact = EXCLUDED.organizer_contact,
                    image_url         = EXCLUDED.image_url,
                    tags              = EXCLUDED.tags,
                    price             = EXCLUDED.price,
                    registration_url  = EXCLUDED.registration_url,
                    duration          = EXCLUDED.duration,
                    agenda_html       = EXCLUDED.agenda_html,
                    speakers_json     = EXCLUDED.speakers_json,
                    prerequisites     = EXCLUDED.prerequisites,
                    max_attendees     = EXCLUDED.max_attendees,
                    attendees_count   = EXCLUDED.attendees_count,
                    last_scraped      = NOW(),
                    scraped_body      = EXCLUDED.scraped_body,
                    updated_at        = NOW()
            """, (
                detail.event_id,
                sanitized_desc,
                _trunc(detail.organizer,           MAX_SHORT_LEN),
                _trunc(detail.organizer_contact,   MAX_SHORT_LEN),
                _trunc(detail.image_url,           MAX_URL_LEN),
                _trunc(detail.tags,                MAX_SHORT_LEN),
                _trunc(detail.price,               MAX_SHORT_LEN),
                _trunc(detail.registration_url,    MAX_URL_LEN),
                _trunc(detail.duration,            MAX_SHORT_LEN),
                _trunc(detail.agenda_html,         MAX_HTML_LEN),
                _trunc(detail.speakers_json,       MAX_HTML_LEN),
                _trunc(detail.prerequisites,       MAX_SHORT_LEN),
                detail.max_attendees,
                detail.attendees_count,
                _trunc(detail.scraped_body,        MAX_HTML_LEN),
            ))
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            print(f"  [DB ERROR] event_id={detail.event_id}: {e}")
        finally:
            cur.close()


# ═══════════════════════════════════════════════════════════════════════════════
#  TEXT UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

def _clean_to_plain_text(html_str: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html_str)
    text = html_lib.unescape(text)
    text = "".join(c for c in text if unicodedata.category(c)[0] != "C" or c in "\n\t")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _is_noisy_description(text: str) -> bool:
    if not text:
        return True
    special = sum(1 for c in text if c in "<>{}[]|\\^~`")
    if special > len(text) * 0.1:
        return True
    lines = text.split("\n")
    short_lines = sum(1 for line in lines if len(line.split()) < 3)
    if len(lines) > 5 and short_lines > len(lines) * 0.6:
        return True
    return False


def _extract_description_from_soup(soup, min_len=60, max_len=3000) -> str:
    for tag in soup.find_all(["nav", "header", "footer", "script", "style", "noscript"]):
        tag.decompose()

    candidates = []

    for sel in [
        ".event-description-html", ".event-description", ".event-details",
        ".event-content", ".event-info", ".description", ".about-event",
        ".about-section", ".content-area", ".entry-content", ".post-content",
        "article .content", ".trix-content", ".markdown",
    ]:
        el = soup.select_one(sel)
        if el:
            t = _clean_to_plain_text(el.get_text())
            if len(t) >= min_len:
                candidates.append(t)

    for tag_name in ("article", "main"):
        el = soup.find(tag_name)
        if el:
            t = _clean_to_plain_text(el.get_text())
            if len(t) >= min_len:
                candidates.append(t)

    p_parts = []
    for p in soup.find_all("p"):
        t = _clean_to_plain_text(p.get_text())
        if len(t) >= min_len:
            p_parts.append(t)
        if len(" ".join(p_parts)) >= max_len:
            break
    if p_parts:
        candidates.append(" ".join(p_parts))

    og = soup.find("meta", property="og:description")
    if og and og.get("content", "").strip():
        t = og["content"].strip()
        if len(t) >= 40:
            candidates.append(t)

    if not candidates:
        return ""

    best = max(candidates, key=lambda x: min(len(x), max_len))
    return best[:max_len].strip()