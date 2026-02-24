import { useState } from "react";
import { useNavigate } from "react-router-dom";

// ── Curated Unsplash photo pools by platform/category ──────────────────────
const POOL_NETWORKING = [
    "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=400&h=220&fit=crop&auto=format",
];

const POOL_CONFERENCE = [
    "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1559223607-b4d0555ae227?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1582192730841-2a682d7375f9?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1561489413-985b06da5bee?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1511578314322-379afb476865?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1464207687429-7505649dae38?w=400&h=220&fit=crop&auto=format",
];

const POOL_TECH = [
    "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1563770660941-20978e870e26?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=220&fit=crop&auto=format",
];

const POOL_EXPO = [
    "https://images.unsplash.com/photo-1587168501724-e9354f88e7cb?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1544531585-9847b68c8c86?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1542744094-3a31f272c490?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1526566661780-1a67ea3c863e?w=400&h=220&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1560439513-74b037a25d84?w=400&h=220&fit=crop&auto=format",
];

const PLATFORM_POOL = {
    echai: POOL_NETWORKING,
    meetup: POOL_NETWORKING,
    hasgeek: POOL_TECH,
    allevents: POOL_CONFERENCE,
    townscript: POOL_CONFERENCE,
    biec: POOL_EXPO,
    hitex: POOL_EXPO,
};

function getEventImage(event) {
    const pool = PLATFORM_POOL[event.platform] || POOL_CONFERENCE;
    const idx = Math.abs(event.id || 0) % pool.length;
    return pool[idx];
}

// ── Month abbreviations ───────────────────────────────────────────────────
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthIndex(str) {
    return MONTHS.findIndex(m => m.toLowerCase() === str.slice(0, 3).toLowerCase());
}

function toDisplay(date) {
    if (!date || isNaN(date.getTime())) return null;
    const mon = MONTHS[date.getUTCMonth()];
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const yr = date.getUTCFullYear();
    return `${mon} ${dd}, ${yr}`;
}

function parseDate(str) {
    if (!str) return null;
    str = str.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [y, m, d] = str.split("-").map(Number);
        return new Date(Date.UTC(y, m - 1, d));
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
        const p = new Date(str);
        if (!isNaN(p.getTime()))
            return new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate()));
    }

    const apoMatch = str.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})'(\d{2,4})$/i);
    if (apoMatch) {
        const mi = monthIndex(apoMatch[1]);
        let yr = +apoMatch[3];
        if (yr < 100) yr += 2000;
        if (mi !== -1) return new Date(Date.UTC(yr, mi, +apoMatch[2]));
    }

    const mdyMatch = str.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})[,\s]+(\d{4})$/i);
    if (mdyMatch) {
        const mi = monthIndex(mdyMatch[1]);
        if (mi !== -1) return new Date(Date.UTC(+mdyMatch[3], mi, +mdyMatch[2]));
    }

    const dmyMatch = str.match(/^(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})$/i);
    if (dmyMatch) {
        const mi = monthIndex(dmyMatch[2]);
        if (mi !== -1) return new Date(Date.UTC(+dmyMatch[3], mi, +dmyMatch[1]));
    }

    const longMatch = str.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:[,\s]+(\d{4}))?$/i);
    if (longMatch) {
        const mi = monthIndex(longMatch[1]);
        const yr = longMatch[3] ? +longMatch[3] : new Date().getUTCFullYear();
        if (mi !== -1) return new Date(Date.UTC(yr, mi, +longMatch[2]));
    }

    const bareMatch = str.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})$/i);
    if (bareMatch) {
        const mi = monthIndex(bareMatch[1]);
        if (mi !== -1) return new Date(Date.UTC(new Date().getUTCFullYear(), mi, +bareMatch[2]));
    }

    return null;
}

function formatDateCard(raw) {
    if (!raw) return "Date TBA";
    const str = raw.trim();
    const rangeMatch = str.match(/^(.+?)\s+[-–]\s+.+$|^(.+?)\s+to\s+.+$/i);
    const startStr = rangeMatch ? (rangeMatch[1] || rangeMatch[2]).trim() : str;
    return toDisplay(parseDate(startStr)) || "Date TBA";
}

// ── Event name formatter ──────────────────────────────────────────────────
// Preserves known tech acronyms, strips emojis & noisy prefixes,
// applies Title Case to everything else.

// Words that should stay fully uppercase (tech acronyms & common abbreviations)
const ALWAYS_UPPER = new Set([
    "AWS", "AI", "ML", "API", "UI", "UX", "SQL", "NoSQL", "REST", "SDK",
    "MVP", "SaaS", "PaaS", "IaaS", "IoT", "AR", "VR", "XR", "NFT",
    "Web3", "HTML", "CSS", "JS", "TS", "PHP", "JVM", "GCP", "GIS",
    "CI", "CD", "DevOps", "DevSecOps", "SEO", "CRM", "ERP", "HR",
    "B2B", "B2C", "D2C", "BIEC", "HITEX", "TBA",
]);

// Words that should stay lowercase (conjunctions, prepositions, articles)
const ALWAYS_LOWER = new Set([
    "a", "an", "the", "and", "but", "or", "for", "nor", "on", "at",
    "to", "by", "in", "of", "up", "as", "vs", "via",
]);

// Noisy prefixes to strip before formatting (case-insensitive)
const STRIP_PREFIXES = [
    /^in\s+person\s*[:\-–]?\s*/i,
    /^event\s+announcement\s*[:\-–]?\s*/i,
    /^free\s+event\s*[:\-–]?\s*/i,
    /^announcement\s*[:\-–]?\s*/i,
    /^upcoming\s*[:\-–]?\s*/i,
    /^online\s+event\s*[:\-–]?\s*/i,
];

// Strip all emoji characters
function stripEmojis(str) {
    return str
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}

function toTitleCase(str) {
    // Split on spaces and hyphens, preserve hyphens in output
    const words = str.split(/(\s+|-)/);
    return words
        .map((token, i) => {
            // Preserve whitespace and hyphen tokens as-is
            if (/^[\s-]+$/.test(token)) return token;

            const upper = token.toUpperCase();
            const lower = token.toLowerCase();

            // Always-upper acronyms
            if (ALWAYS_UPPER.has(upper)) return upper;

            // Preserve mixed-case like "Kafka®" — if token has mixed case already and
            // contains a special char (®, ™, ©), keep it as-is
            if (/[®™©]/.test(token) && token !== token.toUpperCase()) return token;

            // Always-lower words (except first word of name)
            if (i > 0 && ALWAYS_LOWER.has(lower)) return lower;

            // Default: capitalise first letter, lowercase rest
            return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
        })
        .join("");
}

function formatEventName(raw) {
    if (!raw) return "";

    // 1. Strip emojis
    let name = stripEmojis(raw);

    // 2. Strip noisy prefixes
    for (const pattern of STRIP_PREFIXES) {
        name = name.replace(pattern, "");
    }

    // 3. Collapse extra whitespace
    name = name.replace(/\s{2,}/g, " ").trim();

    // 4. Apply Title Case
    return toTitleCase(name);
}

// ── Location formatter ────────────────────────────────────────────────────
// Extracts the most useful part: "Venue, Area, City" → "Area, City"
// or just normalises casing for overly long venue strings.
function formatLocation(raw) {
    if (!raw) return "Location TBA";

    // Split on comma
    const parts = raw.split(",").map(p => p.trim()).filter(Boolean);

    if (parts.length === 0) return "Location TBA";

    // If only one part, return as-is with title case
    if (parts.length === 1) return toTitleCase(parts[0]);

    // If 2 parts: "Venue, City" → keep both
    if (parts.length === 2) return parts.map(toTitleCase).join(", ");

    // If 3+ parts: often "Full Venue Address, Area, City"
    // → Show last 2 meaningful parts (skip long address strings)
    const lastTwo = parts.slice(-2).map(toTitleCase);
    return lastTwo.join(", ");
}

// ── Fallback SVG when Unsplash fails ──────────────────────────────────────
function safeInitials(eventName = "") {
    const safe = eventName.replace(/[^\x20-\x7E]/g, "").trim();
    const words = safe.split(/\s+/).filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    if (words.length === 1 && words[0].length >= 2) return words[0].slice(0, 2).toUpperCase();
    return "EV";
}

function buildFallbackSVG(eventName = "", eventId = 0) {
    let hash = (eventId * 2654435761) >>> 0;
    const chars = [...(eventName || "")];
    for (let i = 0; i < chars.length; i++) {
        const code = chars[i].codePointAt(0) || 0;
        hash = (((hash << 5) - hash + code) | 0) >>> 0;
    }
    const h = hash % 360;
    const h2 = (h + 40) % 360;
    const c1 = `hsl(${h},55%,28%)`;
    const c2 = `hsl(${h2},60%,18%)`;
    const ac = `hsl(${h},70%,75%)`;
    const ab = safeInitials(eventName);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220" viewBox="0 0 400 220">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <filter id="b"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>
  <rect width="400" height="220" fill="url(#g)"/>
  <circle cx="320" cy="40"  r="90" fill="${ac}" opacity="0.12" filter="url(#b)"/>
  <circle cx="60"  cy="180" r="70" fill="${ac}" opacity="0.10" filter="url(#b)"/>
  <text x="200" y="145" text-anchor="middle" font-family="Georgia,serif"
        font-size="100" font-weight="700" fill="white" opacity="0.07">${ab}</text>
  <text x="200" y="130" text-anchor="middle" font-family="Georgia,serif"
        font-size="46" font-weight="600" fill="white" opacity="0.55">${ab}</text>
</svg>`;

    try {
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
    } catch {
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220"><rect width="400" height="220" fill="${c1}"/></svg>`
        )}`;
    }
}

export default function EventCard({ event, index }) {
    const [hovered, setHovered] = useState(false);
    const [imgError, setImgError] = useState(false);
    const navigate = useNavigate();

    const displayDate = formatDateCard(event.date || event.date_time);
    const displayName = formatEventName(event.event_name);
    const displayLocation = formatLocation(event.location);

    const curatedImg = getEventImage(event);
    const headerImg = imgError ? buildFallbackSVG(event.event_name, event.id) : curatedImg;

    return (
        <div
            className="rounded-2xl overflow-hidden flex flex-col cursor-pointer"
            style={{
                background: "#fff8f0",
                boxShadow: hovered
                    ? "0 30px 50px -20px rgba(146,20,12,0.3), 0 0 0 1px #92140c"
                    : "0 10px 30px -15px rgba(30,30,36,0.2), 0 0 0 1px rgba(146,20,12,0.1)",
                transform: hovered ? "translateY(-4px) scale(1.02)" : "translateY(0)",
                transition: "all 0.4s cubic-bezier(0.2, 0.9, 0.3, 1)",
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => navigate(`/events/${event.id}`)}
        >
            {/* ── Header image ── */}
            <div style={{ height: 160, position: "relative", overflow: "hidden", flexShrink: 0 }}>
                <img
                    src={headerImg}
                    alt={displayName}
                    style={{
                        width: "100%", height: "100%",
                        objectFit: "cover", display: "block",
                        transition: "transform 0.5s ease",
                        transform: hovered ? "scale(1.06)" : "scale(1)",
                    }}
                    onError={() => setImgError(true)}
                />
                <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    height: 40,
                    background: "linear-gradient(to top, rgba(255,248,240,0.4), transparent)",
                }} />
            </div>

            {/* ── Card body ── */}
            <div className="flex flex-col flex-1 p-5 gap-3">

                {/* Date — always "Mon DD, YYYY" */}
                <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#92140c" }}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-medium" style={{ color: "#92140c", letterSpacing: "0.02em" }}>
                        {displayDate}
                    </span>
                </div>

                {/* Title */}
                <h3 className="font-medium leading-snug line-clamp-2"
                    style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: "1.05rem", color: "#1e1e24", letterSpacing: "-0.01em",
                    }}>
                    {displayName}
                </h3>

                {/* Location */}
                <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#1e1e24", opacity: 0.45 }}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs truncate" style={{ color: "#1e1e24", opacity: 0.65, letterSpacing: "0.02em" }}>
                        {displayLocation}
                    </span>
                </div>

                {/* View Details button */}
                <button
                    className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                    style={{
                        background: hovered ? "#92140c" : "transparent",
                        border: "1px solid",
                        borderColor: hovered ? "#92140c" : "rgba(146,20,12,0.2)",
                        color: hovered ? "#fff8f0" : "#1e1e24",
                        letterSpacing: "0.02em",
                        transition: "all 0.3s",
                    }}
                    onClick={e => { e.stopPropagation(); navigate(`/events/${event.id}`); }}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    View Details
                </button>
            </div>
        </div>
    );
}
