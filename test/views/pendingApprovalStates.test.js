import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const getPendingApprovals = vi.fn();
vi.mock('@/service/approvalService', () => ({ approvalService: { getPendingApprovals: (...a) => getPendingApprovals(...a) } }));

import PendingApproval from '@/views/approval/PendingApproval.vue';

const stubs = {
    DataTable: { props: ['value'], template: '<div class="dt"><slot v-if="!value.length" name="empty" /><span v-else class="rows">{{ value.length }}</span></div>' },
    Column: true,
    Tag: true,
    Select: true,
    Paginator: true,
    IconField: { template: '<div><slot /></div>' },
    InputIcon: true,
    InputText: true,
    Button: { props: ['label'], template: '<button>{{ label }}<slot /></button>' },
    LeaveAttachment: true,
    ApprovalActionDialog: true,
    LeaveDetailDialog: true
};

const req = { id_request: 'REQ-1', status: 'submitted', requester_name: 'Budi', nm_dept: 'SIT', start_date: '2026-11-20', end_date: '2026-11-22', total_days: 3 };

describe('Validasi Pengajuan approver (audit-029)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('#1 gagal muat tidak tampil sebagai antrean kosong; Coba lagi memuat ulang', async () => {
        getPendingApprovals.mockRejectedValueOnce(new Error('500'));
        const w = mount(PendingApproval, { global: { stubs } });
        await flushPromises();
        expect(w.find('[role="alert"]').text()).toContain('Antrean validasi gagal dimuat');
        expect(w.text()).not.toContain('Tidak ada pengajuan yang menunggu keputusan Anda');
        expect(w.text()).toContain('Total: – pengajuan');

        getPendingApprovals.mockResolvedValueOnce([req]);
        await w.findAll('button').find((b) => b.text() === 'Coba lagi').trigger('click');
        await flushPromises();
        expect(w.find('[role="alert"]').exists()).toBe(false);
        expect(w.find('.dt .rows').text()).toBe('1');
    });
});
