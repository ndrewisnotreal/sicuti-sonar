import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const getRoleAbilities = vi.fn();
const confirmRequire = vi.fn();
let leaveGuard = null;
vi.mock('@/service/rbacService', () => ({ rbacService: { getRoleAbilities: (...a) => getRoleAbilities(...a), updateRole: vi.fn(), deleteRole: vi.fn() } }));
vi.mock('@/service/authService', () => ({ authService: { getMenu: vi.fn().mockResolvedValue({}) } }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: confirmRequire }) }));
vi.mock('vue-router', () => ({ onBeforeRouteLeave: (fn) => (leaveGuard = fn) }));

import AdminPermissions from '@/views/admin/AdminPermissions.vue';

const stubs = {
    Button: { props: ['label', 'disabled'], template: '<button :disabled="disabled">{{ label }}<slot /></button>' },
    Select: true,
    RoleFormDialog: true
};

const data = {
    catalog: [{ key: 'cuti', label: 'Pengajuan Cuti', actions: [{ key: 'ajukan', label: 'Mengajukan Cuti' }, { key: 'batal', label: 'Membatalkan' }] }],
    roles: [
        { kd_role: 'staff', nm_role: 'Staff', level: 90, abilities: [], user_count: 3 },
        { kd_role: 'RS004', nm_role: 'Staff', level: 90, abilities: [], user_count: 0 }
    ]
};

describe('Manajemen Hak Akses (audit-025)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        leaveGuard = null;
    });

    it('#3 gagal muat menampilkan alert dan menonaktifkan Tambah Peran', async () => {
        getRoleAbilities.mockRejectedValueOnce(new Error('500'));
        const w = mount(AdminPermissions, { global: { stubs } });
        await flushPromises();
        expect(w.find('[role="alert"]').text()).toContain('Hak akses gagal dimuat');
        expect(w.findAll('button').find((b) => b.text().includes('Tambah Peran')).attributes('disabled')).toBeDefined();
        expect(w.text()).toContain('– peran');
    });

    it('#1 #2 meninggalkan halaman saat ada perubahan meminta konfirmasi berfokus Batal', async () => {
        getRoleAbilities.mockResolvedValueOnce(structuredClone(data));
        const w = mount(AdminPermissions, { global: { stubs } });
        await flushPromises();
        expect(leaveGuard()).toBe(true);

        await w.find('#izin-cuti-ajukan').trigger('change');
        const pending = leaveGuard();
        expect(pending).toBeInstanceOf(Promise);
        const opts = confirmRequire.mock.calls[0][0];
        expect(opts.defaultFocus).toBe('reject');
        opts.reject();
        await expect(pending).resolves.toBe(false);
        expect(w.text()).toContain('1 perubahan');
    });

    it('#4 #9 peran yang dipakai tidak bisa dihapus dan alasannya terlihat; nama ganda diberi kode', async () => {
        getRoleAbilities.mockResolvedValueOnce(structuredClone(data));
        const w = mount(AdminPermissions, { global: { stubs } });
        await flushPromises();
        expect(w.find('#perm-delete-block').text()).toContain('masih dipakai 3 pengguna');
        expect(w.findAll('button').find((b) => b.text().includes('Hapus Peran')).attributes('disabled')).toBeDefined();
        expect(w.text()).toContain('RS004');
    });
});
