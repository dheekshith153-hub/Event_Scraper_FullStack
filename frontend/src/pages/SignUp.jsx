import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { useAuth } from "../auth/AuthContext";

/* ── reuse the same styles injected by SignIn, or re-inject safely ── */
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

export default function SignUp() {
    injectStyles();

    const navigate = useNavigate();
    const { signup } = useAuth();

    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [show, setShow] = useState(false);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [errKey, setErrKey] = useState(0);

    /* touched state per field */
    const [t, setT] = useState({ name: false, email: false, pass: false, confirm: false });
    const touch = (f) => setT(prev => ({ ...prev, [f]: true }));

    const passwordOk = useMemo(() => password.length >= 6, [password]);
    const matchOk = useMemo(() => password === confirm, [password, confirm]);

    /* inline validation */
    const nameInvalid = t.name && fullName.trim().length === 0;
    const emailInvalid = t.email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    const passInvalid = t.pass && !passwordOk;
    const confirmInvalid = t.confirm && confirm.length > 0 && !matchOk;

    function showError(msg) {
        setErr(msg);
        setErrKey(k => k + 1);
    }

    async function onSubmit(e) {
        e.preventDefault();
        setT({ name: true, email: true, pass: true, confirm: true });

        if (!fullName.trim()) { showError("Full name is required."); return; }
        if (emailInvalid || !email) { showError("Please enter a valid email address."); return; }
        if (!passwordOk) { showError("Password must be at least 6 characters."); return; }
        if (!matchOk) { showError("Passwords do not match."); return; }

        setErr("");
        setLoading(true);
        try {
            await signup({ fullName, email, password });
            navigate("/", { replace: true });
        } catch (error) {
            showError(error.message || "Sign up failed. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    const inputBase = "mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all duration-200 focus:ring-2";
    const inputOk = "border-[#1e1e24]/10 bg-[#fff8f0] focus:ring-[#92140c]/20";
    const inputErr = "err-field border-[#92140c] focus:ring-[#92140c]/20 bg-[#92140c]/5";

    /* password strength */
    const strength = password.length === 0 ? 0
        : password.length < 6 ? 1
            : password.length < 10 ? 2
                : 3;
    const strengthLabel = ["", "Too short", "Good", "Strong"][strength];
    const strengthColor = ["", "bg-[#92140c]", "bg-[#1e1e24]", "bg-[#92140c]"][strength];

    return (
        <div className="min-h-screen bg-[#fff8f0]">
            <Header />

            <div className="mx-auto max-w-6xl px-4 py-10">
                <div className="grid gap-8 lg:grid-cols-2 items-start">

                    {/* Left: intro */}
                    <div className="rounded-2xl border border-[#1e1e24]/10 bg-[#fff8f0] p-6" style={{ boxShadow: "0 10px 30px -15px rgba(30,30,36,0.1)" }}>
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#92140c]/20 bg-[#92140c]/5 px-3 py-1 text-xs text-[#92140c]">
                            🚀 Create your account
                        </div>
                        <h1 className="mt-4 text-3xl font-medium text-[#1e1e24]" style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "-0.02em" }}>Start saving events</h1>
                        <p className="mt-2 text-sm text-[#1e1e24]/60 leading-relaxed" style={{ letterSpacing: "0.02em" }}>
                            Build your personal shortlist, track what you love, and plan your next meetup.
                        </p>
                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-[#92140c]/10 bg-[#92140c]/02 p-4">
                                <div className="text-sm font-medium text-[#1e1e24]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Bookmarks</div>
                                <div className="mt-1 text-sm text-[#1e1e24]/60" style={{ letterSpacing: "0.02em" }}>Save events with one click.</div>
                            </div>
                            <div className="rounded-2xl border border-[#92140c]/10 bg-[#92140c]/02 p-4">
                                <div className="text-sm font-medium text-[#1e1e24]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Planner-ready</div>
                                <div className="mt-1 text-sm text-[#1e1e24]/60" style={{ letterSpacing: "0.02em" }}>Organize what you'll attend.</div>
                            </div>
                        </div>
                        <div className="mt-6 text-sm text-[#1e1e24]/60" style={{ letterSpacing: "0.02em" }}>
                            Already have an account?{" "}
                            <Link to="/signin" className="font-medium text-[#92140c] hover:underline">Sign in</Link>
                        </div>
                    </div>

                    {/* Right: form */}
                    <div className="rounded-2xl border border-[#1e1e24]/10 bg-[#fff8f0] p-6" style={{ boxShadow: "0 10px 30px -15px rgba(30,30,36,0.1)" }}>
                        <h2 className="text-xl font-medium text-[#1e1e24]" style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "-0.02em" }}>Sign up</h2>
                        <p className="mt-1 text-sm text-[#1e1e24]/60" style={{ letterSpacing: "0.02em" }}>Create an account in seconds.</p>

                        {/* ── Animated error banner ── */}
                        {err && (
                            <div
                                key={errKey}
                                className="err-banner mt-4 flex items-start gap-3 rounded-xl border border-[#92140c]/20 bg-[#92140c]/5 px-4 py-3"
                            >
                                <span className="err-icon mt-0.5 text-base leading-none text-[#92140c]">⚠️</span>
                                <div>
                                    <p className="text-sm font-medium text-[#92140c]">Please fix the following</p>
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

                            {/* Full name */}
                            <div>
                                <label className="text-sm font-medium text-[#1e1e24]" style={{ letterSpacing: "0.02em" }}>Full name</label>
                                <input
                                    className={`${inputBase} ${nameInvalid ? inputErr : inputOk}`}
                                    type="text"
                                    placeholder="Your name"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    onBlur={() => touch("name")}
                                />
                                {nameInvalid && (
                                    <p style={{ animation: "slideDown .25s ease both" }}
                                        className="mt-1.5 flex items-center gap-1 text-xs text-[#92140c]">
                                        <span>✕</span> Full name is required
                                    </p>
                                )}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="text-sm font-medium text-[#1e1e24]" style={{ letterSpacing: "0.02em" }}>Email</label>
                                <input
                                    className={`${inputBase} ${emailInvalid ? inputErr : inputOk}`}
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onBlur={() => touch("email")}
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
                                        className={`${inputBase} mt-0 ${passInvalid ? inputErr : inputOk}`}
                                        type={show ? "text" : "password"}
                                        placeholder="Minimum 6 characters"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onBlur={() => touch("pass")}
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

                                {/* Strength bar */}
                                {password.length > 0 && (
                                    <div style={{ animation: "slideDown .25s ease both" }} className="mt-2">
                                        <div className="flex gap-1">
                                            {[1, 2, 3].map(i => (
                                                <div key={i}
                                                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength ? strengthColor : "bg-[#1e1e24]/10"}`}
                                                />
                                            ))}
                                        </div>
                                        <p className={`mt-1 text-xs font-medium ${strength === 1 ? "text-[#92140c]" : strength === 2 ? "text-[#1e1e24]" : "text-[#92140c]"}`}>
                                            {strengthLabel}
                                        </p>
                                    </div>
                                )}

                                {passInvalid && (
                                    <p style={{ animation: "slideDown .25s ease both" }}
                                        className="mt-1.5 flex items-center gap-1 text-xs text-[#92140c]">
                                        <span>✕</span> At least 6 characters required
                                    </p>
                                )}
                            </div>

                            {/* Confirm password */}
                            <div>
                                <label className="text-sm font-medium text-[#1e1e24]" style={{ letterSpacing: "0.02em" }}>Confirm password</label>
                                <input
                                    className={`${inputBase} ${confirmInvalid ? inputErr : inputOk}`}
                                    type={show ? "text" : "password"}
                                    placeholder="Re-enter password"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    onBlur={() => touch("confirm")}
                                />
                                {confirm.length > 0 && (
                                    <p style={{ animation: "slideDown .25s ease both" }}
                                        className={`mt-1.5 flex items-center gap-1 text-xs ${matchOk ? "text-[#1e1e24]" : "text-[#92140c]"}`}>
                                        {matchOk ? <><span className="text-[#1e1e24]">✓</span> Passwords match</> : <><span>✕</span> Passwords do not match</>}
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
                                        Creating…
                                    </span>
                                ) : "Create account"}
                            </button>

                            <div className="flex items-center justify-between text-sm">
                                <Link to="/welcome" className="text-[#1e1e24]/60 hover:text-[#92140c] transition-colors" style={{ letterSpacing: "0.02em" }}>← Back</Link>
                                <Link to="/signin" className="font-medium text-[#92140c] hover:underline" style={{ letterSpacing: "0.02em" }}>Sign in</Link>
                            </div>
                        </form>
                    </div>

                </div>
            </div>
        </div>
    );
}