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

// Unified date format: "Feb 21, 2026"
function formatDate(dateStr) {
    if (!dateStr) return "Date TBA";

    // Standard ISO date
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split("-").map(Number);
        const d = new Date(year, month - 1, day);
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }

    // Try parsing other formats
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }

    // Extract first date from range strings like "17 Feb 2026 - 18 Feb 2026"
    const rangeMatch = dateStr.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
    if (rangeMatch) {
        const d = new Date(`${rangeMatch[2]} ${rangeMatch[1]}, ${rangeMatch[3]}`);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }
    }

    // "February 26 - March 01, 2026" style
    const longMatch = dateStr.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/i);
    if (longMatch) {
        const yearMatch = dateStr.match(/\d{4}/);
        const year = yearMatch ? yearMatch[0] : new Date().getFullYear();
        const d = new Date(`${longMatch[1]} ${longMatch[2]}, ${year}`);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }
    }

    return dateStr;
}

export default function EventCard({ event, index }) {
    const [hovered, setHovered] = useState(false);
    const navigate = useNavigate();

    const bgColors = ["#1e1e24", "#92140c", "#1e1e24", "#92140c", "#1e1e24", "#92140c"];
    const fallbackBg = bgColors[index % bgColors.length];

    const platformLabel = SOURCE_LABELS[event.platform] || event.platform || "Event";
    const displayDate = formatDate(event.date || event.date_time);

    return (
        <div
            className="rounded-2xl overflow-hidden flex flex-col cursor-pointer"
            style={{
                background: "#fff8f0",
                boxShadow: hovered
                    ? "0 30px 50px -20px rgba(146, 20, 12, 0.3), 0 0 0 1px #92140c"
                    : "0 10px 30px -15px rgba(30, 30, 36, 0.2), 0 0 0 1px rgba(146, 20, 12, 0.1)",
                transform: hovered ? "translateY(-4px) scale(1.02)" : "translateY(0)",
                transition: "all 0.4s cubic-bezier(0.2, 0.9, 0.3, 1)",
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => navigate(`/events/${event.id}`)}
        >
            {/* Coloured header with platform badge */}
            <div
                style={{
                    height: 140,
                    background: fallbackBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                {/* Large letter watermark */}
                <span
                    style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: "3rem",
                        fontWeight: 500,
                        color: "rgba(255, 248, 240, 0.15)",
                        userSelect: "none",
                    }}
                >
                    {platformLabel[0]}
                </span>

                {/* Platform badge */}
                <div
                    style={{
                        position: "absolute",
                        top: 12,
                        left: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 10px",
                        borderRadius: 20,
                        background: "rgba(255, 248, 240, 0.15)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255, 248, 240, 0.2)",
                    }}
                >
                    <span
                        style={{
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            background: "#fff8f0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 9,
                            fontWeight: 600,
                            color: fallbackBg,
                        }}
                    >
                        {platformLabel[0]}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "#fff8f0", letterSpacing: "0.02em" }}>
                        {platformLabel}
                    </span>
                </div>

                {/* Offline badge */}
                {event.event_type && (
                    <div
                        style={{
                            position: "absolute",
                            top: 12,
                            right: 12,
                            padding: "3px 8px",
                            borderRadius: 20,
                            background: "rgba(255, 248, 240, 0.15)",
                            backdropFilter: "blur(8px)",
                            fontSize: 10,
                            fontWeight: 500,
                            color: "#fff8f0",
                            border: "1px solid rgba(255, 248, 240, 0.2)",
                        }}
                    >
                        {event.event_type}
                    </div>
                )}
            </div>

            {/* Card body — only date, name, location, button */}
            <div className="flex flex-col flex-1 p-5 gap-3">
                {/* Date */}
                <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#92140c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-medium" style={{ color: "#92140c", letterSpacing: "0.02em" }}>
                        {displayDate}
                    </span>
                </div>

                {/* Title */}
                <h3
                    className="font-medium leading-snug line-clamp-2"
                    style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: "1.05rem",
                        color: "#1e1e24",
                        letterSpacing: "-0.01em",
                    }}
                >
                    {event.event_name}
                </h3>

                {/* Location */}
                <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#1e1e24", opacity: 0.5 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs truncate" style={{ color: "#1e1e24", opacity: 0.7, letterSpacing: "0.02em" }}>
                        {event.location || "Location TBA"}
                    </span>
                </div>

                {/* View Details button */}
                <button
                    className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-300"
                    style={{
                        background: hovered ? "#92140c" : "transparent",
                        border: "1px solid",
                        borderColor: hovered ? "#92140c" : "rgba(146, 20, 12, 0.2)",
                        color: hovered ? "#fff8f0" : "#1e1e24",
                        letterSpacing: "0.02em",
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/events/${event.id}`);
                    }}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    View Details
                </button>
            </div>
        </div>
    );
}
