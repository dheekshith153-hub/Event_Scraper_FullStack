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

    const menuItemStyle = {
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 400,
        color: "#1e1e24", background: "transparent", border: "none",
        cursor: "pointer", textAlign: "left", transition: "all 0.2s",
        textDecoration: "none", letterSpacing: "0.02em",
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
                            color: "#1e1e24",
                            letterSpacing: "-0.02em",
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
                                    className="flex items-center gap-2 transition-all duration-300"
                                    style={{
                                        background: "transparent",
                                        border: "1px solid rgba(146, 20, 12, 0.2)",
                                        borderRadius: 40, padding: "4px 16px 4px 4px",
                                        cursor: "pointer",
                                    }}
                                >
                                    <div style={{
                                        width: 32, height: 32, borderRadius: "50%",
                                        background: "#1e1e24",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 12, fontWeight: 400, color: "#fff8f0",
                                        fontFamily: "'Cormorant Garamond', serif",
                                        border: "1px solid #92140c",
                                    }}>
                                        {initials}
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: 400, color: "#1e1e24", letterSpacing: "0.02em" }}>
                                        {user?.full_name?.split(" ")[0] || "Account"}
                                    </span>
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{
                                        opacity: 0.5,
                                        transform: dropdownOpen ? "rotate(180deg)" : "none",
                                        transition: "transform 0.3s",
                                        stroke: "#92140c"
                                    }}>
                                        <path d="M2 4l4 4 4-4" strokeWidth="1" strokeLinecap="round" />
                                    </svg>
                                </button>

                                {/* Dropdown */}
                                {dropdownOpen && (
                                    <div className="animate-fade-in" style={{
                                        position: "absolute", top: "calc(100% + 10px)", right: 0,
                                        background: "#fff8f0",
                                        borderRadius: 12,
                                        boxShadow: "0 20px 40px -20px rgba(30, 30, 36, 0.3), 0 0 0 1px rgba(146, 20, 12, 0.1)",
                                        minWidth: 220, overflow: "hidden",
                                    }}>
                                        {/* User info */}
                                        <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid rgba(146, 20, 12, 0.1)" }}>
                                            <div style={{ fontSize: 14, fontWeight: 500, color: "#1e1e24", fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.02em" }}>{user?.full_name}</div>
                                            <div style={{ fontSize: 11, color: "#92140c", marginTop: 3, opacity: 0.8 }}>{user?.email}</div>
                                        </div>

                                        {/* Menu items */}
                                        <div style={{ padding: "8px" }}>
                                            <button
                                                onClick={handleProfile}
                                                style={menuItemStyle}
                                                onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 20, 12, 0.05)"}
                                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                            >
                                                <span style={{ color: "#92140c" }}>👤</span> Profile
                                            </button>
                                            <button
                                                onClick={handleHelpCenter}
                                                style={menuItemStyle}
                                                onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 20, 12, 0.05)"}
                                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                            >
                                                <span style={{ color: "#92140c" }}>❓</span> Help Center
                                            </button>
                                        </div>

                                        {/* Logout */}
                                        <div style={{ padding: "8px", borderTop: "1px solid rgba(146, 20, 12, 0.1)" }}>
                                            <button
                                                onClick={handleSignout}
                                                style={{
                                                    ...menuItemStyle,
                                                    color: "#92140c",
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 20, 12, 0.05)"}
                                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                            >
                                                <span>🚪</span> Log out
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
        </>
    );
}