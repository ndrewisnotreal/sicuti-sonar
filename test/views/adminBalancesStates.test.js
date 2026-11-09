import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const getBalances = vi.fn();
const getDepartments = vi.fn();
const apiGet = vi.fn();
vi.mock('@/service/adminService', () => ({
    adminService: {
        getBalances: (...a) => getBalances(...a),
        getDepartments: (...a) => getDepartments(...a),
        upsertBalance: vi.fn()
    }
}));
vi.mock('@/service/api', () => ({ default: { get: (...a) => apiGet(...a) } }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));

import AdminBalances from '@/views/admin/AdminBalances.vue';
import BalanceHistoryDialog from '@/components/admin/BalanceHistoryDialog.vue';
import BalanceEditDialog from '@/components/admin/BalanceEditDialog.vue';
import { currentUser } from '@/service/sicutiService';

const SelectStub = {
    name: 'Select',
    props: ['modelValue', 'options', 'optionLabel', 'optionValue', 'ariaLabelledby'],
    emits: ['update:modelValue'],
    template: '<div class="select" :data-labelledby="ariaLabelledby"></div>'
};

const stubs = {
    DataTable: { props: ['value'], template: '<div class="dt"><slot v-if="!value.length" name="empty" /><span v-else class="rows">{{ value.length }}</span></div>' },
    Column: true,
    Tag: true,
    Select: SelectStub,
    IconField: { template: '<div><slot /></div>' },
    InputIcon: true,
    InputText: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :id="$attrs.id" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    Button: { props: ['label'], template: '<button>{{ label }}<slot /></button>' },
    ReadOnlyNotice: true,
    BalanceEditDialog: true,
    BalanceHistoryDialog: true
};

const row = { uid_user_system: 'U1', nama: 'Budi', namecode: '1', kd_dept: 'SIT', annual_quota: 12, carry_over_days: 0, used_days: 0, remaining: 12, period_label: '1 Januari - 31 Desember 2026' };

function yearSelect(w) {
    return w.findAllComponents(SelectStub).find((s) => s.props('ariaLabelledby') === 'bal-year-label');
}

describe('Saldo Cuti admin (audit-021)', () => {
    it('#1 pemilih tahun mengirim angka tahun, bukan objek opsi', async () => {
        currentUser.value = { id: 'ADM', role: 'admin_super_app' };
        getBalances.mockResolvedValue([row]);
        getDepartments.mockResolvedValue([]);
        const w = mount(AdminBalances, { global: { stubs } });
        await flushPromises();

        const year = yearSelect(w);
        expect(year.props('optionValue')).toBe('value');
        expect(year.props('optionLabel')).toBe('label');
        year.vm.$emit('update:modelValue', 2025);
        await flushPromises();
        expect(getBalances).toHaveBeenLastCalledWith(2025);
        currentUser.value = null;
    });

    it('#2 gagal ganti tahun mengosongkan daftar lama dan menampilkan alert, Coba lagi memuat ulang', async () => {
        currentUser.value = { id: 'ADM', role: 'admin_super_app' };
        getBalances.mockResolvedValueOnce([row]);
        getDepartments.mockResolvedValue([]);
        const w = mount(AdminBalances, { global: { stubs } });
        await flushPromises();
        expect(w.find('.rows').text()).toBe('1');

        getBalances.mockRejectedValueOnce(new Error('400'));
        yearSelect(w).vm.$emit('update:modelValue', 2025);
        await flushPromises();
        expect(w.find('[role="alert"]').text()).toContain('Data saldo tahun 2025 gagal dimuat');
        expect(w.find('.dt').text()).toBe('Data saldo belum termuat.');
        expect(w.text()).toContain('Total: –');

        getBalances.mockResolvedValueOnce([row]);
        await w.findAll('button').find((b) => b.text() === 'Coba lagi').trigger('click');
        await flushPromises();
        expect(w.find('[role="alert"]').exists()).toBe(false);
        expect(w.find('.rows').text()).toBe('1');

        await w.find('#cari-saldo').setValue('tidak-ada');
        expect(w.find('.dt').text()).toContain('Tidak ada karyawan yang cocok');
        currentUser.value = null;
    });

    it('#2 daftar divisi gagal ditulis di dekat filter, bukan diam-diam kosong', async () => {
        currentUser.value = { id: 'ADM', role: 'admin_super_app' };
        getBalances.mockResolvedValue([row]);
        getDepartments.mockRejectedValueOnce(new Error('500'));
        const w = mount(AdminBalances, { global: { stubs } });
        await flushPromises();
        expect(w.find('#bal-dept-error').text()).toContain('Pilihan divisi gagal dimuat');
        currentUser.value = null;
    });

    it('#3 riwayat gagal tidak tampil sebagai riwayat kosong', async () => {
        apiGet.mockRejectedValueOnce(new Error('500'));
        const w = mount(BalanceHistoryDialog, {
            props: { visible: false, user: row, year: 2026 },
            global: { stubs: { Dialog: { template: '<div><slot /></div>' }, DataTable: stubs.DataTable, Column: true, Button: stubs.Button } }
        });
        await w.setProps({ visible: true });
        await flushPromises();
        expect(w.find('[role="alert"]').text()).toContain('Riwayat saldo gagal dimuat');
        expect(w.find('.dt').text()).toBe('Riwayat belum termuat.');

        apiGet.mockResolvedValueOnce({ data: [] });
        await w.findAll('button').find((b) => b.text() === 'Coba lagi').trigger('click');
        await flushPromises();
        expect(w.find('[role="alert"]').exists()).toBe(false);
        expect(w.find('.dt').text()).toBe('Belum ada mutasi saldo pada tahun ini.');
    });

    it('#6 #13 label dialog terhubung, alasan kosong memindah fokus, sisa minus tidak dipotong ke 0', async () => {
        const w = mount(BalanceEditDialog, {
            props: { visible: false, balanceData: { ...row, used_days: 1, remaining: 11 } },
            attachTo: document.body,
            global: {
                stubs: {
                    Dialog: { template: '<div><slot /><slot name="footer" /></div>' },
                    InputNumber: { props: ['modelValue', 'inputId'], emits: ['update:modelValue'], template: '<input :id="inputId" :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value))" />' },
                    DatePicker: { props: ['inputId'], template: '<input :id="inputId" />' },
                    Textarea: { props: ['modelValue'], emits: ['update:modelValue'], template: '<textarea :id="$attrs.id" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
                    Button: stubs.Button
                }
            }
        });
        await w.setProps({ visible: true });
        for (const id of ['balance-quota', 'balance-carry', 'balance-expiry', 'balance-reason-input']) {
            expect(w.find(`label[for="${id}"]`).exists()).toBe(true);
            expect(w.find(`#${id}`).exists()).toBe(true);
        }

        await w.findAll('button').find((b) => b.text() === 'Simpan Saldo').trigger('click');
        await flushPromises();
        expect(w.find('#balance-reason-error').text()).toBe('Alasan penyesuaian wajib diisi');
        expect(document.activeElement?.id).toBe('balance-reason-input');

        await w.find('#balance-quota').setValue('0');
        expect(w.text()).toContain('Sisa saat ini11 hari');
        expect(w.text()).toContain('Sisa setelah disimpan-1 hari');
        expect(w.text()).toContain('Sisa menjadi minus');
        w.unmount();
    });
});
