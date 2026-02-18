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

const PLATFORMS = [
    { name: "Meetup", color: "#92140c", icon: "M" },
    { name: "HasGeek", color: "#1e1e24", icon: "H" },
    { name: "AllEvents", color: "#92140c", icon: "A" },
    { name: "Echai", color: "#1e1e24", icon: "E" },
    { name: "Townscript", color: "#92140c", icon: "T" },
    { name: "BIEC", color: "#1e1e24", icon: "B" },
    { name: "Hitex", color: "#92140c", icon: "X" },
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
                borderRadius: 16,
                padding: "32px 28px",
                transition: "all 0.4s cubic-bezier(0.2, 0.9, 0.3, 1)",
                transform: hovered ? "translateY(-4px)" : "none",
                boxShadow: hovered ? `0 20px 40px -20px ${accent}` : "none",
                cursor: "default",
            }}
        >
            <div
                style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: `${accent}10`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 24, marginBottom: 20, color: accent,
                }}
            >
                {icon}
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

function PreviewCard({ title, platform, location, date, color, style }) {
    return (
        <div style={{
            background: "#fff8f0",
            borderRadius: 16,
            padding: "16px",
            boxShadow: "0 20px 40px -20px rgba(30, 30, 36, 0.3), 0 0 0 1px rgba(146, 20, 12, 0.1)",
            width: 220,
            border: "none",
            ...style,
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 400, color: "#fff8f0", fontFamily: "'Cormorant Garamond', serif" }}>
                    {platform[0]}
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: color, letterSpacing: "0.02em" }}>{platform}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#1e1e24", lineHeight: 1.4, marginBottom: 8, fontFamily: "'Cormorant Garamond', serif", letterSpacing: "-0.01em" }}>{title}</div>
            <div style={{ fontSize: 11, color: "#1e1e24", opacity: 0.7 }}>📍 {location}</div>
            <div style={{ fontSize: 11, color: "#92140c", marginTop: 4, fontWeight: 500 }}>{date}</div>
        </div>
    );
}

function Step({ num, title, desc }) {
    return (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div style={{
                minWidth: 44, height: 44, borderRadius: 8,
                background: "#1e1e24",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Cormorant Garamond', serif", fontWeight: 500,
                fontSize: "1.1rem", color: "#fff8f0", flexShrink: 0,
                border: "1px solid #92140c",
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
                                    Hi, {user?.full_name?.split(" ")[0] || "there"} 👋
                                </span>
                                <Link to="/events" style={{
                                    padding: "9px 20px", borderRadius: 40, fontSize: 13, fontWeight: 400,
                                    background: "#1e1e24",
                                    color: "#fff8f0", textDecoration: "none",
                                    border: "1px solid #92140c",
                                    letterSpacing: "0.05em",
                                    transition: "all 0.3s",
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
                                    background: "#1e1e24",
                                    color: "#fff8f0", textDecoration: "none",
                                    border: "1px solid #92140c",
                                    letterSpacing: "0.05em",
                                    transition: "all 0.3s",
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
                    {/* Left */}
                    <div className="animate-fade-in">
                        {/* Badge */}
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: 8,
                            padding: "6px 14px", borderRadius: 40,
                            background: "rgba(146, 20, 12, 0.05)", border: "1px solid rgba(146, 20, 12, 0.1)",
                            fontSize: 12, fontWeight: 400, color: "#92140c", marginBottom: 24,
                            letterSpacing: "0.05em",
                        }}>
                            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#92140c", display: "inline-block" }} />
                            Live • {PLATFORMS.length} platforms
                        </div>

                        <h1 style={{
                            fontFamily: "'Cormorant Garamond', serif",
                            fontSize: "clamp(2.5rem, 5vw, 4rem)",
                            lineHeight: 1.1,
                            color: "#1e1e24",
                            letterSpacing: "-0.02em",
                            marginBottom: 20,
                            fontWeight: 500,
                        }}>
                            Every tech event<br />
                            across <span style={{ color: "#92140c", fontStyle: "italic" }}>India,</span><br />
                            unified.
                        </h1>

                        <p style={{ fontSize: "0.95rem", color: "#1e1e24", lineHeight: 1.8, maxWidth: 440, marginBottom: 36, opacity: 0.7, letterSpacing: "0.02em" }}>
                            We scrape tech meetups, hackathons, developer conferences, and founder gatherings across 7 platforms in India's top tech cities — so you always know what's happening.
                        </p>

                        {/* CTA */}
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 48 }}>
                            {isAuthed ? (
                                <Link to="/events" style={{
                                    padding: "14px 32px", borderRadius: 40, fontSize: 14, fontWeight: 400,
                                    background: "#1e1e24",
                                    color: "#fff8f0", textDecoration: "none",
                                    border: "1px solid #92140c",
                                    letterSpacing: "0.05em",
                                    transition: "all 0.3s",
                                }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#92140c"}
                                    onMouseLeave={e => e.currentTarget.style.background = "#1e1e24"}>
                                    Browse all events →
                                </Link>
                            ) : (
                                <>
                                    <Link to="/signup" style={{
                                        padding: "14px 32px", borderRadius: 40, fontSize: 14, fontWeight: 400,
                                        background: "#1e1e24",
                                        color: "#fff8f0", textDecoration: "none",
                                        border: "1px solid #92140c",
                                        letterSpacing: "0.05em",
                                        transition: "all 0.3s",
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.background = "#92140c"}
                                        onMouseLeave={e => e.currentTarget.style.background = "#1e1e24"}>
                                        Start for free →
                                    </Link>
                                    <Link to="/signin" style={{
                                        padding: "14px 28px", borderRadius: 40, fontSize: 14, fontWeight: 400,
                                        background: "transparent",
                                        color: "#1e1e24", textDecoration: "none",
                                        border: "1px solid rgba(146, 20, 12, 0.2)",
                                        letterSpacing: "0.02em",
                                    }}>
                                        Sign in
                                    </Link>
                                </>
                            )}
                        </div>

                        {/* Platform pills */}
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 400, color: "#92140c", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                                Sources we cover
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {PLATFORMS.map(p => (
                                    <div key={p.name} style={{
                                        display: "flex", alignItems: "center", gap: 6,
                                        padding: "5px 12px", borderRadius: 40,
                                        background: `${p.color}08`, border: `1px solid ${p.color}15`,
                                        fontSize: 11, fontWeight: 400, color: p.color,
                                        letterSpacing: "0.02em",
                                    }}>
                                        <span style={{ width: 16, height: 16, borderRadius: 4, background: p.color, color: "#fff8f0", fontSize: 9, fontWeight: 400, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond', serif" }}>
                                            {p.icon}
                                        </span>
                                        {p.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: floating preview cards */}
                    <div style={{ position: "relative", height: 480, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {/* Background blob */}
                        <div style={{
                            position: "absolute", width: 360, height: 360, borderRadius: "50%",
                            background: "radial-gradient(circle, rgba(146, 20, 12, 0.05) 0%, transparent 70%)",
                            filter: "blur(40px)",
                        }} />

                        {/* Main large card */}
                        <div className="animate-float" style={{
                            position: "absolute", left: "50%", top: "50%",
                            transform: "translate(-50%, -50%)",
                            background: "#fff8f0", borderRadius: 20,
                            boxShadow: "0 30px 60px -30px rgba(30, 30, 36, 0.4), 0 0 0 1px rgba(146, 20, 12, 0.1)",
                            padding: 24, width: 260,
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#1e1e24", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 400, color: "#fff8f0", border: "1px solid #92140c", fontFamily: "'Cormorant Garamond', serif" }}>M</div>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 500, color: "#1e1e24", letterSpacing: "0.02em" }}>Meetup</div>
                                    <div style={{ fontSize: 10, color: "#1e1e24", opacity: 0.5 }}>Bengaluru, KA</div>
                                </div>
                                <div style={{ marginLeft: "auto", background: "rgba(146, 20, 12, 0.1)", color: "#92140c", fontSize: 10, fontWeight: 400, padding: "3px 8px", borderRadius: 20, letterSpacing: "0.02em" }}>Free</div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: "#1e1e24", lineHeight: 1.4, marginBottom: 10, fontFamily: "'Cormorant Garamond', serif", letterSpacing: "-0.01em" }}>
                                India Tech Founders Summit 2025
                            </div>
                            <div style={{ fontSize: 11, color: "#1e1e24", opacity: 0.7, marginBottom: 4 }}>📍 Koramangala, Bengaluru</div>
                            <div style={{ fontSize: 11, color: "#92140c", fontWeight: 500, marginBottom: 14 }}>Mar 15, 2025</div>
                            <div style={{ padding: "9px 0", borderRadius: 8, background: "#1e1e24", textAlign: "center", fontSize: 12, fontWeight: 400, color: "#fff8f0", border: "1px solid #92140c", letterSpacing: "0.05em" }}>
                                View event
                            </div>
                        </div>

                        {/* Floating card 1 */}
                        <PreviewCard
                            title="React India Conf 2025"
                            platform="HasGeek"
                            location="Pune, MH"
                            date="Apr 2, 2025"
                            color="#1e1e24"
                            style={{
                                position: "absolute", top: "12%", right: "0%",
                                transform: "rotate(2deg)",
                                animation: "float 5s ease-in-out infinite",
                            }}
                        />

                        {/* Floating card 2 */}
                        <PreviewCard
                            title="Startup Pitch Night"
                            platform="Echai"
                            location="Mumbai, MH"
                            date="Mar 22, 2025"
                            color="#92140c"
                            style={{
                                position: "absolute", bottom: "10%", left: "-5%",
                                transform: "rotate(-2deg)",
                                animation: "float 6s ease-in-out infinite",
                            }}
                        />

                        {/* Count badge */}
                        <div className="animate-float" style={{
                            position: "absolute", top: "5%", left: "5%",
                            background: "#fff8f0", borderRadius: 12,
                            boxShadow: "0 15px 30px -15px rgba(30, 30, 36, 0.2), 0 0 0 1px rgba(146, 20, 12, 0.1)",
                            padding: "12px 18px",
                        }}>
                            <div style={{ fontSize: 22, fontWeight: 500, color: "#92140c", fontFamily: "'Cormorant Garamond', serif", lineHeight: 1 }}>500+</div>
                            <div style={{ fontSize: 10, color: "#1e1e24", opacity: 0.6, fontWeight: 400, letterSpacing: "0.02em" }}>events tracked</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── STATS BAR ── */}
            <section style={{ maxWidth: 1200, margin: "80px auto 0", padding: "0 24px" }}>
                <div style={{
                    background: "#fff8f0",
                    borderRadius: 16,
                    padding: "40px 48px",
                    display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 0,
                    border: "1px solid rgba(146, 20, 12, 0.1)",
                }}>
                    {[
                        { value: 500, suffix: "+", label: "Events tracked" },
                        { value: 7, suffix: "", label: "Platforms" },
                        { value: 24, suffix: "h", label: "Update cycle" },
                        { value: 100, suffix: "%", label: "Free access" },
                    ].map((s, i) => (
                        <div key={i} style={{
                            textAlign: "center",
                            borderRight: i < 3 ? "1px solid rgba(146, 20, 12, 0.1)" : "none",
                            padding: "0 24px",
                        }}>
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
                    <div style={{ fontSize: 10, fontWeight: 400, color: "#92140c", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>
                        Why EventScraper
                    </div>
                    <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1.8rem, 3vw, 2.8rem)", color: "#1e1e24", letterSpacing: "-0.02em", marginBottom: 14, fontWeight: 500 }}>
                        Built for those who<br />actually attend
                    </h2>
                    <p style={{ fontSize: "0.9rem", color: "#1e1e24", maxWidth: 480, margin: "0 auto", lineHeight: 1.8, opacity: 0.7, letterSpacing: "0.02em" }}>
                        One place to search, filter, save and track tech events across every major platform in India's top tech hubs.
                    </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                    <FeatureCard
                        icon="🔍"
                        title="Unified Search"
                        desc="Search across 7 platforms at once. No more checking Meetup, then Hasgeek, then AllEvents separately — it's all here."
                        accent="#92140c"
                    />
                    <FeatureCard
                        icon="🎯"
                        title="Smart Filters"
                        desc="Filter by city, platform, date range, and event type. Find exactly what you're looking for in seconds."
                        accent="#1e1e24"
                    />
                    <FeatureCard
                        icon="🔖"
                        title="Save to Planner"
                        desc="Bookmark events you're interested in and build your personal event calendar. Never lose track of a great event."
                        accent="#92140c"
                    />
                    <FeatureCard
                        icon="⚡"
                        title="Fresh Daily"
                        desc="Our scrapers run daily so the events list is always current. New events added automatically, old ones cleaned up."
                        accent="#1e1e24"
                    />
                    <FeatureCard
                        icon="🔄"
                        title="De-duplicated"
                        desc="The same event listed on multiple platforms? We detect and merge duplicates so you see clean, unique results."
                        accent="#92140c"
                    />
                    <FeatureCard
                        icon="📍"
                        title="Location Aware"
                        desc="Filter by tech city or state. Whether you want events in Bengaluru, Pune, Hyderabad, or Mumbai — we've got you covered."
                        accent="#1e1e24"
                    />
                </div>
            </section>

            {/* ── HOW IT WORKS ── */}
            <section style={{ maxWidth: 1200, margin: "96px auto 0", padding: "0 24px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 400, color: "#92140c", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>
                            How it works
                        </div>
                        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1.8rem, 3vw, 2.5rem)", color: "#1e1e24", letterSpacing: "-0.02em", marginBottom: 40, fontWeight: 500 }}>
                            From discovery to<br />calendar in 3 steps
                        </h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                            <Step num="01" title="Create your free account" desc="Sign up in seconds. No credit card, no spam — just a simple account to unlock full access." />
                            <div style={{ width: 1, height: 24, background: "rgba(146, 20, 12, 0.1)", marginLeft: 22 }} />
                            <Step num="02" title="Search & filter events" desc="Use our powerful search and filters to narrow down to exactly what interests you — by date, platform, location, or keyword." />
                            <div style={{ width: 1, height: 24, background: "rgba(146, 20, 12, 0.1)", marginLeft: 22 }} />
                            <Step num="03" title="Save & attend" desc="Bookmark events to your planner and click through to register directly on the source platform." />
                        </div>
                    </div>

                    {/* Visual side */}
                    <div style={{ position: "relative" }}>
                        <div style={{
                            background: "#fff8f0", borderRadius: 20, overflow: "hidden",
                            boxShadow: "0 30px 60px -30px rgba(30, 30, 36, 0.3)",
                            border: "1px solid rgba(146, 20, 12, 0.1)",
                        }}>
                            {/* Mock UI top bar */}
                            <div style={{ background: "rgba(146, 20, 12, 0.05)", padding: "14px 20px", borderBottom: "1px solid rgba(146, 20, 12, 0.1)", display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#92140c", opacity: 0.5 }} />
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#1e1e24", opacity: 0.5 }} />
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#92140c", opacity: 0.5 }} />
                                <div style={{ flex: 1, background: "#fff8f0", borderRadius: 4, padding: "5px 12px", fontSize: 11, color: "#1e1e24", marginLeft: 8, border: "1px solid rgba(146, 20, 12, 0.1)", opacity: 0.8 }}>
                                    eventscraper.com/events
                                </div>
                            </div>

                            {/* Mock search bar */}
                            <div style={{ padding: "20px 20px 16px" }}>
                                <div style={{ background: "rgba(146, 20, 12, 0.05)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#1e1e24", display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(146, 20, 12, 0.1)" }}>
                                    🔍 Search events, platforms, locations...
                                </div>
                            </div>

                            {/* Mock filter chips */}
                            <div style={{ padding: "0 20px 16px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {["All", "Meetup", "Tech Events", "This week"].map((f, i) => (
                                    <div key={f} style={{
                                        padding: "4px 12px", borderRadius: 20,
                                        background: i === 0 ? "#92140c" : "transparent",
                                        color: i === 0 ? "#fff8f0" : "#1e1e24",
                                        fontSize: 11, fontWeight: 400,
                                        border: "1px solid",
                                        borderColor: i === 0 ? "#92140c" : "rgba(146, 20, 12, 0.2)",
                                        letterSpacing: "0.02em",
                                    }}>{f}</div>
                                ))}
                            </div>

                            {/* Mock event cards */}
                            {[
                                { title: "India SaaS Summit 2025", platform: "Meetup", color: "#92140c", loc: "Bengaluru, KA" },
                                { title: "React India Conf 2025", platform: "HasGeek", color: "#1e1e24", loc: "Pune, MH" },
                                { title: "VC Pitch Competition", platform: "Echai", color: "#92140c", loc: "Mumbai, MH" },
                            ].map((e, i) => (
                                <div key={i} style={{ margin: "0 20px 12px", background: "rgba(146, 20, 12, 0.02)", borderRadius: 10, padding: "12px", border: "1px solid rgba(146, 20, 12, 0.1)", display: "flex", gap: 12, alignItems: "center" }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 6, background: e.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 400, color: "#fff8f0", flexShrink: 0, fontFamily: "'Cormorant Garamond', serif" }}>
                                        {e.platform[0]}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 500, color: "#1e1e24", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Cormorant Garamond', serif", letterSpacing: "-0.01em" }}>{e.title}</div>
                                        <div style={{ fontSize: 10, color: "#1e1e24", opacity: 0.6, marginTop: 2 }}>📍 {e.loc}</div>
                                    </div>
                                    <div style={{ width: 20, height: 20, borderRadius: 4, background: "#fff8f0", border: "1px solid rgba(146, 20, 12, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0, color: "#92140c" }}>🔖</div>
                                </div>
                            ))}
                            <div style={{ height: 20 }} />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── PLATFORMS SECTION ── */}
            <section style={{ maxWidth: 1200, margin: "96px auto 0", padding: "0 24px" }}>
                <div style={{ textAlign: "center", marginBottom: 48 }}>
                    <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)", color: "#1e1e24", letterSpacing: "-0.02em", fontWeight: 500 }}>
                        We pull from the best sources
                    </h2>
                    <p style={{ fontSize: "0.85rem", color: "#1e1e24", marginTop: 12, opacity: 0.7, letterSpacing: "0.02em" }}>
                        Automatically updated every day.
                    </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 16 }}>
                    {PLATFORMS.map(p => (
                        <div key={p.name} style={{
                            background: "#fff8f0", borderRadius: 12, padding: "24px 12px",
                            textAlign: "center", border: "1px solid rgba(146, 20, 12, 0.1)",
                        }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 8,
                                background: `${p.color}08`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                margin: "0 auto 10px", fontSize: 18, fontWeight: 400, color: p.color,
                                fontFamily: "'Cormorant Garamond', serif",
                                border: `1px solid ${p.color}15`,
                            }}>
                                {p.icon}
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 400, color: "#1e1e24", letterSpacing: "0.02em" }}>{p.name}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CTA SECTION ── */}
            <section style={{ maxWidth: 1200, margin: "96px auto", padding: "0 24px" }}>
                <div style={{
                    background: "#fff8f0",
                    borderRadius: 24, padding: "72px 64px",
                    textAlign: "center", position: "relative", overflow: "hidden",
                    border: "1px solid rgba(146, 20, 12, 0.1)",
                }}>
                    {/* Decorative */}
                    <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(146, 20, 12, 0.03)", filter: "blur(40px)" }} />
                    <div style={{ position: "absolute", bottom: -40, left: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(30, 30, 36, 0.03)", filter: "blur(40px)" }} />

                    <div style={{ position: "relative", zIndex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 400, color: "#92140c", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 20 }}>
                            Start now — it's free
                        </div>
                        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(2rem, 3.5vw, 3rem)", color: "#1e1e24", letterSpacing: "-0.02em", marginBottom: 16, lineHeight: 1.15, fontWeight: 500 }}>
                            Never miss another<br />tech event in India
                        </h2>
                        <p style={{ fontSize: "0.9rem", color: "#1e1e24", maxWidth: 420, margin: "0 auto 40px", lineHeight: 1.8, opacity: 0.7, letterSpacing: "0.02em" }}>
                            Join hundreds of developers, founders, and tech professionals who use EventScraper to stay connected with India's tech community.
                        </p>
                        {isAuthed ? (
                            <Link to="/events" style={{
                                display: "inline-block", padding: "16px 40px", borderRadius: 40,
                                background: "#1e1e24",
                                color: "#fff8f0", fontSize: 14, fontWeight: 400,
                                textDecoration: "none", border: "1px solid #92140c",
                                letterSpacing: "0.05em",
                                transition: "all 0.3s",
                            }}
                                onMouseEnter={e => e.currentTarget.style.background = "#92140c"}
                                onMouseLeave={e => e.currentTarget.style.background = "#1e1e24"}>
                                Browse all events →
                            </Link>
                        ) : (
                            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                                <Link to="/signup" style={{
                                    display: "inline-block", padding: "16px 40px", borderRadius: 40,
                                    background: "#1e1e24",
                                    color: "#fff8f0", fontSize: 14, fontWeight: 400,
                                    textDecoration: "none", border: "1px solid #92140c",
                                    letterSpacing: "0.05em",
                                    transition: "all 0.3s",
                                }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#92140c"}
                                    onMouseLeave={e => e.currentTarget.style.background = "#1e1e24"}>
                                    Create free account →
                                </Link>
                                <Link to="/signin" style={{
                                    display: "inline-block", padding: "16px 32px", borderRadius: 40,
                                    background: "transparent",
                                    color: "#1e1e24", fontSize: 14, fontWeight: 400,
                                    textDecoration: "none", border: "1px solid rgba(146, 20, 12, 0.2)",
                                    letterSpacing: "0.02em",
                                }}>
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
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: "#1e1e24", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 400, color: "#fff8f0", border: "1px solid #92140c", fontFamily: "'Cormorant Garamond', serif" }}>E</div>
                        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1rem", fontWeight: 500, color: "#1e1e24" }}>EventScraper</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#1e1e24", opacity: 0.6, letterSpacing: "0.02em" }}>
                        © 2025 · India's Tech Event Hub
                    </div>
                    <div style={{ display: "flex", gap: 20 }}>
                        <Link to="/signin" style={{ fontSize: 11, color: "#1e1e24", textDecoration: "none", opacity: 0.6, letterSpacing: "0.02em" }}>Sign in</Link>
                        <Link to="/signup" style={{ fontSize: 11, color: "#1e1e24", textDecoration: "none", opacity: 0.6, letterSpacing: "0.02em" }}>Sign up</Link>
                    </div>
                </div>
            </footer>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px) rotate(var(--rotate, 0deg)); }
                    50% { transform: translateY(-8px) rotate(var(--rotate, 0deg)); }
                }
                @media (max-width: 768px) {
                    section > div[style*="grid-template-columns: 1fr 1fr"] {
                        grid-template-columns: 1fr !important;
                    }
                    section > div[style*="grid-template-columns: repeat(7"] {
                        grid-template-columns: repeat(4, 1fr) !important;
                    }
                    section > div[style*="grid-template-columns: repeat(4"] {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    section > div[style*="grid-template-columns: repeat(3"] {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    );
}