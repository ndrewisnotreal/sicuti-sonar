import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const { svc } = vi.hoisted(() => ({
    svc: {
        getApprovalTemplates: vi.fn(),
        getDepartments: vi.fn().mockResolvedValue([]),
        getApproverRoles: vi.fn().mockResolvedValue([]),
        getEligibleApprovers: vi.fn().mockResolvedValue([]),
        getApprovalFlows: vi.fn().mockResolvedValue([]),
        getTemplateMembers: vi.fn().mockResolvedValue([])
    }
}));
vi.mock('@/service/adminService', () => ({ adminService: svc }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }));

import AdminApprovalFlow from '@/views/admin/AdminApprovalFlow.vue';

const stubs = {
    DataTable: true, Column: true, Select: true, Button: true, ReadOnlyNotice: true,
    ApprovalFlowStepDialog: true, ApprovalFlowMembersDialog: true, ApprovalTemplateDialog: true
};
const KEY = 'sicuti_approval_template';

beforeEach(() => {
    sessionStorage.clear();
    svc.getApprovalFlows.mockClear();
    svc.getApprovalTemplates.mockResolvedValue([
        { id_template: 'T1', nm_template: 'SIS Network' },
        { id_template: 'T2', nm_template: 'SIT Developer' }
    ]);
});

describe('Alur Approval: templat terakhir dipilih diingat', () => {
    it('membuka kembali halaman memakai templat yang terakhir dipilih', async () => {
        const first = mount(AdminApprovalFlow, { global: { stubs } });
        await flushPromises();
        first.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', 'T2');
        await flushPromises();
        expect(sessionStorage.getItem(KEY)).toBe('T2');
        first.unmount();

        svc.getApprovalFlows.mockClear();
        mount(AdminApprovalFlow, { global: { stubs } });
        await flushPromises();
        expect(svc.getApprovalFlows).toHaveBeenCalledWith('T2');
        expect(svc.getApprovalFlows).not.toHaveBeenCalledWith('T1');
    });

    it('templat tersimpan yang sudah tidak ada kembali ke templat pertama', async () => {
        sessionStorage.setItem(KEY, 'T9');
        mount(AdminApprovalFlow, { global: { stubs } });
        await flushPromises();
        expect(svc.getApprovalFlows).toHaveBeenCalledWith('T1');
        expect(sessionStorage.getItem(KEY)).toBe('T1');
    });
});
