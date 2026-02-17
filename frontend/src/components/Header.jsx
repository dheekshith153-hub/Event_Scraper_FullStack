export default function Header() {
    return (
        <header style={{ background: "linear-gradient(135deg, #c0392b 0%, #e8305a 40%, #ff6b35 100%)" }} className="relative overflow-hidden">
            {/* Top banner */}
            <div className="text-center py-2 text-xs font-medium text-white/90 tracking-wide" style={{ background: "rgba(0,0,0,0.15)" }}>
                ✨ New events added daily — bookmark your favorites!
            </div>

            {/* Nav */}
            <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg text-white" style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}>
                        E
                    </div>
                    <span style={{ fontFamily: "'DM Serif Display', serif", color: "white", fontSize: "1.25rem", letterSpacing: "-0.02em" }}>
                        EventScraper
                    </span>
                </div>

                {/* Nav links */}
                <nav className="hidden md:flex items-center gap-8">
                    {["Home", "Explore", "Planner"].map(link => (
                        <a key={link} href="#" className="text-sm font-medium transition-all" style={{ color: link === "Explore" ? "white" : "rgba(255,255,255,0.75)" }}>
                            {link}
                            {link === "Explore" && <div className="h-0.5 rounded-full mt-0.5" style={{ background: "white" }} />}
                        </a>
                    ))}
                </nav>

                {/* Auth */}
                <div className="flex items-center gap-3">
                    <a href="#" className="text-sm font-medium text-white/80 hidden sm:block hover:text-white transition-colors">Sign in</a>
                    <button className="px-4 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105" style={{ background: "white", color: "#e8305a" }}>
                        Sign up
                    </button>
                </div>
            </div>

            {/* Decorative blobs */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{ background: "white", transform: "translate(30%, -30%)" }} />
            <div className="absolute bottom-0 left-20 w-32 h-32 rounded-full opacity-10" style={{ background: "white", transform: "translateY(40%)" }} />
        </header>
    );
}
