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
                onClick={() => onPage(p => p - 1)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all border"
                style={{
                    background: "white",
                    color: page === 1 ? "#ccc" : "#555",
                    borderColor: "#e2ddd8",
                    cursor: page === 1 ? "not-allowed" : "pointer",
                }}
            >
                ← Prev
            </button>

            {pages.map((p, i) =>
                p === "..." ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-sm">...</span>
                ) : (
                    <button
                        key={p}
                        onClick={() => onPage(p)}
                        className="w-9 h-9 rounded-xl text-sm font-medium transition-all border"
                        style={{
                            background: p === page ? "#e8305a" : "white",
                            color: p === page ? "white" : "#555",
                            borderColor: p === page ? "#e8305a" : "#e2ddd8",
                            boxShadow: p === page ? "0 2px 8px rgba(232,48,90,0.3)" : "none",
                        }}
                    >
                        {p}
                    </button>
                )
            )}

            <button
                disabled={page === totalPages}
                onClick={() => onPage(p => p + 1)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all border"
                style={{
                    background: "white",
                    color: page === totalPages ? "#ccc" : "#555",
                    borderColor: "#e2ddd8",
                    cursor: page === totalPages ? "not-allowed" : "pointer",
                }}
            >
                Next →
            </button>
        </div>
    );
}
