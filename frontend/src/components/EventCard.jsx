import { useState } from "react";
import { useNavigate } from "react-router-dom";

const SOURCE_LABELS = {
    allevents: "AllEvents",
    hasgeek: "HasGeek",
    meetup: "Meetup",
    townscript: "Townscript",
    biec: "BIEC",
    echai: "Echai",
    hitex: "Hitex",
};

const PLATFORM_COLORS = {
    allevents: "#92140c",
    hasgeek: "#1e1e24",
    meetup: "#92140c",
    townscript: "#1e1e24",
    biec: "#92140c",
    echai: "#1e1e24",
    hitex: "#5c2d1e",
};

// ── Date: "Feb 21, 2026" — always UTC so no timezone shift ───────
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

    const lm = dateStr.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/i);
    if (lm) {
        const ym = dateStr.match(/\d{4}/);
        const yr = ym ? +ym[0] : new Date().getFullYear();
        const d = new Date(`${lm[1]} ${lm[2]}, ${yr}`);
        if (!isNaN(d.getTime()))
            return d.toLocaleDateString("en-US", {
                month: "short", day: "2-digit", year: "numeric", timeZone: "UTC",
            });
    }

    return dateStr;
}

// ── Deterministic unique SVG per event ───────────────────────────
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
  <line x1="0" y1="53"  x2="400" y2="53"  stroke="white" stroke-opacity="0.04" stroke-width="1"/>
  <line x1="0" y1="106" x2="400" y2="106" stroke="white" stroke-opacity="0.04" stroke-width="1"/>
  <line x1="133" y1="0" x2="133" y2="160" stroke="white" stroke-opacity="0.04" stroke-width="1"/>
  <line x1="266" y1="0" x2="266" y2="160" stroke="white" stroke-opacity="0.04" stroke-width="1"/>
  <text x="200" y="115" text-anchor="middle" font-family="Georgia,serif"
        font-size="90" font-weight="700" fill="white" opacity="0.07">${ab}</text>
  <text x="200" y="97"  text-anchor="middle" font-family="Georgia,serif"
        font-size="38" font-weight="600" fill="white" opacity="0.55">${ab}</text>
</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

export default function EventCard({ event, index }) {
    const [hovered, setHovered] = useState(false);
    const [imgError, setImgError] = useState(false);
    const navigate = useNavigate();

    const displayDate = formatDateCard(event.date || event.date_time);

    const realImg = event.image_url || null;
    const headerImg = (realImg && !imgError) ? realImg : buildSVG(event.event_name, event.id);

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
            {/* ── Header image / SVG — no badges ── */}
            <div style={{ height: 140, position: "relative", overflow: "hidden", flexShrink: 0 }}>
                <img
                    src={headerImg}
                    alt={event.event_name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    onError={() => setImgError(true)}
                />
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
