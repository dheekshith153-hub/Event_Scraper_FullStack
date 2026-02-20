import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import EventCard from "../components/EventCard";
import FilterBar from "../components/FilterBar";
import SearchBar from "../components/SearchBar";
import Header from "../components/Header";
import Pagination from "../components/Pagination";

const API_BASE_URL = "";
const PAGE_SIZE = 8;

export default function Events() {
    const [searchParams, setSearchParams] = useSearchParams();

    const [allEvents, setAllEvents] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [locations, setLocations] = useState([]);
    const [sources, setSources] = useState([]);

    // ── Read ALL state from URL so Back button restores it ──
    const search = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const filters = {
        location: searchParams.get("location") || "",
        source: searchParams.get("source") || "",
        dateFrom: searchParams.get("from") || "",
        dateTo: searchParams.get("to") || "",
    };

    // Helper: write changes back to URL (keeps unchanged params)
    const updateParams = (updates) => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                Object.entries(updates).forEach(([k, v]) => {
                    if (v && v !== "1") next.set(k, v);
                    else next.delete(k);
                });
                return next;
            },
            { replace: false }   // keep history entry so Back works
        );
    };

    const setSearch = (v) => updateParams({ q: v, page: null });
    const setPage = (p) => updateParams({ page: String(p) });
    const setFilters = (updater) => {
        const nf = typeof updater === "function" ? updater(filters) : updater;
        updateParams({
            location: nf.location,
            source: nf.source,
            from: nf.dateFrom,
            to: nf.dateTo,
            page: null,          // reset to page 1 on filter change
        });
    };
    const clearAll = () => setSearchParams({}, { replace: false });

    const hasFilters =
        search || filters.location || filters.source || filters.dateFrom || filters.dateTo;

    useEffect(() => {
        const fetchEvents = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams({
                    page: String(page),
                    limit: String(PAGE_SIZE),
                });
                if (search) params.append("q", search);
                if (filters.location) params.append("location", filters.location);
                if (filters.source) params.append("source", filters.source);
                if (filters.dateFrom) params.append("from", filters.dateFrom);
                if (filters.dateTo) params.append("to", filters.dateTo);

                const response = await fetch(`${API_BASE_URL}/api/events?${params}`);
                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(`Failed to fetch events (${response.status}): ${text.slice(0, 120)}`);
                }
                const data = await response.json();
                setAllEvents(data.events || []);
                setTotal(data.total || 0);
                setTotalPages(data.total_pages || 1);
                setLocations(data.locations || []);
                setSources(data.sources || []);
            } catch (err) {
                console.error("Error fetching events:", err);
                setError(err.message);
                setAllEvents([]);
            } finally {
                setLoading(false);
            }
        };
        fetchEvents();
    }, [search, filters.location, filters.source, filters.dateFrom, filters.dateTo, page]);

    return (
        <div className="min-h-screen" style={{ background: "#fff8f0", fontFamily: "'Inter', sans-serif" }}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap" rel="stylesheet" />
            <Header />

            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <p className="text-xs font-medium tracking-[0.2em] mb-2" style={{ color: "#92140c", opacity: 0.8 }}>DISCOVER</p>
                    <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2.5rem", fontWeight: 500, color: "#1e1e24", letterSpacing: "-0.02em" }}>
                        All Events
                    </h2>
                    <div style={{ width: 60, height: 1, background: "#92140c", marginTop: 12, opacity: 0.3 }} />
                </div>

                <SearchBar value={search} onChange={setSearch} count={total} />

                <FilterBar
                    filters={filters}
                    onChange={setFilters}
                    locations={locations}
                    sources={sources}
                    onClear={clearAll}
                    hasFilters={hasFilters}
                />

                {error ? (
                    <div className="text-center py-24" style={{ background: "#fff8f0", borderRadius: 24, border: "1px solid rgba(146, 20, 12, 0.1)" }}>
                        <div className="text-5xl mb-4" style={{ color: "#92140c", opacity: 0.5 }}>⚠️</div>
                        <p className="text-lg font-medium mb-2" style={{ color: "#1e1e24", fontFamily: "'Cormorant Garamond', serif" }}>Unable to connect to backend</p>
                        <p className="text-sm mb-4" style={{ color: "#1e1e24", opacity: 0.7 }}>Please ensure the backend server is running on port 8080</p>
                        <p className="text-xs font-mono px-4 py-2 rounded inline-block" style={{ background: "rgba(146, 20, 12, 0.05)", color: "#92140c" }}>{error}</p>
                        <div className="mt-6">
                            <button onClick={() => window.location.reload()}
                                className="px-5 py-2 rounded-full text-sm font-medium"
                                style={{ background: "#1e1e24", color: "#fff8f0", border: "1px solid #92140c", letterSpacing: "0.05em" }}>
                                Retry Connection
                            </button>
                        </div>
                    </div>
                ) : loading ? (
                    <div className="flex justify-center items-center py-24">
                        <div className="w-8 h-8 border rounded-full animate-spin"
                            style={{ borderColor: "rgba(146, 20, 12, 0.2)", borderTopColor: "#92140c" }} />
                    </div>
                ) : allEvents.length === 0 ? (
                    <div className="text-center py-24" style={{ background: "#fff8f0", borderRadius: 24, border: "1px solid rgba(146, 20, 12, 0.1)" }}>
                        <div className="text-5xl mb-4" style={{ color: "#92140c", opacity: 0.5 }}>📭</div>
                        <p className="text-lg" style={{ color: "#1e1e24", fontFamily: "'Cormorant Garamond', serif" }}>
                            No events found. Try adjusting your filters.
                        </p>
                        {hasFilters && (
                            <button onClick={clearAll}
                                className="mt-4 px-5 py-2 rounded-full text-sm font-medium"
                                style={{ background: "#1e1e24", color: "#fff8f0", border: "1px solid #92140c", letterSpacing: "0.05em" }}>
                                Clear all filters
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {allEvents.map((event, i) => (
                                <EventCard key={event.id} event={event} index={i} />
                            ))}
                        </div>
                        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
                    </>
                )}
            </main>
        </div>
    );
}
