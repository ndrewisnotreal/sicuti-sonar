import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const { state, syncFromBackend } = vi.hoisted(() => ({ state: { users: [], leaveRequests: [], holidays: [], syncStatus: 'ready' }, syncFromBackend: vi.fn() }));
vi.mock('@/layout/composables/layout', () => ({ useLayout: () => ({ isDarkTheme: { value: false } }) }));
vi.mock('@/service/sicutiService', () => ({
    CURRENT_YEAR: 2026,
    currentUser: { value: { id: 'ADM' } },
    sicutiState: state,
    getAdminDivision: () => null,
    getDivisionUsers: () => state.users,
    getDivisionRequests: () => state.leaveRequests,
    getUser: () => null,
    syncFromBackend
}));

import AdminDashboard from '@/components/dashboard/AdminDashboard.vue';

const Chart = { name: 'Chart', props: ['data', 'options', 'pt'], template: '<div class="chart" />' };
const stubs = { Chart, Tag: { props: ['value'], template: '<span>{{ value }}</span>' }, StatStrip: true, AdminDashboardCalendar: true };

describe('Dashboard Admin (audit-034)', () => {
    it('#2 tanpa pengajuan tahun ini tampil pesan, bukan grafik kosong', () => {
        state.leaveRequests = [{ id: 1, status: 'approved', createdAt: '2025-03-01T08:00:00' }];
        const w = mount(AdminDashboard, { global: { stubs } });
        expect(w.text()).toContain('Belum ada pengajuan cuti yang dibuat pada 2026');
        expect(w.text()).toContain('0 Pengajuan');
        expect(w.findComponent(Chart).exists()).toBe(false);
    });

    it('#1 grafik hanya menghitung pengajuan tahun berjalan dan punya teks pengganti', () => {
        state.leaveRequests = [
            { id: 1, status: 'approved', createdAt: '2025-03-01T08:00:00' },
            { id: 2, status: 'approved', createdAt: '2026-03-10T08:00:00' },
            { id: 3, status: 'submitted', createdAt: '2026-11-05T08:00:00' }
        ];
        const w = mount(AdminDashboard, { global: { stubs } });
        const chart = w.findComponent(Chart);
        expect(chart.props('data').datasets[0].data[2]).toBe(1);
        expect(chart.props('data').datasets[0].data[10]).toBe(1);
        expect(w.text()).toContain('2 Pengajuan');
        expect(chart.props('pt').canvas['aria-label']).toBe('Pengajuan cuti per bulan tahun 2026: Maret 1, November 1.');
    });

    it('#3 memuat: angka "–", bukan 0; gagal: peringatan + Coba lagi memicu sinkron ulang', async () => {
        state.leaveRequests = [];
        const StatStrip = { name: 'StatStrip', props: ['items'], template: '<div />' };
        const Button = { props: ['label'], template: '<button @click="$attrs.onClick">{{ label }}</button>' };
        state.syncStatus = 'loading';
        const w = mount(AdminDashboard, { global: { stubs: { ...stubs, StatStrip, Button } } });
        expect(w.findComponent(StatStrip).props('items').map((i) => i.value)).toEqual(['–', '–', '–', '–']);
        expect(w.text()).toContain('Memuat data');
        expect(w.text()).not.toContain('Belum ada pengajuan');

        state.syncStatus = 'error';
        const failed = mount(AdminDashboard, { global: { stubs: { ...stubs, StatStrip, Button } } });
        expect(failed.find('[role="alert"]').text()).toContain('Data dashboard gagal dimuat');
        await failed.find('button').trigger('click');
        expect(syncFromBackend).toHaveBeenCalledTimes(1);
        state.syncStatus = 'ready';
    });
});
