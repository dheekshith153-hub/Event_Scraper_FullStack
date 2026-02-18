import { useState } from "react";

export default function SearchBar({ value, onChange, count }) {
    const [focused, setFocused] = useState(false);

    return (
        <div className="mb-5">
            <div
                className="flex items-center gap-3 rounded-2xl px-5 py-4 transition-all duration-300"
                style={{
                    background: "#fff8f0",
                    border: focused ? "1px solid #92140c" : "1px solid rgba(146, 20, 12, 0.2)",
                    boxShadow: focused ? "0 10px 30px -15px rgba(146, 20, 12, 0.2)" : "none",
                }}
            >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: focused ? "#92140c" : "#1e1e24", opacity: 0.5 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder={`Search ${count}+ events by name, topic, or city...`}
                    className="flex-1 outline-none bg-transparent text-sm"
                    style={{ color: "#1e1e24", fontFamily: "'Inter', sans-serif", letterSpacing: "0.02em" }}
                />
                {value && (
                    <button
                        onClick={() => onChange("")}
                        className="transition-colors"
                        style={{ color: "#1e1e24", opacity: 0.5 }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#92140c"; e.currentTarget.style.opacity = "1"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#1e1e24"; e.currentTarget.style.opacity = "0.5"; }}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}