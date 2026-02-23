# -*- coding: utf-8 -*-
"""
HITEX Python Scraper
====================
Place at: backend/internal/scrapers/hitex.py
Install : pip install requests beautifulsoup4 psycopg2-binary python-dotenv lxml selenium
Run     : python hitex.py

Scraping strategy (per external site):
  1. Plain HTTP (requests + BeautifulSoup)  — fast, works for static/SSR sites
  2. Selenium Chrome fallback               — for Angular / React / JS-heavy sites
  3. Multiple HTML extraction strategies    — Elementor, sections, paragraphs, og:meta
"""

import hashlib
import io
import os
import re
import sys
import time
from datetime import datetime
from urllib.parse import urljoin, urlparse

# ── Fix Windows cp1252 encoding issue ─────────────────────────────────────────
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import psycopg2
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# ── Selenium import ────────────────────────────────────────────────────────────
# NO webdriver_manager — Selenium 4.6+ has built-in selenium-manager that
# automatically downloads the correct chromedriver.exe on Windows.
# Fix for WinError 193: webdriver_manager was downloading a Linux binary.
try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import TimeoutException, WebDriverException
    _SELENIUM_AVAILABLE = True
except ImportError:
    _SELENIUM_AVAILABLE = False

# ── Load .env ─────────────────────────────────────────────────────────────────
_script_dir = os.path.dirname(os.path.abspath(__file__))
for _candidate in [
    os.path.join(_script_dir, ".env"),
    os.path.join(_script_dir, "..", ".env"),
    os.path.join(_script_dir, "..", "..", ".env"),
]:
    if os.path.exists(_candidate):
        load_dotenv(_candidate)
        print(f"[ENV]   Loaded: {_candidate}")
        break

# ── Constants ──────────────────────────────────────────────────────────────────
HITEX_BASE       = "https://hitex.co.in"
HITEX_EVENTS_URL = "https://hitex.co.in/events/upcoming.html"
PLATFORM         = "hitex"
LOCATION         = "HITEX Exhibition Centre, Hyderabad"
ADDRESS          = "Off Izzat Nagar, Kondapur, Hyderabad, Telangana 500084"

CHROME_FALLBACK_THRESHOLD = 8_000  # bytes

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
}

DATE_RE = re.compile(
    r"(\d{1,2})\s*(?:[-to]+\s*\d{1,2})?\s*"
    r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})",
    re.IGNORECASE,
)
MONTH_MAP = {
    "jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,
    "jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12,
}
_SOCIAL = re.compile(
    r"(facebook\.com|twitter\.com|instagram\.com|youtube\.com|linkedin\.com"
    r"|t\.me|whatsapp\.com|maps\.google|x\.com|wa\.me)", re.I
)
_JS_FRAMEWORKS = re.compile(
    r"(ng-version|__NEXT_DATA__|__nuxt__|reactroot|data-reactroot"
    r"|angular|vue\.js|_app\.js|_next/static)", re.I
)


# ═══════════════════════════════════════════════════════════════════════════════
#  CHROME / SELENIUM HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _build_driver():
    """
    Build a headless Chrome WebDriver.
    Uses Selenium 4.6+ built-in selenium-manager — NO webdriver_manager import.
    selenium-manager auto-downloads the correct chromedriver.exe for Windows.
    """
    opts = ChromeOptions()
    opts.add_argument("--headless=new")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1280,900")
    opts.add_argument("--lang=en-US")
    opts.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)

    # No Service() — selenium-manager picks the right binary automatically
    return webdriver.Chrome(options=opts)


def fetch_with_chrome(url: str, wait_selector: str = None,
                      click_text: str = None, timeout: int = 20) -> str:
    """
    Fetch a URL using headless Chrome.
    - wait_selector : CSS selector to wait for before grabbing HTML
    - click_text    : button text to click (e.g. 'Read More') before grabbing HTML
    Returns rendered HTML string, or "" on failure.
    """
    if not _SELENIUM_AVAILABLE:
        print("    [WARN] Selenium not installed — cannot use Chrome fallback")
        return ""

    driver = None
    try:
        print(f"    [CHROME] Launching headless Chrome for: {url}")
        driver = _build_driver()
        driver.get(url)

        wait = WebDriverWait(driver, timeout)
        if wait_selector:
            try:
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, wait_selector)))
            except TimeoutException:
                print(f"    [WARN] Chrome: wait_selector '{wait_selector}' timed out, continuing anyway")
        else:
            try:
                wait.until(lambda d: len(d.find_element(By.TAG_NAME, "body").text) > 200)
            except TimeoutException:
                pass

        time.sleep(1.5)

        if click_text:
            try:
                btns = driver.find_elements(By.TAG_NAME, "button")
                for btn in btns:
                    if btn.text.strip().lower() == click_text.lower():
                        driver.execute_script("arguments[0].click();", btn)
                        time.sleep(0.8)
                        print(f"    [CHROME] Clicked '{click_text}' button")
                        break
            except Exception:
                pass

        html = driver.page_source
        print(f"    [CHROME] Got {len(html)} bytes")
        return html

    except WebDriverException as e:
        print(f"    [WARN] Chrome WebDriver error: {e}")
        return ""
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass


# ═══════════════════════════════════════════════════════════════════════════════
#  PLAIN HTTP HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def fetch_html(url: str, retries: int = 3) -> str:
    """Fetch raw HTML string via requests. Returns '' on failure."""
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=25, allow_redirects=True)
            if r.status_code == 200:
                return r.text
            print(f"    [WARN] HTTP {r.status_code} -> {url}")
        except Exception as exc:
            print(f"    [WARN] attempt {attempt+1}/{retries}: {exc}")
        if attempt < retries - 1:
            time.sleep((attempt + 1) * 2)
    return ""


def fetch(url: str, retries: int = 3):
    """Fetch and parse HTML via requests. Returns BeautifulSoup or None."""
    html = fetch_html(url, retries)
    if html:
        return BeautifulSoup(html, "html.parser")
    return None


def is_js_rendered(html: str) -> bool:
    """
    Heuristic: does this page look like it needs JS to render real content?
    Only returns True if BOTH: JS framework detected AND visible text is tiny.
    This avoids false positives on static pages that happen to mention 'angular'.
    """
    if len(html) < CHROME_FALLBACK_THRESHOLD:
        return True
    if _JS_FRAMEWORKS.search(html[:5000]):
        soup = BeautifulSoup(html, "html.parser")
        body = soup.find("body")
        if not body:
            return True
        text = re.sub(r"\s+", " ", body.get_text()).strip()
        return len(text.split()) < 80
    return False


def smart_fetch(url: str, wait_selector: str = None, click_text: str = None):
    """
    Smart fetch for external organiser sites only.
    Tries plain HTTP first, falls back to Chrome if response is a JS shell.
    Returns BeautifulSoup or None.
    """
    html = fetch_html(url)

    if html and not is_js_rendered(html):
        return BeautifulSoup(html, "html.parser")

    if _SELENIUM_AVAILABLE:
        chrome_html = fetch_with_chrome(url, wait_selector=wait_selector, click_text=click_text)
        if chrome_html:
            return BeautifulSoup(chrome_html, "html.parser")

    if html:
        return BeautifulSoup(html, "html.parser")

    return None


# ═══════════════════════════════════════════════════════════════════════════════
#  TEXT / URL UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

def resolve(base: str, href: str) -> str:
    if not href or href.strip() in ("#", ""):
        return ""
    return urljoin(base, href.strip())


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def extract_date(text: str) -> str:
    m = DATE_RE.search(text)
    if not m:
        return ""
    return f"{m.group(1)} {m.group(2)} {m.group(3)}"


def is_upcoming(date_str: str) -> bool:
    if not date_str:
        return True
    m = re.search(
        r"(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})",
        date_str, re.I,
    )
    if not m:
        return True
    try:
        d = datetime(int(m.group(3)), MONTH_MAP[m.group(2).lower()], int(m.group(1)))
        return d >= datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    except Exception:
        return True


def generate_hash(website: str, event_name: str) -> str:
    w = (website or "").strip().lower()
    if "?" in w:
        w = w[: w.index("?")]
    w = w.rstrip("/")
    key = w if w else f"{event_name.strip().lower()}|{PLATFORM}"
    return hashlib.sha256(key.encode()).hexdigest()


def get_og_meta(soup) -> dict:
    result = {}
    tag = soup.find("meta", property="og:description")
    if tag and tag.get("content", "").strip():
        result["og_description"] = tag["content"].strip()
    tag = soup.find("meta", property="og:title")
    if tag and tag.get("content", "").strip():
        result["og_title"] = tag["content"].strip()
    tag = soup.find("meta", attrs={"name": "description"})
    if tag and tag.get("content", "").strip():
        result["meta_description"] = tag["content"].strip()
    return result


# ═══════════════════════════════════════════════════════════════════════════════
#  UNIVERSAL DESCRIPTION EXTRACTOR
# ═══════════════════════════════════════════════════════════════════════════════

def _strip_noise(soup):
    for tag in soup.find_all(["nav", "header", "footer", "script",
                               "style", "noscript", "aside", "form"]):
        tag.decompose()
    for el in soup.find_all(class_=re.compile(
        r"navbar|footer|header|nav|menu|sidebar|cookie|popup|modal|breadcrumb"
        r"|social|share|comment|related|advertisement|ad-", re.I
    )):
        el.decompose()
    return soup


def extract_description(soup, min_len: int = 60, max_len: int = 3000) -> str:
    """
    Universal multi-strategy description extractor.
    Tries 9 strategies, returns the longest result found.
    """
    soup = _strip_noise(soup)
    candidates = []

    # Strategy 1: Townscript Angular content
    for sel in ["#event-info-content", ".event-info-body"]:
        el = soup.select_one(sel)
        if el:
            t = clean(el.get_text())
            if len(t) >= min_len:
                candidates.append(("townscript", t))

    # Strategy 2: Elementor WordPress widgets
    elementor_parts = []
    for widget in soup.find_all(attrs={"data-widget_type": "text-editor.default"}):
        for p in widget.find_all("p"):
            t = clean(p.get_text())
            if len(t) >= min_len:
                elementor_parts.append(t)
    if not elementor_parts:
        for widget in soup.find_all(class_="elementor-widget-text-editor"):
            for p in widget.find_all("p"):
                t = clean(p.get_text())
                if len(t) >= min_len:
                    elementor_parts.append(t)
    if elementor_parts:
        candidates.append(("elementor", " ".join(elementor_parts)))

    # Strategy 3: Event/description CSS selectors
    for sel in [
        ".event-description-html", ".event-description", ".event-details",
        ".event-content", ".event-info", ".event-body",
        ".description-content", ".description", ".about-event",
        ".about-section", ".about-content", "[class*='about']",
        ".content-area", ".entry-content", ".post-content",
        ".trix-content", ".markdown", "article .content",
    ]:
        el = soup.select_one(sel)
        if el:
            t = clean(el.get_text())
            if len(t) >= min_len:
                candidates.append((sel, t))

    # Strategy 4: Semantic ID sections
    for sel in ["#about", "#event-description", "#event-details", "#overview"]:
        el = soup.select_one(sel)
        if el:
            t = clean(el.get_text())
            if len(t) >= min_len:
                candidates.append((sel, t))

    # Strategy 5: <article> tag
    article = soup.find("article")
    if article:
        t = clean(article.get_text())
        if len(t) >= min_len:
            candidates.append(("article", t))

    # Strategy 6: <main> tag
    main = soup.find("main")
    if main:
        t = clean(main.get_text())
        if len(t) >= min_len:
            candidates.append(("main", t))

    # Strategy 7: Largest <section> block
    best_section = ""
    for section in soup.find_all("section"):
        t = clean(section.get_text())
        if len(t) > len(best_section):
            best_section = t
    if len(best_section) >= min_len:
        candidates.append(("section", best_section))

    # Strategy 8: Accumulate meaty <p> tags
    p_parts = []
    for p in soup.find_all("p"):
        t = clean(p.get_text())
        if len(t) >= min_len:
            p_parts.append(t)
        if len(" ".join(p_parts)) >= max_len:
            break
    if p_parts:
        candidates.append(("paragraphs", " ".join(p_parts)))

    # Strategy 9: og:description / meta description
    meta = get_og_meta(soup)
    if meta.get("og_description") and len(meta["og_description"]) >= 40:
        candidates.append(("og:description", meta["og_description"]))
    if meta.get("meta_description") and len(meta["meta_description"]) >= 40:
        candidates.append(("meta:description", meta["meta_description"]))

    if not candidates:
        return ""

    best_strategy, best_text = max(candidates, key=lambda x: min(len(x[1]), max_len))
    print(f"    [DESC] Strategy '{best_strategy}' -> {len(best_text)} chars")

    result = best_text[:max_len]
    if len(best_text) > max_len:
        result += "..."
    return result.strip()


# ═══════════════════════════════════════════════════════════════════════════════
#  HITEX EVENT DETAIL PAGE
# ═══════════════════════════════════════════════════════════════════════════════

def fetch_event_details(page_url: str):
    """
    Fetch the HITEX event detail page, find the external organiser URL,
    then scrape that organiser site for a description.
    Returns (description_str, external_url_str).
    """
    if not page_url:
        return "", ""

    soup = fetch(page_url)
    if not soup:
        return "", ""

    ext_url = ""

    # Priority 1: a.btn containing "website"
    for a in soup.find_all("a", class_=re.compile(r"btn", re.I)):
        href = a.get("href", "").strip()
        text = clean(a.get_text()).lower()
        spans = " ".join(clean(s.get_text()).lower() for s in a.find_all("span"))
        if not href.startswith("http") or "hitex.co.in" in href:
            continue
        if _SOCIAL.search(href):
            continue
        if "website" in text or "website" in spans:
            ext_url = href
            break

    # Priority 2: any external non-social link
    if not ext_url:
        for a in soup.find_all("a", href=True):
            href = a.get("href", "").strip()
            if (
                href.startswith("http")
                and "hitex.co.in" not in href
                and not _SOCIAL.search(href)
                and len(href) > 15
            ):
                ext_url = href
                break

    # Try getting description from HITEX detail page itself
    desc = ""
    for sel in [".event-description", ".event-details p", "#about p",
                ".about-content", ".description", "main p", ".content p"]:
        for el in soup.select(sel):
            t = clean(el.get_text())
            if len(t) > 40:
                desc += t + " "
        if len(desc) > 80:
            break
    desc = desc.strip()

    # If no description, scrape the external organiser site
    if not desc and ext_url:
        print(f"    [EXT] Scraping organizer site: {ext_url}")
        desc = scrape_organizer_site(ext_url)

    return desc, ext_url


def scrape_organizer_site(url: str) -> str:
    """
    Scrape an external organiser website for event description.
    Uses smart_fetch (plain HTTP + Chrome fallback for JS-heavy sites).
    """
    wait_sel  = None
    click_txt = None
    domain = urlparse(url).netloc.lower()

    if "townscript.com" in domain:
        wait_sel  = "#event-info-content"
        click_txt = "read more"
    elif "allevents.in" in domain:
        wait_sel = ".event-description-html"
    elif "eventbrite" in domain:
        wait_sel = ".event-description"
    elif "meetup.com" in domain:
        wait_sel = ".event-description"
    elif "insider.in" in domain or "paytm.com" in domain:
        wait_sel = "article"

    soup = smart_fetch(url, wait_selector=wait_sel, click_text=click_txt)
    if not soup:
        return ""

    return extract_description(soup)


# ═══════════════════════════════════════════════════════════════════════════════
#  HITEX LISTING SCRAPER
# ═══════════════════════════════════════════════════════════════════════════════

def _find_pairs_in_soup(soup, seen_urls: set) -> list:
    """Extract (title, link) pairs from a parsed HITEX listing page."""
    pairs = []

    # Strategy 1: media.hitex.co.in event images
    for img in soup.find_all("img", src=re.compile(r"media\.hitex\.co\.in/events", re.I)):
        title = clean(img.get("alt", ""))
        link  = ""
        node = img.parent
        for _ in range(12):
            if node is None:
                break
            if node.name == "a" and node.get("href"):
                link = resolve(HITEX_BASE, node["href"])
                break
            a_tag = node.find("a", href=re.compile(r"hitex\.co\.in|/events/", re.I))
            if not a_tag:
                a_tag = node.find("a", href=True)
            if a_tag and a_tag.get("href"):
                link = resolve(HITEX_BASE, a_tag["href"])
                if not title:
                    title = clean(a_tag.get_text())
                break
            node = node.parent
        if not link:
            parent = img.find_parent(["div", "section", "li", "article"])
            if parent:
                a_tag = parent.find("a", href=True)
                if a_tag:
                    link = resolve(HITEX_BASE, a_tag["href"])
        if link and link not in seen_urls and len(title) > 2:
            seen_urls.add(link)
            pairs.append((title, link))

    # Strategy 2: card selectors
    if not pairs:
        for sel in ["div.event-item", "div.event-card", "article",
                    "div.col-md-4", "div.col-lg-4"]:
            for card in soup.select(sel):
                a = card.find("a", href=True)
                if not a:
                    continue
                h = card.find(["h2", "h3", "h4"])
                title = clean(h.get_text() if h else a.get_text())
                link  = resolve(HITEX_BASE, a["href"])
                if len(title) > 2 and link and link not in seen_urls:
                    seen_urls.add(link)
                    pairs.append((title, link))
            if pairs:
                break

    # Strategy 3: /events/*.html anchors
    if not pairs:
        for a in soup.find_all("a", href=re.compile(r"/events/.*\.html", re.I)):
            title = clean(a.get("alt", "") or a.get_text())
            link  = resolve(HITEX_BASE, a["href"])
            if (len(title) > 2 and "upcoming" not in title.lower()
                    and link not in seen_urls):
                seen_urls.add(link)
                pairs.append((title, link))

    return pairs


def scrape_hitex():
    print(f"\n[HITEX] Fetching -> {HITEX_EVENTS_URL}")

    # ── Use plain HTTP for the listing page — it's static HTML ───────────────
    # Do NOT use smart_fetch here. smart_fetch triggers Chrome if it detects
    # a JS framework signature in the HTML, but hitex.co.in is static and
    # Chrome would just fail with WinError 193 or waste time.
    soup = fetch(HITEX_EVENTS_URL)

    if not soup:
        print("    [WARN] Plain HTTP failed for listing page, trying Chrome...")
        html = fetch_with_chrome(HITEX_EVENTS_URL)
        if html:
            soup = BeautifulSoup(html, "html.parser")

    if not soup:
        print("[HITEX] ERROR: Could not load listing page")
        return []

    seen_urls = set()
    pairs = _find_pairs_in_soup(soup, seen_urls)

    # ── Chrome fallback if static page found 0 events ────────────────────────
    if not pairs and _SELENIUM_AVAILABLE:
        print("    [WARN] No events in static HTML — retrying with Chrome...")
        html = fetch_with_chrome(HITEX_EVENTS_URL)
        if html:
            chrome_soup = BeautifulSoup(html, "html.parser")
            pairs = _find_pairs_in_soup(chrome_soup, seen_urls)
            for title, _ in pairs:
                print(f"  [FOUND via Chrome] {title}")

    for title, _ in pairs:
        if not any(title == p[0] for p in pairs[:pairs.index((title, _))]):
            print(f"  [FOUND] {title}")

    print(f"\n[HITEX] {len(pairs)} event page(s) to process\n")

    events      = []
    seen_titles = set()

    for title, event_url in pairs:
        tkey = title.lower()
        if tkey in seen_titles:
            continue

        print(f"  -> {title}")
        print(f"     URL: {event_url}")

        # Extract date from listing page
        date_str = ""
        for a_tag in soup.find_all("a", href=True):
            if resolve(HITEX_BASE, a_tag["href"]) != event_url:
                continue
            node = a_tag.parent
            for _ in range(8):
                if node is None:
                    break
                d = extract_date(node.get_text())
                if d:
                    date_str = d
                    break
                node = node.parent
            break

        desc, ext_url = fetch_event_details(event_url)

        if not date_str:
            detail_soup = fetch(event_url)
            if detail_soup:
                date_str = extract_date(detail_soup.get_text())

        if date_str and not is_upcoming(date_str):
            print(f"     [SKIP] Past event: {date_str}\n")
            continue

        if desc and ext_url:
            description = f"{desc}\n\nMore information: {ext_url}"
        elif ext_url:
            description = f"More information: {ext_url}"
        else:
            description = desc

        seen_titles.add(tkey)
        events.append({
            "event_name":  title,
            "location":    LOCATION,
            "address":     ADDRESS,
            "date":        date_str,
            "date_time":   date_str,
            "time":        "",
            "website":     event_url,
            "description": description,
            "event_type":  "Offline",
            "platform":    PLATFORM,
            "hash":        generate_hash(event_url, title),
        })

        print(f"     Date: {date_str or 'unknown'}")
        print(f"     Ext : {ext_url or 'none'}")
        print(f"     Desc: {description[:80].replace(chr(10), ' ')}...\n")

    return events


# ═══════════════════════════════════════════════════════════════════════════════
#  POSTGRESQL WRITER
# ═══════════════════════════════════════════════════════════════════════════════

def _dsn() -> str:
    return (
        f"host={os.getenv('DB_HOST', 'localhost')} "
        f"port={os.getenv('DB_PORT', '5432')} "
        f"dbname={os.getenv('DB_NAME', 'event_scraper')} "
        f"user={os.getenv('DB_USER', 'postgres')} "
        f"password={os.getenv('DB_PASSWORD', 'Dheekshith@15')} "
        f"sslmode={os.getenv('DB_SSLMODE', 'disable')}"
    )


def save_to_db(events):
    conn     = psycopg2.connect(_dsn())
    inserted = 0
    skipped  = 0
    now      = datetime.now()

    for ev in events:
        cur = conn.cursor()
        try:
            cur.execute("SELECT id FROM events WHERE hash = %s", (ev["hash"],))
            row = cur.fetchone()
            if row:
                cur.execute(
                    """UPDATE events SET event_name=%s,location=%s,date_time=%s,
                       date=%s,time=%s,website=%s,description=%s,
                       event_type=%s,address=%s,updated_at=%s WHERE id=%s""",
                    (ev["event_name"], ev["location"], ev["date_time"],
                     ev["date"], ev["time"], ev["website"], ev["description"],
                     ev["event_type"], ev["address"], now, row[0]),
                )
                conn.commit()
                skipped += 1
                continue

            if ev["website"]:
                cur.execute("SELECT id FROM events WHERE website = %s", (ev["website"],))
                row = cur.fetchone()
                if row:
                    cur.execute(
                        """UPDATE events SET event_name=%s,location=%s,date_time=%s,
                           date=%s,time=%s,description=%s,event_type=%s,
                           address=%s,updated_at=%s WHERE id=%s""",
                        (ev["event_name"], ev["location"], ev["date_time"],
                         ev["date"], ev["time"], ev["description"],
                         ev["event_type"], ev["address"], now, row[0]),
                    )
                    conn.commit()
                    skipped += 1
                    continue

            cur.execute(
                """INSERT INTO events (
                       event_name,location,date_time,date,time,
                       website,description,event_type,platform,hash,
                       address,created_at,updated_at
                   ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   ON CONFLICT (hash) DO UPDATE SET
                       event_name=EXCLUDED.event_name,
                       location=EXCLUDED.location,
                       date_time=EXCLUDED.date_time,
                       date=EXCLUDED.date,
                       time=EXCLUDED.time,
                       website=EXCLUDED.website,
                       description=EXCLUDED.description,
                       event_type=EXCLUDED.event_type,
                       address=EXCLUDED.address,
                       updated_at=EXCLUDED.updated_at""",
                (ev["event_name"], ev["location"], ev["date_time"], ev["date"],
                 ev["time"], ev["website"], ev["description"], ev["event_type"],
                 ev["platform"], ev["hash"], ev["address"], now, now),
            )
            conn.commit()
            inserted += 1

        except Exception as exc:
            conn.rollback()
            print(f"  [DB ERROR] {ev['event_name']}: {exc}")
            skipped += 1
        finally:
            cur.close()

    conn.close()
    return inserted, skipped


# ═══════════════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("  HITEX Python Scraper")
    print("=" * 60)

    if _SELENIUM_AVAILABLE:
        print("[INFO]  Selenium available — Chrome fallback ENABLED")
    else:
        print("[WARN]  Selenium not found — Chrome fallback DISABLED")
        print("        Install: pip install selenium")

    events = scrape_hitex()

    print(f"\n{'-' * 60}")
    print(f"[HITEX] Upcoming events scraped: {len(events)}")

    if not events:
        print("[HITEX] Nothing to save.")
        sys.exit(0)

    print("[DB]    Saving to PostgreSQL...")
    try:
        ins, skp = save_to_db(events)
        print(f"[DB]    Inserted: {ins} | Updated/Skipped: {skp}")
    except Exception as exc:
        print(f"[DB]    Fatal: {exc}")
        sys.exit(1)

    print("=" * 60)