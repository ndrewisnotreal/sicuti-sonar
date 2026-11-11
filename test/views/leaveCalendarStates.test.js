import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const apiGet = vi.fn();
vi.mock('@/service/api', () => ({ default: { get: (...args) => apiGet(...args) } }));

import LeaveCalendar from '@/views/leave/LeaveCalendar.vue';

const stubs = { Select: true, Tag: true, Button: { props: ['label'], template: '<button>{{ label }}</button>' } };

describe('Kalender Cuti: state gagal dimuat (audit-010 #2)', () => {
    it('API gagal tidak ditampilkan sebagai "tidak ada yang cuti", dan Coba lagi memuat ulang', async () => {
        apiGet.mockRejectedValueOnce(new Error('500'));
        const w = mount(LeaveCalendar, { global: { stubs } });
        await flushPromises();
        expect(w.find('[role="alert"]').text()).toContain('Kalender gagal dimuat');
        expect(w.text()).not.toContain('Tidak ada karyawan yang cuti pada tanggal ini');
        expect(w.find('[data-tour="cal-summary"]').text()).toContain('–');

        apiGet.mockResolvedValueOnce({ data: { leaves: [], holidays: [] } });
        await w.findAll('button').find((b) => b.text() === 'Coba lagi').trigger('click');
        await flushPromises();
        expect(w.find('[role="alert"]').exists()).toBe(false);
        expect(w.text()).toContain('Tidak ada karyawan yang cuti pada tanggal ini');
    });
});
