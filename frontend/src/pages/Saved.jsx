import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Header from "../components/Header";

const API_BASE_URL = "";

// ── SVG icons matching EventCard style ────────────────────────────────────
const IconCalendar = () => (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ flexShrink: 0 }}>
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const IconLocation = () => (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ flexShrink: 0 }}>
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

// ── Month abbreviations ───────────────────────────────────────────────────
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(dateStr) {
    if (!dateStr) return "Date TBA";

    // "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split("-").map(Number);
        const mon = MONTHS[m - 1];
        return `${mon} ${String(d).padStart(2, "0")}, ${y}`;
    }

    // ISO datetime
    if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) {
        const p = new Date(dateStr);
        if (!isNaN(p.getTime())) {
            return `${MONTHS[p.getUTCMonth()]} ${String(p.getUTCDate()).padStart(2, "0")}, ${p.getUTCFullYear()}`;
        }
    }

    // "Mon DD'YY" range — take start only
    const rangeMatch = dateStr.match(/^(.+?)\s+[-–]\s+.+$/);
    const startStr = rangeMatch ? rangeMatch[1].trim() : dateStr.trim();

    const apoMatch = startStr.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})'(\d{2,4})$/i);
    if (apoMatch) {
        let yr = +apoMatch[3];
        if (yr < 100) yr += 2000;
        const mi = MONTHS.findIndex(m => m.toLowerCase() === apoMatch[1].slice(0, 3).toLowerCase());
        if (mi !== -1) return `${MONTHS[mi]} ${String(+apoMatch[2]).padStart(2, "0")}, ${yr}`;
    }

    // "Mon DD" bare
    const bareMatch = startStr.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})$/i);
    if (bareMatch) {
        const mi = MONTHS.findIndex(m => m.toLowerCase() === bareMatch[1].slice(0, 3).toLowerCase());
        if (mi !== -1) return `${MONTHS[mi]} ${String(+bareMatch[2]).padStart(2, "0")}, ${new Date().getUTCFullYear()}`;
    }

    return dateStr;
}

export default function Saved() {
    const { isAuthed, token } = useAuth();
    const navigate = useNavigate();
    const [savedEvents, setSavedEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [removingId, setRemovingId] = useState(null);

    useEffect(() => {
        if (!isAuthed) { setLoading(false); return; }
        fetchSavedEvents();
    }, [isAuthed, token]);

    async function fetchSavedEvents() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/saved-events`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Failed to fetch saved events");
            const data = await res.json();
            setSavedEvents(data.saved_events || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleUnsave(eventId) {
        setRemovingId(eventId);
        try {
            const res = await fetch(`${API_BASE_URL}/api/events/${eventId}/save`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Failed to unsave");
            setSavedEvents((prev) => prev.filter((se) => se.event_id !== eventId));
        } catch (err) {
            setError(err.message);
        } finally {
            setRemovingId(null);
        }
    }

    return (
        <div style={{ minHeight: "100vh", background: "#fff8f0", fontFamily: "'Inter', sans-serif" }}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap" rel="stylesheet" />
            <Header />

            <main style={{ maxWidth: 1000, margin: "0 auto", padding: "100px 24px 60px" }}>
                {/* Title */}
                <div style={{ marginBottom: 40 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.2em", color: "#92140c", opacity: 0.8, marginBottom: 8, textTransform: "uppercase" }}>
                        BOOKMARKS
                    </p>
                    <h1 style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: "2.4rem", fontWeight: 500,
                        color: "#1e1e24", letterSpacing: "-0.02em", marginBottom: 8,
                    }}>
                        Saved Events
                    </h1>
                    <div style={{ width: 60, height: 1, background: "#92140c", opacity: 0.3, marginTop: 12 }} />
                </div>

                {/* Auth gate */}
                {!isAuthed ? (
                    <div style={{
                        textAlign: "center", padding: "80px 24px",
                        borderRadius: 20, border: "1px solid rgba(146,20,12,0.1)",
                    }}>
                        <svg style={{ width: 48, height: 48, color: "#92140c", opacity: 0.6, margin: "0 auto 20px" }}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        <p style={{ fontSize: 16, fontWeight: 500, color: "#1e1e24", marginBottom: 8 }}>
                            Sign in to save events
                        </p>
                        <p style={{ fontSize: 13, color: "#1e1e24", opacity: 0.5, marginBottom: 24 }}>
                            Create an account to bookmark events you're interested in
                        </p>
                        <Link to="/signin" style={{
                            display: "inline-flex", alignItems: "center", gap: 8,
                            padding: "10px 24px", borderRadius: 12,
                            background: "#92140c", color: "#fff8f0",
                            fontSize: 14, fontWeight: 500, textDecoration: "none", letterSpacing: "0.02em",
                        }}>
                            Sign in →
                        </Link>
                    </div>

                ) : loading ? (
                    <div style={{ textAlign: "center", padding: "80px 0" }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            border: "2px solid rgba(146,20,12,0.2)",
                            borderTopColor: "#92140c",
                            animation: "spin 0.8s linear infinite",
                            margin: "0 auto 16px",
                        }} />
                        <p style={{ fontSize: 14, color: "#1e1e24", opacity: 0.6 }}>Loading saved events...</p>
                        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                    </div>

                ) : error ? (
                    <div style={{
                        textAlign: "center", padding: "60px 24px",
                        borderRadius: 20, border: "1px solid rgba(146,20,12,0.1)",
                    }}>
                        <p style={{ fontSize: 15, color: "#92140c", marginBottom: 12 }}>
                            Unable to load saved events
                        </p>
                        <button onClick={fetchSavedEvents} style={{
                            padding: "8px 20px", borderRadius: 10,
                            background: "#92140c", color: "#fff8f0",
                            fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer",
                        }}>
                            Try Again
                        </button>
                    </div>

                ) : savedEvents.length === 0 ? (
                    <div style={{
                        textAlign: "center", padding: "80px 24px",
                        borderRadius: 20, border: "1px solid rgba(146,20,12,0.1)",
                    }}>
                        <svg style={{ width: 48, height: 48, color: "#1e1e24", opacity: 0.3, margin: "0 auto 20px" }}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        <p style={{ fontSize: 16, fontWeight: 500, color: "#1e1e24", marginBottom: 8 }}>
                            No saved events yet
                        </p>
                        <p style={{ fontSize: 13, color: "#1e1e24", opacity: 0.5, marginBottom: 24 }}>
                            Browse events and click the bookmark icon to save them here
                        </p>
                        <Link to="/events" style={{
                            display: "inline-flex", alignItems: "center", gap: 8,
                            padding: "10px 24px", borderRadius: 12,
                            background: "#1e1e24", color: "#fff8f0",
                            fontSize: 14, fontWeight: 500, textDecoration: "none", letterSpacing: "0.02em",
                        }}>
                            Browse Events →
                        </Link>
                    </div>

                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <p style={{ fontSize: 13, color: "#1e1e24", opacity: 0.45, marginBottom: 4, letterSpacing: "0.02em" }}>
                            {savedEvents.length} saved event{savedEvents.length !== 1 ? "s" : ""}
                        </p>

                        {savedEvents.map((se) => {
                            const event = se.event;
                            const isRemoving = removingId === se.event_id;

                            return (
                                <div
                                    key={se.id}
                                    onClick={() => navigate(`/events/${event?.id}`)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 18,
                                        padding: "18px 20px",
                                        borderRadius: 16,
                                        background: "#fff8f0",
                                        border: "1px solid rgba(146,20,12,0.1)",
                                        boxShadow: "0 4px 20px -10px rgba(30,30,36,0.1)",
                                        cursor: "pointer",
                                        transition: "all 0.3s ease",
                                        opacity: isRemoving ? 0.5 : 1,
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.boxShadow = "0 10px 30px -10px rgba(146,20,12,0.2)";
                                        e.currentTarget.style.borderColor = "rgba(146,20,12,0.3)";
                                        e.currentTarget.style.transform = "translateY(-1px)";
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.boxShadow = "0 4px 20px -10px rgba(30,30,36,0.1)";
                                        e.currentTarget.style.borderColor = "rgba(146,20,12,0.1)";
                                        e.currentTarget.style.transform = "translateY(0)";
                                    }}
                                >
                                    {/* Accent strip */}
                                    <div style={{
                                        width: 4, alignSelf: "stretch", minHeight: 52,
                                        borderRadius: 2, background: "#92140c",
                                        opacity: 0.7, flexShrink: 0,
                                    }} />

                                    {/* Event info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {/* Date row — SVG calendar icon matching EventCard */}
                                        <div style={{
                                            display: "flex", alignItems: "center", gap: 5,
                                            marginBottom: 5, color: "#92140c",
                                        }}>
                                            <IconCalendar />
                                            <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.02em" }}>
                                                {formatDate(event?.date || event?.date_time)}
                                            </span>
                                        </div>

                                        {/* Title */}
                                        <h3 style={{
                                            fontFamily: "'Cormorant Garamond', serif",
                                            fontSize: "1.05rem", fontWeight: 500,
                                            color: "#1e1e24", letterSpacing: "-0.01em",
                                            marginBottom: 5,
                                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                        }}>
                                            {event?.event_name}
                                        </h3>

                                        {/* Location row — SVG pin icon matching EventCard */}
                                        <div style={{
                                            display: "flex", alignItems: "center", gap: 5,
                                            color: "#1e1e24",
                                        }}>
                                            <IconLocation />
                                            <span style={{
                                                fontSize: 12, opacity: 0.55,
                                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                letterSpacing: "0.02em",
                                            }}>
                                                {event?.location || "Location TBA"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Unsave button — filled bookmark → outline on hover */}
                                    <button
                                        onClick={e => { e.stopPropagation(); handleUnsave(se.event_id); }}
                                        disabled={isRemoving}
                                        title="Remove from saved"
                                        style={{
                                            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                                            border: "1px solid rgba(146,20,12,0.2)",
                                            background: "transparent",
                                            cursor: isRemoving ? "not-allowed" : "pointer",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            color: "#92140c", transition: "all 0.2s",
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.background = "rgba(146,20,12,0.08)";
                                            e.currentTarget.style.borderColor = "#92140c";
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.background = "transparent";
                                            e.currentTarget.style.borderColor = "rgba(146,20,12,0.2)";
                                        }}
                                    >
                                        {/* Filled bookmark = saved; shows outline on hover via CSS would need extra state,
                                            keeping filled bookmark as the "remove" affordance */}
                                        <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                        </svg>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
