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

function formatDate(dateStr) {
    if (!dateStr) return "Date TBA";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
    }
    return dateStr;
}

export default function RecommendedEvents({ eventId }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchRecommended();
    }, [eventId]);

    const fetchRecommended = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/recommended`);
            if (response.ok) {
                const data = await response.json();
                setEvents(data.events || []);
            }
        } catch (err) {
            console.error("Error fetching recommended events:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="rounded-2xl p-6" style={{ background: "#fff", boxShadow: "0 10px 30px -15px rgba(30, 30, 36, 0.15)" }}>
                <h3 className="text-lg font-medium mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1e1e24" }}>
                    Recommended Events
                </h3>
                <div className="flex justify-center py-4">
                    <div className="w-6 h-6 border rounded-full animate-spin"
                        style={{ borderColor: "rgba(146, 20, 12, 0.2)", borderTopColor: "#92140c" }} />
                </div>
            </div>
        );
    }

    if (events.length === 0) {
        return null;
    }

    return (
        <div className="rounded-2xl p-6" style={{ background: "#fff", boxShadow: "0 10px 30px -15px rgba(30, 30, 36, 0.15)" }}>
            <h3
                className="text-lg font-medium mb-4"
                style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    color: "#1e1e24",
                    letterSpacing: "-0.01em"
                }}
            >
                Recommended Events
            </h3>

            <div className="space-y-4">
                {events.slice(0, 5).map((event) => (
                    <div
                        key={event.id}
                        onClick={() => navigate(`/events/${event.id}`)}
                        className="p-4 rounded-xl cursor-pointer transition-all duration-300"
                        style={{
                            background: "rgba(146, 20, 12, 0.02)",
                            border: "1px solid rgba(146, 20, 12, 0.1)"
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = "rgba(146, 20, 12, 0.05)";
                            e.currentTarget.style.borderColor = "rgba(146, 20, 12, 0.2)";
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = "rgba(146, 20, 12, 0.02)";
                            e.currentTarget.style.borderColor = "rgba(146, 20, 12, 0.1)";
                        }}
                    >
                        <div className="flex items-start gap-2 mb-2">
                            <span
                                className="px-2 py-0.5 rounded text-xs font-medium flex-shrink-0"
                                style={{
                                    background: "#92140c",
                                    color: "#fff8f0",
                                }}
                            >
                                {SOURCE_LABELS[event.platform] || event.platform}
                            </span>
                            <span className="text-xs" style={{ color: "#92140c", opacity: 0.8 }}>
                                {formatDate(event.date || event.date_time)}
                            </span>
                        </div>

                        <h4
                            className="text-sm font-medium mb-2 line-clamp-2 leading-snug"
                            style={{
                                color: "#1e1e24",
                                fontFamily: "'Cormorant Garamond', serif",
                                fontSize: "0.95rem"
                            }}
                        >
                            {event.event_name}
                        </h4>

                        <div className="flex items-center gap-1 text-xs" style={{ color: "#1e1e24", opacity: 0.7 }}>
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="truncate">{event.location}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}