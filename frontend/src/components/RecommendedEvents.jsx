import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatEventDate } from "../utils/dateUtils";
import { getEventImage, getEventImageFallback, formatEventName } from "./EventCard";

const API_BASE_URL = "";

// ── Single recommended card ───────────────────────────────────────────────
function RecommendedCard({ event }) {
    const [hovered, setHovered] = useState(false);
    const [imgFailed, setImgFailed] = useState(false);
    const navigate = useNavigate();

    // Identical logic to EventCard — same date util, same name formatter
    const displayDate = formatEventDate(event.date || event.date_time);
    const displayName = formatEventName(event.event_name);

    // Identical location logic to EventCard
    const cityNorm = event.city_normalized;
    const displayLocation =
        cityNorm && cityNorm !== "Unknown" && cityNorm.trim() !== ""
            ? cityNorm
            : "Location TBA";

    // Identical image logic to EventCard
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
            {/* Header image — same height as EventCard */}
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
                <h3
                    className="font-medium leading-snug line-clamp-2"
                    style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: "1.05rem", color: "#1e1e24", letterSpacing: "-0.01em",
                    }}
                >
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
