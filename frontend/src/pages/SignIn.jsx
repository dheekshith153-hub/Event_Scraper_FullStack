import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { useAuth } from "../auth/AuthContext";

/* ── tiny keyframe injection (runs once) ── */
const STYLES = `
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px) scaleY(0.95); }
  to   { opacity: 1; transform: translateY(0)   scaleY(1);    }
}
@keyframes shake {
  0%,100% { transform: translateX(0); }
  15%      { transform: translateX(-6px); }
  30%      { transform: translateX(6px); }
  45%      { transform: translateX(-4px); }
  60%      { transform: translateX(4px); }
  75%      { transform: translateX(-2px); }
  90%      { transform: translateX(2px); }
}
@keyframes fieldPulse {
  0%   { box-shadow: 0 0 0 0 rgba(146,20,12,0.35); }
  60%  { box-shadow: 0 0 0 6px rgba(146,20,12,0);  }
  100% { box-shadow: 0 0 0 0 rgba(146,20,12,0);    }
}
@keyframes iconBounce {
  0%,100% { transform: scale(1);    }
  40%      { transform: scale(1.25); }
  70%      { transform: scale(0.9);  }
}
.err-banner   { animation: slideDown .3s cubic-bezier(.4,0,.2,1) both, shake .45s .28s ease both; }
.err-field    { animation: fieldPulse .6s ease; border-color: #92140c !important; }
.err-icon     { animation: iconBounce .5s .35s ease both; display:inline-block; }
`;

function injectStyles() {
    if (document.getElementById("auth-anim-styles")) return;
    const el = document.createElement("style");
    el.id = "auth-anim-styles";
    el.textContent = STYLES;
    document.head.appendChild(el);
}

export default function SignIn() {
    injectStyles();

    const navigate = useNavigate();
    const { signin } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [show, setShow] = useState(false);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [errKey, setErrKey] = useState(0);           // re-mount banner to replay anim
    const [touchedEmail, setTouchedEmail] = useState(false);
    const [touchedPassword, setTouchedPassword] = useState(false);

    /* field-level inline validation */
    const emailInvalid = touchedEmail && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    const passwordInvalid = touchedPassword && password.length < 6;

    function showError(msg) {
        setErr(msg);
        setErrKey(k => k + 1);   // forces re-mount → replays animation
    }

    async function onSubmit(e) {
        e.preventDefault();
        setTouchedEmail(true);
        setTouchedPassword(true);
        if (emailInvalid || !email) { showError("Please enter a valid email address."); return; }
        if (passwordInvalid || !password) { showError("Password must be at least 6 characters."); return; }

        setErr("");
        setLoading(true);
        try {
            await signin({ email, password });
            navigate("/", { replace: true });
        } catch (error) {
            showError(error.message || "Sign in failed. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    const inputBase = "mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all duration-200 focus:ring-2";
    const inputOk = "border-[#1e1e24]/10 bg-[#fff8f0] focus:ring-[#92140c]/20";
    const inputErr = "err-field border-[#92140c] focus:ring-[#92140c]/20 bg-[#92140c]/5";

    return (
        <div className="min-h-screen bg-[#fff8f0]">
            <Header />

            <div className="mx-auto max-w-6xl px-4 py-10">
                <div className="grid gap-8 lg:grid-cols-2 items-start">

                    {/* Left: intro */}
                    <div className="rounded-2xl border border-[#1e1e24]/10 bg-[#fff8f0] p-6" style={{ boxShadow: "0 10px 30px -15px rgba(30,30,36,0.1)" }}>
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#92140c]/20 bg-[#92140c]/5 px-3 py-1 text-xs text-[#92140c]">
                            🔒 Secure sign in
                        </div>
                        <h1 className="mt-4 text-3xl font-medium text-[#1e1e24]" style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "-0.02em" }}>Welcome back</h1>
                        <p className="mt-2 text-sm text-[#1e1e24]/60 leading-relaxed" style={{ letterSpacing: "0.02em" }}>
                            Sign in to save events, build your planner, and keep track of your favorites.
                        </p>
                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-[#92140c]/10 bg-[#92140c]/02 p-4">
                                <div className="text-sm font-medium text-[#1e1e24]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Save events</div>
                                <div className="mt-1 text-sm text-[#1e1e24]/60" style={{ letterSpacing: "0.02em" }}>Bookmark the best meetups instantly.</div>
                            </div>
                            <div className="rounded-2xl border border-[#92140c]/10 bg-[#92140c]/02 p-4">
                                <div className="text-sm font-medium text-[#1e1e24]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Stay organized</div>
                                <div className="mt-1 text-sm text-[#1e1e24]/60" style={{ letterSpacing: "0.02em" }}>Keep a personal list for later.</div>
                            </div>
                        </div>
                        <div className="mt-6 text-sm text-[#1e1e24]/60" style={{ letterSpacing: "0.02em" }}>
                            New here?{" "}
                            <Link to="/signup" className="font-medium text-[#92140c] hover:underline">
                                Create an account
                            </Link>
                        </div>
                    </div>

                    {/* Right: form */}
                    <div className="rounded-2xl border border-[#1e1e24]/10 bg-[#fff8f0] p-6" style={{ boxShadow: "0 10px 30px -15px rgba(30,30,36,0.1)" }}>
                        <h2 className="text-xl font-medium text-[#1e1e24]" style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "-0.02em" }}>Sign in</h2>
                        <p className="mt-1 text-sm text-[#1e1e24]/60" style={{ letterSpacing: "0.02em" }}>Use your email and password.</p>

                        {/* ── Animated error banner ── */}
                        {err && (
                            <div
                                key={errKey}
                                className="err-banner mt-4 flex items-start gap-3 rounded-xl border border-[#92140c]/20 bg-[#92140c]/5 px-4 py-3"
                            >
                                <span className="err-icon mt-0.5 text-base leading-none text-[#92140c]">⚠️</span>
                                <div>
                                    <p className="text-sm font-medium text-[#92140c]">Something went wrong</p>
                                    <p className="text-xs text-[#92140c]/80 mt-0.5">{err}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setErr("")}
                                    className="ml-auto text-[#92140c]/40 hover:text-[#92140c] transition-colors text-lg leading-none"
                                    aria-label="Dismiss"
                                >
                                    ×
                                </button>
                            </div>
                        )}

                        <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>

                            {/* Email */}
                            <div>
                                <label className="text-sm font-medium text-[#1e1e24]" style={{ letterSpacing: "0.02em" }}>Email</label>
                                <input
                                    className={`${inputBase} ${emailInvalid ? inputErr : inputOk}`}
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onBlur={() => setTouchedEmail(true)}
                                />
                                {emailInvalid && (
                                    <p style={{ animation: "slideDown .25s ease both" }}
                                        className="mt-1.5 flex items-center gap-1 text-xs text-[#92140c]">
                                        <span>✕</span> Enter a valid email address
                                    </p>
                                )}
                            </div>

                            {/* Password */}
                            <div>
                                <label className="text-sm font-medium text-[#1e1e24]" style={{ letterSpacing: "0.02em" }}>Password</label>
                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        className={`${inputBase} mt-0 ${passwordInvalid ? inputErr : inputOk}`}
                                        type={show ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onBlur={() => setTouchedPassword(true)}
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShow((s) => !s)}
                                        className="rounded-xl border border-[#1e1e24]/10 bg-[#fff8f0] px-3 py-3 text-xs font-medium text-[#1e1e24]/70 hover:bg-[#92140c]/5 transition-colors"
                                        style={{ letterSpacing: "0.02em" }}
                                    >
                                        {show ? "Hide" : "Show"}
                                    </button>
                                </div>
                                {passwordInvalid && (
                                    <p style={{ animation: "slideDown .25s ease both" }}
                                        className="mt-1.5 flex items-center gap-1 text-xs text-[#92140c]">
                                        <span>✕</span> At least 6 characters required
                                    </p>
                                )}
                            </div>

                            <button
                                disabled={loading}
                                className="w-full rounded-xl px-5 py-3 text-sm font-medium text-[#fff8f0] transition-all duration-300
                                           bg-[#1e1e24] hover:bg-[#92140c] disabled:opacity-60"
                                style={{ letterSpacing: "0.05em", border: "1px solid #92140c" }}
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        Signing in…
                                    </span>
                                ) : "Sign in"}
                            </button>

                            <div className="flex items-center justify-between text-sm">
                                <Link to="/welcome" className="text-[#1e1e24]/60 hover:text-[#92140c] transition-colors" style={{ letterSpacing: "0.02em" }}>← Back</Link>
                                <Link to="/signup" className="font-medium text-[#92140c] hover:underline" style={{ letterSpacing: "0.02em" }}>Create account</Link>
                            </div>
                        </form>
                    </div>

                </div>
            </div>
        </div>
    );
}