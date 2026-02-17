import { useState } from "react";

const SOURCE_LABELS = {
    allevents: "AllEvents",
    hasgeek: "HasGeek",
    meetup: "Meetup",
    townscript: "Townscript",
    biec: "BIEC",
    echai: "Echai",
    hitex: "Hitex",
};

const SOURCE_COLORS = {
    allevents: "#7c3aed",
    hasgeek: "#0369a1",
    meetup: "#dc2626",
    townscript: "#059669",
    biec: "#d97706",
    echai: "#db2777",
    hitex: "#4f46e5",
};

function formatDate(dateStr) {
    if (!dateStr) return "Date TBA";

    // If it's already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    }

    // Otherwise, try to parse and format
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
        }
    } catch (e) {
        // If parsing fails, return as-is
    }

    return dateStr;
}

function formatDateRange(start, end) {
    if (!start) return "Date TBA";
    if (!end || start === end) return formatDate(start);
    return `${formatDate(start)} – ${formatDate(end)}`;
}

export default function EventCard({ event, index }) {
    const [imgError, setImgError] = useState(false);
    const [hovered, setHovered] = useState(false);

    const bgColors = ["#1a1a2e", "#0f3460", "#16213e", "#1b262c", "#2d132c", "#1a1a1a"];
    const fallbackBg = bgColors[index % bgColors.length];

    return (
        <div
            className="rounded-2xl overflow-hidden flex flex-col cursor-pointer"
            style={{
                background: "white",
                boxShadow: hovered ? "0 12px 40px rgba(0,0,0,0.15)" : "0 2px 12px rgba(0,0,0,0.07)",
                transform: hovered ? "translateY(-3px)" : "translateY(0)",
                transition: "all 0.22s ease",
                border: "1px solid #ece9e4",
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Image */}
            <div className="relative overflow-hidden" style={{ height: 160, background: fallbackBg, flexShrink: 0 }}>
                {/* No image for now - fallback to initials */}
                <div className="w-full h-full flex items-center justify-center">
                    <span className="text-4xl font-bold text-white/20" style={{ fontFamily: "'DM Serif Display', serif" }}>
                        {event.event_name.slice(0, 2).toUpperCase()}
                    </span>
                </div>

                {/* Source badge */}
                <div
                    className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-semibold text-white"
                    style={{ background: SOURCE_COLORS[event.platform] || "#666", backdropFilter: "blur(4px)" }}
                >
                    {SOURCE_LABELS[event.platform] || event.platform}
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 p-4 gap-2.5">
                {/* Date */}
                <p className="text-xs font-semibold" style={{ color: "#e8305a" }}>
                    {event.date ? formatDate(event.date) : (event.date_time ? formatDate(event.date_time) : "Date TBA")}
                </p>

                {/* Title */}
                <h3 className="font-semibold leading-snug line-clamp-2" style={{ color: "#1a1a1a", fontSize: "0.95rem" }}>
                    {event.event_name}
                </h3>

                {/* Location & Venue */}
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{event.location}</span>
                    </div>
                    {event.address && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span className="truncate">{event.address}</span>
                        </div>
                    )}
                </div>

                {/* View button */}
                <a
                    href={event.website}
                    className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                    style={{
                        border: "1.5px solid #e8e4df",
                        color: "#333",
                        background: hovered ? "#fdf0f2" : "transparent",
                        borderColor: hovered ? "#e8305a" : "#e8e4df",
                        color: hovered ? "#e8305a" : "#555",
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    View event
                </a>
            </div>
        </div>
    );
}
