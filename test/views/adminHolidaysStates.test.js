import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const deleteHoliday = vi.fn();
const toastAdd = vi.fn();
const confirmRequire = vi.fn();
vi.mock('@/service/adminService', () => ({ adminService: { deleteHoliday: (...a) => deleteHoliday(...a) } }));
vi.mock('@/service/sicutiService', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, syncFromBackend: vi.fn().mockResolvedValue(undefined) };
});
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: (opts) => confirmRequire(opts) }) }));

import AdminHolidays from '@/views/admin/AdminHolidays.vue';
import { sicutiState, currentUser } from '@/service/sicutiService';

const viewStubs = {
    ReadOnlyNotice: true,
    HolidayFormDialog: true,
    HolidayBatchUploadDialog: true,
    Button: { props: ['label'], template: '<button><slot />{{ label }}</button>' },
    Tag: { props: ['value'], template: '<span class="tag">{{ value }}</span>' },
    // Tabel desktop: baris dirender tanpa kolom; hanya empty state yang diuji di sini.
    DataTable: {
        props: ['value'],
        template: '<div class="dt"><slot v-if="!value?.length" name="empty" /><span v-else class="rows">{{ value.length }}</span></div>'
    },
    Column: true
};

const holidays = [
    { id: 'H1', name: 'Tahun Baru', date: '2026-01-01', endDate: '2026-01-01', type: 'national' },
    { id: 'H2', name: 'Cuti Bersama Lebaran', date: '2026-03-18', endDate: '2026-03-20', type: 'collective' }
];

describe('Master Hari Libur: state tabel dan daftar kartu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        currentUser.value = { id: 'ADM', role: 'admin_super_app' };
        sicutiState.holidays = [];
    });

    it('menampilkan pesan kosong di tabel dan daftar kartu saat belum ada hari libur', async () => {
        const w = mount(AdminHolidays, { global: { stubs: viewStubs } });
        await flushPromises();
        expect(w.find('.dt').text()).toContain('Belum ada hari libur');
        expect(w.find('ul.md\\:hidden').exists()).toBe(false);
        expect(w.text()).toContain('Libur Nasional 0');
        expect(w.text()).toContain('Cuti Bersama 0');
    });

    it('menghitung kategori nasional dan cuti bersama dari data yang dimuat', async () => {
        sicutiState.holidays = holidays;
        const w = mount(AdminHolidays, { global: { stubs: viewStubs } });
        await flushPromises();
        expect(w.text()).toContain('Libur Nasional 1');
        expect(w.text()).toContain('Cuti Bersama 1');
    });

    it('daftar kartu mobile memuat nama hari libur dengan tombol ubah dan hapus', async () => {
        sicutiState.holidays = holidays;
        const w = mount(AdminHolidays, { global: { stubs: viewStubs } });
        await flushPromises();
        const cards = w.find('ul.md\\:hidden').findAll('li');
        expect(cards).toHaveLength(2);
        expect(cards[0].text()).toContain('Tahun Baru');
        expect(cards[0].find('button[aria-label="Ubah Tahun Baru"]').exists()).toBe(true);
        expect(cards[0].find('button[aria-label="Hapus Tahun Baru"]').exists()).toBe(true);
    });

    it('tombol hapus pada kartu membuka konfirmasi dengan nama hari libur yang benar', async () => {
        sicutiState.holidays = holidays;
        const w = mount(AdminHolidays, { global: { stubs: viewStubs } });
        await flushPromises();
        await w.find('ul.md\\:hidden').find('button[aria-label="Hapus Cuti Bersama Lebaran"]').trigger('click');
        expect(confirmRequire).toHaveBeenCalledTimes(1);
        expect(confirmRequire.mock.calls[0][0].message).toContain('Cuti Bersama Lebaran');
    });

    it('menghapus hari libur memanggil adminService dengan id yang dipilih', async () => {
        sicutiState.holidays = holidays;
        deleteHoliday.mockResolvedValueOnce({});
        const w = mount(AdminHolidays, { global: { stubs: viewStubs } });
        await flushPromises();
        await w.find('ul.md\\:hidden').find('button[aria-label="Hapus Cuti Bersama Lebaran"]').trigger('click');
        await confirmRequire.mock.calls[0][0].accept();
        await flushPromises();
        expect(deleteHoliday).toHaveBeenCalledWith('H2');
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'info' }));
    });

    it('gagal hapus menampilkan toast error dengan detail dari API', async () => {
        sicutiState.holidays = holidays;
        deleteHoliday.mockRejectedValueOnce(new Error('Tidak diizinkan'));
        const w = mount(AdminHolidays, { global: { stubs: viewStubs } });
        await flushPromises();
        await w.find('ul.md\\:hidden').find('button[aria-label="Hapus Tahun Baru"]').trigger('click');
        await confirmRequire.mock.calls[0][0].accept();
        await flushPromises();
        expect(deleteHoliday).toHaveBeenCalledWith('H1');
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error', detail: 'Tidak diizinkan' }));
    });
});
