import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const svc = {
    getLeaveRequests: vi.fn(),
    getBalances: vi.fn(),
    getLeaveTypes: vi.fn(),
    getDepartments: vi.fn()
};
const apiGet = vi.fn();
const downloadExcel = vi.fn();
const printReportPdf = vi.fn(() => true);
const toastAdd = vi.fn();
vi.mock('@/service/adminService', () => ({
    adminService: new Proxy({}, { get: (_, k) => (...a) => svc[k](...a) })
}));
vi.mock('@/service/api', () => ({ default: { get: (...a) => apiGet(...a) } }));
vi.mock('@/utils/reportExport', () => ({ downloadExcel: (...a) => downloadExcel(...a), printReportPdf: (...a) => printReportPdf(...a) }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));

import AdminReports from '@/views/admin/AdminReports.vue';
import { currentUser, CURRENT_YEAR } from '@/service/sicutiService';
import DateRangeFilter from '@/components/common/DateRangeFilter.vue';

const TabsStub = { name: 'Tabs', props: ['value'], emits: ['update:value'], template: '<div><slot /></div>' };
const table = (cls) => ({ props: ['items', 'emptyText', 'loadError'], template: `<div class="${cls}">{{ items.length }}|{{ emptyText }}</div>` });
const stubs = {
    Tabs: TabsStub,
    TabList: { template: '<div><slot /></div>' },
    Tab: { props: ['value'], template: '<div class="tab"><slot /></div>' },
    TabPanels: { template: '<div><slot /></div>' },
    TabPanel: { props: ['value'], template: '<div><slot /></div>' },
    Select: true,
    DatePicker: true,
    IconField: { template: '<div><slot /></div>' },
    InputIcon: true,
    InputText: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :id="$attrs.id" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    Button: { props: ['label'], template: '<button @click="$emit(\'click\')">{{ label }}<slot /></button>' },
    ReportLeaveHistoryTable: table('t-history'),
    ReportBalanceTable: table('t-balance'),
    ReportLeaveTypeSummary: table('t-summary')
};

const request = { id_request: 'R1', requester_name: 'Bayu', namecode: '1', kd_dept: 'SIT', kd_leave_type: 'CT', status: 'approved', start_date: '2026-01-02', end_date: '2026-01-02', total_days: 1 };
const summary = [{ kd_leave_type: 'CT', nm_leave_type: 'Cuti Tahunan', total: 1, approved: 1, rejected: 0, cancelled: 0, pending: 0, approved_days: 1 }];

function okData() {
    svc.getLeaveRequests.mockResolvedValue([request]);
    svc.getBalances.mockResolvedValue([{ uid_user_system: 'U1', nama: 'Bayu', namecode: '1', kd_dept: 'SIT' }]);
    svc.getLeaveTypes.mockResolvedValue([]);
    svc.getDepartments.mockResolvedValue([]);
    apiGet.mockResolvedValue({ data: summary });
}
const exportBtn = (w) => w.findAll('button').find((b) => b.text().includes('Ekspor Excel'));

describe('Laporan (audit-022)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        currentUser.value = { id: 'ADM', role: 'admin_super_app' };
    });

    it('#1 #3 gagal dimuat tidak tampil sebagai 0, dan ekspor ditolak', async () => {
        okData();
        svc.getLeaveRequests.mockRejectedValueOnce(new Error('500'));
        const w = mount(AdminReports, { global: { stubs } });
        await flushPromises();
        expect(w.find('[role="alert"]').text()).toContain('gagal dimuat');
        expect(w.find('.t-history').text()).toBe('0|Data laporan belum termuat.');
        expect(w.findAll('.tab')[0].text()).toContain('–');
        expect(w.text()).toContain('Menampilkan –');

        await exportBtn(w).trigger('click');
        expect(downloadExcel).not.toHaveBeenCalled();
        expect(toastAdd).toHaveBeenLastCalledWith(expect.objectContaining({ summary: 'Data belum termuat' }));
    });

    it('#1 rekap gagal menulis "–" di ringkasan, bukan 0', async () => {
        okData();
        apiGet.mockRejectedValueOnce(new Error('500'));
        const w = mount(AdminReports, { global: { stubs } });
        await flushPromises();
        w.findComponent(TabsStub).vm.$emit('update:value', 2);
        await flushPromises();
        expect(w.findComponent(stubs.ReportLeaveTypeSummary).props('loadError')).toBe(true);
        expect(w.find('[role="alert"]').text()).toContain('rekap per jenis cuti gagal dimuat');
    });

    it('#2 ekspor tab Rekap tidak membawa pencarian dari tab lain', async () => {
        okData();
        const w = mount(AdminReports, { global: { stubs } });
        await flushPromises();
        await w.find('#cari-laporan').setValue('Bayu');
        w.findComponent(TabsStub).vm.$emit('update:value', 2);
        await flushPromises();

        await exportBtn(w).trigger('click');
        await flushPromises();
        const [, params, filename] = downloadExcel.mock.calls[0];
        expect(params.type).toBe('leave-type-summary');
        expect(params).not.toHaveProperty('search');
        expect(params).not.toHaveProperty('status');
        expect(filename.endsWith('.xlsx')).toBe(true);
    });

    it('#3 ekspor 0 baris ditolak', async () => {
        okData();
        const w = mount(AdminReports, { global: { stubs } });
        await flushPromises();
        await w.find('#cari-laporan').setValue('tidak-ada');
        expect(w.find('.t-history').text()).toBe('0|Tidak ada data yang cocok dengan pencarian atau filter.');
        await exportBtn(w).trigger('click');
        expect(downloadExcel).not.toHaveBeenCalled();
        expect(toastAdd).toHaveBeenLastCalledWith(expect.objectContaining({ summary: 'Tidak ada data' }));
    });
    it('C-F4 opsi Tahun menyertakan tahun depan dan data dimuat per tahun terpilih', async () => {
        okData();
        const SelectStub = { name: 'Select', props: ['options', 'ariaLabelledby'], template: '<div />' };
        const w = mount(AdminReports, { global: { stubs: { ...stubs, Select: SelectStub } } });
        await flushPromises();
        const year = w.findAllComponents(SelectStub).find((c) => c.props('ariaLabelledby') === 'rep-year-label');
        expect(year.props('options').map((o) => o.value)).toEqual([CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1]);
        expect(svc.getLeaveRequests).toHaveBeenLastCalledWith({ year: CURRENT_YEAR });
    });

    it('C-F4 rentang tanggal memuat pengajuan tanpa batas tahun dan ekspor tidak membawa year', async () => {
        okData();
        const next = String(CURRENT_YEAR + 1);
        svc.getLeaveRequests.mockResolvedValue([{ ...request, start_date: next + '-01-13', end_date: next + '-01-14' }]);
        const w = mount(AdminReports, { global: { stubs } });
        await flushPromises();
        w.findComponent(DateRangeFilter).vm.$emit('update:modelValue', [new Date(CURRENT_YEAR + 1, 0, 1), new Date(CURRENT_YEAR + 1, 3, 28)]);
        await flushPromises();
        expect(svc.getLeaveRequests).toHaveBeenLastCalledWith({ year: undefined });
        expect(apiGet).toHaveBeenLastCalledWith('/sicuti/report/leave-type-summary', expect.objectContaining({ year: undefined, start_date: `${CURRENT_YEAR + 1}-01-01` }));

        await exportBtn(w).trigger('click');
        await flushPromises();
        expect(downloadExcel.mock.calls[0][1]).toMatchObject({ type: 'leave-request', year: undefined, start_date: `${CURRENT_YEAR + 1}-01-01` });
    });
});
