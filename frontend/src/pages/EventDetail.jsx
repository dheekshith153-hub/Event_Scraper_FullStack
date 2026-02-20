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

const SOURCE_URLS = {
    allevents: "https://allevents.in",
    hasgeek: "https://hasgeek.com",
    meetup: "https://meetup.com",
    townscript: "https://townscript.com",
    biec: "https://www.biecexpo.com",
    echai: "https://echai.ventures",
    hitex: "https://hitex.co.in",
};

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

function htmlToPlainText(html) {
    if (!html) return "";
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/h[1-6]>/gi, "\n")
        .replace(/<\/tr>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .split("\n").map(l => l.trim())
        .filter((l, i, a) => l !== "" || a[i - 1] !== "")
        .join("\n").trim();
}

function isHTML(str) { return /<[a-z][\s\S]*>/i.test(str || ""); }

// ── Aggressive description cleaner ───────────────────────────────
// Handles AllEvents, Meetup, HasGeek, Townscript and others.
// Strips: URLs, social invite links, bullet symbols, pricing/fee lines,
// agenda labels, CTAs, sponsor lines, name/location duplicates.
// Hard caps output at 7 lines → grouped into 2 clean paragraphs.
function cleanDescription(text, eventName = "", location = "") {
    if (!text) return "";

    // Step 1: Strip leading bullet/diamond symbols, keep the text after them
    // Handles ◆ ❖ • ➤ → ▸ ✦ ★ ✓ ✔ ✗ - – — *
    text = text.split("\n").map(line =>
        line.replace(/^[\s◆❖•➤→▸✦★✓✔✗✘►▶\-–—*]+/, "").trim()
    ).join("\n");

    // Step 2: Patterns that cause an entire line to be dropped
    const dropLine = [
        // Bare URLs
        /^https?:\/\/\S+$/i,
        // Any line containing a social/community invite link
        /slack\.com\/|whatsapp\.com\/|t\.me\/|discord\.gg\//i,
        // Lines with long embedded URLs
        /https?:\/\/\S{20,}/i,

        // Filler CTAs / noise phrases
        /^also check out/i,
        /^stay in the loop/i,
        /^are you interested/i,
        /^join the community/i,
        /^join us (on|at|for)/i,
        /^follow us/i,
        /^subscribe/i,
        /^sign up/i,
        /^register (now|here|today)/i,
        /^get (your )?(tickets?|passes?)/i,
        /^buy tickets?/i,
        /^book (now|here|your)/i,
        /^click here/i,
        /^read more/i,
        /^learn more/i,
        /^find out more/i,
        /^view (all|more)/i,
        /^load more/i,
        /^share (this|event)/i,
        /^newsletter/i,
        /^copyright/i,
        /^all rights reserved/i,
        /^powered by/i,
        /^in association with/i,
        /^more coming soon/i,

        // CFP / conference submission noise
        /^call for (proposals?|speakers?|submissions?)/i,
        /^submit your/i,
        /^cfp/i,
        /^we('re| are) opening/i,
        /^suggested themes?:/i,

        // Agenda structural labels (the label itself, not the content)
        /^agenda:?\s*$/i,
        /^schedule:?\s*$/i,
        /^(welcome \+|q&a|networking)\s*$/i,

        // Nav / UI chrome
        /^(home|about|contact|terms|privacy|cookie|×|close|menu|search|login|sign ?in|sign ?up|back|next|previous)$/i,

        // Date-only lines
        /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+/i,
        /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/i,
        /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s+\d{4}/i,
        /^\d{4}-\d{2}-\d{2}(T.*)?$/,

        // Address / city-only lines
        /^[^.]{20,},.*\d{6}/,
        /^[^.]{20,},.*india$/i,
        /^(bengaluru|bangalore|hyderabad|mumbai|delhi|chennai|kolkata|pune|online|virtual)$/i,

        // Fee / pricing lines (often outdated promotional noise)
        /^₹[\d,]+/,
        /^(registration fees?|early bird|fees? will)/i,
        /^from \d+(st|nd|rd|th)? (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
        /^(till|until) \d+(st|nd|rd|th)?/i,
        /^and all this in /i,

        // Numbered sponsor/partner lines
        /^\d+\.\s*(https?:\/\/|guard|more coming)/i,

        // Very short lines (under 20 chars) — almost always noise fragments
        /^.{1,19}$/,
    ];

    // Step 3: Name + location duplicate detection
    const nameWords = new Set(
        eventName.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 3)
    );
    const isNameLine = (line) => {
        if (nameWords.size === 0) return false;
        const lw = line.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 3);
        if (!lw.length) return false;
        return lw.filter(w => nameWords.has(w)).length / Math.max(lw.length, nameWords.size) > 0.6;
    };

    const locWords = location.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 3);
    const isLocationLine = (line) => {
        if (!locWords.length) return false;
        const lw = line.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
        return lw.filter(w => locWords.includes(w)).length >= 2 && line.length < 130;
    };

    // Step 4: Filter lines
    const filtered = text.split("\n").filter(line => {
        const t = line.trim();
        if (!t) return false;
        if (dropLine.some(p => p.test(t))) return false;
        if (isNameLine(t)) return false;
        if (isLocationLine(t)) return false;
        return true;
    });

    // Step 5: Stop at structural section breaks that signal non-description content
    // (agenda items, community links, CFP, sponsor blocks)
    const sectionBreaks = [
        /^(agenda|schedule|you'?ll learn|what you'?ll learn|join the community|call for proposals?|in association with|speakers?:|organis(er|ers?):)\b/i,
        /^(slack|whatsapp|telegram|discord)\b.*:/i,
        /^(1\.|2\.|3\.)\s+https?/i,
    ];

    const capped = [];
    for (const line of filtered) {
        if (capped.length > 0 && sectionBreaks.some(p => p.test(line.trim()))) break;
        capped.push(line.trim());
        if (capped.length >= 7) break; // hard cap: max 7 lines
    }

    if (!capped.length) return "";

    // Step 6: Group into 2 clean paragraphs
    const splitAt = Math.ceil(capped.length / 2);
    const para1 = capped.slice(0, splitAt).join(" ").trim();
    const para2 = capped.slice(splitAt).join(" ").trim();

    return [para1, para2].filter(Boolean).join("\n");
}

function buildHeroSVG(eventName = "", eventId = 0) {
    let hash = (eventId * 2654435761) >>> 0;
    for (let i = 0; i < eventName.length; i++)
        hash = (((hash << 5) - hash + eventName.charCodeAt(i)) | 0) >>> 0;
    const h = hash % 360;
    const h2 = (h + 40) % 360;
    const c1 = `hsl(${h},55%,25%)`;
    const c2 = `hsl(${h2},60%,15%)`;
    const ac = `hsl(${h},70%,70%)`;
    const words = eventName.trim().split(/\s+/).filter(Boolean);
    const ab = words.length >= 2
        ? words[0][0].toUpperCase() + words[1][0].toUpperCase()
        : (eventName.slice(0, 2).toUpperCase() || "EV");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="420" viewBox="0 0 900 420">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <filter id="bl"><feGaussianBlur stdDeviation="30"/></filter>
  </defs>
  <rect width="900" height="420" fill="url(#g)"/>
  <circle cx="750" cy="80"  r="220" fill="${ac}" opacity="0.1"  filter="url(#bl)"/>
  <circle cx="100" cy="360" r="180" fill="${ac}" opacity="0.08" filter="url(#bl)"/>
  <text x="450" y="290" text-anchor="middle" font-family="Georgia,serif"
        font-size="220" font-weight="700" fill="white" opacity="0.06">${ab}</text>
  <text x="450" y="270" text-anchor="middle" font-family="Georgia,serif"
        font-size="90"  font-weight="600" fill="white" opacity="0.45">${ab}</text>
</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

function extractVenue(location) {
    if (!location) return null;
    return location.split(",")[0].trim();
}

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
                const token = localStorage.getItem("token");
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
    const realHeroImg = eventDetail?.image_url || null;
    const heroSrc = (realHeroImg && !heroImgErr) ? realHeroImg : buildHeroSVG(event.event_name, event.id);
    const rawDesc = eventDetail?.full_description || event.description || "";
    const stripped = isHTML(rawDesc) ? htmlToPlainText(rawDesc) : rawDesc.trim();
    const plainDesc = cleanDescription(stripped, event.event_name, event.location);
    const venue = extractVenue(event.location);
    const cardDate = formatDateCard(event.date || event.date_time);

    return (
        <div className="min-h-screen" style={{ background: "#fff8f0", fontFamily: "'Inter', sans-serif" }}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap" rel="stylesheet" />

            <Header />

            {/* ══════════════ HERO ══════════════ */}
            <div style={{ position: "relative", height: 420, overflow: "hidden" }}>
                <img
                    src={heroSrc}
                    alt={event.event_name}
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
                        {event.event_name}
                    </h1>

                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.85)">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span style={{ color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: 500 }}>
                                {cardDate}
                            </span>
                        </div>
                        {venue && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.85)">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span style={{ color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: 500 }}>
                                    {venue}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* ══════════════ END HERO ══════════════ */}

            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* ── Main content ── */}
                    <div className="lg:col-span-2">
                        <div className="rounded-2xl p-8"
                            style={{ background: "#fff", boxShadow: "0 10px 30px -15px rgba(30,30,36,0.15)" }}>

                            {eventDetail?.organizer && (
                                <div className="mb-5">
                                    <p className="text-xs font-medium tracking-wide mb-1"
                                        style={{ color: "#92140c", opacity: 0.7 }}>ORGANISED BY</p>
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
                                    return sp.length > 0 ? (
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
                                    ) : null;
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

                {/* ══════════════ RECOMMENDED ══════════════ */}
                <RecommendedEvents eventId={id} limit={4} />
            </main>
        </div>
    );
}
