import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const getBalances = vi.fn();
const getBalanceMutations = vi.fn();
vi.mock('@/service/leaveService', () => ({ leaveService: { getBalances: (...a) => getBalances(...a), getBalanceMutations: (...a) => getBalanceMutations(...a) } }));
vi.mock('@/service/sicutiService', async (importOriginal) => ({ ...(await importOriginal()), can: () => true }));

import LeaveBalance from '@/views/leave/LeaveBalance.vue';

const stubs = {
    StatStrip: { props: ['items'], template: '<div class="stats">{{ items.map((i) => `${i.label}=${i.value}`).join("|") }}</div>' },
    DataTable: { props: ['value'], template: '<div class="dt"><slot v-if="!value.length" name="empty" /><span v-else class="rows">{{ value.length }}</span></div>' },
    Column: true,
    Select: true,
    Button: { props: ['label'], template: '<button>{{ label }}<slot /></button>' }
};

const balance = { year: new Date().getFullYear(), annual_quota: 12, used_days: 1, carry_over_days: 0, remaining: 11 };

describe('Saldo Cuti karyawan (audit-028)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('#1 saldo gagal dimuat tidak menampilkan angka karangan; Coba lagi memuat ulang', async () => {
        getBalances.mockRejectedValueOnce(new Error('500'));
        getBalanceMutations.mockResolvedValueOnce([]);
        const w = mount(LeaveBalance, { global: { stubs } });
        await flushPromises();
        expect(w.find('[role="alert"]').text()).toContain('gagal dimuat');
        expect(w.find('.stats').text()).toBe('Saldo tersisa=–|Hak kuota tahunan=–|Cuti terpakai=–|Sisa tahun lalu=–');

        getBalances.mockResolvedValueOnce([balance]);
        getBalanceMutations.mockResolvedValueOnce([{ id: 'q', type: 'credit', amount: 12, description: 'Kuota', date: '2026-08-14' }]);
        await w.findAll('button').find((b) => b.text() === 'Coba lagi').trigger('click');
        await flushPromises();
        expect(w.find('[role="alert"]').exists()).toBe(false);
        expect(w.find('.stats').text()).toContain('Saldo tersisa=11');
        expect(w.find('.dt .rows').text()).toBe('1');
    });

    it('#11 riwayat gagal dimuat ditandai, saldo tetap tampil', async () => {
        getBalances.mockResolvedValueOnce([balance]);
        getBalanceMutations.mockRejectedValueOnce(new Error('500'));
        const w = mount(LeaveBalance, { global: { stubs } });
        await flushPromises();
        expect(w.find('[role="alert"]').text()).toContain('Riwayat perubahan saldo gagal dimuat');
        expect(w.find('.stats').text()).toContain('Saldo tersisa=11');
        expect(w.find('.dt').text()).toContain('Riwayat belum termuat.');
    });
});
