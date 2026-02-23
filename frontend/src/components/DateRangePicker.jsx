import { useState, useRef, useEffect } from "react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseDate(str) {
    if (!str) return null;
    const [y, m, d] = str.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

function toDateStr(date) {
    if (!date) return "";
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function isSameDay(a, b) {
    if (!a || !b) return false;
    return a.getUTCFullYear() === b.getUTCFullYear() &&
        a.getUTCMonth() === b.getUTCMonth() &&
        a.getUTCDate() === b.getUTCDate();
}

function isBetween(date, from, to) {
    if (!date || !from || !to) return false;
    return date > from && date < to;
}

function getDaysInMonth(year, month) {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function getFirstDayOfMonth(year, month) {
    return new Date(Date.UTC(year, month, 1)).getUTCDay();
}

function formatDisplay(str) {
    if (!str) return null;
    const d = parseDate(str);
    if (!d) return null;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const navBtnStyle = {
    width: 30,
    height: 30,
    borderRadius: "50%",
    border: "1px solid rgba(146,20,12,0.2)",
    background: "transparent",
    color: "#1e1e24",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s",
};

export default function DateRangePicker({ dateFrom = "", dateTo = "", onChange }) {
    const [open, setOpen] = useState(false);
    const [hovered, setHovered] = useState(null);
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [selecting, setSelecting] = useState(null);
    const ref = useRef();

    const fromDate = parseDate(dateFrom);
    const toDate = parseDate(dateTo);
    const isActive = !!(dateFrom || dateTo);

    useEffect(() => {
        function handleClick(e) {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
                setSelecting(null);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    const handleDayClick = (date) => {
        if (!selecting || selecting === "from") {
            onChange({ dateFrom: toDateStr(date), dateTo: "" });
            setSelecting("to");
        } else {
            if (fromDate && date < fromDate) {
                onChange({ dateFrom: toDateStr(date), dateTo: dateFrom });
            } else {
                onChange({ dateFrom, dateTo: toDateStr(date) });
            }
            setSelecting(null);
            setOpen(false);
        }
    };

    const clear = (e) => {
        e.stopPropagation();
        onChange({ dateFrom: "", dateTo: "" });
        setSelecting(null);
    };

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(Date.UTC(viewYear, viewMonth, d)));

    const effectiveTo = selecting === "to" && hovered ? hovered : toDate;

    let triggerLabel;
    if (dateFrom && dateTo) {
        triggerLabel = `${formatDisplay(dateFrom)} — ${formatDisplay(dateTo)}`;
    } else if (dateFrom) {
        triggerLabel = `From ${formatDisplay(dateFrom)}`;
    } else if (dateTo) {
        triggerLabel = `Until ${formatDisplay(dateTo)}`;
    } else {
        triggerLabel = null;
    }

    function quickSelect(preset) {
        const now = new Date();
        let from, to;
        if (preset === "week") {
            const day = now.getDay();
            from = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - day));
            to = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - day + 6));
        } else if (preset === "month") {
            from = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
            to = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
        } else if (preset === "30days") {
            from = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
            to = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 30));
        }
        onChange({ dateFrom: toDateStr(from), dateTo: toDateStr(to) });
        setSelecting(null);
        setOpen(false);
    }

    return (
        <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
            {/* Trigger */}
            <button
                onClick={() => { setOpen(o => !o); if (!open) setSelecting("from"); }}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "8px 16px",
                    borderRadius: 999,
                    border: `1px solid ${isActive ? "#92140c" : "rgba(146,20,12,0.2)"}`,
                    background: isActive ? "#92140c" : "transparent",
                    color: isActive ? "#fff8f0" : "#1e1e24",
                    fontSize: 13,
                    fontWeight: 500,
                    letterSpacing: "0.02em",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    fontFamily: "'Inter', sans-serif",
                    transition: "all 0.2s",
                }}
            >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{triggerLabel || "Date"}</span>
                {isActive ? (
                    <span onClick={clear} style={{ display: "flex", alignItems: "center", marginLeft: 2, opacity: 0.8, cursor: "pointer" }}>
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </span>
                ) : (
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ opacity: 0.5 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div style={{
                    position: "absolute",
                    top: "calc(100% + 10px)",
                    left: 0,
                    zIndex: 1000,
                    background: "#fff8f0",
                    border: "1px solid rgba(146,20,12,0.15)",
                    borderRadius: 20,
                    boxShadow: "0 24px 60px -20px rgba(30,30,36,0.35), 0 0 0 1px rgba(146,20,12,0.08)",
                    padding: "20px 20px 16px",
                    width: 300,
                    fontFamily: "'Inter', sans-serif",
                    animation: "calFadeIn 0.18s ease",
                }}>
                    <style>{`
                        @keyframes calFadeIn {
                            from { opacity: 0; transform: translateY(-6px); }
                            to   { opacity: 1; transform: translateY(0); }
                        }
                    `}</style>

                    {/* Hint */}
                    <div style={{
                        fontSize: 11, fontWeight: 600, letterSpacing: "0.1em",
                        color: "#92140c", opacity: 0.7, marginBottom: 14,
                        textTransform: "uppercase", textAlign: "center",
                    }}>
                        {selecting === "to" ? "Select end date" : "Select start date"}
                    </div>

                    {/* Month nav */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                        <button onClick={prevMonth} style={navBtnStyle}>
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div style={{ textAlign: "center" }}>
                            <div style={{
                                fontFamily: "'Cormorant Garamond', serif",
                                fontSize: "1.25rem", fontWeight: 600,
                                color: "#1e1e24", letterSpacing: "-0.01em", lineHeight: 1,
                            }}>
                                {MONTHS[viewMonth]}
                            </div>
                            <div style={{ fontSize: 11, color: "#1e1e24", opacity: 0.4, marginTop: 2, letterSpacing: "0.05em" }}>
                                {viewYear}
                            </div>
                        </div>
                        <button onClick={nextMonth} style={navBtnStyle}>
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    {/* Day headers */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
                        {DAYS.map(d => (
                            <div key={d} style={{
                                textAlign: "center", fontSize: 10, fontWeight: 600,
                                letterSpacing: "0.08em", color: "#1e1e24", opacity: 0.35, paddingBottom: 6,
                            }}>{d}</div>
                        ))}
                    </div>

                    {/* Day grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px 0" }}>
                        {cells.map((date, i) => {
                            if (!date) return <div key={`empty-${i}`} />;

                            const isFrom = isSameDay(date, fromDate);
                            const isTo = isSameDay(date, effectiveTo);
                            const inRange = isBetween(date, fromDate, effectiveTo);
                            const isToday = isSameDay(date, new Date());
                            const col = i % 7;

                            let bg = "transparent";
                            let color = "#1e1e24";
                            let fw = 400;
                            let cellBg = "transparent";
                            let cellRadius = {};

                            if (isFrom || isTo) {
                                bg = "#92140c";
                                color = "#fff8f0";
                                fw = 600;
                            }
                            if (inRange) {
                                cellBg = "rgba(146,20,12,0.08)";
                                color = "#92140c";
                                fw = 500;
                                if (col === 0) cellRadius = { borderRadius: "50% 0 0 50%" };
                                else if (col === 6) cellRadius = { borderRadius: "0 50% 50% 0" };
                                else cellRadius = { borderRadius: 0 };
                            }

                            return (
                                <div key={toDateStr(date)} style={{ background: cellBg, ...cellRadius, display: "flex", alignItems: "center", justifyContent: "center", height: 34 }}>
                                    <button
                                        onClick={() => handleDayClick(date)}
                                        onMouseEnter={() => { if (selecting === "to") setHovered(date); }}
                                        onMouseLeave={() => setHovered(null)}
                                        style={{
                                            width: 30, height: 30, borderRadius: "50%",
                                            background: bg, color, fontWeight: fw,
                                            fontSize: 12.5,
                                            border: isToday && !isFrom && !isTo ? "1px solid rgba(146,20,12,0.35)" : "1px solid transparent",
                                            cursor: "pointer", transition: "all 0.15s",
                                            fontFamily: "'Inter', sans-serif",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            position: "relative", zIndex: 1,
                                        }}
                                        onMouseEnterCapture={e => { if (!isFrom && !isTo) e.currentTarget.style.background = "rgba(146,20,12,0.1)"; }}
                                        onMouseLeaveCapture={e => { if (!isFrom && !isTo) e.currentTarget.style.background = bg; }}
                                    >
                                        {date.getUTCDate()}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Selected range summary */}
                    {(dateFrom || dateTo) && (
                        <div style={{
                            marginTop: 14, paddingTop: 14,
                            borderTop: "1px solid rgba(146,20,12,0.1)",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                        }}>
                            <div style={{ fontSize: 11, color: "#1e1e24", opacity: 0.6 }}>
                                {dateFrom && <span><span style={{ opacity: 0.5 }}>From </span><span style={{ color: "#92140c", fontWeight: 500 }}>{formatDisplay(dateFrom)}</span></span>}
                                {dateFrom && dateTo && <span style={{ opacity: 0.4 }}> → </span>}
                                {dateTo && <span>{!dateFrom && <span style={{ opacity: 0.5 }}>Until </span>}<span style={{ color: "#92140c", fontWeight: 500 }}>{formatDisplay(dateTo)}</span></span>}
                            </div>
                            <button onClick={clear} style={{
                                fontSize: 11, color: "#1e1e24", opacity: 0.45,
                                background: "none", border: "none", cursor: "pointer",
                                padding: "2px 6px", borderRadius: 6,
                                fontFamily: "'Inter', sans-serif", letterSpacing: "0.02em",
                            }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = "#92140c"; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = 0.45; e.currentTarget.style.color = "#1e1e24"; }}
                            >
                                Clear
                            </button>
                        </div>
                    )}

                    {/* Quick shortcuts */}
                    <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {[
                            { label: "This week", preset: "week" },
                            { label: "This month", preset: "month" },
                            { label: "Next 30 days", preset: "30days" },
                        ].map(({ label, preset }) => (
                            <button key={preset} onClick={() => quickSelect(preset)} style={{
                                fontSize: 11, padding: "4px 10px", borderRadius: 20,
                                border: "1px solid rgba(146,20,12,0.2)",
                                background: "transparent", color: "#1e1e24",
                                cursor: "pointer", fontFamily: "'Inter', sans-serif",
                                letterSpacing: "0.02em", transition: "all 0.15s",
                            }}
                                onMouseEnter={e => { e.currentTarget.style.background = "#92140c"; e.currentTarget.style.color = "#fff8f0"; e.currentTarget.style.borderColor = "#92140c"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#1e1e24"; e.currentTarget.style.borderColor = "rgba(146,20,12,0.2)"; }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
