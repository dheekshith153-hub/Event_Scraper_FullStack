# -*- coding: utf-8 -*-
"""
Base scraper + Chrome helper + DB helper.
Mirrors: base.go, chrome.go, and the InsertBatch logic from database/db.go.
"""

import io
import logging
import os
import re
import sys
import time
from datetime import datetime

# Suppress Selenium/urllib3 noise
logging.getLogger("selenium").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

import psycopg2
import requests as http_requests
from dotenv import load_dotenv

# Fix Windows cp1252 encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ── Load .env ─────────────────────────────────────────────────────────────────
_script_dir = os.path.dirname(os.path.abspath(__file__))
for _candidate in [
    os.path.join(_script_dir, ".env"),
    os.path.join(_script_dir, "..", ".env"),
    os.path.join(_script_dir, "..", "..", ".env"),
    os.path.join(_script_dir, "..", "..", "..", ".env"),
]:
    if os.path.exists(_candidate):
        load_dotenv(_candidate)
        break

# ── Selenium import ────────────────────────────────────────────────────────────
try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import TimeoutException, WebDriverException
    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False


# ═══════════════════════════════════════════════════════════════════════════════
#  CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
}


# ═══════════════════════════════════════════════════════════════════════════════
#  BASE SCRAPER (mirrors base.go)
# ═══════════════════════════════════════════════════════════════════════════════

class BaseScraper:
    def __init__(self, timeout: int = 30, retries: int = 3):
        self.timeout = timeout
        self.retries = retries
        self._session = http_requests.Session()
        self._session.headers.update(HEADERS)

    def fetch_with_retry(self, url: str) -> http_requests.Response | None:
        """Fetch a URL with retry logic (mirrors base.go FetchWithRetry)."""
        for attempt in range(self.retries):
            try:
                resp = self._session.get(url, timeout=self.timeout, allow_redirects=True)
                if resp.status_code == 200:
                    return resp
                print(f"    [WARN] HTTP {resp.status_code} -> {url}")
            except Exception as e:
                print(f"    [WARN] attempt {attempt + 1}/{self.retries}: {e}")
            if attempt < self.retries - 1:
                time.sleep((attempt + 1) * 2)
        return None

    def name(self) -> str:
        raise NotImplementedError


# ═══════════════════════════════════════════════════════════════════════════════
#  CHROME HELPER (mirrors chrome.go)
# ═══════════════════════════════════════════════════════════════════════════════

def build_chrome_driver():
    """Build a headless Chrome WebDriver (mirrors chrome.go NewChromeContext)."""
    if not SELENIUM_AVAILABLE:
        raise RuntimeError("Selenium not installed")

    opts = ChromeOptions()
    opts.add_argument("--headless=new")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-web-security")
    opts.add_argument("--disable-software-rasterizer")
    opts.add_argument("--disable-logging")
    opts.add_argument("--log-level=3")
    opts.add_argument("--silent")
    opts.add_argument("--window-size=1280,900")
    opts.add_argument("--lang=en-US")
    opts.add_argument(f"--user-agent={USER_AGENT}")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation", "enable-logging"])
    opts.add_experimental_option("useAutomationExtension", False)

    # Suppress DevTools/service log messages on Windows
    from selenium.webdriver.chrome.service import Service
    service = Service(log_output=os.devnull)
    return webdriver.Chrome(options=opts, service=service)


def fetch_with_chrome(url: str, wait_selector: str = None,
                      click_text: str = None, timeout: int = 20) -> str:
    """Fetch URL with headless Chrome. Returns HTML string or ''."""
    if not SELENIUM_AVAILABLE:
        print("    [WARN] Selenium not installed — cannot use Chrome fallback")
        return ""

    driver = None
    try:
        print(f"    [CHROME] Launching headless Chrome for: {url}")
        driver = build_chrome_driver()
        driver.get(url)

        wait = WebDriverWait(driver, timeout)
        if wait_selector:
            try:
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, wait_selector)))
            except TimeoutException:
                print(f"    [WARN] Chrome: wait_selector '{wait_selector}' timed out")
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
#  DATABASE HELPER (mirrors database/db.go InsertBatch)
# ═══════════════════════════════════════════════════════════════════════════════

def _dsn() -> str:
    return (
        f"host={os.getenv('DB_HOST', 'localhost')} "
        f"port={os.getenv('DB_PORT', '5432')} "
        f"dbname={os.getenv('DB_NAME', 'event_scraper')} "
        f"user={os.getenv('DB_USER', 'postgres')} "
        f"password={os.getenv('DB_PASSWORD', '')} "
        f"sslmode={os.getenv('DB_SSLMODE', 'disable')}"
    )


def get_db_connection():
    return psycopg2.connect(_dsn())


def insert_batch(events: list) -> tuple:
    """
    Insert events into the database (mirrors database/db.go InsertBatch).
    Returns (inserted, skipped).
    """
    if not events:
        return 0, 0

    conn = get_db_connection()
    inserted = 0
    skipped = 0
    now = datetime.now()

    for ev in events:
        ev.normalize()
        ev.generate_hash()

        if not ev.is_valid():
            skipped += 1
            continue

        cur = conn.cursor()
        try:
            # Layer 2: URL-based dedup
            if ev.website.strip():
                cur.execute("SELECT id FROM events WHERE website = %s", (ev.website,))
                row = cur.fetchone()
                if row:
                    cur.execute(
                        """UPDATE events SET
                            event_name=%s, location=%s, city_normalized=%s,
                            date_time=%s, date=%s, description=%s,
                            event_type=%s, address=%s, updated_at=%s
                        WHERE website = %s""",
                        (ev.event_name, ev.location, ev.city_normalized,
                         ev.date_time, ev.date, ev.description,
                         ev.event_type, ev.address, now,
                         ev.website),
                    )
                    conn.commit()
                    skipped += 1
                    continue

            # Layer 1: hash conflict via ON CONFLICT
            cur.execute(
                """INSERT INTO events (
                    event_name, location, city_normalized, date_time, date, time,
                    website, description, event_type, platform, hash,
                    address, created_at, updated_at
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (hash) DO UPDATE SET
                    event_name      = EXCLUDED.event_name,
                    location        = EXCLUDED.location,
                    city_normalized = EXCLUDED.city_normalized,
                    date_time       = EXCLUDED.date_time,
                    date            = EXCLUDED.date,
                    time            = EXCLUDED.time,
                    website         = EXCLUDED.website,
                    description     = EXCLUDED.description,
                    event_type      = EXCLUDED.event_type,
                    address         = EXCLUDED.address,
                    updated_at      = EXCLUDED.updated_at""",
                (ev.event_name, ev.location, ev.city_normalized,
                 ev.date_time, ev.date, ev.time,
                 ev.website, ev.description, ev.event_type,
                 ev.platform, ev.hash, ev.address, now, now),
            )
            conn.commit()
            inserted += 1

        except Exception as e:
            conn.rollback()
            print(f"  [DB ERROR] {ev.event_name}: {e}")
            skipped += 1
        finally:
            cur.close()

    conn.close()
    return inserted, skipped
