import { Routes, Route, Navigate } from "react-router-dom";
import Welcome from "../pages/Welcome";
import Events from "../pages/Events";
import EventDetail from "../pages/EventDetail";
import Saved from "../pages/Saved";
import SignIn from "../pages/SignIn";
import SignUp from "../pages/SignUp";
import Profile from "../pages/Profile";

export default function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/welcome" replace />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/saved" element={<Saved />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/welcome" replace />} />
        </Routes>
    );
}
