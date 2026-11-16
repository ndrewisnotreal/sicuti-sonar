import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const getPolicy = vi.fn();
const updatePolicy = vi.fn();
vi.mock('@/service/adminService', () => ({ adminService: { getPolicy: (...a) => getPolicy(...a), updatePolicy: (...a) => updatePolicy(...a) } }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));

import AdminPolicy from '@/views/admin/AdminPolicy.vue';
import { currentUser } from '@/service/sicutiService';

const field = { props: ['disabled'], template: '<input class="field" :disabled="disabled" />' };
const stubs = {
    InputGroup: { template: '<div><slot /></div>' },
    InputGroupAddon: { template: '<span><slot /></span>' },
    InputNumber: field,
    Textarea: field,
    Button: { props: ['label'], template: '<button>{{ label }}<slot /></button>' },
    ReadOnlyNotice: true
};

describe('Kebijakan Cuti: state gagal dimuat (audit-013 #2)', () => {
    it('field dikunci dan pesan tampil saat API gagal; Coba lagi memuat ulang', async () => {
        currentUser.value = { id: 'ADM', role: 'admin_super_app' };
        getPolicy.mockRejectedValueOnce(new Error('500'));
        const w = mount(AdminPolicy, { global: { stubs } });
        await flushPromises();
        expect(w.find('[role="alert"]').text()).toContain('Kebijakan gagal dimuat');
        expect(w.findAll('.field').every((f) => f.attributes('disabled') !== undefined)).toBe(true);

        getPolicy.mockResolvedValueOnce({ annual_quota: 12, max_carry_over: 4, carry_over_expiry_months: 6, description: '' });
        await w.findAll('button').find((b) => b.text() === 'Coba lagi').trigger('click');
        await flushPromises();
        expect(w.find('[role="alert"]').exists()).toBe(false);
        expect(w.text()).toContain('Belum ada perubahan');
        currentUser.value = null;
    });
});

describe('Kebijakan Cuti: validasi wajib isi (B-F12)', () => {
    it('kuota kosong: pesan di bawah field, tidak memanggil API simpan', async () => {
        currentUser.value = { id: 'ADM', role: 'admin_super_app' };
        getPolicy.mockResolvedValueOnce({ annual_quota: 12, max_carry_over: 4, carry_over_expiry_months: 6, description: '' });
        const w = mount(AdminPolicy, { global: { stubs: { ...stubs, InputNumber: { name: 'InputNumber', props: ['modelValue'], emits: ['update:modelValue'], template: '<input class="field" :id="$attrs.inputId" />' } } } });
        await flushPromises();
        w.findAllComponents({ name: 'InputNumber' })[0].vm.$emit('update:modelValue', null);
        await flushPromises();
        await w.find('form').trigger('submit');
        await flushPromises();
        expect(w.find('#policy-quota-error').text()).toBe('Kuota tahunan wajib diisi.');
        expect(updatePolicy).not.toHaveBeenCalled();
        currentUser.value = null;
    });
});
