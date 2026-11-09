import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const apiGet = vi.fn();
const apiPut = vi.fn();
let lastConfirm = null;
const push = vi.fn();
vi.mock('@/service/api', () => ({ default: { get: (...a) => apiGet(...a), put: (...a) => apiPut(...a) }, assetUrl: (v) => v || '' }));
vi.mock('@/service/authService', () => ({ authService: { changePassword: vi.fn() } }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: (o) => (lastConfirm = o) }) }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push, back: vi.fn() }) }));

import Profile from '@/views/user/Profile.vue';

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
        expect(push).not.toHaveBeenCalled();
        lastConfirm.accept();
        expect(push).toHaveBeenCalledWith('/');
        w.unmount();
    });
});
