import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const { svc, confirmRequire } = vi.hoisted(() => ({
    svc: {
        getApprovalTemplates: vi.fn().mockResolvedValue([{ id_template: 'T1', nm_template: 'SIT', kd_dept: 'SIT' }]),
        getDepartments: vi.fn().mockResolvedValue([]),
        getApproverRoles: vi.fn().mockResolvedValue([]),
        getEligibleApprovers: vi.fn().mockResolvedValue([]),
        getApprovalFlows: vi.fn().mockResolvedValue([
            { id_flow: 'A', level: 1, nm_flow: 'Kasie', approvers: [{ uid_user_system: 'U1', nama: 'Budi' }] },
            { id_flow: 'B', level: 2, nm_flow: 'Kadep', approvers: [] }
        ]),
        getTemplateMembers: vi.fn().mockResolvedValue([]),
        reorderApprovalFlows: vi.fn().mockResolvedValue([]),
        assignFlowUsers: vi.fn().mockResolvedValue({})
    },
    confirmRequire: vi.fn()
}));
vi.mock('@/service/adminService', () => ({ adminService: svc }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: confirmRequire }) }));

import AdminApprovalFlow from '@/views/admin/AdminApprovalFlow.vue';
import { currentUser } from '@/service/sicutiService';

const stubs = {
    DataTable: true, Column: true, Select: true, Button: true, ReadOnlyNotice: true,
    ApprovalFlowStepDialog: true, ApprovalFlowMembersDialog: true, ApprovalTemplateDialog: true
};

describe('Alur Approval: alternatif tanpa seret dan konfirmasi keluarkan (audit-015 #1, #2)', () => {
    it('naik/turun memakai API urutan yang sama dengan drag; keluarkan approver dikonfirmasi dulu', async () => {
        currentUser.value = { id: 'ADM', role: 'admin_super_app' };
        const w = mount(AdminApprovalFlow, { global: { stubs } });
        await flushPromises();
        const { moveFlow, confirmRemoveApprover } = w.vm.$.setupState;

        await moveFlow(0, 1);
        await flushPromises();
        expect(svc.reorderApprovalFlows).toHaveBeenCalledWith('T1', ['B', 'A']);

        svc.reorderApprovalFlows.mockClear();
        await moveFlow(0, -1);
        expect(svc.reorderApprovalFlows).not.toHaveBeenCalled();

        const flow = { id_flow: 'A', nm_flow: 'Kasie', approvers: [{ uid_user_system: 'U1', nama: 'Budi' }] };
        confirmRemoveApprover(flow, flow.approvers[0]);
        expect(confirmRequire).toHaveBeenCalledTimes(1);
        // Fokus awal di Batal agar Enter tidak langsung mengeluarkan (audit-016 #3).
        expect(confirmRequire.mock.calls[0][0].defaultFocus).toBe('reject');
        expect(svc.assignFlowUsers).not.toHaveBeenCalled();
        await confirmRequire.mock.calls[0][0].accept();
        await flushPromises();
        expect(svc.assignFlowUsers).toHaveBeenCalledWith({ id_flow: 'A', users: [] });
        currentUser.value = null;
    });
});
