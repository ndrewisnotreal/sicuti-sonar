import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/service/api', () => ({
    default: { get: vi.fn(), post: vi.fn() },
    clearAuth: vi.fn()
}));

const LOGIN_RES = {
    data: {
        user: { uid_user_system: 'USR101', nama: 'Ikhsan', kd_role: 'staff_it' },
        abilities: ['pengajuan_cuti.submit'],
        build_menu: [],
        menu: []
    }
};

async function freshModules() {
    vi.resetModules();
    const api = (await import('@/service/api')).default;
    const { authService, userAbilities } = await import('@/service/authService');
    return { api, authService, userAbilities };
}

describe('authService menu & izin', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });
    afterEach(() => vi.useRealTimers());

    it('login: menu & izin dari respons login dipakai langsung (menu kosong tetap sah), tanpa GET /auth/menu', async () => {
        const { api, authService, userAbilities } = await freshModules();
        api.post.mockResolvedValue(LOGIN_RES);
        await authService.login('OS24980032', 'password123');
        expect(userAbilities.value).toEqual(['pengajuan_cuti.submit']);
        expect(api.get).not.toHaveBeenCalled();
    });

    it('login: username di-trim, password dikirim apa adanya (backend meng-hash password termasuk spasi)', async () => {
        const { api, authService } = await freshModules();
        api.post.mockResolvedValue(LOGIN_RES);
        await authService.login('  OS24980032 ', ' Rahasia1! ');
        expect(api.post).toHaveBeenCalledWith('/auth/authorize', { username: 'OS24980032', password: ' Rahasia1! ' });
    });

    it('getMenu tepat setelah login memakai data login (tidak meminta ulang), kecuali dipaksa', async () => {
        const { api, authService } = await freshModules();
        api.post.mockResolvedValue(LOGIN_RES);
        api.get.mockResolvedValue({ data: { menu: [], abilities: ['pengajuan_cuti.submit'] } });
        await authService.login('OS24980032', 'password123');
        await authService.getMenu();
        expect(api.get).not.toHaveBeenCalled();
        await authService.getMenu({ force: true });
        expect(api.get).toHaveBeenCalledTimes(1);
    });

    it('getMenu yang dipanggil bersamaan (sinkronisasi + sidebar) cukup satu request', async () => {
        const { api, authService } = await freshModules();
        const { setEncryptedItem } = await import('@/utils/encryption');
        setEncryptedItem('sicuti_auth', { uid_user_system: 'USR101' });
        api.get.mockResolvedValue({ data: { menu: [], abilities: ['a.b'] } });
        await Promise.all([authService.getMenu(), authService.getMenu(), authService.getMenu()]);
        expect(api.get).toHaveBeenCalledTimes(1);
    });

    it('setelah data menu kedaluwarsa, getMenu meminta ulang (izin yang diubah admin tetap terbaca)', async () => {
        vi.useFakeTimers({ now: new Date('2026-10-15T08:00:00'), toFake: ['Date'] });
        const { api, authService } = await freshModules();
        const { setEncryptedItem } = await import('@/utils/encryption');
        setEncryptedItem('sicuti_auth', { uid_user_system: 'USR101' });
        api.get.mockResolvedValue({ data: { menu: [], abilities: ['a.b'] } });
        await authService.getMenu();
        vi.setSystemTime(new Date('2026-10-15T08:00:10'));
        await authService.getMenu();
        expect(api.get).toHaveBeenCalledTimes(2);
    });
});
