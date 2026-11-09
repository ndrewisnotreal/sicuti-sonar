import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';

const toastAdd = vi.fn();
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));

vi.mock('@/service/adminService', () => ({
    adminService: {
        createApprovalTemplate: vi.fn().mockResolvedValue({ id_template: 'TPL-NEW', nm_template: 'Template Baru' }),
        updateApprovalTemplate: vi.fn().mockResolvedValue({ id_template: 'TPL-1', nm_template: 'Template Edit' }),
        addTemplateMembers: vi.fn().mockResolvedValue([{ uid_user_system: 'USR-1', nama: 'Budi' }]),
        updateUser: vi.fn().mockResolvedValue({ success: true }),
        upsertLeaveType: vi.fn().mockResolvedValue({ success: true })
    },
    // AuditDetailDialog memakai label yang sama dengan tabel audit (audit-023 #7).
    AUDIT_ACTION_LABEL: { APPROVE: 'Setujui' },
    AUDIT_ENTITY_LABEL: {}
}));

import ApprovalTemplateDialog from '@/components/admin/ApprovalTemplateDialog.vue';
import ApprovalFlowAddMemberDialog from '@/components/admin/ApprovalFlowAddMemberDialog.vue';
import DeactivateAccountDialog from '@/components/admin/DeactivateAccountDialog.vue';
import LeaveTypeFormDialog from '@/components/admin/LeaveTypeFormDialog.vue';
import AuditDetailDialog from '@/components/admin/AuditDetailDialog.vue';
import { adminService } from '@/service/adminService';

const DialogStub = defineComponent({
    name: 'Dialog',
    props: ['visible', 'header'],
    emits: ['update:visible'],
    setup: (p, { slots }) => () => (p.visible ? h('div', { class: 'dialog', 'data-header': p.header }, [slots.default?.(), slots.footer?.()]) : null)
});

const ButtonStub = defineComponent({
    name: 'Button',
    props: ['label', 'disabled', 'loading'],
    emits: ['click'],
    setup: (p, { slots, emit }) => () => h('button', { disabled: p.disabled || undefined, onClick: () => emit('click') }, [p.label, slots.default?.()])
});

const InputTextStub = defineComponent({
    name: 'InputText',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup: (p, { emit }) => () => h('input', { value: p.modelValue, onInput: (e) => emit('update:modelValue', e.target.value) })
});

const SelectStub = defineComponent({
    name: 'Select',
    props: ['modelValue', 'options'],
    emits: ['update:modelValue'],
    setup: (p, { emit }) => () => h('select', { value: p.modelValue, onChange: (e) => emit('update:modelValue', e.target.value) })
});

const MultiSelectStub = defineComponent({
    name: 'MultiSelect',
    props: ['modelValue', 'options'],
    emits: ['update:modelValue'],
    setup: (p, { emit }) => () => h('div', { class: 'multiselect' })
});

const CheckboxStub = defineComponent({
    name: 'Checkbox',
    props: ['modelValue', 'binary', 'inputId'],
    emits: ['update:modelValue'],
    setup: (p, { emit }) => () => h('input', { type: 'checkbox', id: p.inputId, checked: p.modelValue, onChange: (e) => emit('update:modelValue', e.target.checked) })
});

const InputNumberStub = defineComponent({
    name: 'InputNumber',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup: (p, { emit }) => () => h('input', { type: 'number', value: p.modelValue, onInput: (e) => emit('update:modelValue', Number(e.target.value)) })
});

const TextareaStub = defineComponent({
    name: 'Textarea',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup: (p, { emit }) => () => h('textarea', { value: p.modelValue, onInput: (e) => emit('update:modelValue', e.target.value) })
});

const TagStub = defineComponent({
    name: 'Tag',
    props: ['value', 'severity'],
    setup: (p) => () => h('span', { class: `tag tag-${p.severity}` }, p.value)
});

const globalStubs = {
    Dialog: DialogStub,
    Button: ButtonStub,
    InputText: InputTextStub,
    Select: SelectStub,
    MultiSelect: MultiSelectStub,
    Checkbox: CheckboxStub,
    InputNumber: InputNumberStub,
    Textarea: TextareaStub,
    Tag: TagStub
};

describe('ApprovalTemplateDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('validates empty name before saving', async () => {
        const w = mount(ApprovalTemplateDialog, {
            props: { visible: true, isEditing: false, templateData: { nm_template: '' } },
            global: { stubs: globalStubs }
        });
        const saveBtn = w.findAllComponents(ButtonStub).find((b) => b.props('label') === 'Simpan Templat');
        await saveBtn.trigger('click');
        await flushPromises();
        // Pesan di bawah field (audit-015 #5), bukan toast; data tidak dikirim.
        expect(w.find('#tpl-name-error').text()).toBe('Nama templat wajib diisi.');
        expect(toastAdd).not.toHaveBeenCalled();
        expect(adminService.createApprovalTemplate).not.toHaveBeenCalled();
    });

    it('detects duplicate template name', async () => {
        const w = mount(ApprovalTemplateDialog, {
            props: {
                visible: true,
                isEditing: false,
                templateData: { nm_template: 'SIT Dev' },
                templates: [{ id_template: 'TPL-EXIST', nm_template: 'SIT DEV' }]
            },
            global: { stubs: globalStubs }
        });
        const saveBtn = w.findAllComponents(ButtonStub).find((b) => b.props('label') === 'Simpan Templat');
        await saveBtn.trigger('click');
        await flushPromises();
        expect(w.find('#tpl-name-error').text()).toBe('Templat dengan nama "SIT Dev" sudah ada.');
        expect(adminService.createApprovalTemplate).not.toHaveBeenCalled();
    });

    it('creates template successfully and emits saved', async () => {
        const w = mount(ApprovalTemplateDialog, {
            props: {
                visible: true,
                isEditing: false,
                templateData: { nm_template: 'Finance Workflow', kd_dept: 'SIS' },
                templates: []
            },
            global: { stubs: globalStubs }
        });
        const saveBtn = w.findAllComponents(ButtonStub).find((b) => b.props('label') === 'Simpan Templat');
        await saveBtn.trigger('click');
        await flushPromises();
        expect(adminService.createApprovalTemplate).toHaveBeenCalled();
        expect(w.emitted('saved')).toBeTruthy();
    });
});

describe('ApprovalFlowAddMemberDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('validates empty candidates before submission', async () => {
        const w = mount(ApprovalFlowAddMemberDialog, {
            props: { visible: true, template: { id_template: 'TPL-1', nm_template: 'SIT' }, candidateOptions: [] },
            global: { stubs: globalStubs }
        });
        const saveBtn = w.findAllComponents(ButtonStub).find((b) => b.props('label') === 'Simpan Anggota');
        await saveBtn.trigger('click');
        await flushPromises();
        expect(w.find('#member-select-error').text()).toBe('Pilih minimal satu karyawan.');
        expect(adminService.addTemplateMembers).not.toHaveBeenCalled();
    });
});

describe('DeactivateAccountDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders user details and triggers deactivation on confirm', async () => {
        const user = { uid_user_system: 'USR-99', nama: 'Alex Chandra', username: 'achandra' };
        const w = mount(DeactivateAccountDialog, {
            props: { visible: true, user },
            global: { stubs: globalStubs }
        });
        expect(w.text()).toContain('Alex Chandra tidak bisa login');

        const deactBtn = w.findAllComponents(ButtonStub).find((b) => b.props('label') === 'Nonaktifkan');
        await deactBtn.trigger('click');
        expect(w.text()).toContain('Pilih alasan menonaktifkan akun');
        w.vm.reason = 'RESIGN';
        await deactBtn.trigger('click');
        await flushPromises();

        expect(adminService.updateUser).toHaveBeenCalledWith(expect.objectContaining({
            uid_user_system: 'USR-99',
            status: 'N',
            status_reason: 'RESIGN'
        }));
        expect(w.emitted('saved')).toBeTruthy();
    });
});

describe('LeaveTypeFormDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('validates code and name', async () => {
        const w = mount(LeaveTypeFormDialog, {
            props: { visible: true, isEditing: false, typeData: { code: '', name: '' } },
            global: { stubs: globalStubs }
        });
        const saveBtn = w.findAllComponents(ButtonStub).find((b) => b.props('label') === 'Simpan');
        await saveBtn.trigger('click');
        await flushPromises();
        // Kesalahan tampil di bawah field (audit-012 #2), tidak lagi lewat toast; data tidak dikirim.
        expect(w.find('#lt-code-error').text()).toBe('Kode jenis cuti wajib diisi.');
        expect(w.find('#lt-name-error').text()).toBe('Nama jenis cuti wajib diisi.');
        expect(adminService.upsertLeaveType).not.toHaveBeenCalled();
        expect(toastAdd).not.toHaveBeenCalled();
    });

    it('submits valid leave type and emits saved', async () => {
        const w = mount(LeaveTypeFormDialog, {
            props: {
                visible: true,
                isEditing: false,
                typeData: { code: 'CB', name: 'Cuti Bersama', usesQuota: true }
            },
            global: { stubs: globalStubs }
        });
        const saveBtn = w.findAllComponents(ButtonStub).find((b) => b.props('label') === 'Simpan');
        await saveBtn.trigger('click');
        await flushPromises();

        expect(adminService.upsertLeaveType).toHaveBeenCalledWith(expect.objectContaining({
            code: 'CB',
            nm_leave_type: 'Cuti Bersama',
            uses_quota: true
        }));
        expect(w.emitted('saved')).toBeTruthy();
    });
});

describe('AuditDetailDialog', () => {
    it('renders audit log details accurately', () => {
        const log = {
            timestamp: '2025-05-10 14:30:00',
            ip_address: '192.168.1.50',
            username: 'superadmin',
            entity: 'template.d_leave_request',
            action: 'APPROVE',
            details: 'Disetujui oleh Direksi',
            payload: { id_request: 'REQ-01' }
        };
        const w = mount(AuditDetailDialog, {
            props: { visible: true, log },
            global: { stubs: globalStubs }
        });

        expect(w.text()).toContain('192.168.1.50');
        expect(w.text()).toContain('superadmin');
        expect(w.text()).toContain('template.d_leave_request');
        expect(w.text()).toContain('Disetujui oleh Direksi');
        expect(w.text()).toContain('"id_request": "REQ-01"');
    });
});
