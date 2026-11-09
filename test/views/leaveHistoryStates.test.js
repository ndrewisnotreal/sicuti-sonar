import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const getMyLeaves = vi.fn();
const confirmRequire = vi.fn();
vi.mock('@/service/leaveService', () => ({ leaveService: { getMyLeaves: (...a) => getMyLeaves(...a), cancelLeave: vi.fn() } }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: confirmRequire }) }));
vi.mock('vue-router', () => ({ useRouter: () => ({ replace: vi.fn() }), useRoute: () => ({ query: {} }) }));
vi.mock('@/service/sicutiService', async (importOriginal) => ({ ...(await importOriginal()), can: () => true }));

import LeaveHistory from '@/views/leave/LeaveHistory.vue';

const stubs = {
    DataTable: { props: ['value'], template: '<div class="dt"><slot v-if="!value.length" name="empty" /><span v-else class="rows">{{ value.length }}</span></div>' },
    Column: true,
    Tag: true,
    Paginator: true,
    IconField: { template: '<div><slot /></div>' },
    InputIcon: true,
    InputText: true,
    Button: { props: ['label'], template: '<button>{{ label }}<slot /></button>' },
    LeaveDetailDialog: true,
    LeaveFormDialog: true,
    LeaveCompleteDocumentDialog: true
};

const draft = { id_request: 'REQ-1', status: 'draft', nm_leave_type: 'Cuti Tahunan', start_date: '2026-11-18', end_date: '2026-11-20', total_days: 3, created_at: '2026-11-07' };

describe('Pengajuan Cuti karyawan (audit-027)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('#1 gagal muat tidak tampil sebagai "belum ada pengajuan"; Coba lagi memuat ulang', async () => {
        getMyLeaves.mockRejectedValueOnce(new Error('500'));
        const w = mount(LeaveHistory, { global: { stubs } });
        await flushPromises();
        expect(w.find('[role="alert"]').text()).toContain('Daftar pengajuan gagal dimuat');
        expect(w.text()).not.toContain('Anda belum pernah membuat permohonan cuti');
        expect(w.text()).toContain('Pengajuan belum termuat');

        getMyLeaves.mockResolvedValueOnce([draft]);
        await w.findAll('button').find((b) => b.text() === 'Coba lagi').trigger('click');
        await flushPromises();
        expect(w.find('[role="alert"]').exists()).toBe(false);
        expect(w.find('.dt .rows').text()).toBe('1');
    });

    it('#2 konfirmasi Batalkan berfokus awal di Kembali dan tanpa ikon PrimeIcons', async () => {
        getMyLeaves.mockResolvedValueOnce([draft]);
        const w = mount(LeaveHistory, { global: { stubs } });
        await flushPromises();
        await w.findAll('button').find((b) => b.text() === 'Batalkan').trigger('click');
        const opts = confirmRequire.mock.calls[0][0];
        expect(opts.defaultFocus).toBe('reject');
        expect(opts.icon).toBeUndefined();
    });
});
