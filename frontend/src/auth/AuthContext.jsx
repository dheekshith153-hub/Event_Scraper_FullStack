import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as authApi from "../api/auth";

const AuthContext = createContext(null);

const TOKEN_KEY = "event_token";

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    function setAuth(nextToken, nextUser) {
        if (nextToken) {
            localStorage.setItem(TOKEN_KEY, nextToken);
            setToken(nextToken);
        } else {
            localStorage.removeItem(TOKEN_KEY);
            setToken(null);
        }
        setUser(nextUser || null);
    }

    async function refreshMe() {
        if (!localStorage.getItem(TOKEN_KEY)) {
            setUser(null);
            setLoading(false);
            return;
        }
        try {
            const data = await authApi.me();
            setUser(data.user || data);
        } catch (e) {
            localStorage.removeItem(TOKEN_KEY);
            setToken(null);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refreshMe();
    }, []);

    async function signup({ fullName, email, password }) {
        const data = await authApi.signup({ fullName, email, password });
        setAuth(data.token, data.user);
        return data;
    }

    async function signin({ email, password }) {
        const data = await authApi.signin({ email, password });
        setAuth(data.token, data.user);
        return data;
    }

    function signout() {
        setAuth(null, null);
    }

    const value = useMemo(
        () => ({
            token,
            user,
            loading,
            isAuthed: !!token,
            signup,
            signin,
            signout,
            refreshMe,
        }),
        [token, user, loading]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}