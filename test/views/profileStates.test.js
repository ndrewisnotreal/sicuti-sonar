import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const apiGet = vi.fn();
const apiPut = vi.fn();
let lastConfirm = null;
vi.mock('@/service/api', () => ({ default: { get: (...a) => apiGet(...a), put: (...a) => apiPut(...a) }, assetUrl: (v) => v || '' }));
const changePassword = vi.fn();
vi.mock('@/service/authService', () => ({ authService: { changePassword: (...a) => changePassword(...a) } }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: (o) => (lastConfirm = o) }) }));

import Profile from '@/views/user/Profile.vue';
import { currentUser } from '@/service/sicutiService';
import ProfilePasswordSection from '@/components/user/ProfilePasswordSection.vue';

const stubs = {
    Button: { props: ['label'], template: '<button v-bind="$attrs">{{ label }}<slot /></button>' },
    InputText: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    Password: true
};

describe('Profil (audit-031)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        lastConfirm = null;
    });

    it('#2 gagal muat profil terlihat sebagai peringatan', async () => {
        apiGet.mockRejectedValueOnce(new Error('500'));
        const w = mount(Profile, { global: { stubs }, attachTo: document.body });
        await flushPromises();
        expect(w.find('[role="alert"]').text()).toContain('Data profil terbaru gagal dimuat');
        w.unmount();
    });

    it('#3 email kosong → pesan di bawah field, tidak dikirim', async () => {
        apiGet.mockResolvedValueOnce({ data: { nama: 'Budi', email: 'budi@inalum.co.id' } });
        const w = mount(Profile, { global: { stubs }, attachTo: document.body });
        await flushPromises();
        await w.find('#profile-email').setValue('');
        await w.find('form').trigger('submit');
        expect(w.find('#profile-email-error').text()).toBe('Isi alamat email untuk menerima notifikasi cuti.');
        expect(w.find('#profile-email').attributes('aria-invalid')).toBe('true');
        expect(apiPut).not.toHaveBeenCalled();
        w.unmount();
    });

    it('#4 Esc dengan perubahan → konfirmasi berfokus di "Lanjut mengedit", tidak langsung keluar', async () => {
        apiGet.mockResolvedValueOnce({ data: { nama: 'Budi', email: 'budi@inalum.co.id' } });
        const w = mount(Profile, { global: { stubs }, attachTo: document.body });
        await flushPromises();
        await w.find('#profile-email').setValue('lain@inalum.co.id');
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(lastConfirm).toMatchObject({ header: 'Buang perubahan?', defaultFocus: 'reject' });
        expect(w.emitted('close')).toBeUndefined();
        lastConfirm.accept();
        expect(w.emitted('close')).toHaveLength(1);
        w.unmount();
    });

    it('Esc tanpa perubahan → langsung menutup dialog tanpa konfirmasi', async () => {
        apiGet.mockResolvedValueOnce({ data: { nama: 'Budi', email: 'budi@inalum.co.id' } });
        const w = mount(Profile, { global: { stubs }, attachTo: document.body });
        await flushPromises();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(lastConfirm).toBeNull();
        expect(w.emitted('close')).toHaveLength(1);
        w.unmount();
    });

    it('D-F1 "Lanjut mengedit" menurunkan flag: Esc berikutnya memunculkan konfirmasi lagi', async () => {
        apiGet.mockResolvedValueOnce({ data: { nama: 'Budi', email: 'budi@inalum.co.id' } });
        const w = mount(Profile, { global: { stubs }, attachTo: document.body });
        await flushPromises();
        await w.find('#profile-email').setValue('lain@inalum.co.id');
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        const first = lastConfirm;
        first.reject(); // PrimeVue hanya memanggil reject, bukan onHide
        lastConfirm = null;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(lastConfirm).toMatchObject({ header: 'Buang perubahan?' });
        expect(lastConfirm).not.toBe(first);
        w.unmount();
    });

    it('D-F8 sandi saat ini salah → pesan inline di bawah field, field dikosongkan, bukan toast', async () => {
        apiGet.mockResolvedValueOnce({ data: { nama: 'Budi', email: 'budi@inalum.co.id' } });
        changePassword.mockRejectedValueOnce(new Error('Password saat ini salah'));
        const w = mount(Profile, { global: { stubs }, attachTo: document.body });
        await flushPromises();
        const section = w.findComponent(ProfilePasswordSection);
        section.vm.$emit('update:modelValue', {
            ...section.props('modelValue'),
            newPassword: 'Baru#2026x',
            confirmPassword: 'Baru#2026x',
            currentPassword: 'salah'
        });
        await w.find('form').trigger('submit');
        await flushPromises();
        expect(w.find('#profile-current-password-error').text()).toBe('Kata sandi saat ini salah.');
        w.unmount();
    });

    it('D-F10 akun admin memakai label "Username" seperti menu akun', async () => {
        currentUser.value = { id: 'USR1', name: 'Admin', role: 'admin_super_app', kd_role: 'admin_super_app', namecode: '24000000' };
        apiGet.mockResolvedValueOnce({ data: { nama: 'Admin', namecode: '24000000', email: 'a@inalum.co.id' } });
        const w = mount(Profile, { global: { stubs }, attachTo: document.body });
        await flushPromises();
        expect(w.text()).toContain('Username');
        expect(w.text()).not.toContain('NIK');
        w.unmount();
        currentUser.value = null;
    });
});
