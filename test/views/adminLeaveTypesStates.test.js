import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const getLeaveTypes = vi.fn();
const upsertLeaveType = vi.fn();
const toastAdd = vi.fn();
const confirmRequire = vi.fn();
vi.mock('@/service/adminService', () => ({
    adminService: { getLeaveTypes: (...a) => getLeaveTypes(...a), upsertLeaveType: (...a) => upsertLeaveType(...a) }
}));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: (opts) => confirmRequire(opts) }) }));

import AdminLeaveTypes from '@/views/admin/AdminLeaveTypes.vue';
import { currentUser } from '@/service/sicutiService';

const viewStubs = {
    ReadOnlyNotice: true,
    LeaveTypeFormDialog: true,
    Button: { props: ['label'], emits: ['click'], template: '<button @click="$emit(\'click\')" v-bind="$attrs">{{ label }}<slot /></button>' },
    Tag: { props: ['value'], template: '<span class="tag">{{ value }}</span>' },
    DataTable: {
        props: ['value', 'loading'],
        template: '<div class="dt"><slot v-if="!value?.length" name="empty" /><span v-else class="rows">{{ value.length }}</span></div>'
    },
    Column: true
};

const raw = [
    { kd_leave_type: 'LT001', code: 'TAH', nm_leave_type: 'Cuti Tahunan', uses_quota: 1, is_active: 1, max_days: 12, requires_document: 0, allow_backdate: 0 },
    { kd_leave_type: 'LT002', code: 'SAK', nm_leave_type: 'Cuti Sakit', uses_quota: 0, is_active: 0, requires_document: 1, allow_late_document: 1, late_document_days: 3, allow_backdate: 1 }
];

describe('Master Jenis Cuti: state muat, kosong, dan gagal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        currentUser.value = { id: 'ADM', role: 'admin_super_app' };
    });

    it('menampilkan teks "Belum ada jenis cuti" saat daftar kosong dan tidak gagal', async () => {
        getLeaveTypes.mockResolvedValueOnce([]);
        const w = mount(AdminLeaveTypes, { global: { stubs: viewStubs } });
        await flushPromises();
        expect(w.find('.dt').text()).toContain('Belum ada jenis cuti.');
        expect(w.find('[role="alert"]').exists()).toBe(false);
    });

    it('gagal muat menampilkan peringatan dan tombol Coba lagi memuat ulang', async () => {
        getLeaveTypes.mockRejectedValueOnce(new Error('500'));
        const w = mount(AdminLeaveTypes, { global: { stubs: viewStubs } });
        await flushPromises();
        expect(w.find('[role="alert"]').text()).toContain('Jenis cuti gagal dimuat');
        expect(w.find('.dt').text()).toContain('Jenis cuti belum termuat.');
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error', detail: '500' }));

        getLeaveTypes.mockResolvedValueOnce(raw);
        await w.findAll('button').find((b) => b.text() === 'Coba lagi').trigger('click');
        await flushPromises();
        expect(getLeaveTypes).toHaveBeenCalledTimes(2);
        expect(w.find('[role="alert"]').exists()).toBe(false);
        expect(w.find('.dt .rows').text()).toBe('2');
    });

    it('daftar kartu mobile memuat nama, kode, dan aturan dokumen tiap jenis cuti', async () => {
        getLeaveTypes.mockResolvedValueOnce(raw);
        const w = mount(AdminLeaveTypes, { global: { stubs: viewStubs } });
        await flushPromises();
        const cards = w.find('ul').findAll('li');
        expect(cards).toHaveLength(2);
        expect(cards[0].text()).toContain('Cuti Tahunan');
        expect(cards[0].text()).toContain('TAH');
        expect(cards[0].text()).toContain('Tidak wajib');
        expect(cards[0].text()).toContain('Maks. 12 hari kerja');
        expect(cards[1].text()).toContain('Wajib, boleh menyusul 3 hari');
        expect(cards[1].text()).toContain('Nonaktif');
    });

    it('tombol ubah pada kartu mobile membuka dialog dengan data jenis cuti yang dipilih', async () => {
        getLeaveTypes.mockResolvedValueOnce(raw);
        const stubs = {
            ...viewStubs,
            LeaveTypeFormDialog: { name: 'LeaveTypeFormDialog', props: ['visible', 'isEditing', 'typeData'], template: '<div />' }
        };
        const w = mount(AdminLeaveTypes, { global: { stubs } });
        await flushPromises();
        await w.find('ul').find('button[aria-label="Ubah Cuti Sakit"]').trigger('click');
        const dialog = w.findComponent({ name: 'LeaveTypeFormDialog' });
        expect(dialog.props('visible')).toBe(true);
        expect(dialog.props('isEditing')).toBe(true);
        expect(dialog.props('typeData').id).toBe('LT002');
    });

    it('menonaktifkan jenis cuti aktif meminta konfirmasi lalu mengirim id yang benar', async () => {
        getLeaveTypes.mockResolvedValue(raw);
        upsertLeaveType.mockResolvedValueOnce({});
        const w = mount(AdminLeaveTypes, { global: { stubs: viewStubs } });
        await flushPromises();
        await w.find('ul').find('button[aria-label="Nonaktifkan Cuti Tahunan"]').trigger('click');
        expect(confirmRequire).toHaveBeenCalledTimes(1);
        await confirmRequire.mock.calls[0][0].accept();
        await flushPromises();
        expect(upsertLeaveType).toHaveBeenCalledWith(expect.objectContaining({ kd_leave_type: 'LT001', is_active: false }));
    });

    it('mengaktifkan jenis cuti nonaktif langsung tanpa konfirmasi', async () => {
        getLeaveTypes.mockResolvedValue(raw);
        upsertLeaveType.mockResolvedValueOnce({});
        const w = mount(AdminLeaveTypes, { global: { stubs: viewStubs } });
        await flushPromises();
        await w.find('ul').find('button[aria-label="Aktifkan Cuti Sakit"]').trigger('click');
        await flushPromises();
        expect(confirmRequire).not.toHaveBeenCalled();
        expect(upsertLeaveType).toHaveBeenCalledWith(expect.objectContaining({ kd_leave_type: 'LT002', is_active: true }));
    });
});
