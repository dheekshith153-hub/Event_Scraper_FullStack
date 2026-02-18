import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function LoginGate() {
    return (
        <div style={{
            minHeight: "100vh", background: "#faf8f5",
            fontFamily: "'DM Sans', sans-serif",
            display: "flex", flexDirection: "column",
        }}>
            <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />

            {/* Simple header */}
            <header style={{
                background: "linear-gradient(135deg, #1f0d10, #2d1118, #1a0d1a)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
                <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 62, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Link to="/welcome" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #e8305a, #ff6b35)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, color: "white" }}>E</div>
                        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.15rem", color: "white" }}>EventScraper</span>
                    </Link>
                    <div style={{ display: "flex", gap: 10 }}>
                        <Link to="/signin" style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.75)", textDecoration: "none", padding: "8px 14px" }}>Sign in</Link>
                        <Link to="/signup" style={{ fontSize: 13, fontWeight: 700, color: "white", textDecoration: "none", padding: "8px 20px", borderRadius: 40, background: "linear-gradient(135deg, #e8305a, #ff6b35)" }}>Get started →</Link>
                    </div>
                </div>
            </header>

            {/* Gate content */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
                <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
                    {/* Lock icon */}
                    <div style={{
                        width: 80, height: 80, borderRadius: 24,
                        background: "linear-gradient(135deg, #fff0f3, #ffe8e0)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 36, margin: "0 auto 28px",
                        border: "1.5px solid #ffd0da",
                    }}>
                        🔐
                    </div>

                    <h1 style={{
                        fontFamily: "'DM Serif Display', serif",
                        fontSize: "2rem", color: "#1a1a1a",
                        letterSpacing: "-0.03em", marginBottom: 14,
                    }}>
                        Sign in to browse events
                    </h1>
                    <p style={{ fontSize: "0.95rem", color: "#666", lineHeight: 1.7, marginBottom: 36, maxWidth: 380, margin: "0 auto 36px" }}>
                        Create a free account or sign in to unlock access to 500+ events from 7 platforms across Bangalore.
                    </p>

                    <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 40 }}>
                        <Link to="/signup" style={{
                            padding: "13px 32px", borderRadius: 40, fontSize: 14, fontWeight: 700,
                            background: "linear-gradient(135deg, #e8305a, #ff6b35)",
                            color: "white", textDecoration: "none",
                            boxShadow: "0 8px 24px rgba(232,48,90,0.3)",
                        }}>
                            Create free account →
                        </Link>
                        <Link to="/signin" style={{
                            padding: "13px 28px", borderRadius: 40, fontSize: 14, fontWeight: 600,
                            background: "white", border: "1.5px solid #ede9e4",
                            color: "#333", textDecoration: "none",
                        }}>
                            Sign in
                        </Link>
                    </div>

                    {/* Preview teaser */}
                    <div style={{ background: "white", borderRadius: 20, padding: 24, border: "1px solid #ede9e4", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>
                            What you'll get access to
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, textAlign: "left" }}>
                            {[
                                { icon: "🔍", label: "Search 500+ events" },
                                { icon: "🎯", label: "Filter by platform & date" },
                                { icon: "🔖", label: "Save to your planner" },
                                { icon: "⚡", label: "Daily fresh updates" },
                            ].map(f => (
                                <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#444", fontWeight: 500 }}>
                                    <span style={{ fontSize: 16 }}>{f.icon}</span> {f.label}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ProtectedRoute({ redirectTo = "/signin" }) {
    const { isAuthed, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div style={{
                minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
                background: "#faf8f5",
            }}>
                <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    border: "3px solid #fde0e7", borderTopColor: "#e8305a",
                    animation: "spin 0.8s linear infinite",
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // Show beautiful gate page instead of just redirecting
    if (!isAuthed) {
        return <LoginGate />;
    }

    return <Outlet />;
}
