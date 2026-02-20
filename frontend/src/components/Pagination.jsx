export default function Pagination({ page, totalPages, onPage }) {
    if (totalPages <= 1) return null;

    const windowSize = 7;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = start + windowSize - 1;

    if (end > totalPages) {
        end = totalPages;
        start = Math.max(1, end - windowSize + 1);
    }

    const pages = [];
    for (let i = start; i <= end; i++) {
        pages.push(i);
    }

    const navBtn = (onClick, disabled, label) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className="w-9 h-9 flex items-center justify-center rounded-full text-sm font-medium transition-all duration-200 border"
            style={{
                background: "#fff",
                color: disabled ? "#ccc" : "#555",
                borderColor: "#e0e0e0",
                cursor: disabled ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
                if (!disabled) {
                    e.currentTarget.style.borderColor = "#4a1942";
                    e.currentTarget.style.color = "#4a1942";
                }
            }}
            onMouseLeave={(e) => {
                if (!disabled) {
                    e.currentTarget.style.borderColor = "#e0e0e0";
                    e.currentTarget.style.color = "#555";
                }
            }}
        >
            {label}
        </button>
    );

    return (
        <div className="flex items-center justify-center gap-1.5 mt-10">
            {navBtn(() => onPage(1), page === 1, "«")}
            {navBtn(() => onPage(page - 1), page === 1, "‹")}

            {pages.map((p) => (
                <button
                    key={p}
                    onClick={() => onPage(p)}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-sm transition-all duration-200 border"
                    style={{
                        background: p === page ? "#4a1942" : "#fff",
                        color: p === page ? "#fff" : "#555",
                        borderColor: p === page ? "#4a1942" : "#e0e0e0",
                        boxShadow: p === page ? "0 2px 8px rgba(74,25,66,0.25)" : "none",
                        fontWeight: p === page ? "600" : "400",
                    }}
                    onMouseEnter={(e) => {
                        if (p !== page) {
                            e.currentTarget.style.borderColor = "#4a1942";
                            e.currentTarget.style.color = "#4a1942";
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (p !== page) {
                            e.currentTarget.style.borderColor = "#e0e0e0";
                            e.currentTarget.style.color = "#555";
                        }
                    }}
                >
                    {p}
                </button>
            ))}

            {navBtn(() => onPage(page + 1), page === totalPages, "›")}
        </div>
    );
}
