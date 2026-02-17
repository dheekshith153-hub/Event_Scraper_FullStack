import { useState } from "react";

export default function SearchBar({ value, onChange, count }) {
    const [focused, setFocused] = useState(false);

    return (
        <div className="mb-5">
            <div
                className="flex items-center gap-3 rounded-2xl px-5 py-3.5 transition-all duration-200"
                style={{
                    background: "white",
                    border: focused ? "2px solid #e8305a" : "2px solid #ece9e4",
                    boxShadow: focused ? "0 0 0 4px rgba(232,48,90,0.08)" : "0 2px 8px rgba(0,0,0,0.06)",
                }}
            >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: focused ? "#e8305a" : "#aaa" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                </svg>
                <input
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder={`Search ${count}+ events by name, topic, or city...`}
                    className="flex-1 outline-none bg-transparent text-sm"
                    style={{ color: "#1a1a1a", fontFamily: "'DM Sans', sans-serif" }}
                />
                {value && (
                    <button onClick={() => onChange("")} className="text-gray-300 hover:text-gray-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}
