import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const svc = { getUsers: vi.fn(), getDepartments: vi.fn(), unlockUser: vi.fn(), createUser: vi.fn(), updateUser: vi.fn() };
const getRoles = vi.fn();
const toastAdd = vi.fn();
vi.mock('@/service/adminService', () => ({ adminService: new Proxy({}, { get: (_, k) => (...a) => svc[k](...a) }) }));
vi.mock('@/service/rbacService', () => ({ rbacService: { getRoles: (...a) => getRoles(...a) } }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));

import AdminAccounts from '@/views/admin/AdminAccounts.vue';
import AccountFormDialog from '@/components/admin/AccountFormDialog.vue';
import { currentUser } from '@/service/sicutiService';

const viewStubs = {
    DataTable: { props: ['value'], template: '<div class="dt"><slot v-if="!value.length" name="empty" /><span v-else class="rows">{{ value.length }}</span></div>' },
    Column: true,
    Tag: true,
    Select: true,
    IconField: { template: '<div><slot /></div>' },
    InputIcon: true,
    InputText: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :id="$attrs.id" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    // Klik diteruskan lewat atribut fallthrough.
    Button: { props: ['label'], template: '<button>{{ label }}<slot /></button>' },
    AccountFormDialog: { name: 'AccountFormDialog', props: ['rolesError'], template: '<div />' },
    ResetPasswordDialog: true,
    StatusHistoryDialog: true,
    DeactivateAccountDialog: true
};

const formStubs = {
    Dialog: { template: '<div><slot /><slot name="footer" /></div>' },
    InputText: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :id="$attrs.id" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    Select: { props: ['inputId'], template: '<input :id="inputId" />' },
    DatePicker: { props: ['inputId'], template: '<input :id="inputId" />' },
    Checkbox: { props: ['inputId'], template: '<input type="checkbox" :id="inputId" />' },
    Button: { props: ['label', 'disabled'], template: '<button :disabled="disabled">{{ label }}<slot /></button>' }
};

const user = { uid_user_system: 'U1', nama: 'Budi', username: '24000001', kd_dept: 'SIT', status_user: 'A', is_locked: true };

describe('Manajemen Akun (audit-024)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        currentUser.value = { id: 'ADM', role: 'admin_super_app' };
        svc.getDepartments.mockResolvedValue([]);
        getRoles.mockResolvedValue([{ kd_role: 'staff', nm_role: 'Staff', level: 50 }]);
    });

    it('#2 gagal muat akun tidak tampil sebagai kosong; Coba lagi memuat ulang', async () => {
        svc.getUsers.mockRejectedValueOnce(new Error('500'));
        const w = mount(AdminAccounts, { global: { stubs: viewStubs } });
        await flushPromises();
        expect(w.find('[role="alert"]').text()).toContain('Data akun gagal dimuat');
        expect(w.find('.dt').text()).toBe('Data akun belum termuat.');
        expect(w.text()).toContain('Total: – akun');

        svc.getUsers.mockResolvedValueOnce([user]);
        await w.findAll('button').find((b) => b.text() === 'Coba lagi').trigger('click');
        await flushPromises();
        expect(w.find('[role="alert"]').exists()).toBe(false);
        expect(w.find('.dt .rows').text()).toBe('1');
    });

    it('#2 peran gagal dimuat ditulis dan diteruskan ke dialog', async () => {
        svc.getUsers.mockResolvedValue([user]);
        getRoles.mockRejectedValueOnce(new Error('500'));
        const w = mount(AdminAccounts, { global: { stubs: viewStubs } });
        await flushPromises();
        expect(w.text()).toContain('Daftar peran gagal dimuat');
        expect(w.findComponent({ name: 'AccountFormDialog' }).props('rolesError')).toBe(true);
    });

    it('#11 buka kunci tidak terkirim dua kali saat ditekan beruntun', async () => {
        svc.getUsers.mockResolvedValue([user]);
        let release;
        svc.unlockUser.mockImplementation(() => new Promise((r) => (release = r)));
        const w = mount(AdminAccounts, { global: { stubs: viewStubs } });
        await flushPromises();
        // Tabel distub tanpa kolom; tombol di daftar HP tetap dirender dan memakai handler yang sama.
        const btn = () => w.findAll('button').find((b) => b.attributes('aria-label') === 'Buka kunci akun Budi');
        await btn().trigger('click');
        await btn().trigger('click');
        expect(svc.unlockUser).toHaveBeenCalledTimes(1);
        release();
        await flushPromises();
    });

    it('#1 #3 kata sandi lemah ditolak sebelum dikirim dan fokus pindah ke field', async () => {
        const w = mount(AccountFormDialog, {
            props: { visible: false, isEditing: false, roles: [{ kd_role: 'staff', nm_role: 'Staff', level: 50 }], departments: [{ kd_dept: 'SIT', nm_dept: 'SIT' }] },
            attachTo: document.body,
            global: { stubs: formStubs }
        });
        await w.setProps({ visible: true });
        await w.find('#acc-nik').setValue('24019999');
        await w.find('#acc-name').setValue('Uji');
        await w.find('#acc-password').setValue('abcdefgh');
        await w.findAll('button').find((b) => b.text() === 'Buat Akun').trigger('click');
        await flushPromises();

        expect(svc.createUser).not.toHaveBeenCalled();
        expect(w.find('#acc-password-error').text()).toContain('huruf besar dan kecil');
        expect(w.find('#acc-password').attributes('aria-describedby')).toContain('acc-password-error');
        expect(document.activeElement?.id).toBe('acc-password');
        for (const id of ['acc-username', 'acc-nik', 'acc-name', 'acc-email', 'acc-dept', 'acc-role', 'acc-supervisor', 'acc-password']) {
            expect(w.find(`label[for="${id}"]`).exists()).toBe(true);
        }
        w.unmount();
    });

    it('#2 dialog menolak simpan saat peran gagal dimuat', async () => {
        const w = mount(AccountFormDialog, {
            props: { visible: true, rolesError: true, roles: [], departments: [] },
            global: { stubs: formStubs }
        });
        expect(w.find('[role="alert"]').text()).toContain('Daftar peran gagal dimuat');
        expect(w.findAll('button').find((b) => b.text() === 'Buat Akun').attributes('disabled')).toBeDefined();
    });
});
