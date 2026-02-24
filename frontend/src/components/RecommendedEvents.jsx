import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = "";

const SOURCE_LABELS = {
    allevents: "AllEvents",
    hasgeek: "HasGeek",
    meetup: "Meetup",
    townscript: "Townscript",
    biec: "BIEC",
    echai: "Echai",
    hitex: "Hitex",
};

// ── Same curated Unsplash pools as EventCard ──────────────────────────────
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

// Deterministic — same event always gets same image, matching EventCard
function getEventImage(event) {
    const pool = PLATFORM_POOL[event.platform] || POOL_CONFERENCE;
    const idx = Math.abs(event.id || 0) % pool.length;
    return pool[idx];
}

// ── Date formatter ────────────────────────────────────────────────────────
function formatDateCard(dateStr) {
    if (!dateStr) return "Date TBA";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split("-").map(Number);
        return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
            month: "short", day: "2-digit", year: "numeric", timeZone: "UTC",
        });
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime()))
            return d.toLocaleDateString("en-US", {
                month: "short", day: "2-digit", year: "numeric", timeZone: "UTC",
            });
    }
    const rm = dateStr.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
    if (rm) {
        const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const d = new Date(Date.UTC(+rm[3], months.indexOf(rm[2].toLowerCase()), +rm[1]));
        if (!isNaN(d.getTime()))
            return d.toLocaleDateString("en-US", {
                month: "short", day: "2-digit", year: "numeric", timeZone: "UTC",
            });
    }
    return dateStr;
}

// ── Fallback SVG (only used if Unsplash also fails) ───────────────────────
function buildSVG(eventName = "", eventId = 0) {
    let hash = (eventId * 2654435761) >>> 0;
    for (let i = 0; i < eventName.length; i++)
        hash = (((hash << 5) - hash + eventName.charCodeAt(i)) | 0) >>> 0;
    const h = hash % 360;
    const h2 = (h + 40) % 360;
    const c1 = `hsl(${h},55%,28%)`;
    const c2 = `hsl(${h2},60%,18%)`;
    const ac = `hsl(${h},70%,75%)`;
    const words = eventName.trim().split(/\s+/).filter(Boolean);
    const ab = words.length >= 2
        ? words[0][0].toUpperCase() + words[1][0].toUpperCase()
        : (eventName.slice(0, 2).toUpperCase() || "EV");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="160" viewBox="0 0 400 160">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <filter id="b"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>
  <rect width="400" height="160" fill="url(#g)"/>
  <circle cx="320" cy="30"  r="90" fill="${ac}" opacity="0.12" filter="url(#b)"/>
  <circle cx="60"  cy="140" r="70" fill="${ac}" opacity="0.10" filter="url(#b)"/>
  <text x="200" y="115" text-anchor="middle" font-family="Georgia,serif"
        font-size="90" font-weight="700" fill="white" opacity="0.07">${ab}</text>
  <text x="200" y="97"  text-anchor="middle" font-family="Georgia,serif"
        font-size="38" font-weight="600" fill="white" opacity="0.55">${ab}</text>
</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

// ── Single recommended card ───────────────────────────────────────────────
function RecommendedCard({ event }) {
    const [hovered, setHovered] = useState(false);
    const [imgError, setImgError] = useState(false);
    const navigate = useNavigate();

    const displayDate = formatDateCard(event.date || event.date_time);

    // Use curated pool image (same as EventCard), fall back to SVG only on error
    const curatedImg = getEventImage(event);
    const headerImg = imgError ? buildSVG(event.event_name, event.id) : curatedImg;

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
            {/* Header image */}
            <div style={{ height: 140, position: "relative", overflow: "hidden", flexShrink: 0 }}>
                <img
                    src={headerImg}
                    alt={event.event_name}
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

            {/* Card body */}
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
                    {event.event_name}
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
                        {event.location || "Location TBA"}
                    </span>
                </div>

                {/* View Details */}
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

// ── Main export ───────────────────────────────────────────────────────────
export default function RecommendedEvents({ eventId, limit = 4 }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        (async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/events/${eventId}/recommended`);
                if (res.ok) {
                    const data = await res.json();
                    setEvents(data.events || []);
                }
            } catch (err) {
                console.error("Error fetching recommended events:", err);
            } finally {
                setLoading(false);
            }
        })();
    }, [eventId]);

    if (loading) return (
        <div className="flex justify-center py-12">
            <div className="w-6 h-6 border rounded-full animate-spin"
                style={{ borderColor: "rgba(146,20,12,0.2)", borderTopColor: "#92140c" }} />
        </div>
    );

    if (!events.length) return null;

    return (
        <div className="mt-12">
            <div className="mb-6">
                <p className="text-xs font-medium tracking-[0.2em] mb-1"
                    style={{ color: "#92140c", opacity: 0.8 }}>MORE LIKE THIS</p>
                <h2 style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "1.8rem", fontWeight: 500,
                    color: "#1e1e24", letterSpacing: "-0.02em",
                }}>
                    Recommended Events
                </h2>
                <div style={{ width: 40, height: 1, background: "#92140c", marginTop: 8, opacity: 0.3 }} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {events.slice(0, limit).map((event) => (
                    <RecommendedCard key={event.id} event={event} />
                ))}
            </div>
        </div>
    );
}
