import React from "react";
import Header from "../components/Header";
import { useAuth } from "../auth/AuthContext";

export default function Profile() {
    const { user, signout } = useAuth();

    return (
        <div className="min-h-screen bg-[#f6f3f2]">
            <Header />
            <div className="mx-auto max-w-6xl px-4 py-10">
                <div className="rounded-2xl border border-black/5 bg-white shadow-sm p-6">
                    <h1 className="text-xl font-semibold text-black">Profile</h1>
                    <div className="mt-3 text-sm text-black/60">
                        <div>
                            <span className="font-semibold text-black">Name:</span> {user?.full_name || user?.fullName || "-"}
                        </div>
                        <div className="mt-1">
                            <span className="font-semibold text-black">Email:</span> {user?.email || "-"}
                        </div>
                    </div>

                    <button
                        onClick={signout}
                        className="mt-6 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-black/5"
                    >
                        Sign out
                    </button>
                </div>
            </div>
        </div>
    );
}
