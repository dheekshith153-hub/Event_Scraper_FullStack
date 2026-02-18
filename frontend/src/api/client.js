// Always use relative URLs so Vite proxy forwards /api/* → http://localhost:8080
// Do NOT use http://localhost:8080 directly — that bypasses the proxy and causes CORS issues.

export async function apiFetch(path, options = {}) {
    // path must start with "/" e.g. "/api/events"
    const url = path.startsWith("/") ? path : `/${path}`;

    const headers = new Headers(options.headers || {});
    if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const token = localStorage.getItem("event_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(url, { ...options, headers });

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    let data;
    try {
        data = isJson ? await res.json() : await res.text();
    } catch {
        data = null;
    }

    if (!res.ok) {
        const message =
            (data && typeof data === "object" && (data.error || data.message)) ||
            (typeof data === "string" && data) ||
            `Request failed: ${res.status}`;
        const err = new Error(message);
        err.status = res.status;
        err.data = data;
        throw err;
    }

    return data;
}
