import { useState } from "react";
import DateRangePicker from "./DateRangePicker";

function DropdownFilter({ label, icon, options, value, onChange }) {
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
                <span>{isActive ? value : label}</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    style={{ color: isActive ? "#fff8f0" : "#92140c" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div
                    className="absolute top-full left-0 mt-2 rounded-xl overflow-hidden z-50 min-w-[160px]"
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
                        All {label}s
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
                icon="📍"
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
