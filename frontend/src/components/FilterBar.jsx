import { useState } from "react";

function FilterPill({ label, active, onClick, children }) {
    return (
        <button
            onClick={onClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 whitespace-nowrap border"
            style={{
                background: active ? "#e8305a" : "white",
                color: active ? "white" : "#555",
                borderColor: active ? "#e8305a" : "#e2ddd8",
                boxShadow: active ? "0 2px 8px rgba(232,48,90,0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
            }}
        >
            {children || label}
            {active && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
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
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 border"
                style={{
                    background: isActive ? "#e8305a" : "white",
                    color: isActive ? "white" : "#555",
                    borderColor: isActive ? "#e8305a" : "#e2ddd8",
                    boxShadow: isActive ? "0 2px 8px rgba(232,48,90,0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
                }}
            >
                {icon && <span>{icon}</span>}
                <span>{isActive ? (renderLabel ? renderLabel(value) : value) : label}</span>
                <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div
                    className="absolute top-full left-0 mt-2 rounded-xl overflow-hidden z-50 min-w-[160px]"
                    style={{ background: "white", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", border: "1px solid #ece9e4" }}
                >
                    <button
                        onClick={() => { onChange(""); setOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 transition-colors"
                        style={{ color: "#888", borderBottom: "1px solid #f5f3f0" }}
                    >
                        All {label}
                    </button>
                    {options.map(opt => (
                        <button
                            key={opt}
                            onClick={() => { onChange(opt); setOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 transition-colors"
                            style={{ color: value === opt ? "#e8305a" : "#333", fontWeight: value === opt ? 600 : 400 }}
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

export default function FilterBar({ filters, onChange, locations, sources, onClear, hasFilters }) {
    const update = (key, val) => onChange(prev => ({ ...prev, [key]: val }));

    const dateRangeLabel = filters.dateFrom || filters.dateTo
        ? `${filters.dateFrom || "..."} → ${filters.dateTo || "..."}`
        : null;

    return (
        <div className="flex flex-wrap items-center gap-2 mb-6">
            <DropdownFilter
                label="Location"
                icon="📍"
                options={locations}
                value={filters.location}
                onChange={v => update("location", v)}
            />

            <DropdownFilter
                label="Platform"
                icon="🔗"
                options={sources}
                value={filters.source}
                onChange={v => update("source", v)}
                renderLabel={v => SOURCE_LABELS[v] || v}
            />

            {/* Date range */}
            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border bg-white" style={{ borderColor: (filters.dateFrom || filters.dateTo) ? "#e8305a" : "#e2ddd8", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <span>📅</span>
                <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={e => update("dateFrom", e.target.value)}
                    className="outline-none bg-transparent text-sm"
                    style={{ color: filters.dateFrom ? "#e8305a" : "#888", width: 120 }}
                    title="From date"
                />
                <span className="text-gray-300">→</span>
                <input
                    type="date"
                    value={filters.dateTo}
                    onChange={e => update("dateTo", e.target.value)}
                    className="outline-none bg-transparent text-sm"
                    style={{ color: filters.dateTo ? "#e8305a" : "#888", width: 120 }}
                    title="To date"
                />
            </div>

            {hasFilters && (
                <button
                    onClick={onClear}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border"
                    style={{ color: "#888", borderColor: "#e2ddd8", background: "white" }}
                >
                    Clear filters
                </button>
            )}
        </div>
    );
}
