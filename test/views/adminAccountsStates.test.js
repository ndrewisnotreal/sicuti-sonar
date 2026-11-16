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
    // Menu "Lainnya" di kartu HP (audit-013 #10): item dirender sebagai tombol agar command bisa dipicu.
    Menu: {
        props: ['model'],
        methods: { toggle() {} },
        template: '<div><button v-for="item in model.filter((m) => !m.separator)" :key="item.label" :aria-label="item.label" @click="item.command()">{{ item.label }}</button></div>'
    },
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
        // Tabel distub tanpa kolom; di daftar HP aksi ada di menu "Lainnya" yang memakai handler yang sama.
        await w.findAll('button').find((b) => b.attributes('aria-label') === 'Aksi lain untuk Budi').trigger('click');
        const btn = () => w.findAll('button').find((b) => b.attributes('aria-label') === 'Buka kunci akun');
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

    it('#1 tanda wajib NIK tampil untuk peran non-admin; Username wajib hanya saat NIK kosong', async () => {
        const w = mount(AccountFormDialog, {
            props: { visible: true, roles: [{ kd_role: 'staff', nm_role: 'Staff', level: 50 }], departments: [] },
            global: { stubs: formStubs }
        });
        expect(w.find('label[for="acc-nik"] span[aria-hidden="true"]').exists()).toBe(true);
        expect(w.find('label[for="acc-username"] span[aria-hidden="true"]').exists()).toBe(true);
        expect(w.find('#acc-username').attributes('aria-required')).toBe('true');

        await w.find('#acc-nik').setValue('24019999');
        expect(w.find('label[for="acc-username"] span[aria-hidden="true"]').exists()).toBe(false);
        expect(w.find('#acc-username').attributes('aria-required')).toBe('false');
        w.unmount();
    });

    describe('NIK dan username (B-F3, B-F6, B-F9)', () => {
        const props = { visible: false, isEditing: false, roles: [{ kd_role: 'staff', nm_role: 'Staff', level: 50 }], departments: [{ kd_dept: 'SIT', nm_dept: 'SIT' }] };
        async function mountForm() {
            const w = mount(AccountFormDialog, { props, attachTo: document.body, global: { stubs: formStubs } });
            await w.setProps({ visible: true });
            return w;
        }
        const submit = async (w) => {
            await w.findAll('button').find((b) => b.text() === 'Buat Akun').trigger('click');
            await flushPromises();
        };

        it('username kosong tidak disalin ke form; payload memakai NIK terakhir', async () => {
            svc.createUser.mockResolvedValue({});
            const w = await mountForm();
            await w.find('#acc-nik').setValue('1234');
            await w.find('#acc-name').setValue('Uji');
            await w.find('#acc-password').setValue('Abcdefg1!x');
            await submit(w);
            expect(svc.createUser).not.toHaveBeenCalled();
            expect(w.find('#acc-username').element.value).toBe('');

            await w.find('#acc-nik').setValue('OS12345678');
            await submit(w);
            expect(svc.createUser).toHaveBeenCalledWith(expect.objectContaining({ username: 'OS12345678', namecode: 'OS12345678' }));
            w.unmount();
        });

        it('NIK OS + 8 angka dan 8 angka diterima untuk peran non-admin apa pun; selain itu ditolak', async () => {
            svc.createUser.mockResolvedValue({});
            const w = await mountForm();
            await w.find('#acc-nik').setValue('OS1234');
            await submit(w);
            expect(w.find('#acc-nik-error').text()).toBe('NIK: 8 angka, atau OS diikuti 8 angka');

            await w.find('#acc-nik').setValue('OS24980032');
            await w.find('#acc-name').setValue('Uji');
            await w.find('#acc-password').setValue('Abcdefg1!x');
            await submit(w);
            expect(w.find('#acc-nik-error').exists()).toBe(false);
            expect(svc.createUser).toHaveBeenCalledTimes(1);
            w.unmount();
        });

        it('duplikat (409) ditandai di field NIK, bukan toast', async () => {
            svc.createUser.mockRejectedValue(Object.assign(new Error('Username "24019999" sudah dipakai'), { status: 409 }));
            toastAdd.mockClear();
            const w = await mountForm();
            await w.find('#acc-nik').setValue('24019999');
            await w.find('#acc-name').setValue('Uji');
            await w.find('#acc-password').setValue('Abcdefg1!x');
            await submit(w);
            expect(w.find('#acc-nik-error').text()).toContain('sudah dipakai');
            expect(toastAdd).not.toHaveBeenCalled();
            w.unmount();
        });
    });
});
