import { afterEach, describe, expect, it, vi } from 'vitest';
import api, { API_BASE, LOGOUT_NOTICE_KEY, SESSION_KEYS, assetUrl, clearAuth, saveBlob } from '@/service/api';
import { setEncryptedItem } from '@/utils/encryption';

function mockFetch(status, body) {
    const fn = vi.fn().mockResolvedValue({
        status,
        ok: status >= 200 && status < 300,
        statusText: '',
        headers: { get: () => 'application/json' },
        json: async () => body
    });
    vi.stubGlobal('fetch', fn);
    return fn;
}

describe('api', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        clearAuth();
        localStorage.clear();
    });

    it('memakai prefix /api dan mengubah path berkas jadi URL lewat proxy', () => {
        expect(API_BASE).toBe('/api');
        expect(assetUrl('/uploads/avatars/a.png')).toBe('/api/uploads/avatars/a.png');
        expect(assetUrl('https://cdn.example/x.png')).toBe('https://cdn.example/x.png');
        expect(assetUrl(null)).toBeNull();
    });

    it('mengirim x-api-key dan cookie, tanpa header Authorization', async () => {
        const fetchMock = mockFetch(200, { success: true, data: [] });
        await api.get('/sicuti/holiday', { year: 2026, kosong: '' });
        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe('/api/sicuti/holiday?year=2026');
        expect(opts.credentials).toBe('include');
        expect(opts.headers).toHaveProperty('x-api-key');
        expect(opts.headers).not.toHaveProperty('Authorization');
        expect(opts.headers).not.toHaveProperty('Content-Type');
    });

    it('401 di tengah sesi: alasan disimpan untuk ditampilkan di halaman login (QA #11)', async () => {
        const msg = 'Izin login untuk peran Anda sudah dinonaktifkan. Hubungi admin.';
        const loc = { pathname: '/leave/history', href: '/leave/history' };
        vi.stubGlobal('location', loc);
        mockFetch(401, { success: false, message: msg, error: msg });
        await expect(api.get('/sicuti/leave-request/mine')).rejects.toMatchObject({ status: 401 });
        expect(sessionStorage.getItem(LOGOUT_NOTICE_KEY)).toBe(msg);
        expect(loc.href).toBe('/auth/login');
        sessionStorage.clear();
    });

    it('meneruskan pesan error backend beserta data-nya', async () => {
        mockFetch(400, { success: false, error: 'kd_role wajib diisi', data: { code: 'X' } });
        await expect(api.get('/master/permission/action_edit')).rejects.toMatchObject({ message: 'kd_role wajib diisi', status: 400 });
    });

    it('GET identik yang sedang berjalan dipakai bersama: satu request, tiap pemanggil dapat salinan sendiri', async () => {
        let resolveFetch;
        const fetchMock = vi.fn(
            () =>
                new Promise((resolve) => {
                    resolveFetch = () =>
                        resolve({ status: 200, ok: true, statusText: '', headers: { get: () => 'application/json' }, json: async () => ({ data: [{ id: 1 }] }) });
                })
        );
        vi.stubGlobal('fetch', fetchMock);
        const a = api.get('/sicuti/policy', { year: 2026 });
        const b = api.get('/sicuti/policy', { year: 2026 });
        resolveFetch();
        const [ra, rb] = await Promise.all([a, b]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(ra).toEqual({ data: [{ id: 1 }] });
        expect(rb).toEqual(ra);
        expect(rb).not.toBe(ra);
    });

    it('GET identik yang baru selesai (< 2 detik) dipakai ulang: sinkronisasi lalu halaman tidak meminta dua kali', async () => {
        const fetchMock = mockFetch(200, { data: [{ id: 1 }] });
        const a = await api.get('/sicuti/leave-balance/me', { year: 2026 });
        const b = await api.get('/sicuti/leave-balance/me', { year: 2026 });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(b).toEqual(a);
        expect(b).not.toBe(a);
    });

    it('GET identik setelah lebih dari 2 detik tetap dikirim ulang', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        const fetchMock = mockFetch(200, { data: [] });
        await api.get('/sicuti/policy');
        vi.setSystemTime(Date.now() + 2100);
        await api.get('/sicuti/policy');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it.each(['post', 'put', 'delete', 'upload'])('request tulis (%s) membuang hasil GET tersimpan: data sesudah perubahan diambil dari server', async (method) => {
        const fetchMock = mockFetch(200, { data: [] });
        await api.get('/sicuti/leave-request/pending-approval');
        await api[method]('/sicuti/leave-request/approve', method === 'upload' ? new FormData() : { id_request: 'REQ-1' });
        await api.get('/sicuti/leave-request/pending-approval');
        expect(fetchMock.mock.calls.filter(([, opts]) => opts.method === 'GET')).toHaveLength(2);
    });

    it('GET yang selesai saat request tulis masih berjalan tidak dipakai ulang setelah request tulis selesai', async () => {
        const ok = (body) => ({ status: 200, ok: true, statusText: '', headers: { get: () => 'application/json' }, json: async () => body });
        let finishWrite;
        const fetchMock = vi.fn((url, opts) => (opts.method === 'POST' ? new Promise((resolve) => (finishWrite = () => resolve(ok({})))) : Promise.resolve(ok({ data: [] }))));
        vi.stubGlobal('fetch', fetchMock);
        const write = api.post('/sicuti/leave-request/approve', { id_request: 'REQ-1' });
        await api.get('/sicuti/leave-request/pending-approval');
        finishWrite();
        await write;
        await api.get('/sicuti/leave-request/pending-approval');
        expect(fetchMock.mock.calls.filter(([, opts]) => opts.method === 'GET')).toHaveLength(2);
    });

    it.each(['pointerdown', 'keydown'])('aksi pengguna (%s, mis. tombol "Segarkan") membuat GET berikutnya diambil dari server', async (type) => {
        const fetchMock = mockFetch(200, { data: [] });
        await api.get('/sicuti/leave-request/pending-approval');
        window.dispatchEvent(new Event(type));
        await api.get('/sicuti/leave-request/pending-approval');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('aksi pengguna tidak memisahkan GET identik yang masih berjalan', async () => {
        let resolveFetch;
        const fetchMock = vi.fn(
            () =>
                new Promise((resolve) => {
                    resolveFetch = () => resolve({ status: 200, ok: true, statusText: '', headers: { get: () => 'application/json' }, json: async () => ({ data: [] }) });
                })
        );
        vi.stubGlobal('fetch', fetchMock);
        const a = api.get('/sicuti/policy');
        window.dispatchEvent(new Event('pointerdown'));
        const b = api.get('/sicuti/policy');
        resolveFetch();
        await Promise.all([a, b]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('GET yang gagal tidak dipakai ulang', async () => {
        mockFetch(500, { message: 'gangguan' });
        await expect(api.get('/sicuti/policy')).rejects.toMatchObject({ status: 500 });
        const fetchMock = mockFetch(200, { data: [] });
        await api.get('/sicuti/policy');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('clearAuth membuang hasil GET tersimpan (data sesi sebelumnya tidak terpakai)', async () => {
        const fetchMock = mockFetch(200, { data: [] });
        await api.get('/sicuti/leave-balance/me');
        clearAuth();
        await api.get('/sicuti/leave-balance/me');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('request tulis (POST) tidak pernah digabung', async () => {
        const fetchMock = mockFetch(200, { data: {} });
        await Promise.all([api.post('/sicuti/notification/read', {}), api.post('/sicuti/notification/read', {})]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('blob (unduh berkas): URL & query sama seperti GET, kirim x-api-key + cookie, nama berkas dari Content-Disposition', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: (h) => (h.toLowerCase() === 'content-disposition' ? 'attachment; filename="laporan%202026.csv"' : 'text/csv') },
            blob: async () => 'ISI'
        });
        vi.stubGlobal('fetch', fetchMock);
        const res = await api.blob('/sicuti/report/export', { year: 2026, kosong: '', tidak: null });
        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe('/api/sicuti/report/export?year=2026');
        expect(opts.credentials).toBe('include');
        expect(opts.headers).toHaveProperty('x-api-key');
        expect(res).toEqual({ blob: 'ISI', filename: 'laporan 2026.csv' });
        await api.blob('/sicuti/leave-request/REQ-1/document');
        expect(fetchMock.mock.calls[1][0]).toBe('/api/sicuti/leave-request/REQ-1/document');
    });

    it('body POST/PUT: undefined tanpa body, nilai falsy tetap JSON, FormData apa adanya', async () => {
        const fetchMock = mockFetch(200, { data: {} });
        const fd = new FormData();
        await api.post('/x');
        await api.post('/x', null);
        await api.put('/x', 0);
        await api.put('/x', '');
        await api.put('/x', false);
        await api.post('/x', fd);
        const sent = fetchMock.mock.calls.map(([, opts]) => [opts.method, opts.body, opts.headers['Content-Type']]);
        expect(sent).toEqual([
            ['POST', undefined, undefined],
            ['POST', 'null', 'application/json'],
            ['PUT', '0', 'application/json'],
            ['PUT', '""', 'application/json'],
            ['PUT', 'false', 'application/json'],
            ['POST', fd, undefined]
        ]);
    });

    it('DELETE hanya mengirim body bila data truthy', async () => {
        const fetchMock = mockFetch(200, { data: {} });
        await api.delete('/x');
        await api.delete('/x', { id: 1 });
        expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
        expect(fetchMock.mock.calls[1][1].body).toBe('{"id":1}');
    });

    it('respons non-JSON dikembalikan sebagai teks; error non-JSON memakai statusText', async () => {
        const res = (status, text) => ({ status, ok: status < 300, statusText: 'Bad Gateway', headers: { get: () => 'text/plain' }, text: async () => text });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(res(200, 'OK')).mockResolvedValueOnce(res(502, 'gateway')));
        expect(await api.post('/x')).toBe('OK');
        await expect(api.post('/x')).rejects.toMatchObject({ message: 'Bad Gateway', status: 502, data: 'gateway' });
    });

    it('401 di halaman login: sesi dibersihkan tanpa redirect; JSON rusak memakai pesan bawaan', async () => {
        const loc = { pathname: '/auth/login', href: '/auth/login?x=1' };
        vi.stubGlobal('location', loc);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401, ok: false, headers: { get: () => 'application/json' }, json: async () => { throw new SyntaxError('bad'); } }));
        SESSION_KEYS.forEach((k) => setEncryptedItem(k, { a: 1 }));
        await expect(api.post('/sicuti/auth/login', {})).rejects.toMatchObject({ status: 401, message: 'Sesi berakhir, silakan login kembali', data: null });
        expect(loc.href).toBe('/auth/login?x=1');
        SESSION_KEYS.forEach((k) => expect(localStorage.getItem(k)).toBeNull());
    });

    it('saveBlob: tautan unduh dilepas dari DOM, object URL dicabut setelah 1 detik', () => {
        vi.useFakeTimers();
        const revoke = vi.fn();
        vi.stubGlobal('URL', { createObjectURL: () => 'blob:abc', revokeObjectURL: revoke });
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        saveBlob('ISI', 'a.csv');
        expect(click).toHaveBeenCalledTimes(1);
        expect(document.querySelector('a[download]')).toBeNull();
        expect(revoke).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1000);
        expect(revoke).toHaveBeenCalledWith('blob:abc');
        click.mockRestore();
    });

    it('clearAuth menghapus seluruh sesi lokal', () => {
        SESSION_KEYS.forEach((k) => setEncryptedItem(k, { a: 1 }));
        clearAuth();
        SESSION_KEYS.forEach((k) => expect(localStorage.getItem(k)).toBeNull());
    });
});
