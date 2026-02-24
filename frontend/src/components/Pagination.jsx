export default function Pagination({ page, totalPages, onPage }) {
    if (!totalPages || totalPages <= 1) return null;

    const windowSize = 7;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = start + windowSize - 1;

    if (end > totalPages) {
        end = totalPages;
        start = Math.max(1, end - windowSize + 1);
    }

    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);

    const NavBtn = ({ onClick, disabled, children }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                width: 36, height: 36,
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "50%",
                border: "1px solid",
                borderColor: disabled ? "rgba(146,20,12,0.1)" : "rgba(146,20,12,0.2)",
                background: "transparent",
                color: disabled ? "rgba(30,30,36,0.25)" : "#1e1e24",
                fontSize: 14,
                fontWeight: 500,
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                fontFamily: "'Inter', sans-serif",
            }}
            onMouseEnter={e => {
                if (!disabled) {
                    e.currentTarget.style.borderColor = "#92140c";
                    e.currentTarget.style.color = "#92140c";
                    e.currentTarget.style.background = "rgba(146,20,12,0.05)";
                }
            }}
            onMouseLeave={e => {
                if (!disabled) {
                    e.currentTarget.style.borderColor = "rgba(146,20,12,0.2)";
                    e.currentTarget.style.color = "#1e1e24";
                    e.currentTarget.style.background = "transparent";
                }
            }}
        >
            {children}
        </button>
    );

    return (
        <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 48,
            marginBottom: 24,
            fontFamily: "'Inter', sans-serif",
        }}>
            {/* First page */}
            <NavBtn onClick={() => onPage(1)} disabled={page === 1}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
                </svg>
            </NavBtn>

            {/* Prev page */}
            <NavBtn onClick={() => onPage(page - 1)} disabled={page === 1}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
            </NavBtn>

            {/* Page numbers */}
            {pages.map(p => (
                <button
                    key={p}
                    onClick={() => onPage(p)}
                    style={{
                        width: 36, height: 36,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        borderRadius: "50%",
                        border: "1px solid",
                        borderColor: p === page ? "#92140c" : "rgba(146,20,12,0.2)",
                        background: p === page ? "#92140c" : "transparent",
                        color: p === page ? "#fff8f0" : "#1e1e24",
                        fontSize: 13,
                        fontWeight: p === page ? 600 : 400,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        fontFamily: "'Inter', sans-serif",
                        boxShadow: p === page ? "0 4px 12px rgba(146,20,12,0.3)" : "none",
                        letterSpacing: "0.01em",
                    }}
                    onMouseEnter={e => {
                        if (p !== page) {
                            e.currentTarget.style.borderColor = "#92140c";
                            e.currentTarget.style.color = "#92140c";
                            e.currentTarget.style.background = "rgba(146,20,12,0.05)";
                        }
                    }}
                    onMouseLeave={e => {
                        if (p !== page) {
                            e.currentTarget.style.borderColor = "rgba(146,20,12,0.2)";
                            e.currentTarget.style.color = "#1e1e24";
                            e.currentTarget.style.background = "transparent";
                        }
                    }}
                >
                    {p}
                </button>
            ))}

            {/* Next page */}
            <NavBtn onClick={() => onPage(page + 1)} disabled={page === totalPages}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </NavBtn>

            {/* Last page */}
            <NavBtn onClick={() => onPage(totalPages)} disabled={page === totalPages}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M6 5l7 7-7 7" />
                </svg>
            </NavBtn>
        </div>
    );
}
