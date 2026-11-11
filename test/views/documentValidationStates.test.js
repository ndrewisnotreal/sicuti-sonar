import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

vi.mock('vue-router', () => ({ useRoute: () => ({ params: { secret: 'abc' } }) }));
vi.mock('@/service/api', () => ({ API_BASE: '/api', APP_KEY: 'k' }));

import DocumentValidation from '@/views/approval/DocumentValidation.vue';

const stubs = { Button: { props: ['label'], template: '<button @click="$attrs.onClick">{{ label }}</button>' } };

describe('Validasi Dokumen (audit-033)', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('#1 gagal jaringan bukan "Dokumen Tidak Valid"; Coba lagi memeriksa ulang', async () => {
        const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));
        vi.stubGlobal('fetch', fetch);
        const w = mount(DocumentValidation, { global: { stubs } });
        await flushPromises();
        expect(w.text()).toContain('Dokumen belum bisa diperiksa');
        expect(w.text()).not.toContain('Dokumen Tidak Valid');

        fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, data: { is_valid: true, keterangan: 'Sah', document: null } }) });
        await w.find('button').trigger('click');
        await flushPromises();
        expect(w.text()).toContain('Dokumen Valid');
    });

    it('token salah (4xx) tetap "Dokumen Tidak Valid"', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ success: false, error: 'Format token validasi tidak valid.' }) }));
        const w = mount(DocumentValidation, { global: { stubs } });
        await flushPromises();
        expect(w.text()).toContain('Dokumen Tidak Valid');
        expect(w.text()).toContain('Format token validasi tidak valid.');
    });
});
