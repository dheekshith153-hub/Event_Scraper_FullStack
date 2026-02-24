import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Header() {
    const { isAuthed, user, signout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function handleSignout() {
        signout();
        setDropdownOpen(false);
        navigate("/welcome");
    }

    function handleProfile() {
        setDropdownOpen(false);
        navigate("/profile");
    }

    function handleHelpCenter() {
        setDropdownOpen(false);
        window.open("mailto:support@eventscraper.com?subject=Help Request", "_blank");
    }

    const isActive = (path) => location.pathname === path;

    const navLink = (to, label) => (
        <Link
            to={to}
            className="text-sm font-medium transition-all duration-300 relative group"
            style={{
                color: isActive(to) ? "#92140c" : "#1e1e24",
                padding: "4px 0",
                letterSpacing: "0.02em",
            }}
        >
            {label}
            <span
                className="absolute bottom-0 left-0 w-full h-px transform origin-left transition-transform duration-300"
                style={{
                    background: "#92140c",
                    transform: isActive(to) ? "scaleX(1)" : "scaleX(0)",
                }}
            />
        </Link>
    );

    const initials = user?.full_name
        ? user.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
        : "?";

    // ── SVG icons — no emojis ─────────────────────────────────────────────
    const IconProfile = () => (
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
    );

    const IconHelp = () => (
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
                d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
    );

    const IconLogout = () => (
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
        </svg>
    );

    const menuItemBase = {
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "9px 12px", borderRadius: 8, fontSize: 13, fontWeight: 400,
        background: "transparent", border: "none",
        cursor: "pointer", textAlign: "left", transition: "all 0.2s",
        textDecoration: "none", letterSpacing: "0.02em",
        fontFamily: "'Inter', sans-serif",
    };

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap" rel="stylesheet" />

            {/* Top announcement bar */}
            <div style={{
                background: "#92140c",
                textAlign: "center", padding: "10px 16px",
                fontSize: 13, fontWeight: 400, color: "#fff8f0",
                letterSpacing: "0.05em",
                fontFamily: "'Cormorant Garamond', serif",
                textTransform: "uppercase",
            }}>
                <span className="animate-pulse-subtle">✦</span> New events added daily — bookmark your favorites! <span className="animate-pulse-subtle">✦</span>
            </div>

            {/* Main nav */}
            <header style={{
                background: "#fff8f0",
                borderBottom: "1px solid rgba(146, 20, 12, 0.1)",
                position: "sticky", top: 0, zIndex: 99,
            }}>
                <div style={{
                    maxWidth: 1200, margin: "0 auto", padding: "0 24px",
                    height: 72, display: "flex", alignItems: "center", justifyContent: "space-between",
                    fontFamily: "'Inter', sans-serif",
                }}>
                    {/* Logo */}
                    <Link to={isAuthed ? "/events" : "/welcome"} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 8,
                            background: "#1e1e24",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 400, fontSize: 20, color: "#fff8f0",
                            fontFamily: "'Cormorant Garamond', serif",
                            border: "1px solid #92140c",
                        }}>E</div>
                        <span style={{
                            fontFamily: "'Cormorant Garamond', serif",
                            fontSize: "1.3rem", fontWeight: 500,
                            color: "#1e1e24", letterSpacing: "-0.02em",
                        }}>EventScraper</span>
                    </Link>

                    {/* Nav links */}
                    <nav style={{ display: "flex", alignItems: "center", gap: 36 }}>
                        {navLink("/welcome", "Home")}
                        {isAuthed && navLink("/events", "Browse Events")}
                        {isAuthed && navLink("/saved", "Saved")}
                    </nav>

                    {/* Auth area */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {isAuthed ? (
                            <div ref={dropdownRef} style={{ position: "relative" }}>
                                {/* Avatar button */}
                                <button
                                    onClick={() => setDropdownOpen(o => !o)}
                                    style={{
                                        background: dropdownOpen ? "rgba(146,20,12,0.06)" : "transparent",
                                        border: "1px solid",
                                        borderColor: dropdownOpen ? "#92140c" : "rgba(146, 20, 12, 0.2)",
                                        borderRadius: 40, padding: "4px 14px 4px 4px",
                                        cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                                        transition: "all 0.25s",
                                    }}
                                    onMouseEnter={e => {
                                        if (!dropdownOpen) {
                                            e.currentTarget.style.borderColor = "#92140c";
                                            e.currentTarget.style.background = "rgba(146,20,12,0.04)";
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!dropdownOpen) {
                                            e.currentTarget.style.borderColor = "rgba(146,20,12,0.2)";
                                            e.currentTarget.style.background = "transparent";
                                        }
                                    }}
                                >
                                    <div style={{
                                        width: 32, height: 32, borderRadius: "50%",
                                        background: "#1e1e24",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 12, fontWeight: 600, color: "#fff8f0",
                                        fontFamily: "'Cormorant Garamond', serif",
                                        letterSpacing: "0.05em",
                                        flexShrink: 0,
                                    }}>
                                        {initials}
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: 400, color: "#1e1e24", letterSpacing: "0.02em" }}>
                                        {user?.full_name?.split(" ")[0] || "Account"}
                                    </span>
                                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{
                                        opacity: 0.45,
                                        transform: dropdownOpen ? "rotate(180deg)" : "none",
                                        transition: "transform 0.3s",
                                        stroke: "#1e1e24",
                                        flexShrink: 0,
                                    }}>
                                        <path d="M2 4l4 4 4-4" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                </button>

                                {/* Dropdown */}
                                {dropdownOpen && (
                                    <div style={{
                                        position: "absolute", top: "calc(100% + 10px)", right: 0,
                                        background: "#fff8f0",
                                        borderRadius: 14,
                                        boxShadow: "0 24px 48px -16px rgba(30,30,36,0.25), 0 0 0 1px rgba(146,20,12,0.12)",
                                        minWidth: 240, overflow: "hidden",
                                        animation: "fadeSlideDown 0.18s ease",
                                    }}>

                                        {/* ── User identity block ── */}
                                        <div style={{
                                            padding: "20px 18px 16px",
                                            borderBottom: "1px solid rgba(146,20,12,0.08)",
                                            display: "flex", alignItems: "center", gap: 14,
                                        }}>
                                            {/* Large avatar */}
                                            <div style={{
                                                width: 44, height: 44, borderRadius: "50%",
                                                background: "#1e1e24",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: 16, fontWeight: 600, color: "#fff8f0",
                                                fontFamily: "'Cormorant Garamond', serif",
                                                letterSpacing: "0.05em",
                                                border: "1.5px solid #92140c",
                                                flexShrink: 0,
                                            }}>
                                                {initials}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{
                                                    fontSize: 14, fontWeight: 500,
                                                    color: "#1e1e24",
                                                    fontFamily: "'Cormorant Garamond', serif",
                                                    letterSpacing: "0.01em",
                                                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                                }}>
                                                    {user?.full_name}
                                                </div>
                                                <div style={{
                                                    fontSize: 11, color: "#92140c",
                                                    marginTop: 3, opacity: 0.75,
                                                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                                    letterSpacing: "0.01em",
                                                }}>
                                                    {user?.email}
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── Menu items ── */}
                                        <div style={{ padding: "8px" }}>
                                            <button
                                                onClick={handleProfile}
                                                style={{ ...menuItemBase, color: "#1e1e24" }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.background = "rgba(146,20,12,0.06)";
                                                    e.currentTarget.style.color = "#92140c";
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.background = "transparent";
                                                    e.currentTarget.style.color = "#1e1e24";
                                                }}
                                            >
                                                <span style={{ color: "#92140c", opacity: 0.8, flexShrink: 0 }}><IconProfile /></span>
                                                Profile
                                            </button>

                                            <button
                                                onClick={handleHelpCenter}
                                                style={{ ...menuItemBase, color: "#1e1e24" }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.background = "rgba(146,20,12,0.06)";
                                                    e.currentTarget.style.color = "#92140c";
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.background = "transparent";
                                                    e.currentTarget.style.color = "#1e1e24";
                                                }}
                                            >
                                                <span style={{ color: "#92140c", opacity: 0.8, flexShrink: 0 }}><IconHelp /></span>
                                                Help Center
                                            </button>
                                        </div>

                                        {/* ── Logout ── */}
                                        <div style={{ padding: "8px", borderTop: "1px solid rgba(146,20,12,0.08)" }}>
                                            <button
                                                onClick={handleSignout}
                                                style={{ ...menuItemBase, color: "#92140c" }}
                                                onMouseEnter={e => e.currentTarget.style.background = "rgba(146,20,12,0.06)"}
                                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                            >
                                                <span style={{ flexShrink: 0 }}><IconLogout /></span>
                                                Log out
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <Link to="/signin" style={{
                                    fontSize: 13, fontWeight: 400,
                                    color: "#1e1e24", textDecoration: "none",
                                    padding: "8px 16px", transition: "color 0.3s",
                                    letterSpacing: "0.02em",
                                }}
                                    onMouseEnter={e => e.currentTarget.style.color = "#92140c"}
                                    onMouseLeave={e => e.currentTarget.style.color = "#1e1e24"}
                                >
                                    Sign in
                                </Link>
                                <Link to="/signup" style={{
                                    fontSize: 13, fontWeight: 400,
                                    color: "#fff8f0", textDecoration: "none",
                                    padding: "10px 24px", borderRadius: 40,
                                    background: "#1e1e24",
                                    border: "1px solid #92140c",
                                    letterSpacing: "0.05em",
                                    transition: "all 0.3s",
                                }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = "#92140c";
                                        e.currentTarget.style.transform = "translateY(-1px)";
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = "#1e1e24";
                                        e.currentTarget.style.transform = "translateY(0)";
                                    }}
                                >
                                    Get started
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Dropdown animation */}
            <style>{`
                @keyframes fadeSlideDown {
                    from { opacity: 0; transform: translateY(-6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </>
    );
}
