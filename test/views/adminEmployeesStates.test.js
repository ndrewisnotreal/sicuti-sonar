import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const getEmployees = vi.fn();
vi.mock('@/service/adminService', () => ({ adminService: { getEmployees: (...a) => getEmployees(...a) } }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));

import AdminEmployees from '@/views/admin/AdminEmployees.vue';
import { currentUser } from '@/service/sicutiService';

// DataTable diganti stub yang hanya merender slot empty bila datanya kosong.
const stubs = {
    DataTable: { props: ['value'], template: '<div class="dt"><slot v-if="!value.length" name="empty" /><span v-else class="rows">{{ value.length }}</span></div>' },
    Column: true,
    Tag: true,
    Select: true,
    IconField: { template: '<div><slot /></div>' },
    InputIcon: true,
    InputText: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :id="$attrs.id" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    Button: { props: ['label'], template: '<button>{{ label }}<slot /></button>' },
    ReadOnlyNotice: true,
    StatusHistoryDialog: true
};

describe('Data Karyawan: state tabel (audit-011 #2)', () => {
    it('API gagal tidak ditampilkan sebagai direktori kosong, dan Coba lagi memuat ulang', async () => {
        currentUser.value = { id: 'ADM', role: 'superadmin' };
        getEmployees.mockRejectedValueOnce(new Error('500'));
        const w = mount(AdminEmployees, { global: { stubs } });
        await flushPromises();
        expect(w.find('[role="alert"]').text()).toContain('Data karyawan gagal dimuat');
        expect(w.find('.dt').text()).toBe('Data karyawan belum termuat.');
        expect(w.text()).toContain('Total: –');

        getEmployees.mockResolvedValueOnce([{ namecode: '1', nama: 'Budi', email: 'b@x.id' }]);
        await w.findAll('button').find((b) => b.text().includes('Coba lagi')).trigger('click');
        await flushPromises();
        expect(w.find('[role="alert"]').exists()).toBe(false);
        expect(w.find('.rows').text()).toBe('1');

        await w.find('#cari-karyawan').setValue('tidak-ada');
        expect(w.find('.dt').text()).toBe('Tidak ada karyawan yang cocok dengan pencarian atau filter.');
        currentUser.value = null;
    });
});
