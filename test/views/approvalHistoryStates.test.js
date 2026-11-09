import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const getApprovalHistory = vi.fn();
vi.mock('@/service/approvalService', () => ({ approvalService: { getApprovalHistory: (...a) => getApprovalHistory(...a) } }));

import ApprovalHistory from '@/views/approval/ApprovalHistory.vue';
import { currentUser } from '@/service/sicutiService';

const stubs = {
    DataTable: { props: ['value'], template: '<div class="dt"><slot v-if="!value.length" name="empty" /><span v-else class="rows">{{ value.length }}</span></div>' },
    Column: true,
    Tag: { props: ['value'], template: '<span class="tag">{{ value }}</span>' },
    Select: { props: ['options'], template: '<div class="select">{{ options.map((o) => o.label).join("|") }}</div>' },
    Paginator: true,
    IconField: { template: '<div><slot /></div>' },
    InputIcon: true,
    InputText: true,
    Button: { props: ['label'], template: '<button>{{ label }}<slot /></button>' },
    LeaveDetailDialog: true
};

// Disetujui di langkah 1 oleh approver ini, masih menunggu langkah 2.
const req = {
    id_request: 'REQ-1',
    status: 'pending_validation',
    requester_name: 'Budi',
    nm_dept: 'SIT',
    start_date: '2026-11-20',
    end_date: '2026-11-22',
    total_days: 3,
    approval_records: [{ approver_id: 'USR001', action: 'approve', notes: '', created_at: '2026-11-01T08:00:00Z' }]
};

describe('Riwayat Approval approver (audit-030)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        currentUser.value = { id: 'USR001' };
    });

    it('#1 gagal muat tidak tampil sebagai riwayat kosong; Coba lagi memuat ulang', async () => {
        getApprovalHistory.mockRejectedValueOnce(new Error('500'));
        const w = mount(ApprovalHistory, { global: { stubs } });
        await flushPromises();
        expect(w.find('[role="alert"]').text()).toContain('Riwayat persetujuan gagal dimuat');
        expect(w.text()).not.toContain('Belum ada pengajuan yang Anda proses');
        expect(w.text()).toContain('Total: – pengajuan');

        getApprovalHistory.mockResolvedValueOnce([req]);
        await w.findAll('button').find((b) => b.text() === 'Coba lagi').trigger('click');
        await flushPromises();
        expect(w.find('[role="alert"]').exists()).toBe(false);
        expect(w.find('.dt .rows').text()).toBe('1');
    });

    it('#2 keputusan Anda terpisah dari status sekarang; status yang masih berjalan bisa disaring', async () => {
        getApprovalHistory.mockResolvedValueOnce([req]);
        const w = mount(ApprovalHistory, { global: { stubs } });
        await flushPromises();
        const tags = w.findAll('li .tag').map((t) => t.text());
        expect(tags).toEqual(['Disetujui', 'Menunggu Validasi']);
        expect(w.find('.select').text()).toBe('Semua status|Menunggu Validasi');
        expect(w.find('li').text()).toContain('Tanpa catatan');
    });
});
