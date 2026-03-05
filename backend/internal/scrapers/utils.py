# -*- coding: utf-8 -*-
"""
Shared utilities for all Python scrapers.
Mirrors: pkg/utils/dateutil.go, pkg/utils/ollama_classify.go
"""

import json
import os
import re
import time
from datetime import datetime, timedelta

import requests as http_requests

# ═══════════════════════════════════════════════════════════════════════════════
#  DATE PARSING
# ═══════════════════════════════════════════════════════════════════════════════

DATE_FORMATS = [
    # ISO 8601
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M",
    "%Y-%m-%d",
    # US formats
    "%B %d, %Y",
    "%b %d, %Y",
    # With day of week (full month)
    "%A, %B %d, %Y",
    "%a, %B %d, %Y",
    # With day of week (short month)
    "%A, %b %d, %Y",
    "%a, %b %d, %Y",
    # Day-first compact
    "%d %b %Y",
    "%d %B %Y",
    # eChai-style: "15 Mar 2026"
    "%d %b %Y",
    # Slash-separated
    "%m/%d/%Y",
    "%d/%m/%Y",
    "%Y/%m/%d",
    # Dash-separated
    "%d-%m-%Y",
    "%m-%d-%Y",
    "%d-%b-%Y",
    # With time
    "%B %d, %Y %I:%M %p",
    "%b %d, %Y %I:%M %p",
    "%d %b %Y %H:%M",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    # Meetup/AllEvents
    "%a, %d %b %Y %I:%M %p",
    "%a, %d %b %Y %H:%M",
    # Day-first with time
    "%d %b %Y %I:%M %p",
    "%d %B %Y %I:%M %p",
    # Month-name day year (no comma)
    "%B %d %Y",
    "%b %d %Y",
    # AllEvents: "Sat, 14 Mar, 2026" (comma after day-num AND month)
    "%a, %d %b, %Y",
    "%a, %d %B, %Y",
    # AllEvents with time: "Sat, 14 Mar, 2026 - 09:00 AM" (after split)
    "%a, %d %b, %Y %I:%M %p",
    "%a, %d %b, %Y %H:%M",
]

_ORDINAL_RE = re.compile(r"(\d+)(st|nd|rd|th)\b", re.I)


def _clean_date_string(s: str) -> str:
    s = s.strip()
    s = _ORDINAL_RE.sub(r"\1", s)
    if " - " in s:
        parts = s.split(" - ", 1)
        start = parts[0].strip()
        end = parts[1].strip()
        year_match = re.search(r"\b(20\d{2})\b", end)
        if year_match:
            year_str = year_match.group(1)
            if not re.search(r"\b20\d{2}\b", start):
                start = start + ", " + year_str
        s = start
    return s.strip()


def parse_date(date_str: str):
    """Parse a date string. Returns datetime or None."""
    if not date_str or not date_str.strip():
        return None
    s = _clean_date_string(date_str)
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def is_upcoming(date_str: str) -> bool:
    """Returns True if date is today or future.
    For empty/missing dates: returns True (benefit of doubt).
    For unparseable non-empty dates: returns False (reject to be safe).
    """
    if not date_str or not date_str.strip():
        return True  # no date = benefit of doubt
    dt = parse_date(date_str)
    if dt is None:
        # Non-empty but unparseable — reject to avoid old events sneaking in
        return False
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    event_day = dt.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    return event_day >= today


def is_offline_event(event_type: str, location: str, title: str) -> bool:
    """Returns True if event is offline/in-person."""
    combined = f"{event_type} {location} {title}".lower()
    online_indicators = ["online", "virtual", "webinar", "web-based", "remote event"]
    return not any(ind in combined for ind in online_indicators)


# ═══════════════════════════════════════════════════════════════════════════════
#  TECH FILTERING (mirrors allevents.go keyword lists)
# ═══════════════════════════════════════════════════════════════════════════════

TECH_TITLE_KEYWORDS = [
    "tech", "technology", "digital", "software", "hardware", "iot",
    "automation", "robotics", "ai ", " ai,", "artificial intelligence",
    "machine learning", "data", "cyber", "cloud", "semiconductor",
    "electronics", "electric vehicle", "ev ", "drone", "space tech",
    "biotech", "pharma", "fintech", "blockchain", "web3", "crypto",
    "saas", "devops", "devsecops", "kubernetes", "docker", "linux",
    "startup", "hackathon", "coder", "developer", "engineer",
    "python", "javascript", "golang", "java", "react", "node",
    "database", "security", "infosec", "pentest", "open source",
    "makers", "build", "launch", "product hunt",
    "3d printing", "cad", "simulation", "stem",
    "meetup", "conference", "summit", "workshop",
]

NON_TECH_KEYWORDS = [
    "yoga", "fitness", "gym", "zumba", "dance", "salsa", "ballet",
    "music", "concert", "dj ", "band", "karaoke", "singing",
    "painting", "art exhibition", "sculpture", "photography walk",
    "film screening", "movie", "theatre", "drama", "comedy show",
    "food festival", "culinary", "wine tasting", "beer fest",
    "fashion show", "beauty", "makeup", "skincare",
    "wedding", "bridal", "matrimony", "dating",
    "meditation", "spiritual", "prayer", "puja", "bhajan", "kirtan",
    "cricket", "football", "marathon", "cyclothon", "swimming",
    "real estate property", "astrology", "tarot", "numerology",
    "kids crafts", "parenting workshop",
    "bakery", "chocolate", "jewellery", "perfume", "furniture",
    "dairy", "poultry",
]


def is_tech_relevant(title: str) -> bool:
    """Keyword-based tech filter (mirrors allevents.go isTechRelevant)."""
    lower = title.lower()
    for kw in NON_TECH_KEYWORDS:
        if kw in lower:
            return False
    for kw in TECH_TITLE_KEYWORDS:
        if kw in lower:
            return True
    return False


def is_online_location(location: str) -> bool:
    lower = location.lower()
    markers = [
        "online", "virtual", "zoom", "webinar", "google meet",
        "microsoft teams", "discord", "youtube live", "livestream",
        "via internet", "web conference", "remote", "anywhere",
    ]
    return any(m in lower for m in markers)


# ═══════════════════════════════════════════════════════════════════════════════
#  BIEC TECH FILTER (mirrors biec.go)
# ═══════════════════════════════════════════════════════════════════════════════

BIEC_TECH_ALLOW = [
    "automation", "robotics", "robot", "industrial", "manufacturing", "industry",
    "machine", "machinery", "tool", "tooltech", "imtex", "forming", "digital manufacturing",
    "laser", "welding", "weld", "brazing", "soldering", "surface", "coating",
    "electronica", "productronica", "semiconductor", "electronics", "sensor",
    "packaging", "pharma", "labex", "laboratory", "biotech", "medical device",
    "electric vehicle", "ev ", "ev-", "battery", "charging", "renewable", "solar",
    "water", "wastewater", "environment", "recycling", "waste management",
    "logistics", "warehouse", "supply chain", "material handling",
    "cable", "wire", "connector", "power", "switchgear", "transformer",
    "textile machinery", "printing", "label", "barcode",
    "space", "defence", "defense", "aero", "drone", "uav",
]

BIEC_NON_TECH_BLOCK = [
    "bakery", "chocolate", "confectionery", "dairy", "food", "beverage",
    "wedding", "bridal", "jewellery", "jewelry", "gems", "gold",
    "stonemart", "granite", "marble", "tile",
    "furniture", "mattress", "home decor", "interior",
    "spiritual", "yoga", "astrology",
    "pet", "veterinary", "poultry", "aqua",
    "beauty", "cosmetic", "fragrance", "perfume",
    "garment", "fashion", "textile", "silk", "saree",
    "herbalife", "amway", "nutrilite",
    "interior", "décor", "decor", "facades", "doors windows",
    "acetech",
]

BIEC_TECH_URL_HINTS = [
    "electronica", "productronica", "labex", "pharma", "space", "drone",
    "imtex", "tooltech", "automation", "robot", "manufacturing", "digital",
    "warehouse", "logistic", "surface", "coating", "cable", "wire", "ev",
]


def is_biec_tech_event(title: str, website: str) -> bool:
    """BIEC tech filter (mirrors biec.go isTechEvent)."""
    lower = title.lower().strip()

    for bad in BIEC_NON_TECH_BLOCK:
        if bad in lower:
            return False

    for good in BIEC_TECH_ALLOW:
        if good in lower:
            return True

    url_lower = website.lower()
    for hint in BIEC_TECH_URL_HINTS:
        if hint in url_lower:
            return True

    return False


# ═══════════════════════════════════════════════════════════════════════════════
#  OLLAMA CLASSIFIER (mirrors pkg/utils/ollama_classify.go)
# ═══════════════════════════════════════════════════════════════════════════════

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma2:2b")

# ── Ollama health check (cached) ──────────────────────────────────────────────
_ollama_ok = None       # True / False / None (unknown)
_ollama_checked_at = 0  # time.time()
_OLLAMA_CHECK_TTL = 60  # re-check every 60s


def _is_ollama_reachable() -> bool:
    """Quick connectivity check — cached so we don't spam on every call."""
    global _ollama_ok, _ollama_checked_at
    import time as _t
    now = _t.time()
    if _ollama_ok is not None and (now - _ollama_checked_at) < _OLLAMA_CHECK_TTL:
        return _ollama_ok
    try:
        r = http_requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        _ollama_ok = r.status_code == 200
    except Exception:
        _ollama_ok = False
    _ollama_checked_at = now
    if not _ollama_ok:
        print("   ⚠️  Ollama is NOT reachable — skipping LLM classification")
    return _ollama_ok

# Education/demo spam prefilter
_EDU_PATTERNS = [
    "demo class", "free demo", "demo classes",
    "day 01", "day 1", "day-1", "day01",
    "orientation", "admission", "admissions",
    "enroll", "enrol", "enrollment", "registration open",
    "batch", "new batch", "batch starts", "batch start",
    "syllabus", "curriculum", "tuition", "tuitions",
    "coaching", "academy", "institute", "classes", "course", "training class",
    "neet", "jee", "upsc", "ssc", "bank exam",
    "ielts", "toefl", "gre", "gmat", "cat",
    "school", "college", "kids", "nursery", "kindergarten",
]


def _edu_spam_prefilter(title: str, desc: str) -> tuple:
    s = (title + " " + desc).lower().strip()
    for p in _EDU_PATTERNS:
        if p in s:
            return True, f"matched education/demo keyword: {p}"
    return False, ""


def _build_tech_classifier_prompt(title: str, desc: str) -> str:
    prompt = (
        "You are a strict event classifier.\n\n"
        "Choose exactly ONE category:\nTECH\nNON-TECH\nEDU-NON-TECH\nUNKNOWN\n\n"
        "Definitions:\n"
        "- TECH: primary subject is technology or engineering.\n"
        "  Includes: software/coding, AI/ML, data science, cloud/DevOps, cybersecurity,\n"
        "  IT infrastructure, networking, blockchain, IoT, robotics, semiconductors,\n"
        "  electronics, embedded systems, EV tech, biotech/pharma tech, fintech, SaaS/devtools, hackathons.\n"
        "- EDU-NON-TECH: coaching/tuition/demo classes/admissions/batches/exam prep.\n"
        "- NON-TECH: music/dance/yoga/fitness, arts, food festivals, fashion, weddings,\n"
        "  spiritual/astrology, sports, real-estate, generic business networking.\n"
        "- UNKNOWN: too vague to be sure.\n\n"
        "Rules:\n"
        "1) If title contains demo class/day 01/batch/admissions/coaching => EDU-NON-TECH.\n"
        "2) Workshops are TECH only if they explicitly mention tech topics.\n"
        "3) Expos are TECH only if the expo topic itself is technology.\n"
        "4) If uncertain, output UNKNOWN. Prefer NON-TECH over TECH when unsure.\n\n"
        "Return ONLY ONE LINE:\nCATEGORY: reason (max 10 words)\n\n"
        "Examples:\n"
        'Title: "React Bengaluru Meetup" -> TECH: Software developer meetup.\n'
        'Title: "Free Demo Classes | Day 01" -> EDU-NON-TECH: Demo/coaching session.\n'
        'Title: "Bangalore Yoga & Breathwork" -> NON-TECH: Wellness event.\n\n'
        f"Now classify:\nEvent title: {title}\n"
    )
    if desc.strip():
        prompt += f"Event description: {desc}\n"
    return prompt


def _parse_category(raw: str) -> tuple:
    """Parse LLM response -> (label, reason)."""
    s = raw.strip().strip("`\"' \n\t")
    if "\n" in s:
        s = s[: s.index("\n")].strip()
    upper = s.upper()

    for prefix in ["TECH:", "NON-TECH:", "EDU-NON-TECH:", "UNKNOWN:"]:
        if upper.startswith(prefix):
            return prefix.rstrip(":"), s[len(prefix):].strip()

    if "EDU" in upper or "COACH" in upper or "DEMO CLASS" in upper:
        return "EDU-NON-TECH", s
    if "NON-TECH" in upper or "NOT TECH" in upper:
        return "NON-TECH", s
    if "TECH" in upper:
        return "TECH", s
    return "", s


def classify_tech_event(title: str, description: str = "") -> tuple:
    """
    Ask Ollama LLM whether this event is tech-related.
    Returns (is_tech: bool, reason: str).
    """
    title = title.strip()
    if not title:
        return False, "missing title"

    desc = description.strip()[:700]

    is_edu, why = _edu_spam_prefilter(title, desc)
    if is_edu:
        return False, f"EDU-NON-TECH: {why}"

    # Fast-fail if Ollama is down
    if not _is_ollama_reachable():
        return False, "ollama unreachable — skipped"

    prompt = _build_tech_classifier_prompt(title, desc)
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.0, "num_predict": 90},
    }

    try:
        resp = http_requests.post(
            f"{OLLAMA_URL}/api/generate",
            json=payload,
            timeout=15,
        )
        resp.raise_for_status()
        raw = resp.json().get("response", "").strip()
    except Exception as e:
        return False, f"ollama error: {e}"

    label, reason = _parse_category(raw)

    if label == "TECH":
        return True, reason or "tech-related"
    elif label == "NON-TECH":
        return False, reason or "not tech-related"
    elif label == "EDU-NON-TECH":
        return False, f"EDU-NON-TECH: {reason or 'education/demo'}"
    elif label == "UNKNOWN":
        return False, f"UNKNOWN: {reason or 'insufficient info'}"
    else:
        return False, f"LLM response unclear: {raw}"


# ═══════════════════════════════════════════════════════════════════════════════
#  OLLAMA DESCRIBER (mirrors internal/ai/ollama_describe.go)
# ═══════════════════════════════════════════════════════════════════════════════

def generate_description_from_title(title: str, platform: str) -> str:
    """
    Generate a 6-sentence description from the event title using Ollama.
    Produces website-ready copy: professional English, no PII whatsoever.

    Prefer generate_description_from_context() when scraped data is available.
    """
    if not _is_ollama_reachable():
        return ""

    prompt = (
        "You are writing copy for a professional tech event listing website.\n"
        "Write exactly 6 sentences describing the following event.\n\n"
        "STRICT RULES — violation makes the output unusable:\n"
        "- Plain English sentences only. No bullet points, no markdown, no numbered lists.\n"
        "- DO NOT include any phone numbers, mobile numbers, or contact numbers.\n"
        "- DO NOT include any physical addresses, street names, building numbers, or PIN codes.\n"
        "- DO NOT include any email addresses or website URLs.\n"
        "- DO NOT include any WhatsApp, Telegram, Slack, or Discord links.\n"
        "- DO NOT make up specific dates, ticket prices, or speaker names.\n"
        "- Each sentence must be grammatically correct and end with a full stop.\n"
        "- Focus on: what the event is about, who should attend, what they will learn,\n"
        "  why it matters for the industry, and what networking opportunities exist.\n\n"
        f"Event title: {title}\n"
        f"Platform: {platform}\n\n"
        "Write the 6-sentence description now:"
    )

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.3, "num_predict": 400},
    }

    try:
        resp = http_requests.post(
            f"{OLLAMA_URL}/api/generate",
            json=payload,
            timeout=45,
        )
        resp.raise_for_status()
        result = resp.json().get("response", "").strip()
    except Exception as e:
        print(f"   ⚠️  LLM describe error: {e}")
        return ""

    # Clean markdown artifacts the LLM may still produce
    result = re.sub(r"\*{1,2}|#{1,6}\s?|- {1}", "", result)

    lines = [line.strip() for line in result.split("\n") if line.strip()]
    clean_lines = []
    for line in lines:
        line = re.sub(r"^\d+[\.\)]\s*", "", line)   # strip "1. " or "1) "
        if line and len(line.split()) >= 4:
            # Capitalise and punctuate
            line = line[0].upper() + line[1:]
            if line[-1] not in ".!?":
                line += "."
            clean_lines.append(line)
        if len(clean_lines) >= 6:
            break

    return "\n".join(clean_lines)


def generate_description_from_context(title: str, platform: str, context: str) -> str:
    """
    Generate an 8-sentence, website-ready description using rich scraped context
    (agenda/about text, venue, organizer, dates, etc.) via Gemma 2:2b.

    This is the preferred function when any real event content has been scraped.
    It produces far more accurate, relevant copy than the title-only version.

    Args:
        title:    The event title (used as primary anchor for the model).
        platform: Source platform name, e.g. "echai" or "biec".
        context:  Raw scraped text — agenda, about section, venue, organizer,
                  dates, or any combination. Trimmed to 1800 chars internally.

    Returns:
        8-sentence clean description string, or "" on failure.
        Falls back to generate_description_from_title() if Ollama is unreachable
        or the model returns garbage.

    Notes on sparse context (e.g. BIEC which has no prose description):
        When context contains only structured fields (dates, venue, organizer),
        the prompt asks Gemma to use its own knowledge about the event category
        to fill in meaningful sentences — this is explicitly permitted for
        industry facts (not specific claims like prices or speaker names).
    """
    if not context or not context.strip():
        return generate_description_from_title(title, platform)

    if not _is_ollama_reachable():
        return ""

    # Keep prompt within gemma2:2b's comfortable context window.
    # 1800 chars allows richer external-site descriptions to be included.
    context = context[:1800].strip()

    # Detect whether context is sparse (only structured metadata) or rich (has prose)
    # A context with real description sentences will have sentences ending in punctuation
    is_sparse = len(context) < 250 and "description" not in context.lower()

    if is_sparse:
        # For sparse context (BIEC-style: just dates/venue/organizer), allow
        # Gemma to use general industry knowledge to write meaningful sentences,
        # anchored to the specific facts provided.
        extra_instruction = (
            "The context above contains only structured event metadata (not a prose description).\n"
            "Use the event title and the provided facts as your anchor, and draw on general\n"
            "industry knowledge to write informative sentences about what this type of event\n"
            "covers, who attends, and why it matters. Do NOT invent specific claims like\n"
            "ticket prices, speaker names, or visitor numbers.\n"
        )
    else:
        extra_instruction = (
            "Use the scraped event information above as your primary source.\n"
            "Rephrase and expand it into polished English — do not copy it verbatim.\n"
        )

    prompt = (
        "You are writing copy for a professional tech and industry event listing website.\n"
        "Write exactly 8 clear, informative sentences describing this event.\n\n"
        "STRICT OUTPUT RULES — any violation makes the output unusable:\n"
        "- Plain English prose only. No bullet points, no markdown, no numbered lists.\n"
        "- DO NOT include phone numbers, mobile numbers, or contact details of any kind.\n"
        "- DO NOT include physical street addresses, building numbers, or PIN codes.\n"
        "- DO NOT include email addresses or website URLs in your output.\n"
        "- DO NOT make up specific ticket prices, exhibitor counts, or speaker names.\n"
        "- Each sentence must be grammatically correct and end with a full stop.\n"
        "- Sentences should cover: what the event is about, its industry significance,\n"
        "  who should attend, key topics or product categories on display, the organizer,\n"
        "  the city where it is held, and why it is worth attending.\n\n"
        f"Event title: {title}\n"
        f"Platform: {platform}\n\n"
        f"Event information:\n{context}\n\n"
        f"{extra_instruction}\n"
        "Write exactly 8 sentences now:"
    )

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        # num_predict=600 fits ~8 sentences with comfortable headroom
        "options": {"temperature": 0.3, "num_predict": 600},
    }

    try:
        resp = http_requests.post(
            f"{OLLAMA_URL}/api/generate",
            json=payload,
            timeout=90,       # 90s: Gemma 2:2b on CPU can be slow with richer prompts
        )
        resp.raise_for_status()
        result = resp.json().get("response", "").strip()
    except Exception as e:
        print(f"   ⚠️  LLM context-describe error: {e}")
        return generate_description_from_title(title, platform)

    # Strip any markdown artifacts the model still produces
    result = re.sub(r"\*{1,2}|#{1,6}\s?|- {1}", "", result)

    lines = [line.strip() for line in result.split("\n") if line.strip()]
    clean_lines = []
    for line in lines:
        line = re.sub(r"^\d+[\.\)]\s*", "", line)   # strip "1. " or "1) "
        line = line.strip()
        if not line or len(line.split()) < 4:
            continue
        line = line[0].upper() + line[1:]
        if line[-1] not in ".!?":
            line += "."
        clean_lines.append(line)
        if len(clean_lines) >= 8:
            break

    if not clean_lines:
        print(f"   ⚠️  LLM context-describe returned no usable lines, falling back to title-only")
        return generate_description_from_title(title, platform)

    return "\n".join(clean_lines)