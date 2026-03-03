import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatEventDate } from "../utils/dateUtils";

// ── Curated Unsplash photo pools ─────────────────────────────────────────────
export const POOL_NETWORKING = [
    "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=900&h=420&fit=crop&auto=format",
];

export const POOL_CONFERENCE = [
    "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1559223607-b4d0555ae227?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1582192730841-2a682d7375f9?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1561489413-985b06da5bee?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1511578314322-379afb476865?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1464207687429-7505649dae38?w=900&h=420&fit=crop&auto=format",
];

export const POOL_TECH = [
    "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1563770660941-20978e870e26?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=900&h=420&fit=crop&auto=format",
];

export const POOL_EXPO = [
    "https://images.unsplash.com/photo-1587168501724-e9354f88e7cb?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1544531585-9847b68c8c86?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1542744094-3a31f272c490?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1526566661780-1a67ea3c863e?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1560439513-74b037a25d84?w=900&h=420&fit=crop&auto=format",
];

export const PLATFORM_POOL = {
    echai: POOL_NETWORKING,
    meetup: POOL_NETWORKING,
    hasgeek: POOL_TECH,
    allevents: POOL_CONFERENCE,
    townscript: POOL_CONFERENCE,
    biec: POOL_EXPO,
    hitex: POOL_EXPO,
};

/**
 * Deterministic image lookup — same event ID always returns same image.
 * Exported so EventDetail can import it and always match the card image.
 */
export function getEventImage(event) {
    const pool = PLATFORM_POOL[event.platform] || POOL_CONFERENCE;
    return pool[Math.abs(event.id || 0) % pool.length];
}
export function getEventImageFallback(event) {
    const pool = PLATFORM_POOL[event.platform] || POOL_CONFERENCE;
    return pool[(Math.abs(event.id || 0) + 1) % pool.length];
}

// ── Name formatter ────────────────────────────────────────────────────────────
const ALWAYS_UPPER = new Set([
    "AWS", "AI", "ML", "API", "UI", "UX", "SQL", "NoSQL", "REST", "SDK", "MVP", "SaaS", "PaaS",
    "IaaS", "IoT", "AR", "VR", "XR", "NFT", "Web3", "HTML", "CSS", "JS", "TS", "PHP", "JVM",
    "GCP", "GIS", "CI", "CD", "DevOps", "DevSecOps", "SEO", "CRM", "ERP", "HR", "B2B", "B2C",
    "D2C", "BIEC", "HITEX", "TBA", "EC2", "S3", "RDS", "VPC", "IAM", "EKS", "ECS", "LLM", "NLP",
    "CV", "RL", "DL", "GPU", "CPU", "RAM", "SSD", "HDD", "USB", "TCP", "IP", "DNS", "HTTP",
    "HTTPS", "SSH", "SSL", "TLS", "JWT", "OAuth", "ICTL", "SLM", "LORA", "RAG",
]);

const ALWAYS_LOWER = new Set([
    "a", "an", "the", "and", "but", "or", "for", "nor", "on", "at", "to", "by", "in", "of",
    "up", "as", "vs", "via", "with",
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
    "pune", "bengaluru", "bangalore", "mumbai", "hyderabad", "chennai", "delhi",
    "new delhi", "kolkata", "ahmedabad", "gurugram", "gurgaon", "noida", "jaipur",
    "kochi", "surat", "coimbatore", "salem", "online", "virtual", "remote",
]);

function stripEmojis(str) {
    return str.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").replace(/\s{2,}/g, " ").trim();
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
    return str.split(/(\s+|-)/).map((token, i) => {
        if (/^[\s-]+$/.test(token)) return token;
        const upper = token.toUpperCase();
        const lower = token.toLowerCase();
        if (ALWAYS_UPPER.has(upper)) return upper;
        if (/[®™©]/.test(token) && token !== token.toUpperCase()) return token;
        if (i > 0 && ALWAYS_LOWER.has(lower)) return lower;
        return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    }).join("");
}

export function formatEventName(raw) {
    if (!raw) return "";
    let name = stripEmojis(raw);
    for (const p of STRIP_PREFIXES) name = name.replace(p, "");
    name = stripNoisyBrackets(name);
    name = name.replace(/[|#$%^*~`]/g, "").replace(/\s{2,}/g, " ").trim();
    name = name.replace(/[\-–:,]+$/, "").trim();
    return toTitleCase(name);
}

// ─────────────────────────────────────────────────────────────────────────────

export default function EventCard({ event }) {
    const [hovered, setHovered] = useState(false);
    const [imgFailed, setImgFailed] = useState(false);
    const navigate = useNavigate();

    // Use shared dateUtils — handles ALL platform formats.
    // Prefer events.date (YYYY-MM-DD). Meetup rows have empty date but
    // populated date_time (ISO), so fallback to date_time covers them.
    const displayDate = formatEventDate(event.date || event.date_time);
    const displayName = formatEventName(event.event_name);

    const cityNorm = event.city_normalized;
    const displayLocation =
        cityNorm && cityNorm !== "Unknown" && cityNorm.trim() !== ""
            ? cityNorm : "Location TBA";

    const headerImg = imgFailed ? getEventImageFallback(event) : getEventImage(event);

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
            <div style={{ height: 160, position: "relative", overflow: "hidden", flexShrink: 0 }}>
                <img
                    src={headerImg}
                    alt={displayName}
                    style={{
                        width: "100%", height: "100%", objectFit: "cover", display: "block",
                        transition: "transform 0.5s ease",
                        transform: hovered ? "scale(1.06)" : "scale(1)",
                    }}
                    onError={() => setImgFailed(true)}
                />
                <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0, height: 40,
                    background: "linear-gradient(to top, rgba(255,248,240,0.4), transparent)",
                }} />
            </div>

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

                {/* CTA */}
                <button
                    className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                    style={{
                        background: hovered ? "#92140c" : "transparent",
                        border: "1px solid",
                        borderColor: hovered ? "#92140c" : "rgba(146,20,12,0.2)",
                        color: hovered ? "#fff8f0" : "#1e1e24",
                        letterSpacing: "0.02em", transition: "all 0.3s",
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
