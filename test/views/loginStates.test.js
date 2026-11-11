import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const login = vi.fn();
vi.mock('@/service/sicutiService', () => ({ login: (...a) => login(...a) }));
vi.mock('@/service/api', () => ({ default: { post: vi.fn() }, LOGOUT_NOTICE_KEY: 'k' }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import Login from '@/views/auth/Login.vue';

const stubs = {
    Button: { props: ['label'], template: '<button v-bind="$attrs">{{ label }}<slot /></button>' },
    InputText: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    Password: { props: ['modelValue', 'inputId'], emits: ['update:modelValue'], template: '<input type="password" :id="inputId" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    IconField: { template: '<div><slot /></div>' },
    InputIcon: true,
    RouterLink: { template: '<a><slot /></a>' }
};

describe('Login (audit-032)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('#2 isian kosong → pesan di bawah field, tidak memanggil login', async () => {
        const w = mount(Login, { global: { stubs }, attachTo: document.body });
        await w.find('form').trigger('submit');
        await flushPromises();
        expect(w.find('#login-id-error').text()).toBe('Isi NIK atau email Anda.');
        expect(w.find('#login-password-error').text()).toBe('Isi kata sandi Anda.');
        expect(w.find('#login-id').attributes('aria-invalid')).toBe('true');
        expect(w.find('[role="alert"]').exists()).toBe(false);
        expect(login).not.toHaveBeenCalled();
        w.unmount();
    });

    it('galat server tetap di banner atas', async () => {
        login.mockResolvedValueOnce({ success: false, message: 'NIK atau kata sandi salah' });
        const w = mount(Login, { global: { stubs }, attachTo: document.body });
        await w.find('#login-id').setValue('123');
        await w.find('#login-password').setValue('x');
        await w.find('form').trigger('submit');
        await flushPromises();
        expect(w.find('[role="alert"]').text()).toBe('NIK atau kata sandi salah');
        w.unmount();
    });

    it('tombol Masuk menampilkan "Memproses…" selama login berjalan', async () => {
        let resolve;
        login.mockReturnValueOnce(new Promise((r) => (resolve = r)));
        const w = mount(Login, { global: { stubs }, attachTo: document.body });
        await w.find('#login-id').setValue('123');
        await w.find('#login-password').setValue('x');
        await w.find('form').trigger('submit');
        expect(w.find('button[type="submit"]').text()).toBe('Memproses…');
        resolve({ success: false, message: 'gagal' });
        await flushPromises();
        expect(w.find('button[type="submit"]').text()).toBe('Masuk');
        w.unmount();
    });
});
