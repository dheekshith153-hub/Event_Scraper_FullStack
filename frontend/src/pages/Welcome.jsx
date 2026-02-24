import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function Counter({ end, suffix = "", duration = 2000 }) {
    const [count, setCount] = useState(0);
    const ref = useRef(null);
    const started = useRef(false);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !started.current) {
                started.current = true;
                let start = 0;
                const step = end / (duration / 16);
                const timer = setInterval(() => {
                    start += step;
                    if (start >= end) { setCount(end); clearInterval(timer); }
                    else setCount(Math.floor(start));
                }, 16);
            }
        });
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [end, duration]);

    return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ── Inline SVG icons — no emojis anywhere ────────────────────────────────
const Icons = {
    search: (size = 20) => (
        <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z" />
        </svg>
    ),
    filter: (size = 20) => (
        <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h18M6 9.75h12M9.75 15h4.5" />
        </svg>
    ),
    bookmark: (size = 20) => (
        <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
        </svg>
    ),
    bolt: (size = 20) => (
        <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
    ),
    refresh: (size = 20) => (
        <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
    ),
    pin: (size = 20) => (
        <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
    ),
    mic: (size = 20) => (
        <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
    ),
    people: (size = 20) => (
        <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
    ),
    code: (size = 20) => (
        <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
        </svg>
    ),
    wrench: (size = 20) => (
        <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
        </svg>
    ),
    rocket: (size = 20) => (
        <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
        </svg>
    ),
    chart: (size = 20) => (
        <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
    ),
    globe: (size = 20) => (
        <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253" />
        </svg>
    ),
};

const CATEGORIES = [
    { name: "Conferences", icon: Icons.mic, color: "#92140c" },
    { name: "Meetups", icon: Icons.people, color: "#1e1e24" },
    { name: "Hackathons", icon: Icons.code, color: "#92140c" },
    { name: "Workshops", icon: Icons.wrench, color: "#1e1e24" },
    { name: "Pitch Nights", icon: Icons.rocket, color: "#92140c" },
    { name: "Summits", icon: Icons.chart, color: "#1e1e24" },
    { name: "Webinars", icon: Icons.globe, color: "#92140c" },
];

function FeatureCard({ icon, title, desc, accent }) {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                background: "#fff8f0",
                border: `1px solid ${hovered ? accent : "rgba(146, 20, 12, 0.1)"}`,
                borderRadius: 16, padding: "32px 28px",
                transition: "all 0.4s cubic-bezier(0.2, 0.9, 0.3, 1)",
                transform: hovered ? "translateY(-4px)" : "none",
                boxShadow: hovered ? `0 20px 40px -20px ${accent}` : "none",
                cursor: "default",
            }}
        >
            <div style={{
                width: 48, height: 48, borderRadius: 12, background: `${accent}10`,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 20, color: accent,
            }}>
                {icon(20)}
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: "1.1rem", color: "#1e1e24", marginBottom: 8, letterSpacing: "-0.01em" }}>
                {title}
            </div>
            <div style={{ fontSize: "0.85rem", color: "#1e1e24", lineHeight: 1.7, opacity: 0.7, letterSpacing: "0.02em" }}>
                {desc}
            </div>
        </div>
    );
}

function PreviewCard({ title, type, location, date, color, style }) {
    return (
        <div style={{
            background: "#fff8f0", borderRadius: 16, padding: "16px",
            boxShadow: "0 20px 40px -20px rgba(30, 30, 36, 0.3), 0 0 0 1px rgba(146, 20, 12, 0.1)",
            width: 220, ...style,
        }}>
            <div style={{ marginBottom: 10 }}>
                <div style={{ padding: "2px 10px", borderRadius: 20, background: `${color}10`, border: `1px solid ${color}20`, fontSize: 10, fontWeight: 500, color, letterSpacing: "0.04em", display: "inline-block" }}>
                    {type}
                </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#1e1e24", lineHeight: 1.4, marginBottom: 8, fontFamily: "'Cormorant Garamond', serif", letterSpacing: "-0.01em" }}>{title}</div>
            <div style={{ fontSize: 11, color: "#1e1e24", opacity: 0.7, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color, opacity: 0.5, display: "flex" }}>{Icons.pin(10)}</span>
                {location}
            </div>
            <div style={{ fontSize: 11, color: "#92140c", marginTop: 4, fontWeight: 500 }}>{date}</div>
        </div>
    );
}

function Step({ num, title, desc }) {
    return (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div style={{
                minWidth: 44, height: 44, borderRadius: 8, background: "#1e1e24",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Cormorant Garamond', serif", fontWeight: 500,
                fontSize: "1.1rem", color: "#fff8f0", flexShrink: 0, border: "1px solid #92140c",
            }}>{num}</div>
            <div>
                <div style={{ fontWeight: 500, color: "#1e1e24", fontSize: "0.95rem", marginBottom: 4, fontFamily: "'Cormorant Garamond', serif", letterSpacing: "-0.01em" }}>{title}</div>
                <div style={{ fontSize: "0.85rem", color: "#1e1e24", lineHeight: 1.7, opacity: 0.7, letterSpacing: "0.02em" }}>{desc}</div>
            </div>
        </div>
    );
}

export default function Welcome() {
    const { isAuthed, user } = useAuth();
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        const onScroll = () => setScrollY(window.scrollY);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <div style={{ fontFamily: "'Inter', sans-serif", background: "#fff8f0", overflowX: "hidden" }}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap" rel="stylesheet" />

            {/* ── HEADER ── */}
            <header style={{
                position: "sticky", top: 0, zIndex: 100,
                background: scrollY > 40 ? "rgba(255, 248, 240, 0.95)" : "transparent",
                backdropFilter: scrollY > 40 ? "blur(12px)" : "none",
                borderBottom: scrollY > 40 ? "1px solid rgba(146, 20, 12, 0.1)" : "none",
                transition: "all 0.3s ease",
            }}>
                <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Link to="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: "#1e1e24", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 400, fontSize: 20, color: "#fff8f0", fontFamily: "'Cormorant Garamond', serif", border: "1px solid #92140c" }}>E</div>
                        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.3rem", fontWeight: 500, color: "#1e1e24", letterSpacing: "-0.02em" }}>EventScraper</span>
                    </Link>

                    <nav style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {isAuthed ? (
                            <>
                                <span style={{ fontSize: 13, color: "#1e1e24", opacity: 0.7, marginRight: 8, letterSpacing: "0.02em" }}>
                                    Hi, {user?.full_name?.split(" ")[0] || "there"}
                                </span>
                                <Link to="/events" style={{
                                    padding: "9px 20px", borderRadius: 40, fontSize: 13, fontWeight: 400,
                                    background: "#1e1e24", color: "#fff8f0", textDecoration: "none",
                                    border: "1px solid #92140c", letterSpacing: "0.05em", transition: "all 0.3s",
                                }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#92140c"}
                                    onMouseLeave={e => e.currentTarget.style.background = "#1e1e24"}>
                                    Browse Events
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link to="/signin" style={{ padding: "9px 16px", fontSize: 13, fontWeight: 400, color: "#1e1e24", textDecoration: "none", letterSpacing: "0.02em", opacity: 0.7 }}>
                                    Sign in
                                </Link>
                                <Link to="/signup" style={{
                                    padding: "9px 20px", borderRadius: 40, fontSize: 13, fontWeight: 400,
                                    background: "#1e1e24", color: "#fff8f0", textDecoration: "none",
                                    border: "1px solid #92140c", letterSpacing: "0.05em", transition: "all 0.3s",
                                }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#92140c"}
                                    onMouseLeave={e => e.currentTarget.style.background = "#1e1e24"}>
                                    Get started
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
            </header>

            {/* ── HERO ── */}
            <section style={{ maxWidth: 1200, margin: "0 auto", padding: "72px 24px 0" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
                    <div>
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: 8,
                            padding: "6px 14px", borderRadius: 40,
                            background: "rgba(146, 20, 12, 0.05)", border: "1px solid rgba(146, 20, 12, 0.1)",
                            fontSize: 12, fontWeight: 400, color: "#92140c", marginBottom: 24, letterSpacing: "0.05em",
                        }}>
                            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#92140c", display: "inline-block" }} />
                            Live · Updated daily
                        </div>

                        <h1 style={{
                            fontFamily: "'Cormorant Garamond', serif",
                            fontSize: "clamp(2.5rem, 5vw, 4rem)",
                            lineHeight: 1.1, color: "#1e1e24",
                            letterSpacing: "-0.02em", marginBottom: 20, fontWeight: 500,
                        }}>
                            Every tech event<br />
                            across <span style={{ color: "#92140c", fontStyle: "italic" }}>India,</span><br />
                            unified.
                        </h1>

                        <p style={{ fontSize: "0.95rem", color: "#1e1e24", lineHeight: 1.8, maxWidth: 440, marginBottom: 36, opacity: 0.7, letterSpacing: "0.02em" }}>
                            We track tech meetups, hackathons, developer conferences, and founder gatherings across India's top tech cities — so you always know what's happening.
                        </p>

                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                            {isAuthed ? (
                                <Link to="/events" style={{
                                    padding: "14px 32px", borderRadius: 40, fontSize: 14, fontWeight: 400,
                                    background: "#1e1e24", color: "#fff8f0", textDecoration: "none",
                                    border: "1px solid #92140c", letterSpacing: "0.05em", transition: "all 0.3s",
                                }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#92140c"}
                                    onMouseLeave={e => e.currentTarget.style.background = "#1e1e24"}>
                                    Browse all events →
                                </Link>
                            ) : (
                                <>
                                    <Link to="/signup" style={{
                                        padding: "14px 32px", borderRadius: 40, fontSize: 14, fontWeight: 400,
                                        background: "#1e1e24", color: "#fff8f0", textDecoration: "none",
                                        border: "1px solid #92140c", letterSpacing: "0.05em", transition: "all 0.3s",
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.background = "#92140c"}
                                        onMouseLeave={e => e.currentTarget.style.background = "#1e1e24"}>
                                        Start for free →
                                    </Link>
                                    <Link to="/signin" style={{
                                        padding: "14px 28px", borderRadius: 40, fontSize: 14, fontWeight: 400,
                                        background: "transparent", color: "#1e1e24", textDecoration: "none",
                                        border: "1px solid rgba(146, 20, 12, 0.2)", letterSpacing: "0.02em",
                                    }}>
                                        Sign in
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right: floating preview cards */}
                    <div style={{ position: "relative", height: 480, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{
                            position: "absolute", width: 360, height: 360, borderRadius: "50%",
                            background: "radial-gradient(circle, rgba(146, 20, 12, 0.05) 0%, transparent 70%)",
                            filter: "blur(40px)",
                        }} />

                        {/* Main card */}
                        <div style={{
                            position: "absolute", left: "50%", top: "50%",
                            transform: "translate(-50%, -50%)",
                            background: "#fff8f0", borderRadius: 20,
                            boxShadow: "0 30px 60px -30px rgba(30, 30, 36, 0.4), 0 0 0 1px rgba(146, 20, 12, 0.1)",
                            padding: 24, width: 260,
                            animation: "float 7s ease-in-out infinite",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                                <div style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(146,20,12,0.08)", border: "1px solid rgba(146,20,12,0.15)", fontSize: 10, fontWeight: 500, color: "#92140c", letterSpacing: "0.04em" }}>
                                    Conference
                                </div>
                                <div style={{ marginLeft: "auto", background: "rgba(146, 20, 12, 0.1)", color: "#92140c", fontSize: 10, padding: "3px 8px", borderRadius: 20, letterSpacing: "0.02em" }}>Free</div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: "#1e1e24", lineHeight: 1.4, marginBottom: 10, fontFamily: "'Cormorant Garamond', serif", letterSpacing: "-0.01em" }}>
                                India Tech Founders Summit 2025
                            </div>
                            <div style={{ fontSize: 11, color: "#1e1e24", opacity: 0.7, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ color: "#92140c", opacity: 0.5, display: "flex" }}>{Icons.pin(10)}</span>
                                Koramangala, Bengaluru
                            </div>
                            <div style={{ fontSize: 11, color: "#92140c", fontWeight: 500, marginBottom: 14 }}>Mar 15, 2025</div>
                            <div style={{ padding: "9px 0", borderRadius: 8, background: "#1e1e24", textAlign: "center", fontSize: 12, fontWeight: 400, color: "#fff8f0", border: "1px solid #92140c", letterSpacing: "0.05em" }}>
                                View event
                            </div>
                        </div>

                        <PreviewCard title="React India Conf 2025" type="Workshop" location="Pune, MH" date="Apr 2, 2025" color="#1e1e24"
                            style={{ position: "absolute", top: "12%", right: "0%", transform: "rotate(2deg)", animation: "float 5s ease-in-out infinite" }} />

                        <PreviewCard title="Startup Pitch Night" type="Pitch Night" location="Mumbai, MH" date="Mar 22, 2025" color="#92140c"
                            style={{ position: "absolute", bottom: "10%", left: "-5%", transform: "rotate(-2deg)", animation: "float 6s ease-in-out infinite" }} />

                        <div style={{
                            position: "absolute", top: "5%", left: "5%",
                            background: "#fff8f0", borderRadius: 12,
                            boxShadow: "0 15px 30px -15px rgba(30, 30, 36, 0.2), 0 0 0 1px rgba(146, 20, 12, 0.1)",
                            padding: "12px 18px", animation: "float 8s ease-in-out infinite",
                        }}>
                            <div style={{ fontSize: 22, fontWeight: 500, color: "#92140c", fontFamily: "'Cormorant Garamond', serif", lineHeight: 1 }}>500+</div>
                            <div style={{ fontSize: 10, color: "#1e1e24", opacity: 0.6, letterSpacing: "0.02em" }}>events tracked</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── STATS BAR ── */}
            <section style={{ maxWidth: 1200, margin: "80px auto 0", padding: "0 24px" }}>
                <div style={{
                    background: "#fff8f0", borderRadius: 16, padding: "40px 48px",
                    display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0,
                    border: "1px solid rgba(146, 20, 12, 0.1)",
                }}>
                    {[
                        { value: 500, suffix: "+", label: "Events tracked" },
                        { value: 7, suffix: "", label: "Cities covered" },
                        { value: 24, suffix: "h", label: "Update cycle" },
                        { value: 100, suffix: "%", label: "Free access" },
                    ].map((s, i) => (
                        <div key={i} style={{ textAlign: "center", borderRight: i < 3 ? "1px solid rgba(146, 20, 12, 0.1)" : "none", padding: "0 24px" }}>
                            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2.5rem", color: "#92140c", fontWeight: 500 }}>
                                <Counter end={s.value} suffix={s.suffix} />
                            </div>
                            <div style={{ fontSize: 12, color: "#1e1e24", marginTop: 4, opacity: 0.7, letterSpacing: "0.02em" }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── FEATURES ── */}
            <section style={{ maxWidth: 1200, margin: "96px auto 0", padding: "0 24px" }}>
                <div style={{ textAlign: "center", marginBottom: 56 }}>
                    <div style={{ fontSize: 10, fontWeight: 400, color: "#92140c", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>Why EventScraper</div>
                    <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1.8rem, 3vw, 2.8rem)", color: "#1e1e24", letterSpacing: "-0.02em", marginBottom: 14, fontWeight: 500 }}>
                        Built for those who<br />actually attend
                    </h2>
                    <p style={{ fontSize: "0.9rem", color: "#1e1e24", maxWidth: 480, margin: "0 auto", lineHeight: 1.8, opacity: 0.7, letterSpacing: "0.02em" }}>
                        One place to search, filter, save and track tech events across every major city in India's tech ecosystem.
                    </p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                    <FeatureCard icon={Icons.search} title="Unified Search" desc="Search across hundreds of events at once. No more hopping between websites — everything is aggregated and searchable here." accent="#92140c" />
                    <FeatureCard icon={Icons.filter} title="Smart Filters" desc="Filter by city, date range, and event type. Find exactly what you're looking for in seconds." accent="#1e1e24" />
                    <FeatureCard icon={Icons.bookmark} title="Save to Planner" desc="Bookmark events you're interested in and build your personal event calendar. Never lose track of a great event." accent="#92140c" />
                    <FeatureCard icon={Icons.bolt} title="Fresh Daily" desc="Our scrapers run daily so the events list is always current. New events added automatically, old ones cleaned up." accent="#1e1e24" />
                    <FeatureCard icon={Icons.refresh} title="De-duplicated" desc="The same event listed in multiple places? We detect and merge duplicates so you see clean, unique results." accent="#92140c" />
                    <FeatureCard icon={Icons.pin} title="Location Aware" desc="Filter by tech city or state. Whether you want events in Bengaluru, Pune, Hyderabad, or Mumbai — we've got you covered." accent="#1e1e24" />
                </div>
            </section>

            {/* ── HOW IT WORKS ── */}
            <section style={{ maxWidth: 1200, margin: "96px auto 0", padding: "0 24px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 400, color: "#92140c", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>How it works</div>
                        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1.8rem, 3vw, 2.5rem)", color: "#1e1e24", letterSpacing: "-0.02em", marginBottom: 40, fontWeight: 500 }}>
                            From discovery to<br />calendar in 3 steps
                        </h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                            <Step num="01" title="Create your free account" desc="Sign up in seconds. No credit card, no spam — just a simple account to unlock full access." />
                            <div style={{ width: 1, height: 24, background: "rgba(146, 20, 12, 0.1)", marginLeft: 22 }} />
                            <Step num="02" title="Search & filter events" desc="Use our powerful search and filters to narrow down to exactly what interests you — by date, location, or keyword." />
                            <div style={{ width: 1, height: 24, background: "rgba(146, 20, 12, 0.1)", marginLeft: 22 }} />
                            <Step num="03" title="Save & attend" desc="Bookmark events to your planner and click through to register directly on the event page." />
                        </div>
                    </div>

                    <div>
                        <div style={{ background: "#fff8f0", borderRadius: 20, overflow: "hidden", boxShadow: "0 30px 60px -30px rgba(30, 30, 36, 0.3)", border: "1px solid rgba(146, 20, 12, 0.1)" }}>
                            <div style={{ background: "rgba(146, 20, 12, 0.05)", padding: "14px 20px", borderBottom: "1px solid rgba(146, 20, 12, 0.1)", display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#92140c", opacity: 0.5 }} />
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#1e1e24", opacity: 0.5 }} />
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#92140c", opacity: 0.5 }} />
                                <div style={{ flex: 1, background: "#fff8f0", borderRadius: 4, padding: "5px 12px", fontSize: 11, color: "#1e1e24", marginLeft: 8, border: "1px solid rgba(146, 20, 12, 0.1)", opacity: 0.8 }}>
                                    eventscraper.com/events
                                </div>
                            </div>
                            <div style={{ padding: "20px 20px 16px" }}>
                                <div style={{ background: "rgba(146, 20, 12, 0.05)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#1e1e24", display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(146, 20, 12, 0.1)" }}>
                                    <span style={{ color: "#92140c", opacity: 0.5, display: "flex" }}>{Icons.search(12)}</span>
                                    Search events, cities, topics...
                                </div>
                            </div>
                            <div style={{ padding: "0 20px 16px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {["All", "Bengaluru", "Conferences", "This week"].map((f, i) => (
                                    <div key={f} style={{ padding: "4px 12px", borderRadius: 20, background: i === 0 ? "#92140c" : "transparent", color: i === 0 ? "#fff8f0" : "#1e1e24", fontSize: 11, border: "1px solid", borderColor: i === 0 ? "#92140c" : "rgba(146, 20, 12, 0.2)", letterSpacing: "0.02em" }}>{f}</div>
                                ))}
                            </div>
                            {[
                                { title: "India SaaS Summit 2025", type: "Summit", loc: "Bengaluru, KA", color: "#92140c" },
                                { title: "React India Conf 2025", type: "Conference", loc: "Pune, MH", color: "#1e1e24" },
                                { title: "VC Pitch Competition", type: "Pitch Night", loc: "Mumbai, MH", color: "#92140c" },
                            ].map((e, i) => (
                                <div key={i} style={{ margin: "0 20px 12px", background: "rgba(146, 20, 12, 0.02)", borderRadius: 10, padding: "12px", border: "1px solid rgba(146, 20, 12, 0.1)", display: "flex", gap: 12, alignItems: "center" }}>
                                    <div style={{ padding: "3px 8px", borderRadius: 20, background: `${e.color}10`, border: `1px solid ${e.color}20`, fontSize: 9, fontWeight: 500, color: e.color, letterSpacing: "0.04em", whiteSpace: "nowrap", flexShrink: 0 }}>
                                        {e.type}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 500, color: "#1e1e24", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Cormorant Garamond', serif", letterSpacing: "-0.01em" }}>{e.title}</div>
                                        <div style={{ fontSize: 10, color: "#1e1e24", opacity: 0.6, marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}>
                                            <span style={{ color: e.color, opacity: 0.5, display: "flex" }}>{Icons.pin(9)}</span>
                                            {e.loc}
                                        </div>
                                    </div>
                                    <div style={{ width: 20, height: 20, borderRadius: 4, background: "#fff8f0", border: "1px solid rgba(146, 20, 12, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#92140c" }}>
                                        {Icons.bookmark(10)}
                                    </div>
                                </div>
                            ))}
                            <div style={{ height: 20 }} />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── EVENT CATEGORIES ── */}
            <section style={{ maxWidth: 1200, margin: "96px auto 0", padding: "0 24px" }}>
                <div style={{ textAlign: "center", marginBottom: 48 }}>
                    <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)", color: "#1e1e24", letterSpacing: "-0.02em", fontWeight: 500 }}>
                        Every kind of tech event
                    </h2>
                    <p style={{ fontSize: "0.85rem", color: "#1e1e24", marginTop: 12, opacity: 0.7, letterSpacing: "0.02em" }}>
                        From intimate workshops to city-wide summits — all in one place.
                    </p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 16 }}>
                    {CATEGORIES.map(c => (
                        <div key={c.name} style={{ background: "#fff8f0", borderRadius: 12, padding: "24px 12px", textAlign: "center", border: "1px solid rgba(146, 20, 12, 0.1)" }}>
                            <div style={{ width: 44, height: 44, borderRadius: 8, background: `${c.color}08`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", color: c.color, border: `1px solid ${c.color}15` }}>
                                {c.icon(20)}
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 400, color: "#1e1e24", letterSpacing: "0.02em" }}>{c.name}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CTA ── */}
            <section style={{ maxWidth: 1200, margin: "96px auto", padding: "0 24px" }}>
                <div style={{ background: "#fff8f0", borderRadius: 24, padding: "72px 64px", textAlign: "center", position: "relative", overflow: "hidden", border: "1px solid rgba(146, 20, 12, 0.1)" }}>
                    <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(146, 20, 12, 0.03)", filter: "blur(40px)" }} />
                    <div style={{ position: "absolute", bottom: -40, left: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(30, 30, 36, 0.03)", filter: "blur(40px)" }} />
                    <div style={{ position: "relative", zIndex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 400, color: "#92140c", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 20 }}>Start now — it's free</div>
                        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(2rem, 3.5vw, 3rem)", color: "#1e1e24", letterSpacing: "-0.02em", marginBottom: 16, lineHeight: 1.15, fontWeight: 500 }}>
                            Never miss another<br />tech event in India
                        </h2>
                        <p style={{ fontSize: "0.9rem", color: "#1e1e24", maxWidth: 420, margin: "0 auto 40px", lineHeight: 1.8, opacity: 0.7, letterSpacing: "0.02em" }}>
                            Join hundreds of developers, founders, and tech professionals who use EventScraper to stay connected with India's tech community.
                        </p>
                        {isAuthed ? (
                            <Link to="/events" style={{ display: "inline-block", padding: "16px 40px", borderRadius: 40, background: "#1e1e24", color: "#fff8f0", fontSize: 14, fontWeight: 400, textDecoration: "none", border: "1px solid #92140c", letterSpacing: "0.05em", transition: "all 0.3s" }}
                                onMouseEnter={e => e.currentTarget.style.background = "#92140c"}
                                onMouseLeave={e => e.currentTarget.style.background = "#1e1e24"}>
                                Browse all events →
                            </Link>
                        ) : (
                            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                                <Link to="/signup" style={{ display: "inline-block", padding: "16px 40px", borderRadius: 40, background: "#1e1e24", color: "#fff8f0", fontSize: 14, fontWeight: 400, textDecoration: "none", border: "1px solid #92140c", letterSpacing: "0.05em", transition: "all 0.3s" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#92140c"}
                                    onMouseLeave={e => e.currentTarget.style.background = "#1e1e24"}>
                                    Create free account →
                                </Link>
                                <Link to="/signin" style={{ display: "inline-block", padding: "16px 32px", borderRadius: 40, background: "transparent", color: "#1e1e24", fontSize: 14, fontWeight: 400, textDecoration: "none", border: "1px solid rgba(146, 20, 12, 0.2)", letterSpacing: "0.02em" }}>
                                    Sign in
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer style={{ borderTop: "1px solid rgba(146, 20, 12, 0.1)", padding: "32px 24px", maxWidth: 1200, margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: "#1e1e24", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff8f0", border: "1px solid #92140c", fontFamily: "'Cormorant Garamond', serif" }}>E</div>
                        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1rem", fontWeight: 500, color: "#1e1e24" }}>EventScraper</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#1e1e24", opacity: 0.6, letterSpacing: "0.02em" }}>© 2025 · India's Tech Event Hub</div>
                    <div style={{ display: "flex", gap: 20 }}>
                        <Link to="/signin" style={{ fontSize: 11, color: "#1e1e24", textDecoration: "none", opacity: 0.6, letterSpacing: "0.02em" }}>Sign in</Link>
                        <Link to="/signup" style={{ fontSize: 11, color: "#1e1e24", textDecoration: "none", opacity: 0.6, letterSpacing: "0.02em" }}>Sign up</Link>
                    </div>
                </div>
            </footer>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-8px); }
                }
                @media (max-width: 768px) {
                    section > div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
                    section > div[style*="grid-template-columns: repeat(7"] { grid-template-columns: repeat(4, 1fr) !important; }
                    section > div[style*="grid-template-columns: repeat(4"] { grid-template-columns: repeat(2, 1fr) !important; }
                    section > div[style*="grid-template-columns: repeat(3"] { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </div>
    );
}
