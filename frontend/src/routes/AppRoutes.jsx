import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

import Welcome from "../pages/Welcome";
import SignIn from "../pages/SignIn";
import SignUp from "../pages/SignUp";
import Events from "../pages/Events";
import Saved from "../pages/Saved";
import Profile from "../pages/Profile";
import ProtectedRoute from "./ProtectedRoute";

export default function AppRoutes() {
    const { isAuthed, loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
                background: "#faf8f5", fontFamily: "'DM Sans', sans-serif",
            }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: "50%",
                        border: "3px solid #fde0e7",
                        borderTopColor: "#e8305a",
                        animation: "spin 0.8s linear infinite",
                        margin: "0 auto 16px",
                    }} />
                    <div style={{ fontSize: 13, color: "#aaa" }}>Loading...</div>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <Routes>
            {/* Public landing page */}
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />

            {/* Root: redirect to /events if authed, else /welcome */}
            <Route
                path="/"
                element={isAuthed ? <Navigate to="/events" replace /> : <Navigate to="/welcome" replace />}
            />

            {/* All these routes require login */}
            <Route element={<ProtectedRoute />}>
                <Route path="/events" element={<Events />} />
                <Route path="/saved" element={<Saved />} />
                <Route path="/profile" element={<Profile />} />
            </Route>

            {/* Catch-all */}
            <Route
                path="*"
                element={isAuthed ? <Navigate to="/events" replace /> : <Navigate to="/welcome" replace />}
            />
        </Routes>
    );
}
