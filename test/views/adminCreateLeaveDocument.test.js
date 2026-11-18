import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, reactive } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';

// Bug Pengajuan Karyawan #3: form admin "Buat Pengajuan Cuti Karyawan" tidak punya field dokumen,
// sehingga jenis cuti wajib dokumen (mis. Cuti Menikah) selalu ditolak backend.

const createLeave = vi.fn();
const uploadDocument = vi.fn();
vi.mock('@/service/leaveService', () => ({
    leaveService: { createLeave: (...a) => createLeave(...a), uploadDocument: (...a) => uploadDocument(...a) }
}));
const toastAdd = vi.fn();
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }));
const push = vi.fn();
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));

vi.mock('@/service/sicutiService', () => {
    const users = [
        { id: 'USR002', name: 'Raka', namecode: '24010002', role: 'staff_approval', isActive: true },
        { id: 'USR014', name: 'Hizkia', namecode: '24011021', role: 'staff_approval', isActive: true }
    ];
    return {
        sicutiState: reactive({
            leaveBalances: users.map((u) => ({ userId: u.id })),
            leaveTypes: [
                { id: 'LT001', name: 'Cuti Tahunan', isActive: true, usesQuota: true, requiresDocument: false },
                { id: 'LT002', name: 'Cuti Sakit', isActive: true, usesQuota: false, requiresDocument: true, allowLateDocument: true, lateDocumentDays: 3 },
                { id: 'LT004', name: 'Cuti Menikah', isActive: true, usesQuota: false, requiresDocument: true, allowLateDocument: false, lateDocumentDays: 3, maxDays: 3 }
            ]
        }),
        getDivisionUsers: () => users,
        getUserBalance: () => ({ remaining: 12 }),
        calculateWorkingDays: () => 3,
        holidayDateSet: () => new Set(),
        syncFromBackend: vi.fn().mockResolvedValue(undefined),
        isSubstituteRequired: () => false,
        ROLE_LABELS: {}
    };
});

import AdminCreateLeave from '@/views/admin/AdminCreateLeave.vue';

const emitting = (name) =>
    defineComponent({
        name,
        inheritAttrs: false,
        props: ['modelValue', 'inputId'],
        emits: ['update:modelValue'],
        setup: (p) => () => h('input', { id: p.inputId })
    });

const stubs = {
    Select: emitting('Select'),
    DatePicker: emitting('DatePicker'),
    Textarea: { props: ['modelValue'], emits: ['update:modelValue'], template: '<textarea :id="$attrs.id" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    Button: { props: ['label'], template: '<button :type="$attrs.type">{{ label }}<slot /></button>' },
    LeaveAttachmentUpload: defineComponent({
        name: 'LeaveAttachmentUpload',
        props: ['modelValue', 'disabled'],
        emits: ['update:modelValue'],
        setup: (p) => () => h('div', { class: 'upload-stub' }, p.modelValue?.name || 'kosong')
    })
};

async function fill(w, leaveTypeId) {
    const selects = w.findAllComponents({ name: 'Select' });
    selects[0].vm.$emit('update:modelValue', 'USR002');
    selects[1].vm.$emit('update:modelValue', leaveTypeId);
    const dates = w.findAllComponents({ name: 'DatePicker' });
    dates[0].vm.$emit('update:modelValue', new Date(2027, 2, 1));
    await flushPromises();
    w.findAllComponents({ name: 'DatePicker' })[1].vm.$emit('update:modelValue', new Date(2027, 2, 3));
    await w.find('#acl-reason').setValue('Pernikahan');
    await flushPromises();
}

const pdf = { file: new File(['%PDF-1.4'], 'undangan.pdf', { type: 'application/pdf' }), name: 'undangan.pdf', size: 8 };

describe('Buat Pengajuan Cuti Karyawan: dokumen pendukung', () => {
    beforeEach(() => {
        createLeave.mockReset().mockResolvedValue({ id_request: 'REQ-SIT-0001/2027' });
        uploadDocument.mockReset().mockResolvedValue({ url: '/uploads/documents/1-a.pdf', file_path: '/uploads/documents/1-a.pdf' });
        toastAdd.mockReset();
        push.mockReset();
    });

    it('field dokumen hanya muncul untuk jenis cuti wajib dokumen', async () => {
        const w = mount(AdminCreateLeave, { global: { stubs } });
        await fill(w, 'LT001');
        expect(w.find('#acl-document').exists()).toBe(false);
        w.findAllComponents({ name: 'Select' })[1].vm.$emit('update:modelValue', 'LT004');
        await flushPromises();
        expect(w.find('#acl-document').exists()).toBe(true);
        expect(w.text()).toContain('Wajib untuk Cuti Menikah');
    });

    it('Cuti Menikah tanpa berkas: ditandai di field, API tidak dipanggil', async () => {
        const w = mount(AdminCreateLeave, { global: { stubs }, attachTo: document.body });
        await fill(w, 'LT004');
        await w.find('form').trigger('submit');
        await flushPromises();
        expect(w.find('#acl-document-error').text()).toBe('Unggah dokumen pendukung untuk Cuti Menikah.');
        expect(uploadDocument).not.toHaveBeenCalled();
        expect(createLeave).not.toHaveBeenCalled();
        expect(document.activeElement?.id).toBe('acl-document');
        w.unmount();
    });

    it('Cuti Menikah dengan berkas: diunggah dulu, lalu URL-nya ikut dikirim', async () => {
        const w = mount(AdminCreateLeave, { global: { stubs } });
        await fill(w, 'LT004');
        w.findComponent({ name: 'LeaveAttachmentUpload' }).vm.$emit('update:modelValue', pdf);
        await flushPromises();
        expect(w.find('#acl-document-error').exists()).toBe(false);
        await w.find('form').trigger('submit');
        await flushPromises();
        expect(uploadDocument).toHaveBeenCalledWith(pdf.file);
        expect(createLeave).toHaveBeenCalledWith(
            expect.objectContaining({
                uid_user_system: 'USR002',
                kd_leave_type: 'LT004',
                attachment_url: '/uploads/documents/1-a.pdf',
                attachment_name: 'undangan.pdf'
            })
        );
        expect(push).toHaveBeenCalledWith('/admin/monitoring');
    });

    it('upload gagal: pengajuan tidak dibuat dan admin melihat alasannya', async () => {
        uploadDocument.mockRejectedValueOnce(Object.assign(new Error('403'), { data: { message: 'Tidak memiliki izin' } }));
        const w = mount(AdminCreateLeave, { global: { stubs } });
        await fill(w, 'LT004');
        w.findComponent({ name: 'LeaveAttachmentUpload' }).vm.$emit('update:modelValue', pdf);
        await w.find('form').trigger('submit');
        await flushPromises();
        expect(createLeave).not.toHaveBeenCalled();
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error', detail: 'Upload dokumen gagal: Tidak memiliki izin' }));
    });

    it('jenis cuti yang dokumennya boleh menyusul (Cuti Sakit) tetap bisa dikirim tanpa berkas', async () => {
        const w = mount(AdminCreateLeave, { global: { stubs } });
        await fill(w, 'LT002');
        expect(w.text()).toContain('boleh menyusul maks. 3 hari');
        await w.find('form').trigger('submit');
        await flushPromises();
        expect(uploadDocument).not.toHaveBeenCalled();
        expect(createLeave).toHaveBeenCalledWith(expect.objectContaining({ kd_leave_type: 'LT002', attachment_url: undefined, attachment_name: undefined }));
    });

    it('ganti ke jenis cuti tanpa dokumen: berkas yang sudah dipilih tidak ikut terkirim', async () => {
        const w = mount(AdminCreateLeave, { global: { stubs } });
        await fill(w, 'LT004');
        w.findComponent({ name: 'LeaveAttachmentUpload' }).vm.$emit('update:modelValue', pdf);
        await flushPromises();
        w.findAllComponents({ name: 'Select' })[1].vm.$emit('update:modelValue', 'LT001');
        await flushPromises();
        await w.find('form').trigger('submit');
        await flushPromises();
        expect(uploadDocument).not.toHaveBeenCalled();
        expect(createLeave).toHaveBeenCalledWith(expect.objectContaining({ kd_leave_type: 'LT001', attachment_url: undefined }));
    });
});
