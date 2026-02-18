import React from "react";
import Header from "../components/Header";

export default function Saved() {
    return (
        <div className="min-h-screen bg-[#f6f3f2]">
            <Header />
            <div className="mx-auto max-w-6xl px-4 py-10">
                <div className="rounded-2xl border border-black/5 bg-white shadow-sm p-6">
                    <h1 className="text-xl font-semibold text-black">Saved events</h1>
                    <p className="mt-2 text-sm text-black/60">
                        This page is protected. Next we’ll connect it to your user_saved_events table.
                    </p>
                </div>
            </div>
        </div>
    );
}
