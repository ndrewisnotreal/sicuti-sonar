// @vitest-environment node
import { createDecipheriv, createECDH, hkdfSync } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/service/api', () => ({ API_BASE: '/api', APP_KEY: 'kunci-uji' }));

import { canSeal, sealFields, sealValue } from '@/service/secretSeal';

const PREFIX = 'sealed.v1.';
const ALG = 'ECDH-P256+HKDF-SHA256+A256GCM';

// "Server" tiruan: membuka segel dengan cara yang sama seperti backend (ECDH P-256 + HKDF-SHA256 + AES-256-GCM).
function makeServer() {
    const ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
    const publicKey = ecdh.getPublicKey();
    return {
        info: { alg: ALG, key: publicKey.toString('base64url'), challenge: '1794884400.tanda-tangan-uji', expires_in: 300 },
        open(sealed) {
            const blob = Buffer.from(sealed.slice(PREFIX.length), 'base64url');
            const ephemeral = blob.subarray(0, 65);
            const iv = blob.subarray(65, 77);
            const tag = blob.subarray(blob.length - 16);
            const body = blob.subarray(77, blob.length - 16);
            const key = Buffer.from(hkdfSync('sha256', ecdh.computeSecret(ephemeral), Buffer.concat([ephemeral, publicKey]), Buffer.from('sicuti/sealed-secret/aes-256-gcm'), 32));
            const decipher = createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAAD(Buffer.from(PREFIX));
            decipher.setAuthTag(tag);
            return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8'));
        }
    };
}

function respondWith(info, { ok = true } = {}) {
    return vi.fn().mockResolvedValue({ ok, json: async () => ({ success: true, data: info }) });
}

describe('secretSeal', () => {
    let server;

    beforeEach(() => {
        server = makeServer();
    });
    afterEach(() => vi.unstubAllGlobals());

    it('sealValue: hasilnya hanya bisa dibuka pemilik kunci, isinya persis nilai asli + challenge', async () => {
        for (const value of ['password123', '  Rahasia1!  ', 'sandi-ünïkødé-密碼-🔒']) {
            const sealed = await sealValue(server.info, value);
            expect(sealed.startsWith(PREFIX)).toBe(true);
            expect(sealed).not.toContain(value);
            expect(server.open(sealed)).toEqual({ c: server.info.challenge, v: value });
        }
    });

    it('sealValue: nilai yang sama menghasilkan teks berbeda tiap kali', async () => {
        const a = await sealValue(server.info, 'PasswordQa1!');
        const b = await sealValue(server.info, 'PasswordQa1!');
        expect(a).not.toBe(b);
    });

    it('sealFields: hanya field yang disebut yang disegel, payload asli tidak diubah', async () => {
        const fetchMock = respondWith(server.info);
        vi.stubGlobal('fetch', fetchMock);
        const payload = { username: 'OS24980032', password: ' Rahasia1! ' };
        const out = await sealFields(payload, ['password']);

        expect(payload).toEqual({ username: 'OS24980032', password: ' Rahasia1! ' });
        expect(out.username).toBe('OS24980032');
        expect(JSON.stringify(out)).not.toContain('Rahasia1!');
        expect(server.open(out.password).v).toBe(' Rahasia1! ');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/public-key');
        expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'x-api-key': 'kunci-uji' });
    });

    it('sealFields: beberapa field memakai satu kali pengambilan kunci', async () => {
        const fetchMock = respondWith(server.info);
        vi.stubGlobal('fetch', fetchMock);
        const out = await sealFields({ current_password: 'password123', new_password: 'PasswordBaru1!', confirm_password: 'PasswordBaru1!' }, ['current_password', 'new_password', 'confirm_password']);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(server.open(out.current_password).v).toBe('password123');
        expect(server.open(out.new_password).v).toBe('PasswordBaru1!');
        expect(out.new_password).not.toBe(out.confirm_password);
    });

    it('sealFields: field kosong atau tidak ada tidak disegel dan kunci tidak diambil', async () => {
        const fetchMock = respondWith(server.info);
        vi.stubGlobal('fetch', fetchMock);
        const noPassword = { uid_user_system: 'USR007', position: 'Staf' };
        expect(await sealFields(noPassword, ['password'])).toBe(noPassword);
        const empty = { uid_user_system: 'USR007', password: '' };
        expect(await sealFields(empty, ['password'])).toBe(empty);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('backend lama (tanpa /auth/public-key) → payload dikirim seperti sebelumnya', async () => {
        vi.stubGlobal('fetch', respondWith(null, { ok: false }));
        const payload = { username: 'OS24980032', password: 'password123' };
        expect(await sealFields(payload, ['password'])).toBe(payload);
    });

    it('jaringan gagal atau jawaban tak dikenal → payload dikirim seperti sebelumnya', async () => {
        const payload = { username: 'OS24980032', password: 'password123' };
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
        expect(await sealFields(payload, ['password'])).toBe(payload);
        vi.stubGlobal('fetch', respondWith({ ...server.info, alg: 'LAIN' }));
        expect(await sealFields(payload, ['password'])).toBe(payload);
        vi.stubGlobal('fetch', respondWith({ ...server.info, key: 'bukan-kunci' }));
        expect(await sealFields(payload, ['password'])).toBe(payload);
    });

    it('browser tanpa WebCrypto (halaman HTTP non-localhost) → payload dikirim seperti sebelumnya', async () => {
        const fetchMock = respondWith(server.info);
        vi.stubGlobal('fetch', fetchMock);
        vi.stubGlobal('crypto', { getRandomValues: () => {} });
        expect(canSeal()).toBe(false);
        const payload = { username: 'OS24980032', password: 'password123' };
        expect(await sealFields(payload, ['password'])).toBe(payload);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
