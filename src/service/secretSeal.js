import { API_BASE, APP_KEY } from './api.js';

// Password disegel di browser sebelum dikirim, supaya tidak terbaca di tab Network.
// Enkripsi memakai kunci publik server (ECDH P-256 + HKDF-SHA256 + AES-256-GCM, WebCrypto bawaan browser);
// hanya server yang bisa membukanya. Bentuk hasil: `sealed.v1.<base64url>` di field yang sama.
const SEALED_PREFIX = 'sealed.v1.';
const ALGORITHM = 'ECDH-P256+HKDF-SHA256+A256GCM';
const AES_INFO = 'sicuti/sealed-secret/aes-256-gcm';
const CURVE = { name: 'ECDH', namedCurve: 'P-256' };

const encoder = new TextEncoder();

function fromBase64Url(text) {
    const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
}

function toBase64Url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts) {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
        out.set(p, at);
        at += p.length;
    }
    return out;
}

// WebCrypto hanya ada di halaman HTTPS atau localhost. Di luar itu password dikirim seperti sebelumnya.
export function canSeal() {
    return Boolean(globalThis.crypto?.subtle && typeof globalThis.crypto.getRandomValues === 'function');
}

// Kunci publik + challenge berumur pendek dari server; diambil tepat sebelum menyegel.
export async function fetchSealKey() {
    const res = await fetch(`${API_BASE}/auth/public-key`, {
        headers: { 'x-api-key': APP_KEY },
        credentials: 'include',
        cache: 'no-store'
    });
    if (!res.ok) return null;
    const body = await res.json();
    const info = body?.data ?? body;
    return info?.alg === ALGORITHM && info.key && info.challenge ? info : null;
}

export async function sealValue(info, value) {
    const subtle = globalThis.crypto.subtle;
    const serverRaw = fromBase64Url(info.key);
    const serverKey = await subtle.importKey('raw', serverRaw, CURVE, false, []);
    const ephemeral = await subtle.generateKey(CURVE, true, ['deriveBits']);
    const ephemeralRaw = new Uint8Array(await subtle.exportKey('raw', ephemeral.publicKey));
    const shared = await subtle.deriveBits({ name: 'ECDH', public: serverKey }, ephemeral.privateKey, 256);
    const hkdfKey = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
    const aesKey = await subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: concat(ephemeralRaw, serverRaw), info: encoder.encode(AES_INFO) },
        hkdfKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const cipher = new Uint8Array(
        await subtle.encrypt(
            { name: 'AES-GCM', iv, additionalData: encoder.encode(SEALED_PREFIX) },
            aesKey,
            encoder.encode(JSON.stringify({ c: info.challenge, v: value }))
        )
    );
    return SEALED_PREFIX + toBase64Url(concat(ephemeralRaw, iv, cipher));
}

/**
 * Salinan `payload` dengan field `names` (yang berisi teks) sudah tersegel.
 * Bila penyegelan tidak mungkin (backend lama tanpa /auth/public-key, browser tanpa WebCrypto, jaringan gagal),
 * payload dikembalikan apa adanya: backend tetap menerima password polos, jadi alur lama tetap jalan.
 */
export async function sealFields(payload, names) {
    const targets = names.filter((name) => typeof payload?.[name] === 'string' && payload[name] !== '');
    if (targets.length === 0 || !canSeal()) return payload;
    try {
        const info = await fetchSealKey();
        if (!info) return payload;
        const sealed = { ...payload };
        for (const name of targets) sealed[name] = await sealValue(info, payload[name]);
        return sealed;
    } catch {
        return payload;
    }
}
