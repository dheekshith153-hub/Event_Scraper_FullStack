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
    allevents: "#92140c",
    hasgeek: "#1e1e24",
    meetup: "#92140c",
    townscript: "#1e1e24",
    biec: "#92140c",
    echai: "#1e1e24",
    hitex: "#92140c",
};

function formatDate(dateStr) {
    if (!dateStr) return "Date TBA";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    }
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
        }
    } catch (e) { }
    return dateStr;
}

export default function EventCard({ event, index }) {
    const [imgError, setImgError] = useState(false);
    const [hovered, setHovered] = useState(false);

    const bgColors = ["#1e1e24", "#92140c", "#1e1e24", "#92140c", "#1e1e24", "#92140c"];
    const fallbackBg = bgColors[index % bgColors.length];

    return (
        <div
            className="rounded-2xl overflow-hidden flex flex-col cursor-pointer group animate-fade-in"
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
        >
            {/* Image */}
            <div className="relative overflow-hidden" style={{ height: 160, background: fallbackBg, flexShrink: 0 }}>
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e24]/90 via-transparent to-transparent" />

                {/* Fallback to initials */}
                <div className="w-full h-full flex items-center justify-center">
                    <span className="text-5xl font-light text-[#fff8f0]/20" style={{ fontFamily: "'Cormorant Garamond', 'Inter', serif", letterSpacing: "0.05em" }}>
                        {event.event_name.slice(0, 2).toUpperCase()}
                    </span>
                </div>

                {/* Source badge */}
                <div
                    className="absolute top-3 left-3 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md"
                    style={{
                        background: "#fff8f0",
                        color: SOURCE_COLORS[event.platform] || "#92140c",
                        border: "none",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        letterSpacing: "0.02em",
                    }}
                >
                    {SOURCE_LABELS[event.platform] || event.platform}
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 p-5 gap-3">
                {/* Date */}
                <p className="text-xs font-medium tracking-wide" style={{ color: "#92140c" }}>
                    {event.date ? formatDate(event.date) : (event.date_time ? formatDate(event.date_time) : "Date TBA")}
                </p>

                {/* Title */}
                <h3 className="font-medium leading-snug line-clamp-2" style={{ color: "#1e1e24", fontSize: "0.95rem", fontFamily: "'Cormorant Garamond', 'Inter', serif", fontSize: "1.1rem", letterSpacing: "-0.01em" }}>
                    {event.event_name}
                </h3>

                {/* Location & Venue */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: "#1e1e24" }}>
                        <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#92140c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate opacity-80">{event.location}</span>
                    </div>
                    {event.address && (
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: "#1e1e24" }}>
                            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#92140c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span className="truncate opacity-70">{event.address}</span>
                        </div>
                    )}
                </div>

                {/* View button */}
                <a
                    href={event.website}
                    className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-300"
                    style={{
                        background: hovered ? "#92140c" : "transparent",
                        border: "1px solid",
                        borderColor: hovered ? "#92140c" : "rgba(146, 20, 12, 0.2)",
                        color: hovered ? "#fff8f0" : "#1e1e24",
                        letterSpacing: "0.02em",
                    }}
                    onClick={e => e.stopPropagation()}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                    View event
                </a>
            </div>
        </div>
    );
}