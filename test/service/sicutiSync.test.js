import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/service/api', () => ({
    default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
    clearAuth: vi.fn(),
    assetUrl: (p) => p,
    saveBlob: vi.fn()
}));

const YEAR = new Date().getFullYear();

async function freshModules({ abilities = [], user = { id: 'USR101', role: 'staff_it' } } = {}) {
    vi.resetModules();
    const api = (await import('@/service/api')).default;
    api.get.mockImplementation(async (url) => (url === '/auth/menu' ? { data: { menu: [], abilities } } : { data: [] }));
    const auth = await import('@/service/authService');
    auth.userAbilities.value = abilities;
    const svc = await import('@/service/sicutiService');
    svc.currentUser.value = user;
    return { api, svc };
}

const calls = (api, url) => api.get.mock.calls.filter((c) => c[0] === url);

describe('syncFromBackend', () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => vi.clearAllMocks());

    it('dipanggil bersamaan (mis. saat aplikasi dibuka) hanya berjalan sekali', async () => {
        const { api, svc } = await freshModules();
        await Promise.all([svc.syncFromBackend(), svc.syncFromBackend()]);
        expect(calls(api, '/sicuti/leave-request')).toHaveLength(1);
        expect(calls(api, '/sicuti/policy')).toHaveLength(1);
    });

    it('{ fresh: true } saat sinkron masih berjalan menunggu satu sinkron baru, agar data hasil penulisan ikut terambil', async () => {
        const { api, svc } = await freshModules();
        const running = svc.syncFromBackend();
        const afterWrite = svc.syncFromBackend({ fresh: true });
        const alsoAfterWrite = svc.syncFromBackend({ fresh: true });
        expect(afterWrite).toBe(alsoAfterWrite);
        await Promise.all([running, afterWrite]);
        expect(calls(api, '/sicuti/leave-request')).toHaveLength(2);
    });

    it('hasil sinkron yang selesai setelah logout dibuang', async () => {
        const { api, svc } = await freshModules();
        let release;
        api.get.mockImplementation(async (url) => {
            if (url === '/sicuti/leave-request') {
                await new Promise((resolve) => {
                    release = resolve;
                });
                return { data: { data: [{ id_request: 'MILIK-SESI-LAMA' }], total: 1 } };
            }
            return url === '/auth/menu' ? { data: { menu: [], abilities: [] } } : { data: [] };
        });
        const pending = svc.syncFromBackend();
        svc.logout();
        release();
        await pending;
        expect(svc.sicutiState.leaveRequests).toEqual([]);
        expect(svc.sicutiState.syncStatus).toBe('idle');
    });

    it('logout mengosongkan data per pengguna agar pengguna berikutnya tidak melihatnya (qa-browser Q4)', async () => {
        const { api, svc } = await freshModules();
        api.get.mockImplementation(async (url) => {
            if (url === '/sicuti/leave-request') return { data: { data: [{ id_request: 'MILIK-A', uid_user_system: 'USR101' }], total: 1 } };
            return url === '/auth/menu' ? { data: { menu: [], abilities: [] } } : { data: [] };
        });
        await svc.syncFromBackend();
        svc.setPendingApprovalCount(2);
        expect(svc.sicutiState.leaveRequests).toHaveLength(1);

        svc.logout();
        expect(svc.sicutiState.leaveRequests).toEqual([]);
        expect(svc.sicutiState.users).toEqual([]);
        expect(svc.sicutiState.leaveBalances).toEqual([]);
        expect(svc.sicutiState.pendingApprovalCount).toBe(0);
    });

    it('saldo & hari libur diminta untuk tahun berjalan (URL sama dengan halaman, bisa digabung)', async () => {
        const { api, svc } = await freshModules();
        await svc.syncFromBackend();
        expect(calls(api, '/sicuti/leave-balance/me')[0][1]).toEqual({ year: YEAR });
        expect(calls(api, '/sicuti/holiday')[0][1]).toEqual({ year: YEAR });
    });

    it('syncStatus: loading → ready; gagal → error; sinkron ulang setelah ready tidak kembali ke loading (audit-034 #3)', async () => {
        const { api, svc } = await freshModules();
        expect(svc.sicutiState.syncStatus).toBe('idle');
        const first = svc.syncFromBackend();
        expect(svc.sicutiState.syncStatus).toBe('loading');
        await first;
        expect(svc.sicutiState.syncStatus).toBe('ready');

        const second = svc.syncFromBackend();
        expect(svc.sicutiState.syncStatus).toBe('ready');
        await second;

        api.get.mockImplementation(async (url) => {
            if (url === '/sicuti/leave-request') throw new Error('500');
            return url === '/auth/menu' ? { data: { menu: [], abilities: [] } } : { data: [] };
        });
        await svc.syncFromBackend();
        expect(svc.sicutiState.syncStatus).toBe('error');

        svc.logout();
        expect(svc.sicutiState.syncStatus).toBe('idle');
    });

    it('membuka modul tidak memicu sinkronisasi kedua secara otomatis', async () => {
        vi.useFakeTimers();
        try {
            const { api } = await freshModules();
            await vi.advanceTimersByTimeAsync(500);
            expect(calls(api, '/sicuti/leave-request')).toHaveLength(0);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('hitungan antrean approval (badge)', () => {
    const APPROVER = { abilities: ['approval.view_requests'], user: { id: 'USR002', role: 'staff_approval' } };
    afterEach(() => vi.clearAllMocks());

    it('tidak meminta ulang bila halaman antrean baru saja memuat daftarnya', async () => {
        const { api, svc } = await freshModules(APPROVER);
        svc.setPendingApprovalCount(3);
        await svc.refreshPendingApprovalCount();
        expect(calls(api, '/sicuti/leave-request/pending-approval')).toHaveLength(0);
        expect(svc.sicutiState.pendingApprovalCount).toBe(3);
    });

    it('pemanggilan bersamaan cukup satu request; force tetap meminta ulang', async () => {
        const { api, svc } = await freshModules(APPROVER);
        api.get.mockImplementation(async (url) => (url === '/sicuti/leave-request/pending-approval' ? { data: [{}, {}] } : { data: [] }));
        await Promise.all([svc.refreshPendingApprovalCount(), svc.refreshPendingApprovalCount()]);
        expect(calls(api, '/sicuti/leave-request/pending-approval')).toHaveLength(1);
        expect(svc.sicutiState.pendingApprovalCount).toBe(2);
        await svc.refreshPendingApprovalCount({ force: true });
        expect(calls(api, '/sicuti/leave-request/pending-approval')).toHaveLength(2);
    });
});
