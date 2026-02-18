import { useState } from "react";

function FilterPill({ label, active, onClick, children }) {
    return (
        <button
            onClick={onClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap"
            style={{
                background: active ? "#92140c" : "transparent",
                color: active ? "#fff8f0" : "#1e1e24",
                border: "1px solid",
                borderColor: active ? "#92140c" : "rgba(146, 20, 12, 0.2)",
                letterSpacing: "0.02em",
            }}
        >
            {children || label}
            {active && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
            )}
        </button>
    );
}

function DropdownFilter({ label, icon, options, value, onChange, renderLabel }) {
    const [open, setOpen] = useState(false);
    const isActive = !!value;

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300"
                style={{
                    background: isActive ? "#92140c" : "transparent",
                    color: isActive ? "#fff8f0" : "#1e1e24",
                    border: "1px solid",
                    borderColor: isActive ? "#92140c" : "rgba(146, 20, 12, 0.2)",
                    letterSpacing: "0.02em",
                }}
            >
                {icon && <span>{icon}</span>}
                <span>{isActive ? (renderLabel ? renderLabel(value) : value) : label}</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: isActive ? "#fff8f0" : "#92140c" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div
                    className="absolute top-full left-0 mt-2 rounded-xl overflow-hidden z-50 min-w-[160px] animate-fade-in"
                    style={{
                        background: "#fff8f0",
                        boxShadow: "0 20px 40px -20px rgba(30, 30, 36, 0.3), 0 0 0 1px rgba(146, 20, 12, 0.1)",
                    }}
                >
                    <button
                        onClick={() => { onChange(""); setOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                        style={{ color: "#1e1e24", borderBottom: "1px solid rgba(146, 20, 12, 0.1)", letterSpacing: "0.02em" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 20, 12, 0.05)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                        All {label}
                    </button>
                    {options.map(opt => (
                        <button
                            key={opt}
                            onClick={() => { onChange(opt); setOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                            style={{
                                color: value === opt ? "#92140c" : "#1e1e24",
                                fontWeight: value === opt ? 500 : 400,
                                letterSpacing: "0.02em",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 20, 12, 0.05)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            )}

            {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
        </div>
    );
}

const SOURCE_LABELS = {
    allevents: "AllEvents",
    hasgeek: "HasGeek",
    meetup: "Meetup",
    townscript: "Townscript",
    biec: "BIEC",
    echai: "Echai",
};

export default function FilterBar({ filters = {}, onChange, locations = [], sources = [], onClear, hasFilters }) {
    const f = { location: "", source: "", dateFrom: "", dateTo: "", ...filters };
    const update = (key, val) => onChange(prev => ({ ...prev, [key]: val }));

    return (
        <div className="flex flex-wrap items-center gap-2 mb-6">
            <DropdownFilter
                label="Location"
                icon="📍"
                options={locations}
                value={f.location}
                onChange={v => update("location", v)}
            />

            <DropdownFilter
                label="Platform"
                icon="🔗"
                options={sources}
                value={f.source}
                onChange={v => update("source", v)}
                renderLabel={v => SOURCE_LABELS[v] || v}
            />

            {/* Date range */}
            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border"
                style={{
                    background: "transparent",
                    borderColor: (f.dateFrom || f.dateTo) ? "#92140c" : "rgba(146, 20, 12, 0.2)",
                    color: "#1e1e24",
                }}
            >
                <span style={{ color: "#92140c" }}>📅</span>
                <input
                    type="date"
                    value={f.dateFrom}
                    onChange={e => update("dateFrom", e.target.value)}
                    className="outline-none bg-transparent text-sm"
                    style={{
                        color: f.dateFrom ? "#92140c" : "#1e1e24",
                        width: 120,
                        opacity: 0.8,
                    }}
                    title="From date"
                />
                <span style={{ color: "rgba(146, 20, 12, 0.3)" }}>—</span>
                <input
                    type="date"
                    value={f.dateTo}
                    onChange={e => update("dateTo", e.target.value)}
                    className="outline-none bg-transparent text-sm"
                    style={{
                        color: f.dateTo ? "#92140c" : "#1e1e24",
                        width: 120,
                        opacity: 0.8,
                    }}
                    title="To date"
                />
            </div>

            {hasFilters && (
                <button
                    onClick={onClear}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border"
                    style={{
                        color: "#1e1e24",
                        borderColor: "rgba(146, 20, 12, 0.2)",
                        background: "transparent",
                        letterSpacing: "0.02em",
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(146, 20, 12, 0.05)";
                        e.currentTarget.style.color = "#92140c";
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#1e1e24";
                    }}
                >
                    Clear filters
                </button>
            )}
        </div>
    );
}