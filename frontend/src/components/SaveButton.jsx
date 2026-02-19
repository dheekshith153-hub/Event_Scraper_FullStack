import { useState, useEffect } from "react";

const API_BASE_URL = "";

export default function SaveButton({ eventId, initialSaved = false, onToggle }) {
    const [isSaved, setIsSaved] = useState(initialSaved);
    const [isLoading, setIsLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("event_token");
        setIsAuthenticated(!!token);
        setIsSaved(initialSaved);
    }, [initialSaved]);

    const handleSaveToggle = async () => {
        if (!isAuthenticated) {
            alert("Please sign in to save events");
            return;
        }

        setIsLoading(true);

        try {
            const token = localStorage.getItem("event_token");
            const method = isSaved ? "DELETE" : "POST";

            const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/save`, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to save event");
            }

            const newSavedState = !isSaved;
            setIsSaved(newSavedState);
            if (onToggle) onToggle(newSavedState);
        } catch (err) {
            console.error("Error saving event:", err);
            alert("Failed to save event. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isAuthenticated) {
        return null; // Don't show save button if not logged in
    }

    return (
        <button
            onClick={handleSaveToggle}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-300"
            style={{
                background: isSaved ? "#92140c" : "transparent",
                border: "1px solid",
                borderColor: isSaved ? "#92140c" : "rgba(146, 20, 12, 0.3)",
                color: isSaved ? "#fff8f0" : "#1e1e24",
                letterSpacing: "0.02em",
                opacity: isLoading ? 0.6 : 1,
                cursor: isLoading ? "not-allowed" : "pointer",
            }}
            onMouseEnter={e => {
                if (!isLoading) {
                    e.currentTarget.style.borderColor = "#92140c";
                    if (!isSaved) {
                        e.currentTarget.style.background = "rgba(146, 20, 12, 0.05)";
                    }
                }
            }}
            onMouseLeave={e => {
                if (!isLoading) {
                    e.currentTarget.style.borderColor = isSaved ? "#92140c" : "rgba(146, 20, 12, 0.3)";
                    if (!isSaved) {
                        e.currentTarget.style.background = "transparent";
                    }
                }
            }}
        >
            {isLoading ? (
                <>
                    <div className="w-4 h-4 border-2 rounded-full animate-spin"
                        style={{
                            borderColor: isSaved ? "rgba(255, 248, 240, 0.3)" : "rgba(146, 20, 12, 0.3)",
                            borderTopColor: isSaved ? "#fff8f0" : "#92140c"
                        }}
                    />
                    {isSaved ? "Unsaving..." : "Saving..."}
                </>
            ) : (
                <>
                    <svg
                        className="w-5 h-5"
                        fill={isSaved ? "currentColor" : "none"}
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                        />
                    </svg>
                    {isSaved ? "Saved" : "Save Event"}
                </>
            )}
        </button>
    );
}