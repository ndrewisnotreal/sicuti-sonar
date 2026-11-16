import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('@/layout/composables/layout', () => ({ useLayout: () => ({ isDarkTheme: { value: false } }) }));

import ForgotPassword from '@/views/auth/ForgotPassword.vue';

const stubs = {
    RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' }
};

describe('Lupa kata sandi: instruksi pemulihan', () => {
    it('menjelaskan bahwa kata sandi tidak bisa diatur ulang mandiri dan harus lewat admin', () => {
        const w = mount(ForgotPassword, { global: { stubs } });
        expect(w.find('h1').text()).toBe('Lupa kata sandi?');
        expect(w.text()).toContain('Kata sandi tidak bisa diatur ulang sendiri');
        expect(w.text()).toContain('Admin Seksi');
        expect(w.text()).toContain('Admin Super App');
    });

    it('meminta NIK atau username dan menunjuk menu profil untuk mengganti kata sandi', () => {
        const w = mount(ForgotPassword, { global: { stubs } });
        expect(w.text()).toContain('Sebutkan NIK atau username Anda');
        expect(w.text()).toContain('Ubah kata sandi');
    });

    it('tautan kembali mengarah ke halaman masuk', () => {
        const w = mount(ForgotPassword, { global: { stubs } });
        const link = w.find('a[href="/auth/login"]');
        expect(link.exists()).toBe(true);
        expect(link.text()).toContain('Kembali ke halaman masuk');
    });
});
