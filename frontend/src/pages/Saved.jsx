import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Header from "../components/Header";

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
        return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
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
        if (!isAuthed) {
            setLoading(false);
            return;
        }
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
        <div style={{ minHeight: "100vh", background: "#fff8f0" }}>
            <Header />
            <main style={{ maxWidth: 1000, margin: "0 auto", padding: "100px 24px 60px" }}>
                {/* Title */}
                <div style={{ marginBottom: 40 }}>
                    <h1
                        style={{
                            fontFamily: "'Cormorant Garamond', serif",
                            fontSize: "2.4rem",
                            fontWeight: 500,
                            color: "#1e1e24",
                            letterSpacing: "-0.02em",
                            marginBottom: 8,
                        }}
                    >
                        Saved Events
                    </h1>
                    <p style={{ fontSize: 14, color: "#1e1e24", opacity: 0.6, letterSpacing: "0.02em" }}>
                        Events you've bookmarked for later
                    </p>
                </div>

                {/* Auth gate */}
                {!isAuthed ? (
                    <div
                        className="animate-fade-in"
                        style={{
                            textAlign: "center",
                            padding: "80px 24px",
                            borderRadius: 20,
                            border: "1px solid rgba(146, 20, 12, 0.1)",
                        }}
                    >
                        <svg
                            style={{ width: 48, height: 48, color: "#92140c", opacity: 0.6, margin: "0 auto 20px" }}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                            />
                        </svg>
                        <p style={{ fontSize: 16, fontWeight: 500, color: "#1e1e24", marginBottom: 8 }}>
                            Sign in to save events
                        </p>
                        <p style={{ fontSize: 13, color: "#1e1e24", opacity: 0.5, marginBottom: 24 }}>
                            Create an account to bookmark events you're interested in
                        </p>
                        <Link
                            to="/signin"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "10px 24px",
                                borderRadius: 12,
                                background: "#92140c",
                                color: "#fff8f0",
                                fontSize: 14,
                                fontWeight: 500,
                                textDecoration: "none",
                                letterSpacing: "0.02em",
                            }}
                        >
                            Sign in →
                        </Link>
                    </div>
                ) : loading ? (
                    /* Loading state */
                    <div style={{ textAlign: "center", padding: "80px 0" }}>
                        <div
                            className="animate-pulse-subtle"
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: "50%",
                                background: "rgba(146, 20, 12, 0.1)",
                                margin: "0 auto 16px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <div
                                style={{
                                    width: 24,
                                    height: 24,
                                    border: "2px solid rgba(146, 20, 12, 0.3)",
                                    borderTopColor: "#92140c",
                                    borderRadius: "50%",
                                    animation: "spin 0.8s linear infinite",
                                }}
                            />
                        </div>
                        <p style={{ fontSize: 14, color: "#1e1e24", opacity: 0.6 }}>Loading saved events...</p>
                        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                    </div>
                ) : error ? (
                    /* Error state */
                    <div
                        className="animate-fade-in"
                        style={{
                            textAlign: "center",
                            padding: "60px 24px",
                            borderRadius: 20,
                            border: "1px solid rgba(146, 20, 12, 0.1)",
                        }}
                    >
                        <p style={{ fontSize: 15, color: "#92140c", marginBottom: 12 }}>⚠️ {error}</p>
                        <button
                            onClick={fetchSavedEvents}
                            style={{
                                padding: "8px 20px",
                                borderRadius: 10,
                                background: "#92140c",
                                color: "#fff8f0",
                                fontSize: 13,
                                fontWeight: 500,
                                border: "none",
                                cursor: "pointer",
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                ) : savedEvents.length === 0 ? (
                    /* Empty state */
                    <div
                        className="animate-fade-in"
                        style={{
                            textAlign: "center",
                            padding: "80px 24px",
                            borderRadius: 20,
                            border: "1px solid rgba(146, 20, 12, 0.1)",
                        }}
                    >
                        <svg
                            style={{ width: 48, height: 48, color: "#1e1e24", opacity: 0.3, margin: "0 auto 20px" }}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                            />
                        </svg>
                        <p style={{ fontSize: 16, fontWeight: 500, color: "#1e1e24", marginBottom: 8 }}>
                            No saved events yet
                        </p>
                        <p style={{ fontSize: 13, color: "#1e1e24", opacity: 0.5, marginBottom: 24 }}>
                            Browse events and click the bookmark icon to save them here
                        </p>
                        <Link
                            to="/events"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "10px 24px",
                                borderRadius: 12,
                                background: "#1e1e24",
                                color: "#fff8f0",
                                fontSize: 14,
                                fontWeight: 500,
                                textDecoration: "none",
                                letterSpacing: "0.02em",
                            }}
                        >
                            Browse Events →
                        </Link>
                    </div>
                ) : (
                    /* Saved events list */
                    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <p style={{ fontSize: 13, color: "#1e1e24", opacity: 0.5, marginBottom: 8 }}>
                            {savedEvents.length} saved event{savedEvents.length !== 1 ? "s" : ""}
                        </p>

                        {savedEvents.map((se) => {
                            const event = se.event;
                            const platformLabel = SOURCE_LABELS[event?.platform] || event?.platform || "Event";
                            return (
                                <div
                                    key={se.id}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 20,
                                        padding: 20,
                                        borderRadius: 16,
                                        background: "#fff8f0",
                                        border: "1px solid rgba(146, 20, 12, 0.1)",
                                        boxShadow: "0 4px 20px -10px rgba(30, 30, 36, 0.1)",
                                        cursor: "pointer",
                                        transition: "all 0.3s ease",
                                    }}
                                    onClick={() => navigate(`/events/${event?.id}`)}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.boxShadow =
                                            "0 10px 30px -10px rgba(146, 20, 12, 0.2)";
                                        e.currentTarget.style.borderColor = "rgba(146, 20, 12, 0.3)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.boxShadow =
                                            "0 4px 20px -10px rgba(30, 30, 36, 0.1)";
                                        e.currentTarget.style.borderColor = "rgba(146, 20, 12, 0.1)";
                                    }}
                                >
                                    {/* Color strip */}
                                    <div
                                        style={{
                                            width: 6,
                                            height: 60,
                                            borderRadius: 3,
                                            background: "#92140c",
                                            flexShrink: 0,
                                        }}
                                    />

                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    fontWeight: 600,
                                                    color: "#92140c",
                                                    padding: "2px 8px",
                                                    borderRadius: 20,
                                                    background: "rgba(146, 20, 12, 0.08)",
                                                    letterSpacing: "0.04em",
                                                    textTransform: "uppercase",
                                                }}
                                            >
                                                {platformLabel}
                                            </span>
                                            <span style={{ fontSize: 12, color: "#1e1e24", opacity: 0.5 }}>
                                                {formatDate(event?.date || event?.date_time)}
                                            </span>
                                        </div>
                                        <h3
                                            style={{
                                                fontFamily: "'Cormorant Garamond', serif",
                                                fontSize: "1.1rem",
                                                fontWeight: 500,
                                                color: "#1e1e24",
                                                marginBottom: 4,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {event?.event_name}
                                        </h3>
                                        <p
                                            style={{
                                                fontSize: 12,
                                                color: "#1e1e24",
                                                opacity: 0.5,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 4,
                                            }}
                                        >
                                            📍 {event?.location || "Location TBA"}
                                        </p>
                                    </div>

                                    {/* Unsave button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleUnsave(se.event_id);
                                        }}
                                        disabled={removingId === se.event_id}
                                        style={{
                                            width: 38,
                                            height: 38,
                                            borderRadius: 10,
                                            border: "1px solid rgba(146, 20, 12, 0.2)",
                                            background: removingId === se.event_id ? "rgba(146, 20, 12, 0.05)" : "transparent",
                                            cursor: removingId === se.event_id ? "not-allowed" : "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                            transition: "all 0.2s ease",
                                            color: "#92140c",
                                        }}
                                        title="Remove from saved"
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = "rgba(146, 20, 12, 0.1)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = "transparent";
                                        }}
                                    >
                                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
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
