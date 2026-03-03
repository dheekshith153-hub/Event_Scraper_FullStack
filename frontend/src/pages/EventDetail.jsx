import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import RecommendedEvents from "../components/RecommendedEvents";
import SaveButton from "../components/SaveButton";
import { formatEventDate } from "../utils/dateUtils";
import {
    getEventImage, getEventImageFallback,
    formatEventName,
    PLATFORM_POOL,
} from "../components/EventCard";

const API_BASE_URL = "";

const SOURCE_LABELS = {
    allevents: "AllEvents", hasgeek: "HasGeek", meetup: "Meetup",
    townscript: "Townscript", biec: "BIEC", echai: "Echai", hitex: "Hitex",
};

const SOURCE_URLS = {
    allevents: "https://allevents.in", hasgeek: "https://hasgeek.com",
    meetup: "https://meetup.com", townscript: "https://townscript.com",
    biec: "https://www.biecexpo.com", echai: "https://echai.ventures",
    hitex: "https://hitex.co.in",
};

// ── HTML → plain text ─────────────────────────────────────────────────────────
function isHTML(str) { return /<[a-z][\s\S]*>/i.test(str || ""); }

function htmlToPlainText(html) {
    if (!html) return "";
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n").replace(/<\/li>/gi, "\n")
        .replace(/<\/div>/gi, "\n").replace(/<\/h[1-6]>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&#\d+;/g, "").replace(/&\w+;/g, " ")
        .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
        .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n")
        .split("\n").map(l => l.trim()).filter(l => l !== "").join("\n").trim();
}

// ── Patterns: lines to drop entirely ─────────────────────────────────────────
const DROP_LINE = [
    // Bare URLs
    /^https?:\/\/\S+$/i,
    // Social / messaging links
    /slack\.com\/|whatsapp\.com\/|t\.me\/|discord\.gg\//i,
    /wa\.me\/|chat\.whatsapp|telegram\.me/i,
    // CTA / spam lines
    /^(also check out|stay in the loop|join the community|join us|follow us)/i,
    /^(subscribe|sign up|register|get (your )?(tickets?|passes?))/i,
    /^(buy tickets?|book (now|here)|click here|read more|learn more)/i,
    /^(copyright|all rights reserved|powered by)/i,
    /^(home|about|contact|terms|privacy|×|close|menu|login|sign ?in|sign ?up)$/i,
    // Standalone dates or city names
    /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/i,
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s+\d{4}/i,
    /^\d{4}-\d{2}-\d{2}(T.*)?$/,
    /^(bengaluru|bangalore|hyderabad|mumbai|delhi|chennai|kolkata|pune|online|virtual)$/i,

    // ── Phone numbers ─────────────────────────────────────────────────────────
    // Indian 10-digit (with or without +91 / 0)
    /(?:\+91[\s\-]?|^0)?[6-9]\d{9}/,
    // Generic international format (brackets, spaces, dashes)
    /\+?\d[\d\s\-\(\)]{8,14}\d/,
    // Lines that are primarily a phone number
    /^\s*(?:\+?\d[\d\s\-\(\).]{7,})\s*$/,

    // ── Physical addresses ────────────────────────────────────────────────────
    // Door / Flat / Plot / House / Shop number
    /\b(?:no\.?|flat|door\s+no\.?|plot\s+no\.?|house\s+no\.?|shop\s+no\.?|h\.?\s*no\.?)\s*\d+/i,
    // Street-level: "12, MG Road", "4th Cross", "Sector 5"
    /\d+\s*[,\-]?\s*(?:[a-z]+\s+)*(?:road|street|st\.|lane|avenue|colony|nagar|sector\s*\d|phase\s*\d|cross|main|circle|layout|enclave|extension)\b/i,
    // Indian PIN codes (6-digit, optionally prefixed)
    /\b(?:pin\s*:?\s*)?\d{6}\b/i,
    // Full address lines (contains comma-separated location parts)
    /\d+[,\s]+[a-z\s]+(?:road|street|colony|nagar|layout|bangalore|hyderabad|mumbai|delhi|chennai|pune|india)\b/i,

    // ── Email addresses ───────────────────────────────────────────────────────
    /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i,

    // ── Contact CTA lines ─────────────────────────────────────────────────────
    /(?:contact|reach|call|email|write)\s+(?:us|me)\s+(?:at|on|via)/i,
    /for\s+(more\s+)?(?:details?|info(?:rmation)?|queries|enquir(?:y|ies))\s*[,:]?\s*(?:contact|call|email|whatsapp)/i,

    // Too short to be meaningful prose
    /^.{1,15}$/,
];

const SECTION_BREAKS = [
    /^(agenda|schedule|you'?ll learn|call for|speakers?:|organis(er|ers?):)\b/i,
    /^(slack|whatsapp|telegram|discord)\b.*:/i,
];

// ── Inline token stripper (for partial matches mid-sentence) ─────────────────
function stripInlineNoise(line) {
    return line
        // Strip email addresses
        .replace(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi, "")
        // Strip bare URLs
        .replace(/https?:\/\/\S+/gi, "")
        .replace(/www\.\S+/gi, "")
        // Strip Indian phone numbers (+91 / 10-digit mobile)
        .replace(/(?:\+91[\s\-]?)?[6-9]\d{9}/g, "")
        // Strip generic phone formats (e.g. +1-800-555-0100)
        .replace(/\+?\d[\d\s\-\(\)]{8,14}\d/g, "")
        // Strip Indian PIN codes
        .replace(/\b\d{6}\b/g, "")
        // Clean up orphaned punctuation after stripping
        .replace(/[,\-–|]+\s*[,\-–|]+/g, ",")
        .replace(/\s+[,\-–|]\s*$/g, "")
        .replace(/^\s*[,\-–|]+\s*/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}

// ── Sentence grammar fixer ────────────────────────────────────────────────────
function fixGrammar(line) {
    if (!line) return "";
    // Capitalise first character
    let s = line.charAt(0).toUpperCase() + line.slice(1);
    // Add full stop if no terminal punctuation
    if (!/[.!?]$/.test(s)) s += ".";
    return s;
}

// ── Main cleaner ─────────────────────────────────────────────────────────────
function cleanDescription(text) {
    if (!text) return "";

    const lines = text.split("\n").filter(line => {
        const t = line.trim();
        if (!t) return false;
        // Drop if any DROP_LINE pattern matches
        if (DROP_LINE.some(p => p.test(t))) return false;
        return true;
    });

    const collected = [];
    for (const line of lines) {
        if (collected.length > 0 && SECTION_BREAKS.some(p => p.test(line.trim()))) break;

        // Strip any inline noise that didn't trigger a full-line drop
        const cleaned = stripInlineNoise(line.trim());
        // Skip if stripping left the line too short or empty
        if (!cleaned || cleaned.length < 16 || cleaned.split(" ").length < 4) continue;

        collected.push(fixGrammar(cleaned));
        if (collected.length >= 10) break;
    }

    return collected.join("\n").trim();
}

// ─────────────────────────────────────────────────────────────────────────────

export default function EventDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [event, setEvent] = useState(null);
    const [eventDetail, setEventDetail] = useState(null);
    const [isSaved, setIsSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [heroImgErr, setHeroImgErr] = useState(false);

    useEffect(() => {
        setLoading(true); setError(null); setHeroImgErr(false);
        (async () => {
            try {
                const token = localStorage.getItem("event_token");
                const headers = { "Content-Type": "application/json" };
                if (token) headers["Authorization"] = `Bearer ${token}`;
                const res = await fetch(`${API_BASE_URL}/api/events/${id}`, { headers });
                if (!res.ok) throw new Error(`Failed to fetch event (${res.status})`);
                const data = await res.json();
                setEvent(data.event);
                setEventDetail(data.event_detail);
                setIsSaved(data.is_saved || false);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    if (loading) return (
        <div className="min-h-screen" style={{ background: "#fff8f0" }}>
            <Header />
            <div className="flex justify-center items-center py-24">
                <div className="w-8 h-8 border rounded-full animate-spin"
                    style={{ borderColor: "rgba(146,20,12,0.2)", borderTopColor: "#92140c" }} />
            </div>
        </div>
    );

    if (error || !event) return (
        <div className="min-h-screen" style={{ background: "#fff8f0" }}>
            <Header />
            <div className="max-w-4xl mx-auto px-4 py-12 text-center">
                <div className="text-5xl mb-4" style={{ color: "#92140c", opacity: 0.5 }}>⚠️</div>
                <p className="text-lg font-medium mb-4" style={{ color: "#1e1e24" }}>Event not found</p>
                <button onClick={() => navigate(-1)}
                    className="px-5 py-2 rounded-full text-sm font-medium"
                    style={{ background: "#1e1e24", color: "#fff8f0", border: "1px solid #92140c" }}>
                    Go Back
                </button>
            </div>
        </div>
    );

    const officialWebsite = eventDetail?.external_url || eventDetail?.registration_url || event.website;
    const parentSiteURL = SOURCE_URLS[event.platform] || officialWebsite;
    const parentSiteLabel = SOURCE_LABELS[event.platform] || event.platform;

    const heroSrc = heroImgErr ? getEventImageFallback(event) : getEventImage(event);
    const displayName = formatEventName(event.event_name);
    const displayDate = formatEventDate(event.date || event.date_time);

    const cityNorm = event.city_normalized;
    const displayCity = cityNorm && cityNorm !== "Unknown" && cityNorm.trim() !== ""
        ? cityNorm : null;

    const rawDesc = eventDetail?.full_description || event.description || "";
    const stripped = isHTML(rawDesc) ? htmlToPlainText(rawDesc) : rawDesc.trim();
    const plainDesc = cleanDescription(stripped);

    return (
        <div className="min-h-screen" style={{ background: "#fff8f0", fontFamily: "'Inter', sans-serif" }}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap" rel="stylesheet" />
            <Header />

            {/* ══ HERO ══ */}
            <div style={{ position: "relative", height: 420, overflow: "hidden" }}>
                <img src={heroSrc} alt={displayName}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    onError={() => setHeroImgErr(true)}
                />
                <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to bottom, rgba(10,10,14,0.18) 0%, rgba(10,10,14,0.82) 100%)",
                }} />

                <button onClick={() => navigate(-1)} style={{
                    position: "absolute", top: 18, left: 20,
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", borderRadius: 20,
                    background: "rgba(0,0,0,0.38)", backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>

                <div style={{
                    position: "absolute", bottom: 36, left: 0, right: 0,
                    maxWidth: 900, margin: "0 auto", padding: "0 28px",
                }}>
                    <span style={{
                        display: "inline-block", padding: "3px 10px", borderRadius: 20,
                        background: "rgba(146,20,12,0.85)", color: "#fff",
                        fontSize: 10, fontWeight: 600, letterSpacing: "0.07em", marginBottom: 12,
                    }}>
                        {SOURCE_LABELS[event.platform] || event.platform}
                    </span>

                    <h1 style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: "clamp(1.8rem, 4.5vw, 3rem)",
                        fontWeight: 600, color: "#fff",
                        lineHeight: 1.2, letterSpacing: "-0.02em",
                        marginBottom: 14, textShadow: "0 2px 16px rgba(0,0,0,0.5)",
                    }}>
                        {displayName}
                    </h1>

                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.85)">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span style={{ color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: 500 }}>
                                {displayDate}
                            </span>
                        </div>
                        {displayCity && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.85)">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span style={{ color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: 500 }}>
                                    {displayCity}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* ── Main content ── */}
                    <div className="lg:col-span-2">
                        <div className="rounded-2xl p-8"
                            style={{ background: "#fff", boxShadow: "0 10px 30px -15px rgba(30,30,36,0.15)" }}>

                            {eventDetail?.organizer && (
                                <div className="mb-5">
                                    <p className="text-sm font-medium" style={{ color: "#1e1e24" }}>
                                        {eventDetail.organizer}
                                    </p>
                                </div>
                            )}

                            {eventDetail?.tags && (
                                <div className="mb-5">
                                    <p className="text-xs font-medium tracking-wide mb-2"
                                        style={{ color: "#92140c", opacity: 0.7 }}>TAGS</p>
                                    <div className="flex flex-wrap gap-2">
                                        {eventDetail.tags.split(",").map((tag, idx) => (
                                            <span key={idx} className="px-3 py-1 rounded-full text-xs"
                                                style={{
                                                    background: "rgba(146,20,12,0.07)",
                                                    color: "#92140c",
                                                    border: "1px solid rgba(146,20,12,0.15)",
                                                }}>
                                                {tag.trim()}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(eventDetail?.organizer || eventDetail?.tags) && (
                                <div style={{ height: 1, background: "rgba(146,20,12,0.08)", margin: "1.2rem 0" }} />
                            )}

                            <h2 className="text-xl font-medium mb-4"
                                style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1e1e24", letterSpacing: "-0.01em" }}>
                                About this event
                            </h2>

                            {plainDesc ? (
                                <div>
                                    {plainDesc.split("\n").filter(l => l.trim()).map((para, i) => (
                                        <p key={i} style={{
                                            color: "#1e1e24", opacity: 0.85,
                                            lineHeight: 1.85, fontSize: "0.95rem",
                                            marginBottom: "0.9em",
                                        }}>
                                            {para}
                                        </p>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ color: "#1e1e24", opacity: 0.5, lineHeight: 1.8, fontSize: "0.95rem" }}>
                                    No description available. Visit the event website for full details.
                                </p>
                            )}

                            {eventDetail?.speakers_json && (() => {
                                try {
                                    const sp = JSON.parse(eventDetail.speakers_json);
                                    if (!sp.length) return null;
                                    return (
                                        <div className="mt-7">
                                            <div style={{ height: 1, background: "rgba(146,20,12,0.08)", marginBottom: "1.4rem" }} />
                                            <h2 className="text-xl font-medium mb-3"
                                                style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1e1e24" }}>
                                                Speakers
                                            </h2>
                                            <div className="flex flex-wrap gap-2">
                                                {sp.map((s, i) => (
                                                    <span key={i} className="px-4 py-2 rounded-lg text-sm font-medium"
                                                        style={{ background: "#1e1e24", color: "#fff8f0" }}>
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                } catch { return null; }
                            })()}

                            {eventDetail?.prerequisites && (
                                <div className="mt-7">
                                    <div style={{ height: 1, background: "rgba(146,20,12,0.08)", marginBottom: "1.4rem" }} />
                                    <h2 className="text-xl font-medium mb-3"
                                        style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1e1e24" }}>
                                        Prerequisites
                                    </h2>
                                    <p className="text-sm leading-relaxed" style={{ color: "#1e1e24", opacity: 0.82 }}>
                                        {eventDetail.prerequisites}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Sidebar ── */}
                    <div className="lg:col-span-1">
                        <div className="rounded-2xl p-6 sticky top-4"
                            style={{ background: "#fff", boxShadow: "0 10px 30px -15px rgba(30,30,36,0.15)" }}>

                            <SaveButton eventId={id} initialSaved={isSaved} onToggle={setIsSaved} />

                            <a href={officialWebsite} target="_blank" rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium mt-3"
                                style={{ background: "#92140c", color: "#fff8f0", border: "1px solid #92140c", letterSpacing: "0.02em" }}
                                onMouseEnter={e => { e.currentTarget.style.background = "#1e1e24"; e.currentTarget.style.borderColor = "#1e1e24"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "#92140c"; e.currentTarget.style.borderColor = "#92140c"; }}>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                </svg>
                                Register / View Event
                            </a>

                            <a href={parentSiteURL} target="_blank" rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm mt-2"
                                style={{ background: "transparent", border: "1px solid rgba(146,20,12,0.2)", color: "#1e1e24", letterSpacing: "0.02em" }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = "#92140c"; e.currentTarget.style.color = "#92140c"; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(146,20,12,0.2)"; e.currentTarget.style.color = "#1e1e24"; }}>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                        d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                                </svg>
                                Visit {parentSiteLabel}
                            </a>
                        </div>
                    </div>
                </div>

                <RecommendedEvents eventId={id} limit={4} />
            </main>
        </div>
    );
}
