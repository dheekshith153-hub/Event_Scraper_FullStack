export default function Pagination({ page, totalPages, onPage }) {
    if (totalPages <= 1) return null;

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
            pages.push(i);
        } else if (pages[pages.length - 1] !== "...") {
            pages.push("...");
        }
    }

    return (
        <div className="flex items-center justify-center gap-2 mt-10">
            <button
                disabled={page === 1}
                onClick={() => onPage(page - 1)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border"
                style={{
                    background: page === 1 ? "transparent" : "#fff8f0",
                    color: page === 1 ? "#1e1e24/30" : "#1e1e24",
                    borderColor: page === 1 ? "rgba(30, 30, 36, 0.1)" : "rgba(146, 20, 12, 0.2)",
                    cursor: page === 1 ? "not-allowed" : "pointer",
                    opacity: page === 1 ? 0.5 : 1,
                    letterSpacing: "0.02em",
                }}
                onMouseEnter={(e) => {
                    if (page !== 1) {
                        e.currentTarget.style.background = "#92140c";
                        e.currentTarget.style.color = "#fff8f0";
                        e.currentTarget.style.borderColor = "#92140c";
                    }
                }}
                onMouseLeave={(e) => {
                    if (page !== 1) {
                        e.currentTarget.style.background = "#fff8f0";
                        e.currentTarget.style.color = "#1e1e24";
                        e.currentTarget.style.borderColor = "rgba(146, 20, 12, 0.2)";
                    }
                }}
            >
                ← Prev
            </button>

            {pages.map((p, i) =>
                p === "..." ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-sm" style={{ color: "#1e1e24", opacity: 0.5 }}>...</span>
                ) : (
                    <button
                        key={p}
                        onClick={() => onPage(p)}
                        className="w-9 h-9 rounded-xl text-sm font-medium transition-all duration-300 border"
                        style={{
                            background: p === page ? "#92140c" : "#fff8f0",
                            color: p === page ? "#fff8f0" : "#1e1e24",
                            borderColor: p === page ? "#92140c" : "rgba(146, 20, 12, 0.2)",
                            boxShadow: p === page ? "0 4px 12px rgba(146, 20, 12, 0.2)" : "none",
                            letterSpacing: "0.02em",
                        }}
                        onMouseEnter={(e) => {
                            if (p !== page) {
                                e.currentTarget.style.background = "rgba(146, 20, 12, 0.05)";
                                e.currentTarget.style.color = "#92140c";
                                e.currentTarget.style.borderColor = "#92140c";
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (p !== page) {
                                e.currentTarget.style.background = "#fff8f0";
                                e.currentTarget.style.color = "#1e1e24";
                                e.currentTarget.style.borderColor = "rgba(146, 20, 12, 0.2)";
                            }
                        }}
                    >
                        {p}
                    </button>
                )
            )}

            <button
                disabled={page === totalPages}
                onClick={() => onPage(page + 1)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border"
                style={{
                    background: page === totalPages ? "transparent" : "#fff8f0",
                    color: page === totalPages ? "#1e1e24/30" : "#1e1e24",
                    borderColor: page === totalPages ? "rgba(30, 30, 36, 0.1)" : "rgba(146, 20, 12, 0.2)",
                    cursor: page === totalPages ? "not-allowed" : "pointer",
                    opacity: page === totalPages ? 0.5 : 1,
                    letterSpacing: "0.02em",
                }}
                onMouseEnter={(e) => {
                    if (page !== totalPages) {
                        e.currentTarget.style.background = "#92140c";
                        e.currentTarget.style.color = "#fff8f0";
                        e.currentTarget.style.borderColor = "#92140c";
                    }
                }}
                onMouseLeave={(e) => {
                    if (page !== totalPages) {
                        e.currentTarget.style.background = "#fff8f0";
                        e.currentTarget.style.color = "#1e1e24";
                        e.currentTarget.style.borderColor = "rgba(146, 20, 12, 0.2)";
                    }
                }}
            >
                Next →
            </button>
        </div>
    );
}