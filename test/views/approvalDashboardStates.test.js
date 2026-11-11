import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const svc = vi.hoisted(() => ({ getPendingApprovals: vi.fn(), getApprovalHistory: vi.fn(), getOnLeaveToday: vi.fn() }));
vi.mock('@/service/approvalService', () => ({ approvalService: svc }));
vi.mock('@/service/sicutiService', () => ({
    currentUser: { value: { id: 'USR1' } },
    can: () => true,
    formatDate: (d) => String(d).slice(0, 10),
    attachmentInfo: () => null,
    documentPending: () => false,
    sicutiState: { dataVersion: 0 },
    setPendingApprovalCount: vi.fn(),
    isStepApprover: () => true
}));

import ApprovalDashboard from '@/components/dashboard/ApprovalDashboard.vue';

const StatStrip = { name: 'StatStrip', props: ['items'], template: '<div />' };
const stubs = {
    StatStrip,
    LeaveDetailDialog: true,
    ApprovalActionDialog: true,
    LeaveAttachment: true,
    DataTable: true,
    Column: true,
    Paginator: true,
    IconField: { template: '<div><slot /></div>' },
    InputIcon: true,
    InputText: true,
    RouterLink: { template: '<a><slot /></a>' },
    Button: { props: ['label'], template: '<button @click="$attrs.onClick">{{ label }}<slot /></button>' }
};

describe('Dashboard Approval (audit-035)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('#1 gagal muat: angka "–" dan peringatan, bukan "Antrean kosong"; Coba lagi memuat ulang', async () => {
        svc.getPendingApprovals.mockRejectedValue(new Error('500'));
        svc.getApprovalHistory.mockRejectedValue(new Error('500'));
        svc.getOnLeaveToday.mockResolvedValue([]);
        const w = mount(ApprovalDashboard, { global: { stubs } });
        await flushPromises();
        const items = w.findComponent(StatStrip).props('items');
        expect(items.map((i) => i.value)).toEqual(['–', '–', '–']);
        expect(items[0].hint).toBe('Antrean belum termuat');
        expect(w.find('[role="alert"]').text()).toContain('Antrean dan riwayat persetujuan gagal dimuat');

        svc.getPendingApprovals.mockResolvedValue([]);
        svc.getApprovalHistory.mockResolvedValue([]);
        await w.find('[role="alert"] button').trigger('click');
        await flushPromises();
        expect(w.find('[role="alert"]').exists()).toBe(false);
        expect(w.findComponent(StatStrip).props('items')[0]).toMatchObject({ value: 0, hint: 'Antrean kosong' });
    });

    it('#2 endpoint cuti hari ini gagal: sumber data disebut, tanpa klaim "seluruh tim aktif"', async () => {
        svc.getPendingApprovals.mockResolvedValue([]);
        svc.getApprovalHistory.mockResolvedValue([]);
        svc.getOnLeaveToday.mockRejectedValue(new Error('404'));
        const w = mount(ApprovalDashboard, { global: { stubs } });
        await flushPromises();
        expect(w.text()).toContain('Hanya dari pengajuan yang pernah Anda proses');
        expect(w.text()).not.toContain('Seluruh anggota tim aktif');
    });
});
