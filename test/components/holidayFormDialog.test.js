import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const toastAdd = vi.fn();
const createHoliday = vi.fn().mockResolvedValue({});
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('@/service/adminService', () => ({ adminService: { createHoliday: (...a) => createHoliday(...a) } }));

import HolidayFormDialog from '@/components/admin/HolidayFormDialog.vue';

const stubs = {
    Dialog: { template: '<div><slot /><slot name="footer" /></div>' },
    DatePicker: { props: ['inputId'], template: '<input :id="inputId" />' },
    InputText: { props: ['modelValue'], template: '<input :id="$attrs.id" :value="modelValue" />' },
    Button: { props: ['label'], template: '<button>{{ label }}</button>' }
};

async function openAndSave(holidayData) {
    const w = mount(HolidayFormDialog, { props: { visible: false, isEditing: !!holidayData, holidayData }, global: { stubs } });
    await w.setProps({ visible: true });
    await w.findAll('button').find((b) => /Tambah Hari Libur|Simpan Perubahan/.test(b.text())).trigger('click');
    await flushPromises();
    return w;
}

describe('HolidayFormDialog: validasi di bawah field (audit-014 #2)', () => {
    it('field kosong: pesan tanggal dan nama tampil, tidak ada toast dan tidak menyimpan', async () => {
        const w = await openAndSave(null);
        expect(w.find('#holiday-start-error').text()).toBe('Tanggal mulai wajib diisi.');
        expect(w.find('#holiday-name-error').text()).toBe('Nama hari libur wajib diisi.');
        expect(toastAdd).not.toHaveBeenCalled();
        expect(createHoliday).not.toHaveBeenCalled();
    });

    it('tanggal akhir sebelum tanggal mulai ditolak dengan pesan di field akhir', async () => {
        const w = await openAndSave({ id: 'H1', date: '2026-05-10', endDate: '2026-05-01', name: 'Uji', type: 'national' });
        expect(w.find('#holiday-end-error').text()).toBe('Tanggal akhir tidak boleh sebelum tanggal mulai.');
        expect(w.find('#holiday-start-error').exists()).toBe(false);
        expect(createHoliday).not.toHaveBeenCalled();
    });
});
