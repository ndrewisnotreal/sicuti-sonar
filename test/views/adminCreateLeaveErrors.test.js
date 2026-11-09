import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const createLeave = vi.fn();
vi.mock('@/service/leaveService', () => ({ leaveService: { createLeave: (...a) => createLeave(...a) } }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));
const confirmRequire = vi.fn();
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: confirmRequire }) }));
const push = vi.fn();
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));

import AdminCreateLeave from '@/views/admin/AdminCreateLeave.vue';

const stubs = {
    Select: true, DatePicker: true,
    Textarea: { props: ['modelValue'], emits: ['update:modelValue'], template: '<textarea :id="$attrs.id" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    Button: { props: ['label'], template: '<button :type="$attrs.type">{{ label }}<slot /></button>' }
};

describe('Pengajuan Cuti Karyawan: pesan per field (audit-017 #1, #7)', () => {
    it('kirim kosong menandai tiap field wajib tanpa memanggil API; pengganti tidak ditandai sebelum karyawan dipilih', async () => {
        const w = mount(AdminCreateLeave, { global: { stubs } });
        await w.find('form').trigger('submit');
        await flushPromises();
        const ids = w.findAll('[id$="-error"]').map((e) => e.attributes('id'));
        expect(ids).toEqual(['acl-user-error', 'acl-type-error', 'acl-start-error', 'acl-end-error', 'acl-reason-error']);
        expect(createLeave).not.toHaveBeenCalled();

        await w.find('#acl-reason').setValue('Keperluan keluarga');
        expect(w.find('#acl-reason-error').exists()).toBe(false);
    });

    it('Batal dengan isian meminta konfirmasi; tanpa isian langsung kembali', async () => {
        const w = mount(AdminCreateLeave, { global: { stubs } });
        await w.findAll('button').find((b) => b.text() === 'Batal').trigger('click');
        expect(push).toHaveBeenCalledWith('/');
        expect(confirmRequire).not.toHaveBeenCalled();

        await w.find('#acl-reason').setValue('x');
        await w.findAll('button').find((b) => b.text() === 'Batal').trigger('click');
        expect(confirmRequire).toHaveBeenCalledTimes(1);
        expect(confirmRequire.mock.calls[0][0].defaultFocus).toBe('reject');
    });
});
