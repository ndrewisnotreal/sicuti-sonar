import { removeEncryptedItem } from '@/utils/encryption';
import { publicPath } from '@/utils/publicPath';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const APP_KEY = import.meta.env.VITE_APP_KEY || '';

export const SESSION_KEYS = ['sicuti_auth', 'sicuti_user_menus', 'sicuti_abilities'];

export const LOGOUT_NOTICE_KEY = 'sicuti_logout_notice';

try {
    localStorage.removeItem('sicuti_token');
    sessionStorage.removeItem('sicuti_token');
} catch {}

export function assetUrl(p) {
    if (!p) return null;
    return /^https?:\/\//.test(p) ? p : `${API_BASE}${p}`;
}

export function clearAuth() {
    for (const key of SESSION_KEYS) removeEncryptedItem(key);
    forgetSharedGets();
}

function buildUrl(endpoint, params) {
    let url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    if (params && typeof params === 'object') {
        const query = new URLSearchParams();
        for (const [key, val] of Object.entries(params)) {
            if (val !== undefined && val !== null && val !== '') {
                query.append(key, String(val));
            }
        }
        const qs = query.toString();
        if (qs) {
            url += (url.includes('?') ? '&' : '?') + qs;
        }
    }
    return url;
}

const isFormData = (value) => typeof FormData !== 'undefined' && value instanceof FormData;

function httpError(message, status, data) {
    const err = new Error(message);
    err.status = status;
    err.data = data;
    return err;
}

async function sessionExpired(res) {
    const body = await res.json().catch(() => null);
    clearAuth();
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
        try {
            if (body?.message) sessionStorage.setItem(LOGOUT_NOTICE_KEY, body.message);
        } catch {}
        window.location.href = publicPath('auth/login');
    }
    return httpError(body?.error || body?.message || 'Sesi berakhir, silakan login kembali', 401, body);
}

async function request(endpoint, options = {}) {
    const hasJsonBody = !isFormData(options.body) && options.body !== undefined;
    const headers = {
        ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
        'x-api-key': APP_KEY,
        ...options.headers
    };

    const res = await fetch(buildUrl(endpoint, options.params), {
        ...options,
        headers,
        credentials: 'include'
    });

    if (res.status === 401) throw await sessionExpired(res);

    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json() : await res.text();

    if (!res.ok) {
        const message = (data && typeof data === 'object' && (data.error || data.message)) || res.statusText || 'Request failed';
        throw httpError(message, res.status, data);
    }

    return data;
}

async function requestBlob(endpoint, params) {
    const res = await fetch(buildUrl(endpoint, params), { headers: { 'x-api-key': APP_KEY }, credentials: 'include' });
    if (res.status === 401) throw await sessionExpired(res);
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        const err = new Error(body?.error || body?.message || res.statusText || 'Berkas tidak bisa diambil');
        err.status = res.status;
        throw err;
    }
    const disposition = res.headers.get('content-disposition') || '';
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    return { blob: await res.blob(), filename: match ? safeDecode(match[1]) : '' };
}

function safeDecode(value) {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

export function saveBlob(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

const RECENT_GET_MS = 2000;
const sharedGets = new Map();
const copyOf = (data) => (data && typeof data === 'object' ? structuredClone(data) : data);

function forgetSharedGets() {
    sharedGets.clear();
}

function forgetFinishedGets() {
    for (const [key, entry] of sharedGets) if (entry.doneAt) sharedGets.delete(key);
}
if (typeof window !== 'undefined') {
    for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, forgetFinishedGets, { capture: true, passive: true });
}

function sharedGet(url, params) {
    const key = buildUrl(url, params);
    const hit = sharedGets.get(key);
    if (hit && (!hit.doneAt || Date.now() - hit.doneAt < RECENT_GET_MS)) return hit.promise.then(copyOf);
    const entry = { doneAt: 0 };
    const drop = () => sharedGets.get(key) === entry && sharedGets.delete(key);
    entry.promise = request(url, { method: 'GET', params }).then(
        (data) => {
            entry.doneAt = Date.now();
            setTimeout(drop, RECENT_GET_MS);
            return data;
        },
        (err) => {
            drop();
            throw err;
        }
    );
    sharedGets.set(key, entry);
    return entry.promise.then(copyOf);
}

// null, 0, false, dan '' tetap dikirim sebagai JSON; hanya undefined yang berarti tanpa body.
function serializeBody(data) {
    if (isFormData(data)) return data;
    if (data === undefined) return undefined;
    return JSON.stringify(data);
}

function write(url, options) {
    forgetSharedGets();
    return request(url, options).finally(forgetSharedGets);
}

export const api = {
    get: (url, params) => sharedGet(url, params),
    blob: (url, params) => requestBlob(url, params),
    post: (url, data) => write(url, { method: 'POST', body: serializeBody(data) }),
    upload: (url, formData) => write(url, { method: 'POST', body: formData }),
    put: (url, data) => write(url, { method: 'PUT', body: serializeBody(data) }),
    delete: (url, data) => write(url, { method: 'DELETE', body: data ? JSON.stringify(data) : undefined })
};

export default api;
