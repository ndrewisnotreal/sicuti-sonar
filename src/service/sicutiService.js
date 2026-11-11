import { reactive, ref, computed } from 'vue';
import { getEncryptedItem, setEncryptedItem } from '@/utils/encryption';
import { countWorkingDays } from '@/utils/workingDays';
import api, { clearAuth } from './api.js';
import authService, { userMenus, userAbilities, can } from './authService.js';
import leaveService from './leaveService.js';
import approvalService from './approvalService.js';
import adminService from './adminService.js';
import {
    BUILT_IN_ROLES,
    ADMIN_ROLES,
    APPROVER_ROLES,
    ROLE_LABELS,
    roleOf,
    getPrimaryRole,
    isAdmin,
    isSuperAdmin,
    isApprover,
    isApprovalOnly,
    isApplicant,
    canSubmitLeave,
    isSubstituteRequired,
    getAdminDivision,
    registerCurrentUserGetter
} from '@/utils/roleUtils.js';
import {
    CURRENT_YEAR,
    YEAR_OPTIONS,
    formatDate,
    formatDateTime,
    formatTimeAgo
} from '@/utils/dateUtils.js';
import {
    STATUS_LABELS,
    getStatusSeverity,
    getStatusLabel,
    STATUS_OPTIONS
} from '@/utils/statusUtils.js';
import {
    lastReturnNote,
    stepApproverName,
    isStepApprover,
    getUserApprovalLevel as _getUserApprovalLevel,
    getApprovalFlowsForRequest as _getApprovalFlowsForRequest,
    getCurrentApprovalLevel as _getCurrentApprovalLevel,
    canUserApprove as _canUserApprove
} from '@/utils/approvalStepUtils.js';
import {
    attachmentInfo,
    fetchAttachmentUrl,
    openAttachment,
    documentPending
} from '@/utils/attachmentUtils.js';

export { userMenus, userAbilities, can };
export {
    BUILT_IN_ROLES,
    ADMIN_ROLES,
    APPROVER_ROLES,
    ROLE_LABELS,
    roleOf,
    getPrimaryRole,
    isAdmin,
    isSuperAdmin,
    isApprover,
    isApprovalOnly,
    isApplicant,
    canSubmitLeave,
    isSubstituteRequired,
    getAdminDivision
};
export {
    CURRENT_YEAR,
    YEAR_OPTIONS,
    formatDate,
    formatDateTime,
    formatTimeAgo
};
export {
    STATUS_LABELS,
    getStatusSeverity,
    getStatusLabel,
    STATUS_OPTIONS
};
export {
    lastReturnNote,
    stepApproverName,
    isStepApprover,
    attachmentInfo,
    fetchAttachmentUrl,
    openAttachment,
    documentPending
};

const AUTH_KEY = 'sicuti_auth';

export const sicutiState = reactive({
    users: [],
    departments: [],
    leaveTypes: [],
    leavePolicy: {
        annualQuota: 12,
        maxCarryOver: 4,
        carryOverExpiryMonths: 6,
        description: 'Kuota tahunan 12 hari, carry over maks 4 hari'
    },
    holidays: [],
    leaveBalances: [],
    approvalFlows: [],
    leaveRequests: [],
    pendingApprovalCount: 0,
    dataVersion: 0,
    // 'idle' | 'loading' | 'ready' | 'error'. Sinkron ulang setelah 'ready' tidak kembali ke 'loading'
    // agar data lama tetap tampil (izin pengguna 2026-11-09, audit-034 #3).
    syncStatus: 'idle'
});

const PENDING_FRESH_MS = 2000;
let pendingCountAt = 0;
let pendingCountPromise = null;

export function setPendingApprovalCount(count) {
    sicutiState.pendingApprovalCount = Number(count) || 0;
    pendingCountAt = Date.now();
}

export async function refreshPendingApprovalCount({ force = false } = {}) {
    if (!isApprover()) return;
    if (!force && Date.now() - pendingCountAt < PENDING_FRESH_MS) return;
    if (pendingCountPromise) return pendingCountPromise;
    pendingCountPromise = (async () => {
        try {
            const res = await api.get('/sicuti/leave-request/pending-approval');
            const list = res?.data || res;
            setPendingApprovalCount(Array.isArray(list) ? list.length : 0);
        } catch {
        } finally {
            pendingCountPromise = null;
        }
    })();
    return pendingCountPromise;
}


function loadInitialAuth() {
    const user = getEncryptedItem(AUTH_KEY);
    if (!user || typeof user !== 'object') return { user: null, activeRole: null };
    return {
        user,
        activeRole: getPrimaryRole(user.kd_role || user.role)
    };
}

const initialAuth = loadInitialAuth();
export const currentUser = ref(initialAuth.user);
export const activeRole = ref(initialAuth.activeRole);
registerCurrentUserGetter(() => currentUser.value);

export function defaultAnnualQuota() {
    return Number(sicutiState.leavePolicy?.annualQuota) || 12;
}


function hasApplicantAccess(user = currentUser.value) {
    return isApplicant(user) && can('pengajuan_cuti.submit', 'dokumen_saldo.view_history', 'dokumen_saldo.view_balance');
}

const MODE_KEY = 'sicuti_mode';
function loadInitialMode() {
    try {
        return localStorage.getItem(MODE_KEY) === 'approval' ? 'approval' : 'user';
    } catch {
        return 'user';
    }
}
const storedMode = ref(loadInitialMode());

export const appMode = computed({
    get() {
        const user = currentUser.value;
        if (isApprovalOnly(user)) return 'approval';
        if (!isApprover(user) || !hasApplicantAccess(user)) return isApprover(user) ? 'approval' : 'user';
        return storedMode.value;
    },
    set(mode) {
        storedMode.value = mode === 'approval' ? 'approval' : 'user';
        try {
            localStorage.setItem(MODE_KEY, storedMode.value);
        } catch {}
    }
});

export function saveToLocalStorage() {
}

function mapLeaveTypes(rawTypes) {
    return rawTypes.map((t, idx) => ({
        id: t.kd_leave_type || t.id_leave_type || t.id || `LT${idx + 1}`,
        code: t.code || t.kd_leave_type || `LT${idx + 1}`,
        name: t.nm_leave_type || t.name,
        description: t.description || '',
        usesQuota: Boolean(t.uses_quota ?? t.is_paid ?? t.usesQuota),
        requiresDocument: Boolean(t.requires_document ?? t.requires_attachment ?? t.requiresDocument),
        isActive: Boolean(t.is_active ?? t.isActive ?? true),
        maxDays: t.max_days ? Number(t.max_days) : null,
        allowBackdate: Boolean(t.allow_backdate),
        allowLateDocument: Boolean(t.allow_late_document),
        lateDocumentDays: Number(t.late_document_days || 3)
    }));
}

export function setActiveLeaveTypes(rawList) {
    const active = (Array.isArray(rawList) ? rawList : []).filter((t) => t.is_active !== false && t.is_deleted !== true);
    sicutiState.leaveTypes = mapLeaveTypes(active);
}

let syncPromise = null;
export function syncFromBackend() {
    if (!currentUser.value) return Promise.resolve();
    if (!syncPromise) {
        syncPromise = runSync().finally(() => {
            syncPromise = null;
        });
    }
    return syncPromise;
}

async function runSync() {
    if (sicutiState.syncStatus !== 'ready') sicutiState.syncStatus = 'loading';
    let failed = false;
    try {
        const year = new Date().getFullYear();
        const [reqs, balances, holidays, leaveTypes, policy, flows, depts, usersRes, menuRes] = await Promise.allSettled([
            api.get('/sicuti/leave-request', { limit: 1000 }),
            can('master_data.view_master_data', 'dashboard_laporan.view_reports')
                ? api.get('/sicuti/leave-balance', { year })
                : api.get('/sicuti/leave-balance/me', { year }),
            api.get('/sicuti/holiday', { year }),
            api.get('/sicuti/leave-type'),
            api.get('/sicuti/policy'),
            can('master_data.view_master_data', 'master_data.manage_approval', 'approval.view_requests')
                ? api.get('/sicuti/approval-flow')
                : Promise.resolve(null),
            api.get('/sicuti/department'),
            can('master_data.view_master_data', 'master_data.manage_employees') ? api.get('/master/user') : Promise.resolve(null),
            authService.getMenu()
        ]);

        void refreshPendingApprovalCount();

        // Pengajuan, hari libur, dan pengguna adalah sumber angka Dashboard Admin; gagal di sini berarti 0 bukan fakta.
        failed = [reqs, holidays, usersRes].some((r) => r.status === 'rejected');

        if (reqs.status === 'fulfilled' && reqs.value) {
            const rawReqs = reqs.value.data?.data || reqs.value.data || reqs.value;
            if (Array.isArray(rawReqs)) {
                sicutiState.leaveRequests = rawReqs.map((r) => ({
                    id: r.id_request || r.id,
                    userId: r.uid_user_system || r.userId,
                    userName: r.requester_name || r.userName || r.nama,
                    namecode: r.namecode || r.username,
                    department: r.kd_dept || r.department,
                    departmentName: r.nm_dept || r.departmentName,
                    leaveTypeId: r.kd_leave_type || r.id_leave_type || r.leaveTypeId,
                    leaveTypeName: r.nm_leave_type || r.leaveTypeName,
                    startDate: r.start_date ? String(r.start_date).split('T')[0] : (r.startDate || ''),
                    endDate: r.end_date ? String(r.end_date).split('T')[0] : (r.endDate || ''),
                    totalDays: Number(r.total_days ?? r.totalDays ?? 0),
                    reason: r.reason || '',
                    substituteId: r.substitute_id || r.substituteId || null,
                    status: r.status || 'submitted',
                    createdAt: r.created_at || r.createdAt,
                    updatedAt: r.updated_at || r.updatedAt,
                    approvalRecords: (r.approval_records || r.approvalRecords || []).map((a) => ({
                        approverId: a.approver_id || a.approverId,
                        approverName: a.approver_name || a.approverName,
                        level: Number(a.level || 1),
                        action: a.action,
                        notes: a.notes,
                        signature: a.signature_url || a.signature || a.approver_name,
                        createdAt: a.created_at || a.createdAt
                    })),
                    documents: r.attachment_url ? [{ fileName: r.attachment_url }] : (r.documents || [])
                }));
            }
        }

        if (balances.status === 'fulfilled' && balances.value) {
            const rawBalances = balances.value.data || balances.value;
            if (Array.isArray(rawBalances)) {
                sicutiState.leaveBalances = rawBalances.map((b) => ({
                    id: b.id_balance || b.id,
                    userId: b.uid_user_system || b.userId,
                    userName: b.nama || b.userName,
                    namecode: b.namecode || b.username,
                    department: b.kd_dept || b.department,
                    year: Number(b.year || new Date().getFullYear()),
                    annualQuota: Number(b.annual_quota ?? b.annualQuota ?? defaultAnnualQuota()),
                    usedDays: Number(b.used_days ?? b.usedDays ?? 0),
                    carryOverDays: Number(b.carry_over_days ?? b.carryOverDays ?? 0),
                    carryOverExpiryDate: b.carry_over_expiry_date ? String(b.carry_over_expiry_date).split('T')[0] : null,
                    remaining: Number(b.remaining ?? 0),
                    periodStart: b.period_start || null,
                    periodEnd: b.period_end || null,
                    periodLabel: b.period_label || ''
                }));
            }
        }

        if (holidays.status === 'fulfilled' && holidays.value) {
            const rawHolidays = holidays.value.data || holidays.value;
            if (Array.isArray(rawHolidays)) {
                sicutiState.holidays = rawHolidays.map((h) => ({
                    id: h.id_holiday || h.id,
                    date: h.holiday_date ? String(h.holiday_date).split('T')[0] : (h.date || ''),
                    endDate: h.end_date ? String(h.end_date).split('T')[0] : (h.endDate || null),
                    name: h.nm_holiday || h.name,
                    year: Number(h.year || new Date().getFullYear()),
                    type: h.holiday_type || h.type || 'national'
                }));
            }
        }

        if (leaveTypes.status === 'fulfilled' && leaveTypes.value) {
            const rawTypes = leaveTypes.value.data || leaveTypes.value;
            if (Array.isArray(rawTypes)) {
                sicutiState.leaveTypes = mapLeaveTypes(rawTypes);
            }
        }

        if (policy.status === 'fulfilled' && policy.value?.data) {
            const p = policy.value.data;
            sicutiState.leavePolicy = {
                annualQuota: Number(p.annual_quota),
                maxCarryOver: Number(p.max_carry_over ?? 0),
                carryOverExpiryMonths: Number(p.carry_over_expiry_months ?? 0),
                description: `Kuota tahunan ${p.annual_quota} hari, carry over maks ${p.max_carry_over ?? 0} hari`
            };
        }

        if (flows.status === 'fulfilled' && flows.value) {
            const rawFlows = flows.value.data || flows.value;
            if (Array.isArray(rawFlows)) {
                sicutiState.approvalFlows = rawFlows.map((f) => ({
                    id: f.id_flow || f.id,
                    level: Number(f.level || 1),
                    name: f.nm_flow || f.name,
                    assignedRole: f.assigned_role || f.assignedRole,
                    isMandatory: Boolean(f.is_mandatory ?? f.isMandatory),
                    isActive: Boolean(f.is_active ?? f.isActive),
                    assignedUserIds: (f.users || [])
                        .map((u) => (typeof u === 'string' ? u : u?.uid_user_system || u?.id))
                        .filter(Boolean)
                }));
            }
        }

        if (depts.status === 'fulfilled' && depts.value) {
            const rawDepts = depts.value.data || depts.value;
            if (Array.isArray(rawDepts)) {
                sicutiState.departments = rawDepts.map((d) => ({
                    id: d.id_dept || d.id,
                    code: d.kd_dept || d.code,
                    name: d.nm_dept || d.name
                }));
            }
        }

        if (usersRes.status === 'fulfilled' && usersRes.value) {
            const rawUsers = usersRes.value.data || usersRes.value;
            if (Array.isArray(rawUsers)) {
                sicutiState.users = rawUsers.map((u) => ({
                    id: u.uid_user_system || u.id,
                    name: u.nama || u.name,
                    username: u.username,
                    namecode: u.username || u.namecode,
                    email: u.email || '',
                    role: u.kd_role || u.role,
                    roleName: u.nm_role || u.roleName,
                    department: u.kd_dept || u.department || 'SIT',
                    departmentName: u.nm_dept || u.departmentName,
                    position: u.position || '',
                    adminDivision: u.admin_division || null,
                    supervisorId: u.supervisor_id || null,
                    joinDate: u.join_date ? String(u.join_date).split('T')[0] : null,
                    isActive: u.status_user === 'A' && !u.is_locked && !u.is_deleted,
                    isLocked: Boolean(u.is_locked),
                    isDeleted: Boolean(u.is_deleted)
                }));
            }
        }
    } catch (e) {
        failed = true;
        console.warn('[sicutiService] syncFromBackend error:', e.message);
    }
    sicutiState.syncStatus = failed ? 'error' : 'ready';
}

export async function login(identifier, password) {
    try {
        const data = await authService.login(identifier, password);
        const user = data.user;
        const normalizedUser = {
            id: user.uid_user_system || user.id,
            name: user.nama || user.name,
            username: user.username,
            namecode: user.username,
            email: user.email || '',
            role: user.kd_role || user.role,
            roleName: user.nm_role,
            department: user.kd_dept || user.department || null,
            position: user.position || '',
            adminDivision: user.admin_division || null,
            isSuper: Boolean(user.is_super),
            isActive: true
        };
        currentUser.value = normalizedUser;
        activeRole.value = getPrimaryRole(normalizedUser.role);
        persistCurrentUser();

        syncFromBackend();

        return { success: true, user: normalizedUser };
    } catch (err) {
        return {
            success: false,
            message: err.data?.error || err.data?.message || err.message || 'Login gagal. Periksa ID dan kata sandi.',
            code: err.data?.data?.code || null,
            data: err.data?.data || null
        };
    }
}

export function persistCurrentUser() {
    if (currentUser.value) setEncryptedItem(AUTH_KEY, currentUser.value);
}

export function logout() {
    authService.logout();
    currentUser.value = null;
    activeRole.value = null;
    sicutiState.syncStatus = 'idle';
    clearAuth();
}

export function switchRole(role) {
    activeRole.value = role;
}


export function getDivisionUsers(division = getAdminDivision()) {
    return division
        ? sicutiState.users.filter((u) => u.department === division)
        : sicutiState.users;
}

export function getDivisionRequests(division = getAdminDivision()) {
    const userIds = new Set(getDivisionUsers(division).map((u) => u.id));
    return sicutiState.leaveRequests.filter((r) => userIds.has(r.userId));
}

export function getDivisionBalances(division = getAdminDivision()) {
    const users = getDivisionUsers(division).filter((u) => u.isActive !== false);
    const userIds = new Set(users.map((u) => u.id));
    return sicutiState.leaveBalances.filter((b) => userIds.has(b.userId));
}

export function getUserBalance(userId) {
    const balance = sicutiState.leaveBalances.find((b) => b.userId === userId);
    if (balance) {
        const remaining = (balance.annualQuota || 0) + (balance.carryOverDays || 0) - (balance.usedDays || 0);
        return {
            annualQuota: balance.annualQuota,
            usedDays: balance.usedDays,
            carryOverDays: balance.carryOverDays,
            carryOverExpiryDate: balance.carryOverExpiryDate,
            remaining: Math.max(0, remaining)
        };
    }
    return {
        annualQuota: 12,
        usedDays: 0,
        carryOverDays: 0,
        carryOverExpiryDate: null,
        remaining: 12
    };
}

export function holidayDateSet() {
    const dates = new Set();
    for (const h of sicutiState.holidays) {
        if (!h.date) continue;
        const cur = new Date(h.date + "T00:00:00Z");
        const fin = new Date((h.endDate || h.date) + "T00:00:00Z");
        while (cur <= fin) {
            dates.add(cur.toISOString().slice(0, 10));
            cur.setUTCDate(cur.getUTCDate() + 1);
        }
    }
    return dates;
}

export function calculateWorkingDays(startDate, endDate) {
    return countWorkingDays(startDate, endDate, holidayDateSet());
}

export async function createLeaveRequest(payload) {
    const res = await leaveService.createLeave(payload);
    await syncFromBackend();
    return res;
}

export async function updateLeaveRequest(id, payload) {
    if (payload.status === 'submitted') {
        const res = await leaveService.createLeave(payload);
        await syncFromBackend();
        return res;
    }
    return null;
}

export async function deleteLeaveRequest(id) {
    const res = await leaveService.cancelLeave(id);
    await syncFromBackend();
    return res;
}

export function getUserApprovalLevel(userId) {
    return _getUserApprovalLevel(userId, sicutiState.approvalFlows, getUser);
}

export function getApprovalFlowsForRequest(leaveRequest) {
    return _getApprovalFlowsForRequest(leaveRequest, sicutiState.approvalFlows, getUser);
}

export function getCurrentApprovalLevel(req) {
    return _getCurrentApprovalLevel(req, sicutiState.approvalFlows, getUser);
}

export function canUserApprove(req, user) {
    return _canUserApprove(req, user, sicutiState.approvalFlows, {
        getUserFn: getUser,
        isSuperAdminFn: isSuperAdmin,
        isApproverFn: isApprover
    });
}

export async function approveLeaveRequest(id, notes, signature) {
    const res = await approvalService.processApproval({
        idRequest: id,
        action: 'approve',
        notes,
        signature
    });
    await syncFromBackend();
    return res;
}

export async function rejectLeaveRequest(id, notes) {
    const res = await approvalService.processApproval({
        idRequest: id,
        action: 'reject',
        notes
    });
    await syncFromBackend();
    return res;
}

export async function returnLeaveRequest(id, notes) {
    const res = await approvalService.processApproval({
        idRequest: id,
        action: 'return',
        notes
    });
    await syncFromBackend();
    return res;
}

export function getUser(id) {
    return sicutiState.users.find((u) => u.id === id || u.username === id);
}

export function getLeaveType(id) {
    return sicutiState.leaveTypes.find((t) => t.id === id || t.code === id);
}



export async function updateUserAccount(userId, payload) {
    const res = await adminService.updateUser({
        uid_user_system: userId,
        nama: payload.name,
        email: payload.email,
        password: payload.password,
        status_user: payload.isActive ? 'A' : 'N'
    });
    await syncFromBackend();
    return res;
}

export async function toggleUserStatus(userId) {
    const user = getUser(userId);
    if (!user) return null;
    const res = await adminService.updateUser({
        uid_user_system: userId,
        status_user: user.isActive ? 'N' : 'A'
    });
    await syncFromBackend();
    return res;
}

