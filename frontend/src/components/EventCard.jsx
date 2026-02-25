import { useState } from "react";
import { useNavigate } from "react-router-dom";

// ── Curated Unsplash photo pools by platform/category ──────────────────────
const POOL_NETWORKING = [
    "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=900&h=420&fit=crop&auto=format",
];

const POOL_CONFERENCE = [
    "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1559223607-b4d0555ae227?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1582192730841-2a682d7375f9?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1561489413-985b06da5bee?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1511578314322-379afb476865?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1464207687429-7505649dae38?w=900&h=420&fit=crop&auto=format",
];

const POOL_TECH = [
    "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1563770660941-20978e870e26?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=900&h=420&fit=crop&auto=format",
];

const POOL_EXPO = [
    "https://images.unsplash.com/photo-1587168501724-e9354f88e7cb?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1544531585-9847b68c8c86?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1542744094-3a31f272c490?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1526566661780-1a67ea3c863e?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1560439513-74b037a25d84?w=900&h=420&fit=crop&auto=format",
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

// Deterministic: same event always gets the same image on card AND detail page
function getEventImage(event) {
    const pool = PLATFORM_POOL[event.platform] || POOL_CONFERENCE;
    const idx = Math.abs(event.id || 0) % pool.length;
    return pool[idx];
}

// ── Name formatter ────────────────────────────────────────────────────────
const ALWAYS_UPPER = new Set([
    "AWS", "AI", "ML", "API", "UI", "UX", "SQL", "NoSQL", "REST", "SDK",
    "MVP", "SaaS", "PaaS", "IaaS", "IoT", "AR", "VR", "XR", "NFT",
    "Web3", "HTML", "CSS", "JS", "TS", "PHP", "JVM", "GCP", "GIS",
    "CI", "CD", "DevOps", "DevSecOps", "SEO", "CRM", "ERP", "HR",
    "B2B", "B2C", "D2C", "BIEC", "HITEX", "TBA", "EC2", "S3", "RDS",
    "VPC", "IAM", "EKS", "ECS", "LLM", "NLP", "CV", "RL", "DL",
    "GPU", "CPU", "RAM", "SSD", "HDD", "USB", "TCP", "IP", "DNS",
    "HTTP", "HTTPS", "SSH", "SSL", "TLS", "JWT", "OAuth", "ICTL",
    "SLM", "LORA", "RAG",
]);

const ALWAYS_LOWER = new Set([
    "a", "an", "the", "and", "but", "or", "for", "nor", "on", "at",
    "to", "by", "in", "of", "up", "as", "vs", "via", "with",
]);

const STRIP_PREFIXES = [
    /^in\s+person\s*[:\-–]?\s*/i,
    /^event\s+announcement\s*[:\-–]?\s*/i,
    /^free\s+event\s*[:\-–]?\s*/i,
    /^announcement\s*[:\-–]?\s*/i,
    /^upcoming\s*[:\-–]?\s*/i,
    /^online\s+event\s*[:\-–]?\s*/i,
    /^register\s+now\s*[:\-–]?\s*/i,
    /^new\s*[:\-–]\s*/i,
];

const CITY_NAMES = new Set([
    "pune", "bengaluru", "bangalore", "mumbai", "hyderabad", "chennai",
    "delhi", "new delhi", "kolkata", "ahmedabad", "gurugram", "gurgaon",
    "noida", "jaipur", "kochi", "surat", "coimbatore", "salem", "online",
    "virtual", "remote",
]);

function stripEmojis(str) {
    return str
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}

function stripNoisyBrackets(str) {
    str = str.replace(/\(\s*([^)]{1,30})\s*\)/g, (match, inner) => {
        const clean = inner.trim().toLowerCase();
        if (CITY_NAMES.has(clean)) return "";
        if (/^[A-Z]{2,8}$/.test(inner.trim())) return "";
        if (/^\w{1,6}$/.test(inner.trim()) && !/^\d+$/.test(inner.trim())) return "";
        return match;
    });
    str = str.replace(/\[\s*([^\]]{1,30})\s*\]/g, (match, inner) => {
        const clean = inner.trim().toLowerCase();
        if (CITY_NAMES.has(clean)) return "";
        if (/^[A-Z]{2,8}$/.test(inner.trim())) return "";
        return match;
    });
    return str;
}

function toTitleCase(str) {
    const words = str.split(/(\s+|-)/);
    return words
        .map((token, i) => {
            if (/^[\s-]+$/.test(token)) return token;
            const upper = token.toUpperCase();
            const lower = token.toLowerCase();
            if (ALWAYS_UPPER.has(upper)) return upper;
            if (/[®™©]/.test(token) && token !== token.toUpperCase()) return token;
            if (i > 0 && ALWAYS_LOWER.has(lower)) return lower;
            return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
        })
        .join("");
}

function formatEventName(raw) {
    if (!raw) return "";
    let name = stripEmojis(raw);
    for (const pattern of STRIP_PREFIXES) {
        name = name.replace(pattern, "");
    }
    name = stripNoisyBrackets(name);
    name = name.replace(/[|#$%^*~`]/g, "");
    name = name.replace(/\s{2,}/g, " ").trim();
    name = name.replace(/[\-–:,]+$/, "").trim();
    return toTitleCase(name);
}

// ── Date parser ───────────────────────────────────────────────────────────
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
    const usDate = str.match(/^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})$/i);
    if (usDate) {
        const mi = monthIndex(usDate[1]);
        if (mi !== -1) return new Date(Date.UTC(+usDate[3], mi, +usDate[2]));
    }
    const apoMatch = str.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})'(\d{2,4})$/i);
    if (apoMatch) {
        const mi = monthIndex(apoMatch[1]);
        let yr = +apoMatch[3];
        if (yr < 100) yr += 2000;
        if (mi !== -1) return new Date(Date.UTC(yr, mi, +apoMatch[2]));
    }
    const dmyMatch = str.match(/^(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})$/i);
    if (dmyMatch) {
        const mi = monthIndex(dmyMatch[2]);
        if (mi !== -1) return new Date(Date.UTC(+dmyMatch[3], mi, +dmyMatch[1]));
    }
    const range1 = str.match(/^(\d{1,2})\s*[–-]\s*\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i);
    if (range1) {
        const mi = monthIndex(range1[2]);
        if (mi !== -1) return new Date(Date.UTC(+range1[3], mi, +range1[1]));
    }
    const cardish = str.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+(\d{4}))?/i);
    if (cardish) {
        const mi = monthIndex(cardish[3]);
        const yr = cardish[4] ? +cardish[4] : new Date().getUTCFullYear();
        if (mi !== -1) return new Date(Date.UTC(yr, mi, +cardish[2]));
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

export default function EventCard({ event, index }) {
    const [hovered, setHovered] = useState(false);
    const [imgFailed, setImgFailed] = useState(false);
    const navigate = useNavigate();

    const displayDate = formatDateCard(event.date || event.date_time);
    const displayName = formatEventName(event.event_name);

    // ── Location: city_normalized only, skip "Unknown" ────────────────────
    const cityNorm = event.city_normalized;
    const displayLocation =
        cityNorm && cityNorm !== "Unknown" && cityNorm.trim() !== ""
            ? cityNorm
            : "Location TBA";

    // ── Image: always curated Unsplash pool (never scraped image_url) ─────
    // Falls back to next image in pool if Unsplash itself fails to load
    const pool = PLATFORM_POOL[event.platform] || POOL_CONFERENCE;
    const primaryIdx = Math.abs(event.id || 0) % pool.length;
    const fallbackIdx = (primaryIdx + 1) % pool.length;
    const headerImg = imgFailed ? pool[fallbackIdx] : pool[primaryIdx];

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
                    onError={() => setImgFailed(true)}
                />
                <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    height: 40,
                    background: "linear-gradient(to top, rgba(255,248,240,0.4), transparent)",
                }} />
            </div>

            {/* ── Card body ── */}
            <div className="flex flex-col flex-1 p-5 gap-3">

                {/* Date */}
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

                {/* Location — city_normalized only */}
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
