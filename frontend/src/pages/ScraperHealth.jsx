import { useState, useEffect } from "react";
import Header from "../components/Header";

const API_BASE_URL = "";

export default function ScraperHealth() {
    const [scrapers, setScrapers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedScraper, setExpandedScraper] = useState(null);

    useEffect(() => {
        fetchHealth();
    }, []);

    async function fetchHealth() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/scraper-health`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setScrapers(data.scrapers || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    function getStatusColor(success) {
        return success ? "#10b981" : "#ef4444";
    }

    function getSuccessRateColor(rate) {
        if (rate >= 90) return "#10b981";
        if (rate >= 70) return "#f59e0b";
        return "#ef4444";
    }

    function formatDuration(secs) {
        if (secs < 60) return `${secs.toFixed(1)}s`;
        return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
    }

    const overallHealth = scrapers.length > 0
        ? scrapers.filter(s => s.last_success).length / scrapers.length * 100
        : 0;

    return (
        <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0c0f1a 0%, #1a1f35 50%, #0d1117 100%)" }}>
            <Header />
            <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
                    <div>
                        <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 700, margin: 0, fontFamily: "'Inter', sans-serif" }}>
                            Scraper Health Dashboard
                        </h1>
                        <p style={{ color: "#94a3b8", fontSize: 14, margin: "4px 0 0", fontFamily: "'Inter', sans-serif" }}>
                            Monitor scraper performance and diagnose failures
                        </p>
                    </div>
                    <button
                        onClick={fetchHealth}
                        style={{
                            background: "linear-gradient(135deg, #6366f1, #818cf8)",
                            color: "#fff",
                            border: "none",
                            borderRadius: 10,
                            padding: "10px 20px",
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "'Inter', sans-serif",
                            transition: "transform 0.15s",
                        }}
                        onMouseEnter={e => e.target.style.transform = "scale(1.05)"}
                        onMouseLeave={e => e.target.style.transform = "scale(1)"}
                    >
                        Refresh
                    </button>
                </div>

                {/* Overall Health */}
                <div style={{
                    background: "rgba(255,255,255,0.05)",
                    backdropFilter: "blur(20px)",
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.08)",
                    padding: 24,
                    marginBottom: 24,
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: "50%",
                        background: `conic-gradient(${getSuccessRateColor(overallHealth)} ${overallHealth * 3.6}deg, rgba(255,255,255,0.1) 0deg)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: "50%",
                            background: "#1a1f35",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: getSuccessRateColor(overallHealth),
                            fontWeight: 700, fontSize: 16, fontFamily: "'Inter', sans-serif",
                        }}>
                            {Math.round(overallHealth)}%
                        </div>
                    </div>
                    <div>
                        <div style={{ color: "#fff", fontSize: 18, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
                            System Health
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: 14, fontFamily: "'Inter', sans-serif" }}>
                            {scrapers.filter(s => s.last_success).length} of {scrapers.length} scrapers operational
                        </div>
                    </div>
                </div>

                {/* Loading / Error */}
                {loading && (
                    <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontFamily: "'Inter', sans-serif" }}>
                        Loading health data...
                    </div>
                )}
                {error && (
                    <div style={{
                        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                        borderRadius: 12, padding: 16, marginBottom: 24, color: "#f87171",
                        fontFamily: "'Inter', sans-serif",
                    }}>
                        Error: {error}
                    </div>
                )}

                {/* No data */}
                {!loading && !error && scrapers.length === 0 && (
                    <div style={{
                        background: "rgba(255,255,255,0.03)", borderRadius: 16,
                        border: "1px solid rgba(255,255,255,0.06)", padding: 48,
                        textAlign: "center", color: "#64748b", fontFamily: "'Inter', sans-serif",
                    }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: "#94a3b8" }}>
                            No scraper data yet
                        </div>
                        <div style={{ fontSize: 14 }}>
                            Health data will appear here once the scrapers have been run at least once.
                        </div>
                    </div>
                )}

                {/* Scraper Cards */}
                {!loading && scrapers.map(scraper => (
                    <div
                        key={scraper.name}
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            backdropFilter: "blur(16px)",
                            borderRadius: 14,
                            border: `1px solid ${scraper.last_success ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.2)"}`,
                            marginBottom: 16,
                            overflow: "hidden",
                            transition: "border-color 0.2s",
                        }}
                    >
                        {/* Scraper Header */}
                        <div
                            onClick={() => setExpandedScraper(expandedScraper === scraper.name ? null : scraper.name)}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "16px 20px", cursor: "pointer",
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                {/* Status indicator */}
                                <div style={{
                                    width: 10, height: 10, borderRadius: "50%",
                                    background: getStatusColor(scraper.last_success),
                                    boxShadow: `0 0 8px ${getStatusColor(scraper.last_success)}40`,
                                }} />
                                <div>
                                    <div style={{ color: "#fff", fontSize: 16, fontWeight: 600, fontFamily: "'Inter', sans-serif", textTransform: "capitalize" }}>
                                        {scraper.name}
                                    </div>
                                    <div style={{ color: "#64748b", fontSize: 12, fontFamily: "'Inter', sans-serif" }}>
                                        Last run: {scraper.last_run || "Never"}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                                {/* Success rate badge */}
                                <div style={{
                                    background: `${getSuccessRateColor(scraper.success_rate)}20`,
                                    color: getSuccessRateColor(scraper.success_rate),
                                    padding: "4px 10px", borderRadius: 6,
                                    fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif",
                                }}>
                                    {scraper.success_rate.toFixed(0)}% success
                                </div>

                                {/* Last run events */}
                                {scraper.recent_runs && scraper.recent_runs.length > 0 && (
                                    <div style={{ color: "#94a3b8", fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
                                        {scraper.recent_runs[0].events_found} events
                                    </div>
                                )}

                                {/* Expand arrow */}
                                <div style={{
                                    color: "#64748b", fontSize: 16, transition: "transform 0.2s",
                                    transform: expandedScraper === scraper.name ? "rotate(180deg)" : "rotate(0)",
                                }}>
                                    ▼
                                </div>
                            </div>
                        </div>

                        {/* Expanded: Recent Runs */}
                        {expandedScraper === scraper.name && scraper.recent_runs && (
                            <div style={{ padding: "0 20px 16px" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                                            {["Status", "Time", "Events", "Filtered", "Duration", "Error"].map(h => (
                                                <th key={h} style={{
                                                    color: "#64748b", fontSize: 11, fontWeight: 600,
                                                    textTransform: "uppercase", letterSpacing: "0.05em",
                                                    padding: "8px 8px", textAlign: "left",
                                                    fontFamily: "'Inter', sans-serif",
                                                }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scraper.recent_runs.map((run, i) => (
                                            <tr key={run.id || i} style={{
                                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                            }}>
                                                <td style={{
                                                    padding: "10px 8px", fontSize: 13,
                                                    fontFamily: "'Inter', sans-serif",
                                                }}>
                                                    <span style={{
                                                        display: "inline-block", width: 8, height: 8,
                                                        borderRadius: "50%", marginRight: 6,
                                                        background: getStatusColor(run.success),
                                                    }} />
                                                    <span style={{ color: run.success ? "#10b981" : "#ef4444" }}>
                                                        {run.success ? "OK" : "FAIL"}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "10px 8px", color: "#94a3b8", fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
                                                    {run.run_at}
                                                </td>
                                                <td style={{ padding: "10px 8px", color: "#fff", fontSize: 13, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
                                                    {run.events_found}
                                                </td>
                                                <td style={{ padding: "10px 8px", color: "#94a3b8", fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
                                                    {run.events_filtered}
                                                </td>
                                                <td style={{ padding: "10px 8px", color: "#94a3b8", fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
                                                    {formatDuration(run.duration_seconds)}
                                                </td>
                                                <td style={{
                                                    padding: "10px 8px", color: run.error_message ? "#f87171" : "#64748b",
                                                    fontSize: 12, fontFamily: "'Inter', sans-serif",
                                                    maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                                    title={run.error_message || "—"}
                                                >
                                                    {run.error_message || "—"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
