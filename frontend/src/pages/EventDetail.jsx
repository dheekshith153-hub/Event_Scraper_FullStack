import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import RecommendedEvents from "../components/RecommendedEvents";
import SaveButton from "../components/SaveButton";

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

// Platform base URLs for "Visit Official Website" link
const SOURCE_URLS = {
    allevents: "https://allevents.in",
    hasgeek: "https://hasgeek.com",
    meetup: "https://meetup.com",
    townscript: "https://townscript.com",
    biec: "https://www.biecexpo.com",
    echai: "https://echai.ventures",
    hitex: "https://hitex.co.in",
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

// Unified date: "Monday, February 21, 2026"
function formatDate(dateStr) {
    if (!dateStr) return "Date TBA";

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split("-").map(Number);
        const d = new Date(year, month - 1, day);
        return d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    }

    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    }

    const rangeMatch = dateStr.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
    if (rangeMatch) {
        const d = new Date(`${rangeMatch[2]} ${rangeMatch[1]}, ${rangeMatch[3]}`);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        }
    }

    return dateStr;
}

export default function EventDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [event, setEvent] = useState(null);
    const [eventDetail, setEventDetail] = useState(null);
    const [isSaved, setIsSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchEventDetail();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const fetchEventDetail = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem("token");
            const headers = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const response = await fetch(`${API_BASE_URL}/api/events/${id}`, { headers });
            if (!response.ok) throw new Error(`Failed to fetch event (${response.status})`);

            const data = await response.json();
            setEvent(data.event);
            setEventDetail(data.event_detail);
            setIsSaved(data.is_saved || false);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen" style={{ background: "#fff8f0" }}>
                <Header />
                <div className="flex justify-center items-center py-24">
                    <div className="w-8 h-8 border rounded-full animate-spin"
                        style={{ borderColor: "rgba(146, 20, 12, 0.2)", borderTopColor: "#92140c" }} />
                </div>
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="min-h-screen" style={{ background: "#fff8f0" }}>
                <Header />
                <div className="max-w-4xl mx-auto px-4 py-12">
                    <div className="text-center py-12 rounded-2xl"
                        style={{ background: "#fff8f0", border: "1px solid rgba(146, 20, 12, 0.1)" }}>
                        <div className="text-5xl mb-4" style={{ color: "#92140c", opacity: 0.5 }}>⚠️</div>
                        <p className="text-lg font-medium mb-4" style={{ color: "#1e1e24" }}>Event not found</p>
                        <button onClick={() => navigate("/events")}
                            className="px-5 py-2 rounded-full text-sm font-medium"
                            style={{ background: "#1e1e24", color: "#fff8f0", border: "1px solid #92140c", letterSpacing: "0.05em" }}>
                            Back to Events
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Determine the official website link:
    // For HITEX, prefer the external organizer URL if available; else fallback to event.website
    const officialWebsite = eventDetail?.external_url || eventDetail?.registration_url || event.website;
    const parentSiteURL = SOURCE_URLS[event.platform] || officialWebsite;
    const parentSiteLabel = SOURCE_LABELS[event.platform] || event.platform;

    return (
        <div className="min-h-screen" style={{ background: "#fff8f0", fontFamily: "'Inter', sans-serif" }}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap" rel="stylesheet" />

            {/* Description HTML styles injected globally for this page */}
            <style>{`
                .event-html-description h1,
                .event-html-description h2 { font-family: 'Cormorant Garamond', serif; color: #1e1e24; margin: 1.2em 0 0.4em; font-weight: 600; }
                .event-html-description h1 { font-size: 1.5rem; }
                .event-html-description h2 { font-size: 1.25rem; }
                .event-html-description h3 { font-size: 1.05rem; font-weight: 600; color: #92140c; margin: 1em 0 0.3em; }
                .event-html-description p  { margin: 0.6em 0; line-height: 1.75; color: #1e1e24; opacity: 0.88; }
                .event-html-description ul,
                .event-html-description ol { padding-left: 1.4em; margin: 0.6em 0; }
                .event-html-description li  { margin: 0.3em 0; line-height: 1.65; color: #1e1e24; opacity: 0.88; }
                .event-html-description strong { color: #1e1e24; font-weight: 600; }
                .event-html-description a  { color: #92140c; text-decoration: underline; }
                .event-html-description img { max-width: 100%; border-radius: 8px; margin: 1em 0; }
                .event-html-description br  { display: block; content: ""; margin: 0.25em 0; }
                .event-html-description div { margin: 0.4em 0; }
            `}</style>

            <Header />

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Back */}
                <button onClick={() => navigate("/events")}
                    className="flex items-center gap-2 mb-6 text-sm font-medium"
                    style={{ color: "#1e1e24", opacity: 0.7 }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to all events
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* ── Main content ── */}
                    <div className="lg:col-span-2">
                        <div className="rounded-2xl p-8 mb-6"
                            style={{ background: "#fff", boxShadow: "0 10px 30px -15px rgba(30, 30, 36, 0.15)" }}>

                            {/* Platform + type badges */}
                            <div className="flex items-center gap-3 mb-4">
                                <span className="px-3 py-1.5 rounded-lg text-xs font-medium"
                                    style={{ background: SOURCE_COLORS[event.platform] || "#92140c", color: "#fff8f0", letterSpacing: "0.02em" }}>
                                    {SOURCE_LABELS[event.platform] || event.platform}
                                </span>
                                <span className="text-xs tracking-wide" style={{ color: "#92140c", opacity: 0.8 }}>
                                    {event.event_type || "Offline"}
                                </span>
                            </div>

                            {/* Title */}
                            <h1 className="font-medium mb-4 leading-tight"
                                style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2.5rem", color: "#1e1e24", letterSpacing: "-0.02em" }}>
                                {event.event_name}
                            </h1>

                            {/* Date */}
                            <div className="flex items-center gap-2 mb-3">
                                <svg className="w-5 h-5 flex-shrink-0" style={{ color: "#92140c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-base font-medium" style={{ color: "#1e1e24" }}>
                                    {formatDate(event.date || event.date_time)}
                                </span>
                            </div>

                            {/* Location */}
                            <div className="flex items-center gap-2 mb-3">
                                <svg className="w-5 h-5 flex-shrink-0" style={{ color: "#92140c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="text-base" style={{ color: "#1e1e24", opacity: 0.9 }}>{event.location}</span>
                            </div>

                            {/* Address */}
                            {event.address && (
                                <div className="flex items-start gap-2 mb-4">
                                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#92140c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    <span className="text-sm" style={{ color: "#1e1e24", opacity: 0.8 }}>{event.address}</span>
                                </div>
                            )}

                            <div style={{ width: "100%", height: 1, background: "rgba(146, 20, 12, 0.1)", margin: "1.5rem 0" }} />

                            {/* Event detail fields */}
                            {eventDetail && (
                                <>
                                    {/* Image */}
                                    {eventDetail.image_url && (
                                        <div className="mb-6 rounded-xl overflow-hidden"
                                            style={{ border: "1px solid rgba(146, 20, 12, 0.1)" }}>
                                            <img src={eventDetail.image_url} alt={event.event_name}
                                                className="w-full h-auto"
                                                onError={(e) => (e.target.style.display = "none")} />
                                        </div>
                                    )}

                                    {/* Organizer only (price removed) */}
                                    {eventDetail.organizer && (
                                        <div className="mb-6">
                                            <p className="text-xs font-medium tracking-wide mb-1"
                                                style={{ color: "#92140c", opacity: 0.8 }}>ORGANIZED BY</p>
                                            <p className="text-sm font-medium" style={{ color: "#1e1e24" }}>
                                                {eventDetail.organizer}
                                            </p>
                                        </div>
                                    )}

                                    {/* Tags */}
                                    {eventDetail.tags && (
                                        <div className="mb-6">
                                            <p className="text-xs font-medium tracking-wide mb-2"
                                                style={{ color: "#92140c", opacity: 0.8 }}>TAGS</p>
                                            <div className="flex flex-wrap gap-2">
                                                {eventDetail.tags.split(",").map((tag, idx) => (
                                                    <span key={idx} className="px-3 py-1 rounded-full text-xs"
                                                        style={{ background: "rgba(146, 20, 12, 0.08)", color: "#92140c", border: "1px solid rgba(146, 20, 12, 0.15)" }}>
                                                        {tag.trim()}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ── Description (HTML rendered) ── */}
                            <div>
                                <h2 className="text-xl font-medium mb-4"
                                    style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1e1e24", letterSpacing: "-0.01em" }}>
                                    About this event
                                </h2>

                                {eventDetail?.full_description ? (
                                    <div
                                        className="event-html-description text-base leading-relaxed"
                                        dangerouslySetInnerHTML={{ __html: eventDetail.full_description }}
                                    />
                                ) : (
                                    <p className="text-base leading-relaxed" style={{ color: "#1e1e24", opacity: 0.7 }}>
                                        {event.description || "No description available yet. Check back soon or visit the event website."}
                                    </p>
                                )}
                            </div>

                            {/* Speakers */}
                            {eventDetail?.speakers_json && (() => {
                                try {
                                    const speakers = JSON.parse(eventDetail.speakers_json);
                                    return speakers.length > 0 ? (
                                        <div className="mt-8">
                                            <h2 className="text-xl font-medium mb-3"
                                                style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1e1e24" }}>
                                                Speakers
                                            </h2>
                                            <div className="flex flex-wrap gap-2">
                                                {speakers.map((sp, idx) => (
                                                    <span key={idx} className="px-4 py-2 rounded-lg text-sm font-medium"
                                                        style={{ background: "#1e1e24", color: "#fff8f0" }}>{sp}</span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null;
                                } catch { return null; }
                            })()}

                            {/* Prerequisites */}
                            {eventDetail?.prerequisites && (
                                <div className="mt-8">
                                    <h2 className="text-xl font-medium mb-3"
                                        style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1e1e24" }}>
                                        Prerequisites
                                    </h2>
                                    <p className="text-sm leading-relaxed" style={{ color: "#1e1e24", opacity: 0.85 }}>
                                        {eventDetail.prerequisites}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Sidebar ── */}
                    <div className="lg:col-span-1">
                        <div className="rounded-2xl p-6 mb-6 sticky top-4"
                            style={{ background: "#fff", boxShadow: "0 10px 30px -15px rgba(30, 30, 36, 0.15)" }}>

                            {/* Save */}
                            <SaveButton eventId={id} initialSaved={isSaved} onToggle={setIsSaved} />

                            {/* Register / View on platform */}
                            <a href={officialWebsite} target="_blank" rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-300 mt-3"
                                style={{ background: "#92140c", color: "#fff8f0", border: "1px solid #92140c", letterSpacing: "0.02em" }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = "#1e1e24"; e.currentTarget.style.borderColor = "#1e1e24"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = "#92140c"; e.currentTarget.style.borderColor = "#92140c"; }}>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                </svg>
                                Register / View Event
                            </a>

                            {/* Visit Official Website (parent platform) */}
                            <a href={parentSiteURL} target="_blank" rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm mt-2 transition-all duration-300"
                                style={{ background: "transparent", border: "1px solid rgba(146, 20, 12, 0.2)", color: "#1e1e24", letterSpacing: "0.02em" }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#92140c"; e.currentTarget.style.color = "#92140c"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(146, 20, 12, 0.2)"; e.currentTarget.style.color = "#1e1e24"; }}>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                                </svg>
                                Visit {parentSiteLabel}
                            </a>

                            {/* Attendees */}
                            {eventDetail?.attendees_count > 0 && (
                                <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(146, 20, 12, 0.1)" }}>
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4" style={{ color: "#92140c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <span className="text-sm" style={{ color: "#1e1e24", opacity: 0.8 }}>
                                            {eventDetail.attendees_count} attending
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <RecommendedEvents eventId={id} />
                    </div>
                </div>
            </main>
        </div>
    );
}
