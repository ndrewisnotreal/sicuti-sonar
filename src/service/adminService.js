import api from './api';
import { statusReasonLabel } from './statusReason';

export const adminService = {
    async getUsers(params = {}) {
        const res = await api.get('/master/user', params);
        return res?.data || res || [];
    },

    async getEmployees(params = {}) {
        return this.getUsers(params);
    },

    async createUser(data) {
        const res = await api.post('/master/user', data);
        return res?.data || res;
    },

    async updateUser(data) {
        const res = await api.put('/master/user', data);
        return res?.data || res;
    },

    async getStatusHistory(uid) {
        const res = await api.get('/master/user/status-history', { uid });
        return res?.data || [];
    },

    async deleteUser(uid) {
        const res = await api.delete('/master/user', { uid_user_system: uid });
        return res?.data || res;
    },

    async unlockUser(uid) {
        const res = await api.post('/master/user/unlock', { uid_user_system: uid });
        return res?.data || res;
    },

    async getDepartments(all = true) {
        const res = await api.get('/sicuti/department', { all: all ? 'true' : 'false' });
        return res?.data || res || [];
    },

    async getLeaveRequests(params = {}) {
        const res = await api.get('/sicuti/leave-request', { limit: 1000, ...params });
        return res?.data?.data || res?.data || [];
    },

    async getBalances(year) {
        const res = await api.get('/sicuti/leave-balance', year ? { year } : {});
        return res?.data || res || [];
    },

    async upsertBalance(data) {
        const res = await api.post('/sicuti/leave-balance', data);
        return res?.data || res;
    },

    async getApprovalTemplates(params = {}) {
        const res = await api.get('/sicuti/approval-template', params);
        return res?.data || res || [];
    },

    async createApprovalTemplate(data) {
        const res = await api.post('/sicuti/approval-template', data);
        return res?.data || res;
    },

    async updateApprovalTemplate(data) {
        const res = await api.put('/sicuti/approval-template', data);
        return res?.data || res;
    },

    async deleteApprovalTemplate(idTemplate) {
        const res = await api.delete(`/sicuti/approval-template?id_template=${encodeURIComponent(idTemplate)}`);
        return res?.data || res;
    },

    async getApprovalFlows(templateId) {
        const params = templateId ? { id_template: templateId } : {};
        const res = await api.get('/sicuti/approval-flow', params);
        return res?.data || res || [];
    },

    async getEligibleApprovers() {
        const res = await api.get('/sicuti/approval-flow/eligible-approvers');
        return res?.data || res || [];
    },

    async upsertApprovalFlow(data) {
        const res = await api.post('/sicuti/approval-flow', data);
        return res?.data || res;
    },

    async assignFlowUsers(data) {
        const res = await api.put('/sicuti/approval-flow/users', data);
        return res?.data || res;
    },

    async deleteApprovalFlow(idFlow) {
        const res = await api.delete(`/sicuti/approval-flow?id_flow=${encodeURIComponent(idFlow)}`);
        return res?.data || res;
    },

    async getApproverRoles() {
        const res = await api.get('/sicuti/approval-flow/roles');
        return res?.data || res || [];
    },

    async reorderApprovalFlows(idTemplate, order) {
        const res = await api.put('/sicuti/approval-flow/order', { id_template: idTemplate, order });
        return res?.data || res || [];
    },

    async getTemplateMembers(idTemplate) {
        const res = await api.get('/sicuti/approval-template/members', { id_template: idTemplate });
        return res?.data || res || [];
    },

    async getMemberCandidates(idTemplate) {
        const res = await api.get('/sicuti/approval-template/candidates', { id_template: idTemplate });
        return res?.data || res || [];
    },

    async getUnassignedEmployees() {
        const res = await api.get('/sicuti/approval-template/unassigned');
        return res?.data || res || [];
    },

    async addTemplateMembers(idTemplate, uids) {
        const res = await api.post('/sicuti/approval-template/members', { id_template: idTemplate, uids });
        return res?.data || res || [];
    },

    async removeTemplateMember(uid) {
        const res = await api.delete(`/sicuti/approval-template/members?uid_user_system=${encodeURIComponent(uid)}`);
        return res?.data || res;
    },

    async getLeaveTypes(all = true) {
        const res = await api.get('/sicuti/leave-type', { all: all ? 'true' : 'false' });
        return res?.data || res || [];
    },

    async upsertLeaveType(data) {
        const res = await api.post('/sicuti/leave-type', data);
        return res?.data || res;
    },

    async deleteLeaveType(kd_leave_type) {
        const res = await api.delete('/sicuti/leave-type', { kd_leave_type });
        return res?.data || res;
    },

    async createHoliday(data) {
        const res = await api.post('/sicuti/holiday', data);
        return res?.data || res;
    },

    async deleteHoliday(id_holiday) {
        const res = await api.delete('/sicuti/holiday', { id_holiday });
        return res?.data || res;
    },

    async getPolicy() {
        const res = await api.get('/sicuti/policy');
        return res?.data || res;
    },

    async updatePolicy(data) {
        const res = await api.put('/sicuti/policy', data);
        return res?.data || res;
    },

    async getAuditLogs(params = {}) {
        const res = await api.get('/sicuti/audit-trail', { limit: 500, ...params });
        const rows = res?.data?.data || res?.data || [];
        return (Array.isArray(rows) ? rows : []).map((a) => ({
            id: a.id_audit,
            timestamp: localDateTime(a.created_at),
            username: a.username || a.uid_user || '-',
            user_name: a.user_name || '',
            user_role: a.user_role || '',
            action: a.action,
            entity: String(a.entity || 'SYSTEM').toUpperCase(),
            ip_address: a.ip_address || '-',
            details: describeAudit(a)
        }));
    }
};

function localDateTime(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value || '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export const AUDIT_ACTION_LABEL = {
    LOGIN: 'Masuk aplikasi',
    LOGOUT: 'Keluar aplikasi',
    SUBMIT_LEAVE: 'Ajukan cuti',
    RESUBMIT_LEAVE: 'Ajukan ulang cuti',
    APPROVE_LEAVE: 'Setujui cuti',
    RETURN_LEAVE: 'Kembalikan cuti',
    REJECT_LEAVE: 'Tolak cuti',
    CANCEL_LEAVE: 'Batalkan cuti',
    UPLOAD_DOCUMENT: 'Unggah dokumen',
    COMPLETE_DOCUMENT: 'Lengkapi dokumen',
    UPDATE_BALANCE: 'Sesuaikan saldo',
    CREATE_USER: 'Buat akun',
    UPDATE_USER: 'Ubah akun',
    DELETE_USER: 'Hapus akun',
    DEACTIVATE_USER: 'Nonaktifkan akun',
    RESET_PASSWORD: 'Ganti password oleh admin',
    CHANGE_PASSWORD: 'Ganti password',
    UNLOCK_USER: 'Buka kunci akun',
    IMPORT_USER: 'Impor karyawan',
    UPDATE_PROFILE: 'Ubah profil',
    CREATE_HOLIDAY: 'Tambah hari libur',
    UPDATE_HOLIDAY: 'Ubah hari libur',
    DELETE_HOLIDAY: 'Hapus hari libur',
    IMPORT_HOLIDAY: 'Impor hari libur',
    SAVE_LEAVE_TYPE: 'Simpan jenis cuti',
    DELETE_LEAVE_TYPE: 'Hapus jenis cuti',
    UPDATE_POLICY: 'Ubah kebijakan cuti',
    SAVE_APPROVAL_FLOW: 'Simpan tingkat approval',
    DELETE_APPROVAL_FLOW: 'Hapus tingkat approval',
    REORDER_APPROVAL_FLOW: 'Ubah urutan approval',
    ASSIGN_APPROVER: 'Tetapkan approver',
    SAVE_APPROVAL_TEMPLATE: 'Simpan templat approval',
    DELETE_APPROVAL_TEMPLATE: 'Hapus templat approval',
    SAVE_DEPARTMENT: 'Simpan departemen',
    UPDATE_PERMISSION: 'Ubah hak akses',
    ACCESS_DENIED: 'Akses ditolak'
};

export const AUDIT_ENTITY_LABEL = {
    AUTH: 'Autentikasi',
    LEAVE_REQUEST: 'Pengajuan cuti',
    LEAVE_BALANCE: 'Saldo cuti',
    USER: 'Akun',
    HOLIDAY: 'Hari libur',
    LEAVE_TYPE: 'Jenis cuti',
    POLICY: 'Kebijakan cuti',
    APPROVAL_FLOW: 'Alur approval',
    APPROVAL_TEMPLATE: 'Templat approval',
    DEPARTMENT: 'Departemen',
    PERMISSION: 'Hak akses'
};

function describeAudit(a) {
    const who = a.user_name || a.username || '';
    if (a.action === 'LOGIN') return `${who} masuk ke aplikasi`;
    if (a.action === 'LOGOUT') return `${who} keluar dari aplikasi`;
    const data = a.new_data && typeof a.new_data === 'object' ? a.new_data : null;
    const body = data?.body && typeof data.body === 'object' ? data.body : data;
    const fields = body
        ? Object.entries(body)
              .filter(([k, v]) => v !== null && v !== '' && typeof v !== 'object' && !['method', 'path'].includes(k))
              .slice(0, 4)
              .map(([k, v]) => `${k}: ${v}`)
        : [];
    const label = AUDIT_ACTION_LABEL[a.action] || a.action;
    const title = a.entity_id ? `${label} ${a.entity_id}` : label;
    if (a.action === 'DEACTIVATE_USER') return describeDeactivation(title, body);
    const extra = data?.reason ? ` (${data.reason})` : '';
    return [title + extra, ...fields].join(' · ');
}

function describeDeactivation(title, body) {
    return [
        title,
        body?.status_reason ? `Alasan: ${statusReasonLabel(body.status_reason)}` : '',
        body?.status_note ? `Keterangan: ${body.status_note}` : ''
    ]
        .filter(Boolean)
        .join(' · ');
}

export default adminService;
