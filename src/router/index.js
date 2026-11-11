import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';
import { currentUser, isAdmin, isSuperAdmin, isApprover, isApplicant, can } from '@/service/sicutiService';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            component: AppLayout,
            children: [
                {
                    path: '/',
                    alias: '/dashboard',
                    name: 'dashboard',
                    component: () => import('@/views/Dashboard.vue'),
                    meta: { requiresAuth: true }
                },
                {
                    path: '/leave/new',
                    name: 'leave-new',
                    redirect: { path: '/leave/history', query: { action: 'new_leave' } }
                },
                {
                    path: '/leave/edit/:id',
                    name: 'leave-edit',
                    redirect: (to) => ({ path: '/leave/history', query: { editId: to.params.id } })
                },
                {
                    path: '/calendar',
                    name: 'leave-calendar',
                    component: () => import('@/views/leave/LeaveCalendar.vue'),
                    meta: { requiresAuth: true, ability: 'dashboard_laporan.view_calendar' }
                },
                {
                    path: '/leave/history',
                    name: 'leave-history',
                    component: () => import('@/views/leave/LeaveHistory.vue'),
                    meta: { requiresAuth: true, requiresApplicant: true, ability: 'dokumen_saldo.view_history' }
                },
                {
                    path: '/leave/balance',
                    name: 'leave-balance',
                    component: () => import('@/views/leave/LeaveBalance.vue'),
                    meta: { requiresAuth: true, requiresApplicant: true, ability: 'dokumen_saldo.view_balance' }
                },
                {
                    path: '/approval/pending',
                    name: 'approval-pending',
                    component: () => import('@/views/approval/PendingApproval.vue'),
                    meta: { requiresAuth: true, requiresApprover: true, ability: ['approval.view_requests', 'approval.validate'] }
                },
                {
                    path: '/approval/history',
                    name: 'approval-history',
                    component: () => import('@/views/approval/ApprovalHistory.vue'),
                    meta: { requiresAuth: true, requiresApprover: true, ability: 'approval.view_requests' }
                },
                {
                    path: '/admin/monitoring',
                    name: 'admin-monitoring',
                    component: () => import('@/views/admin/AdminMonitoring.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true, ability: 'master_data.view_processed' }
                },
                {
                    path: '/admin/balances',
                    name: 'admin-balances',
                    component: () => import('@/views/admin/AdminBalances.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true, requiresMasterView: true }
                },
                {
                    path: '/admin/employees',
                    name: 'admin-employees',
                    component: () => import('@/views/admin/AdminEmployees.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true, requiresMasterView: true }
                },
                {
                    path: '/admin/accounts',
                    name: 'admin-accounts',
                    component: () => import('@/views/admin/AdminAccounts.vue'),
                    meta: { requiresAuth: true, requiresSuperAdmin: true }
                },
                {
                    path: '/admin/roles',
                    redirect: '/admin/permissions'
                },
                {
                    path: '/admin/policy',
                    name: 'admin-policy',
                    component: () => import('@/views/admin/AdminPolicy.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true, requiresMasterView: true }
                },
                {
                    path: '/admin/create-leave',
                    name: 'admin-create-leave',
                    component: () => import('@/views/admin/AdminCreateLeave.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true }
                },
                {
                    path: '/admin/leave-types',
                    name: 'admin-leave-types',
                    component: () => import('@/views/admin/AdminLeaveTypes.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true, requiresMasterView: true }
                },
                {
                    path: '/admin/holidays',
                    name: 'admin-holidays',
                    component: () => import('@/views/admin/AdminHolidays.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true, requiresMasterView: true }
                },
                {
                    path: '/admin/approval-flow',
                    name: 'admin-approval-flow',
                    component: () => import('@/views/admin/AdminApprovalFlow.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true, requiresMasterView: true }
                },
                {
                    path: '/admin/permissions',
                    name: 'admin-permissions',
                    component: () => import('@/views/admin/AdminPermissions.vue'),
                    meta: { requiresAuth: true, requiresSuperAdmin: true }
                },
                {
                    path: '/admin/reports',
                    name: 'admin-reports',
                    component: () => import('@/views/admin/AdminReports.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true, ability: 'dashboard_laporan.view_reports' }
                },
                {
                    path: '/admin/audit-trail',
                    name: 'admin-audit-trail',
                    component: () => import('@/views/admin/AdminAuditTrail.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true, ability: 'dashboard_laporan.view_audit' }
                },
                {
                    path: '/profile',
                    name: 'profile',
                    component: () => import('@/views/user/Profile.vue'),
                    meta: { requiresAuth: true, ability: 'login_user.view_profile' }
                }
            ]
        },
        {
            path: '/validasi/:secret(.*)',
            name: 'document-validation',
            component: () => import('@/views/approval/DocumentValidation.vue'),
            meta: { public: true }
        },
        {
            path: '/auth/forgot-password',
            name: 'forgot-password',
            component: () => import('@/views/auth/ForgotPassword.vue'),
            meta: { public: true }
        },
        {
            path: '/auth/login',
            name: 'login',
            component: () => import('@/views/auth/Login.vue')
        },
        {
            path: '/:pathMatch(.*)*',
            name: 'notfound',
            component: () => import('@/views/NotFound.vue')
        }
    ]
});

router.beforeEach((to) => {
    if (to.meta.public) return true;

    const isAuth = Boolean(currentUser.value);
    if (to.name !== 'login' && !isAuth) return { name: 'login' };
    if (to.name === 'login') return isAuth ? { name: 'dashboard' } : true;

    const denied =
        (to.meta.requiresSuperAdmin && !isSuperAdmin()) ||
        (to.meta.requiresAdmin && !isAdmin()) ||
        (to.meta.requiresApprover && !isApprover()) ||
        (to.meta.requiresMasterView && !isSuperAdmin() && !can('master_data.view_master_data')) ||
        (to.meta.requiresApplicant && !isApplicant()) ||
        (to.meta.ability && !isSuperAdmin() && !can(to.meta.ability));
    return denied ? { name: 'dashboard' } : true;
});

export default router;
