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

// ── Curated Unsplash photo pools by platform/category ──────────────────────
// IMPORTANT: These are identical to EventCard.jsx — same pool + same index
// formula guarantees the card image and detail hero image always match.
const POOL_NETWORKING = [
    "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=900&h=420&fit=crop&auto=format",
];

const POOL_CONFERENCE = [
    "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1559223607-b4d0555ae227?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1582192730841-2a682d7375f9?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1561489413-985b06da5bee?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1511578314322-379afb476865?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1464207687429-7505649dae38?w=900&h=420&fit=crop&auto=format",
];

const POOL_TECH = [
    "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1563770660941-20978e870e26?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=900&h=420&fit=crop&auto=format",
];

const POOL_EXPO = [
    "https://images.unsplash.com/photo-1587168501724-e9354f88e7cb?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1544531585-9847b68c8c86?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1542744094-3a31f272c490?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1526566661780-1a67ea3c863e?w=900&h=420&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1560439513-74b037a25d84?w=900&h=420&fit=crop&auto=format",
];

const PLATFORM_POOL = {
    echai: POOL_NETWORKING,
    meetup: POOL_NETWORKING,
    hasgeek: POOL_TECH,
    allevents: POOL_CONFERENCE,
    townscript: POOL_CONFERENCE,
    biec: POOL_EXPO,
    hitex: POOL_EXPO,
};

// Same formula as EventCard — guarantees card and detail always show the same image
function getEventImage(event) {
    const pool = PLATFORM_POOL[event.platform] || POOL_CONFERENCE;
    const idx = Math.abs(event.id || 0) % pool.length;
    return pool[idx];
}

// Returns the next image in the pool as a fallback if the primary URL fails
function getEventImageFallback(event) {
    const pool = PLATFORM_POOL[event.platform] || POOL_CONFERENCE;
    const idx = (Math.abs(event.id || 0) + 1) % pool.length;
    return pool[idx];
}

// ── Date formatter ────────────────────────────────────────────────────────
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
    let text = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/h[1-6]>/gi, "\n")
        .replace(/<\/tr>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'").replace(/&ensp;/g, " ").replace(/&emsp;/g, " ")
        .replace(/&thinsp;/g, " ").replace(/&#8203;/g, "").replace(/&shy;/g, "")
        .replace(/&#\d+;/g, "").replace(/&\w+;/g, " ")
        .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, "")
        .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
        .replace(/[◆❖•➤→▸✦★✓✔✗✘►▶◉○●■□▪▫⬤⬛⬜♦♣♠♥▲▼◀▻△▽◁▷⟶⟹⟵⇒⇐⇔·‣⁃※†‡§¶]/g, "")
        .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]/gu, "")
        .replace(/[\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n+/g, "\n");
    return text.split("\n").map(l => l.trim()).filter(l => l !== "").join("\n").trim();
}

function isHTML(str) { return /<[a-z][\s\S]*>/i.test(str || ""); }

function cleanDescription(text, eventName = "", location = "") {
    if (!text) return "";
    text = text.split("\n").map(line =>
        line.replace(/^[\s◆❖•➤→▸✦★✓✔✗✘►▶\-–—*·:]+/, "").trim()
    ).join("\n");

    const dropLine = [
        /^https?:\/\/\S+$/i,
        /slack\.com\/|whatsapp\.com\/|t\.me\/|discord\.gg\//i,
        /https?:\/\/\S{20,}/i,
        /^(also check out|stay in the loop|are you interested|join the community)/i,
        /^(join us|follow us|subscribe|sign up|register|get (your )?(tickets?|passes?))/i,
        /^(buy tickets?|book (now|here|your)|click here|read more|learn more)/i,
        /^(find out more|view (all|more)|load more|share (this|event)|newsletter)/i,
        /^(copyright|all rights reserved|powered by|in association with|more coming soon)/i,
        /^(call for|submit your|cfp|we('re| are) opening|suggested themes?:)/i,
        /^(agenda|schedule|welcome \+|q&a|networking):?\s*$/i,
        /^(home|about|contact|terms|privacy|cookie|×|close|menu|search|login|sign ?in|sign ?up|back|next|previous)$/i,
        /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+/i,
        /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/i,
        /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s+\d{4}/i,
        /^\d{4}-\d{2}-\d{2}(T.*)?$/,
        /^(bengaluru|bangalore|hyderabad|mumbai|delhi|chennai|kolkata|pune|online|virtual)$/i,
        /^₹[\d,]+/, /^(registration fees?|early bird|fees? will)/i,
        /^from \d+(st|nd|rd|th)?/i, /^(till|until) \d+(st|nd|rd|th)?/i,
        /^.{1,15}$/,
    ];

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

    const sectionBreaks = [
        /^(agenda|schedule|you'?ll learn|what you'?ll learn|join the community|call for|in association with|speakers?:|organis(er|ers?):)\b/i,
        /^(slack|whatsapp|telegram|discord)\b.*:/i,
        /^(1\.|2\.|3\.)\s+https?/i,
    ];

    const lines = text.split("\n").filter(line => {
        const t = line.trim();
        if (!t) return false;
        if (dropLine.some(p => p.test(t))) return false;
        if (isNameLine(t)) return false;
        if (isLocationLine(t)) return false;
        return true;
    });

    const collected = [];
    for (const line of lines) {
        if (collected.length > 0 && sectionBreaks.some(p => p.test(line.trim()))) break;
        collected.push(line.trim());
        if (collected.length >= 6) break;
    }

    if (!collected.length) return "";

    let paragraph = collected.join(" ").trim()
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();

    if (paragraph.length > 400) {
        let cut = paragraph.lastIndexOf(". ", 400);
        if (cut > 100) {
            paragraph = paragraph.slice(0, cut + 1);
        } else {
            cut = paragraph.lastIndexOf(" ", 400);
            if (cut > 100) paragraph = paragraph.slice(0, cut) + "...";
        }
    }

    return paragraph;
}

// ── Event name formatter ──────────────────────────────────────────────────
const ALWAYS_UPPER = new Set([
    "AWS", "AI", "ML", "API", "UI", "UX", "SQL", "NoSQL", "REST", "SDK",
    "MVP", "SaaS", "PaaS", "IaaS", "IoT", "AR", "VR", "XR", "NFT",
    "Web3", "HTML", "CSS", "JS", "TS", "PHP", "JVM", "GCP", "GIS",
    "CI", "CD", "DevOps", "DevSecOps", "SEO", "CRM", "ERP", "HR",
    "B2B", "B2C", "D2C", "BIEC", "HITEX", "TBA", "SLM", "LORA", "RAG",
]);

const ALWAYS_LOWER = new Set([
    "a", "an", "the", "and", "but", "or", "for", "nor", "on", "at",
    "to", "by", "in", "of", "up", "as", "vs", "via",
]);

const STRIP_PREFIXES = [
    /^in\s+person\s*[:\-–]?\s*/i,
    /^event\s+announcement\s*[:\-–]?\s*/i,
    /^free\s+event\s*[:\-–]?\s*/i,
    /^announcement\s*[:\-–]?\s*/i,
    /^upcoming\s*[:\-–]?\s*/i,
    /^online\s+event\s*[:\-–]?\s*/i,
];

function stripEmojis(str) {
    return str
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}

function toTitleCase(str) {
    const words = str.split(/(\s+|-)/);
    return words.map((token, i) => {
        if (/^[\s-]+$/.test(token)) return token;
        const upper = token.toUpperCase();
        const lower = token.toLowerCase();
        if (ALWAYS_UPPER.has(upper)) return upper;
        if (/[®™©]/.test(token) && token !== token.toUpperCase()) return token;
        if (i > 0 && ALWAYS_LOWER.has(lower)) return lower;
        return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    }).join("");
}

function formatEventName(raw) {
    if (!raw) return "";
    let name = stripEmojis(raw);
    for (const pattern of STRIP_PREFIXES) {
        name = name.replace(pattern, "");
    }
    name = name.replace(/\s{2,}/g, " ").trim();
    return toTitleCase(name);
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

    // ── Hero image: same curated Unsplash pool as EventCard (never scraped) ──
    const heroSrc = heroImgErr ? getEventImageFallback(event) : getEventImage(event);

    const displayName = formatEventName(event.event_name);

    // ── Location: city_normalized only (matches EventCard) ───────────────
    const cityNorm = event.city_normalized;
    const displayCity =
        cityNorm && cityNorm !== "Unknown" && cityNorm.trim() !== ""
            ? cityNorm
            : null;

    const rawDesc = eventDetail?.full_description || event.description || "";
    const stripped = isHTML(rawDesc) ? htmlToPlainText(rawDesc) : rawDesc.trim();
    const plainDesc = cleanDescription(stripped, event.event_name, event.location);
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
                    alt={displayName}
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
                                {cardDate}
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
