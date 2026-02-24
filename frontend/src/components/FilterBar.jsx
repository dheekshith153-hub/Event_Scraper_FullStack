import { useState } from "react";
import DateRangePicker from "./DateRangePicker";

function LocationIcon({ color }) {
    return (
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );
}

function DropdownFilter({ label, options, value, onChange }) {
    const [open, setOpen] = useState(false);
    const isActive = !!value;
    const iconColor = isActive ? "#fff8f0" : "#1e1e24";

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(o => !o)}
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
                <LocationIcon color={iconColor} />
                <span>{isActive ? value : label}</span>
                {isActive ? (
                    <span
                        onClick={e => { e.stopPropagation(); onChange(""); setOpen(false); }}
                        style={{ display: "flex", alignItems: "center", marginLeft: 2, opacity: 0.8, cursor: "pointer" }}
                    >
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </span>
                ) : (
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
                        style={{ opacity: 0.5 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                )}
            </button>

            {open && (
                <div
                    style={{
                        position: "absolute",
                        top: "calc(100% + 10px)",
                        left: 0,
                        zIndex: 1000,
                        background: "#fff8f0",
                        border: "1px solid rgba(146,20,12,0.15)",
                        borderRadius: 16,
                        boxShadow: "0 24px 60px -20px rgba(30,30,36,0.25), 0 0 0 1px rgba(146,20,12,0.08)",
                        minWidth: 200,
                        maxHeight: 260,
                        overflowY: "auto",
                        fontFamily: "'Inter', sans-serif",
                        animation: "locFadeIn 0.15s ease",
                    }}
                >
                    <style>{`
                        @keyframes locFadeIn {
                            from { opacity: 0; transform: translateY(-5px); }
                            to   { opacity: 1; transform: translateY(0); }
                        }
                        .loc-option:hover { background: rgba(146,20,12,0.05) !important; }
                    `}</style>

                    {/* Header */}
                    <div style={{
                        padding: "12px 16px 8px",
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                        color: "#92140c",
                        opacity: 0.7,
                        textTransform: "uppercase",
                        borderBottom: "1px solid rgba(146,20,12,0.08)",
                    }}>
                        Select Location
                    </div>

                    {/* All option */}
                    <button
                        className="loc-option"
                        onClick={() => { onChange(""); setOpen(false); }}
                        style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "10px 16px",
                            fontSize: 13,
                            color: !value ? "#92140c" : "#1e1e24",
                            fontWeight: !value ? 500 : 400,
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            letterSpacing: "0.02em",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            borderBottom: "1px solid rgba(146,20,12,0.06)",
                        }}
                    >
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24"
                            stroke={!value ? "#92140c" : "rgba(30,30,36,0.35)"} strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                        </svg>
                        All Locations
                    </button>

                    {/* Location options */}
                    {options.map(opt => (
                        <button
                            key={opt}
                            className="loc-option"
                            onClick={() => { onChange(opt); setOpen(false); }}
                            style={{
                                width: "100%",
                                textAlign: "left",
                                padding: "10px 16px",
                                fontSize: 13,
                                color: value === opt ? "#92140c" : "#1e1e24",
                                fontWeight: value === opt ? 500 : 400,
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                letterSpacing: "0.02em",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24"
                                stroke={value === opt ? "#92140c" : "rgba(30,30,36,0.3)"} strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {opt}
                        </button>
                    ))}
                </div>
            )}

            {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
        </div>
    );
}

export default function FilterBar({ filters = {}, onChange, locations = [], onClear, hasFilters }) {
    const f = { location: "", dateFrom: "", dateTo: "", ...filters };
    const update = (key, val) => onChange(prev => ({ ...prev, [key]: val }));

    const handleDateChange = ({ dateFrom, dateTo }) => {
        onChange(prev => ({ ...prev, dateFrom, dateTo }));
    };

    return (
        <div className="flex flex-wrap items-center gap-2 mb-8">
            <DropdownFilter
                label="Location"
                options={locations}
                value={f.location}
                onChange={v => update("location", v)}
            />

            <DateRangePicker
                dateFrom={f.dateFrom}
                dateTo={f.dateTo}
                onChange={handleDateChange}
            />

            {hasFilters && (
                <button
                    onClick={onClear}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 16px",
                        borderRadius: 999,
                        border: "1px solid rgba(146,20,12,0.2)",
                        background: "transparent",
                        color: "#1e1e24",
                        fontSize: 13,
                        fontWeight: 500,
                        letterSpacing: "0.02em",
                        cursor: "pointer",
                        fontFamily: "'Inter', sans-serif",
                        transition: "all 0.2s",
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(146,20,12,0.05)";
                        e.currentTarget.style.color = "#92140c";
                        e.currentTarget.style.borderColor = "rgba(146,20,12,0.4)";
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#1e1e24";
                        e.currentTarget.style.borderColor = "rgba(146,20,12,0.2)";
                    }}
                >
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear filters
                </button>
            )}
        </div>
    );
}
