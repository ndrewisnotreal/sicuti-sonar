import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const svc = vi.hoisted(() => ({ getBalances: vi.fn(), getMyLeaves: vi.fn(), getHolidays: vi.fn() }));
vi.mock('@/service/leaveService', () => ({ leaveService: svc }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/service/sicutiService', () => ({
    getStatusSeverity: () => 'info',
    getStatusLabel: (s) => s,
    formatDate: (d) => String(d).slice(0, 10),
    can: () => true
}));

import UserDashboard from '@/components/dashboard/UserDashboard.vue';
import DashboardMiniCalendar from '@/components/dashboard/DashboardMiniCalendar.vue';

const StatStrip = { name: 'StatStrip', props: ['items'], template: '<div />' };
const stubs = {
    StatStrip,
    DashboardMiniCalendar: true,
    LeaveDetailDialog: true,
    DataTable: true,
    Column: true,
    Tag: true,
    RouterLink: { template: '<a><slot /></a>' },
    Button: { props: ['label'], template: '<button @click="$attrs.onClick">{{ label }}<slot /></button>' }
};

describe('Dashboard Karyawan (audit-036)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('#1 gagal muat: peringatan + "–", bukan saldo 0 atau "belum ada pengajuan"; Coba lagi memuat ulang', async () => {
        svc.getBalances.mockRejectedValue(new Error('500'));
        svc.getMyLeaves.mockRejectedValue(new Error('500'));
        const w = mount(UserDashboard, { global: { stubs } });
        await flushPromises();
        expect(w.find('[role="alert"]').text()).toContain('Saldo dan riwayat pengajuan gagal dimuat');
        expect(w.findComponent(StatStrip).props('items').map((i) => i.value)).toEqual(['–', '–', '–', '–']);
        expect(w.text()).toContain('Riwayat belum termuat');
        expect(w.text()).not.toContain('Belum ada pengajuan cuti');

        svc.getBalances.mockResolvedValue([{ year: new Date().getFullYear(), annual_quota: 12, used_days: 2, carry_over_days: 0 }]);
        svc.getMyLeaves.mockResolvedValue([]);
        await w.find('[role="alert"] button').trigger('click');
        await flushPromises();
        expect(w.find('[role="alert"]').exists()).toBe(false);
        expect(w.findComponent(StatStrip).props('items')[0].value).toBe(10);
        expect(w.text()).toContain('Belum ada pengajuan cuti');
    });

    it('#2 tanpa data saldo: tidak mengarang kuota 12', async () => {
        svc.getBalances.mockResolvedValue([]);
        svc.getMyLeaves.mockResolvedValue([]);
        const w = mount(UserDashboard, { global: { stubs } });
        await flushPromises();
        const items = w.findComponent(StatStrip).props('items');
        expect(items.map((i) => i.value)).toEqual(['–', '–', '–', '–']);
        expect(items[0].hint).toBe('Belum ada data saldo');
    });

    it('#1 kalender: hari libur gagal dimuat disebut, bukan diam', async () => {
        svc.getHolidays.mockRejectedValue(new Error('500'));
        const w = mount(DashboardMiniCalendar, { global: { stubs: { Tag: true } } });
        await flushPromises();
        expect(w.text()).toContain(`Hari libur ${new Date().getFullYear()} belum termuat`);
    });
});
