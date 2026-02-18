import { apiFetch } from "./client";

export function signup({ fullName, email, password }) {
    return apiFetch("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ fullName, email, password }),
    });
}

export function signin({ email, password }) {
    return apiFetch("/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
}

export function me() {
    return apiFetch("/api/auth/me", { method: "GET" });
}
