import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const push = vi.fn();
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));

import NotFound from '@/views/NotFound.vue';

const stubs = {
    Button: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' }
};

describe('Halaman tidak ditemukan (404)', () => {
    it('menampilkan kode 404 dan pesan bahwa halaman tidak ada', () => {
        const w = mount(NotFound, { global: { stubs } });
        expect(w.text()).toContain('404');
        expect(w.find('h1').text()).toBe('Halaman tidak ditemukan');
    });

    it('tombol kembali ke Dashboard mengarahkan ke halaman utama', async () => {
        const w = mount(NotFound, { global: { stubs } });
        await w.find('button').trigger('click');
        expect(push).toHaveBeenCalledWith('/');
        expect(w.text()).toContain('Kembali ke Dashboard');
    });
});
