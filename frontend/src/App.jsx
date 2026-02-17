import { useState, useEffect } from "react";
import EventCard from "./components/EventCard";
import FilterBar from "./components/FilterBar";
import SearchBar from "./components/SearchBar";
import Header from "./components/Header";
import Pagination from "./components/Pagination";

const API_BASE_URL = ""; // Use Vite proxy
const PAGE_SIZE = 8;

export default function App() {
    const [allEvents, setAllEvents] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState({ location: "", source: "", dateFrom: "", dateTo: "" });
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [locations, setLocations] = useState([]);
    const [sources, setSources] = useState([]);

    // Fetch events from backend API
    useEffect(() => {
        const fetchEvents = async () => {
            setLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams({
                    page: page.toString(),
                    limit: PAGE_SIZE.toString(),
                });

                if (search) params.append("q", search);
                if (filters.location) params.append("location", filters.location);
                if (filters.source) params.append("source", filters.source);
                if (filters.dateFrom) params.append("from", filters.dateFrom);
                if (filters.dateTo) params.append("to", filters.dateTo);

                const response = await fetch(`${API_BASE_URL}/api/events?${params.toString()}`);

                if (!response.ok) {
                    throw new Error(`Failed to fetch events: ${response.statusText}`);
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
    }, [search, filters, page]);

    const clearAll = () => {
        setSearch("");
        setFilters({ location: "", source: "", dateFrom: "", dateTo: "" });
        setPage(1);
    };

    const hasFilters = search || filters.location || filters.source || filters.dateFrom || filters.dateTo;

    return (
        <div className="min-h-screen" style={{ background: "#f7f6f3", fontFamily: "'DM Sans', sans-serif" }}>
            <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
            <Header />

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Page Title */}
                <div className="mb-6">
                    <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">Discover</p>
                    <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "2rem", color: "#1a1a1a" }}>
                        All Events
                    </h2>
                    <div style={{ width: 48, height: 3, background: "linear-gradient(90deg,#e8305a,#ff6b35)", borderRadius: 2, marginTop: 8 }} />
                </div>

                {/* Search */}
                <SearchBar value={search} onChange={setSearch} count={total} />

                {/* Filters */}
                <FilterBar
                    filters={filters}
                    onChange={setFilters}
                    locations={locations}
                    sources={sources}
                    onClear={clearAll}
                    hasFilters={hasFilters}
                />

                {/* Results */}
                {error ? (
                    <div className="text-center py-24">
                        <div className="text-5xl mb-4">⚠️</div>
                        <p className="text-gray-700 text-lg font-semibold mb-2">Unable to connect to backend</p>
                        <p className="text-gray-500 text-sm mb-4">Please ensure the backend server is running on port 8080</p>
                        <p className="text-gray-400 text-xs font-mono bg-gray-100 px-4 py-2 rounded inline-block">{error}</p>
                        <div className="mt-6">
                            <button
                                onClick={() => window.location.reload()}
                                className="px-5 py-2 rounded-full text-sm font-medium text-white"
                                style={{ background: "#e8305a" }}
                            >
                                Retry Connection
                            </button>
                        </div>
                    </div>
                ) : loading ? (
                    <div className="flex justify-center items-center py-24">
                        <div className="w-8 h-8 border-4 border-red-200 border-t-red-500 rounded-full animate-spin" />
                    </div>
                ) : allEvents.length === 0 ? (
                    <div className="text-center py-24">
                        <div className="text-5xl mb-4">📭</div>
                        <p className="text-gray-500 text-lg">No events found. Try adjusting your filters.</p>
                        {hasFilters && (
                            <button onClick={clearAll} className="mt-4 px-5 py-2 rounded-full text-sm font-medium text-white" style={{ background: "#e8305a" }}>
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
