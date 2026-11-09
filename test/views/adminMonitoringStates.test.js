import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent } from 'vue';

const mocks = vi.hoisted(() => ({
    requests: vi.fn(), types: vi.fn(), departments: vi.fn(), download: vi.fn(), toast: vi.fn()
}));
vi.mock('@/service/adminService', () => ({ adminService: {
    getLeaveRequests: mocks.requests, getLeaveTypes: mocks.types, getDepartments: mocks.departments
} }));
vi.mock('@/utils/reportExport', () => ({ downloadExcel: mocks.download }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: mocks.toast }) }));
vi.mock('@/service/sicutiService', async () => {
    const { ref, reactive } = await import('vue');
    return { currentUser: ref(null), getAdminDivision: () => '', isSuperAdmin: () => true, sicutiState: reactive({ dataVersion: 0 }) };
});

import AdminMonitoring from '@/views/admin/AdminMonitoring.vue';
import { sicutiState } from '@/service/sicutiService';

const Table = defineComponent({
    props: ['requests', 'loading', 'loadError', 'staleData', 'leaveTypes', 'departments', 'leaveTypesError', 'departmentsError'],
    setup(props, { expose }) {
        expose({ filteredCount: computed(() => props.requests.length), exportFilters: { status: 'submitted', search: 'Dewi' } });
    },
    template: '<div class="monitoring-results">{{ requests.length }}</div>'
});
const stubs = {
    Button: { props: ['label', 'loading'], template: '<button :disabled="$attrs.disabled || loading">{{ label }}<slot /></button>' },
    AdminDashboardMonitoringTable: Table,
    LeaveDetailDialog: true
};
let wrapper;
const button = (label) => wrapper.findAll('button').find((b) => b.text() === label);
async function open() {
    wrapper = mount(AdminMonitoring, { global: { stubs } });
    await flushPromises();
    return wrapper.getComponent(Table);
}
beforeEach(() => {
    vi.clearAllMocks();
    mocks.requests.mockResolvedValue([{ id_request: 'REQ-1' }]);
    mocks.types.mockResolvedValue([{ kd_leave_type: 'CT' }]);
    mocks.departments.mockResolvedValue([{ kd_dept: 'SIT' }]);
    mocks.download.mockResolvedValue();
});
afterEach(() => wrapper?.unmount());

describe('Pemantauan: data gagal, data terakhir dan filter', () => {
    it('gagal pertama tidak mengaku punya data terakhir; retry memulihkan ekspor', async () => {
        mocks.requests.mockRejectedValueOnce(new Error('Tidak tersambung'));
        const table = await open();
        expect(wrapper.get('[role="alert"]').text()).toContain('Data pengajuan gagal dimuat.');
        expect(table.props('staleData')).toBe(false);
        expect(button('Ekspor Excel').element.disabled).toBe(true);
        await wrapper.vm.exportExcel();
        expect(mocks.download).not.toHaveBeenCalled();
        await button('Coba lagi').trigger('click');
        await flushPromises();
        expect(wrapper.find('[role="alert"]').exists()).toBe(false);
        expect(table.props('requests')).toHaveLength(1);
        expect(button('Ekspor Excel').element.disabled).toBe(false);
    });

    it('refresh gagal menyimpan baris, memberi waktu data terakhir dan mencegah ekspor', async () => {
        const table = await open();
        mocks.requests.mockRejectedValueOnce(new Error('500'));
        await button('Segarkan').trigger('click');
        await flushPromises();
        expect(table.props('requests')).toHaveLength(1);
        expect(table.props('staleData')).toBe(true);
        expect(wrapper.get('#mon-load-error').text()).toMatch(/Menampilkan data terakhir dimuat pada .+\d{4}/);
        expect(button('Ekspor Excel').attributes('aria-describedby')).toBe('mon-load-error');
        expect(button('Ekspor Excel').element.disabled).toBe(true);
        await wrapper.vm.exportExcel();
        expect(mocks.download).not.toHaveBeenCalled();
        await button('Coba lagi').trigger('click');
        await flushPromises();
        expect(table.props('staleData')).toBe(false);
        expect(button('Ekspor Excel').element.disabled).toBe(false);
    });

    it('kegagalan filter tidak membuang opsi sebelumnya atau menghalangi pemuatan daftar', async () => {
        const table = await open();
        mocks.types.mockRejectedValueOnce(new Error('500'));
        mocks.departments.mockRejectedValueOnce(new Error('500'));
        mocks.requests.mockResolvedValueOnce([{ id_request: 'REQ-2' }]);
        await button('Segarkan').trigger('click');
        await flushPromises();
        expect(table.props()).toMatchObject({
            requests: [{ id_request: 'REQ-2' }], loadError: false,
            leaveTypesError: true, departmentsError: true,
            leaveTypes: [{ kd_leave_type: 'CT' }], departments: [{ kd_dept: 'SIT' }]
        });
        await table.vm.$emit('refresh');
        await flushPromises();
        expect(table.props('leaveTypesError')).toBe(false);
        expect(table.props('departmentsError')).toBe(false);
    });

    it('hasil sukses kosong tetap merupakan snapshot valid ketika refresh berikutnya gagal', async () => {
        mocks.requests.mockResolvedValueOnce([]);
        const table = await open();
        mocks.requests.mockRejectedValueOnce(new Error('500'));
        await button('Segarkan').trigger('click');
        await flushPromises();
        expect(table.props('staleData')).toBe(true);
        expect(table.props('requests')).toEqual([]);
    });

    it.each([
        ['types', 'leaveTypesError', 'departmentsError'],
        ['departments', 'departmentsError', 'leaveTypesError']
    ])('kegagalan awal %s tidak menandai sumber filter lainnya gagal', async (source, failedProp, healthyProp) => {
        mocks[source].mockRejectedValueOnce(new Error('500'));
        const table = await open();
        expect(table.props(failedProp)).toBe(true);
        expect(table.props(healthyProp)).toBe(false);
        expect(table.props('loadError')).toBe(false);
        expect(table.props('requests')).toHaveLength(1);
    });

    it('respons lama tidak menimpa refresh baru dan ekspor diblokir selama memuat', async () => {
        let resolveOlder;
        mocks.requests.mockReturnValueOnce(new Promise((resolve) => { resolveOlder = resolve; }));
        wrapper = mount(AdminMonitoring, { global: { stubs } });
        await wrapper.vm.exportExcel();
        expect(mocks.download).not.toHaveBeenCalled();
        mocks.requests.mockResolvedValueOnce([{ id_request: 'NEW' }]);
        sicutiState.dataVersion++;
        await flushPromises();
        resolveOlder([{ id_request: 'OLD' }]);
        await flushPromises();
        expect(wrapper.getComponent(Table).props('requests')).toEqual([{ id_request: 'NEW' }]);
        expect(button('Segarkan').element.disabled).toBe(false);
    });

    it('ekspor sukses mempertahankan endpoint dan filter; daftar kosong tidak mengunduh', async () => {
        await open();
        await button('Ekspor Excel').trigger('click');
        await flushPromises();
        expect(mocks.download).toHaveBeenCalledWith('/sicuti/report/export', {
            type: 'leave-request', status: 'submitted', search: 'Dewi', kd_dept: undefined
        }, 'pemantauan_cuti.xlsx');
        mocks.requests.mockResolvedValueOnce([]);
        await button('Segarkan').trigger('click');
        await flushPromises();
        await button('Ekspor Excel').trigger('click');
        expect(mocks.download).toHaveBeenCalledTimes(1);
        expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ summary: 'Tidak ada data' }));
    });
});
