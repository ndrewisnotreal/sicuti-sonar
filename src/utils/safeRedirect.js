// Tujuan setelah login hanya boleh path internal: diawali "/" dan bukan "//" atau "/\" (protocol-relative / open redirect).
export function safeRedirect(value, fallback = '/') {
    const target = Array.isArray(value) ? value[0] : value;
    if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return fallback;
    // Jangan kembali ke halaman login itu sendiri.
    if (/^\/auth\/login(?:[/?#]|$)/.test(target)) return fallback;
    return target;
}
