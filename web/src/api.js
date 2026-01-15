const SERVER_URL = "http://localhost:3000";

function getHeaders() {
    const token = localStorage.getItem('authToken');
    const headers = { "Content-Type": "application/json" };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

// Global Logout Trigger
function forceLogout() {
    console.warn("Session expired. Logging out...");
    localStorage.clear();
    window.location.reload();
}

async function handleResponse(res) {
    // ✅ 1. SECURITY: Auto-Logout on 401 (Expired Token)
    if (res.status === 401) {
        forceLogout();
        throw new Error("Session expired");
    }

    // 2. Handle other API errors
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `API Error: ${res.statusText}`);
    }

    return res.json();
}

function getUrl(endpoint) {
    if (endpoint.startsWith('http')) return endpoint;
    const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (cleanPath.startsWith('/api')) {
        return `${SERVER_URL}${cleanPath}`;
    }
    return `${SERVER_URL}/api${cleanPath}`;
}

// --- Methods (With Caching Disabled) ---

export async function apiGet(endpoint) {
    try {
        const res = await fetch(getUrl(endpoint), {
            headers: getHeaders(),
            cache: "no-store" // ✅ IMPORTANT: Forces browser to ask server every time
        });
        return handleResponse(res);
    } catch (error) { throw error; }
}

export async function apiPost(endpoint, body) {
    try {
        const res = await fetch(getUrl(endpoint), {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse(res);
    } catch (error) { throw error; }
}

export async function apiPatch(endpoint, body) {
    try {
        const res = await fetch(getUrl(endpoint), {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse(res);
    } catch (error) { throw error; }
}

export async function apiDelete(endpoint) {
    try {
        const res = await fetch(getUrl(endpoint), {
            method: "DELETE",
            headers: getHeaders(),
        });
        return handleResponse(res);
    } catch (error) { throw error; }
}