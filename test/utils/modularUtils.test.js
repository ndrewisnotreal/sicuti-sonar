import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    CURRENT_YEAR,
    YEAR_OPTIONS,
    formatDate,
    formatDateTime,
    formatTimeAgo
} from '@/utils/dateUtils';
import {
    STATUS_LABELS,
    getStatusSeverity,
    getStatusLabel,
    STATUS_OPTIONS
} from '@/utils/statusUtils';
import {
    ADMIN_ROLES,
    APPROVER_ROLES,
    BUILT_IN_ROLES,
    ROLE_LABELS,
    canSubmitLeave,
    getAdminDivision,
    getPrimaryRole,
    isAdmin,
    isApplicant,
    isApprovalOnly,
    isApprover,
    isSubstituteRequired,
    isSuperAdmin,
    registerCurrentUserGetter,
    roleOf
} from '@/utils/roleUtils';

describe('dateUtils', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('formatDate handles valid date and empty string', () => {
        expect(formatDate('2026-10-15')).toBe('15 Oktober 2026');
        expect(formatDate('')).toBe('-');
        expect(formatDate(null)).toBe('-');
    });

    it('formatDate handles ISO timestamp strings', () => {
        const formatted = formatDate('2026-05-20T08:30:00Z');
        expect(formatted).toContain('2026');
        expect(formatted).toContain('Mei');
    });

    it('formatDateTime formats date and time with id locale', () => {
        expect(formatDateTime('')).toBe('-');
        expect(formatDateTime('invalid-date')).toBe('invalid-date');
        const dt = formatDateTime('2026-05-20T10:30:00Z');
        expect(dt).toContain('2026');
        expect(dt).toContain('Mei');
    });

    it('formatTimeAgo returns relative time intervals', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));

        expect(formatTimeAgo('')).toBe('');
        expect(formatTimeAgo('2026-09-30T11:59:45Z')).toBe('Baru saja');
        expect(formatTimeAgo('2026-09-30T11:40:00Z')).toBe('20 mnt lalu');
        expect(formatTimeAgo('2026-09-30T08:00:00Z')).toBe('4 jam lalu');
        expect(formatTimeAgo('2026-09-29T11:00:00Z')).toBe('Kemarin');
        expect(formatTimeAgo('2026-09-26T12:00:00Z')).toBe('4 hr lalu');
    });

    it('CURRENT_YEAR and YEAR_OPTIONS have correct values', () => {
        expect(CURRENT_YEAR).toBe(new Date().getFullYear());
        expect(YEAR_OPTIONS.map((o) => o.value)).toEqual([CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1]);
    });
});

describe('statusUtils', () => {
    it('getStatusSeverity maps leave statuses to PrimeVue severities', () => {
        expect(getStatusSeverity('approved')).toBe('success');
        expect(getStatusSeverity('completed')).toBe('success');
        expect(getStatusSeverity('submitted')).toBe('warn');
        expect(getStatusSeverity('pending_validation')).toBe('warn');
        expect(getStatusSeverity('processing')).toBe('info');
        expect(getStatusSeverity('rejected')).toBe('danger');
        expect(getStatusSeverity('returned')).toBe('warn');
        expect(getStatusSeverity('draft')).toBe('secondary');
        expect(getStatusSeverity('cancelled')).toBe('secondary');
        expect(getStatusSeverity('unknown')).toBe('secondary');
    });

    it('getStatusLabel maps statuses to user-friendly Indonesian labels', () => {
        expect(getStatusLabel('draft')).toBe('Draf');
        expect(getStatusLabel('submitted')).toBe('Diajukan');
        expect(getStatusLabel('pending_validation')).toBe('Menunggu Validasi');
        expect(getStatusLabel('approved')).toBe('Disetujui');
        expect(getStatusLabel('rejected')).toBe('Ditolak');
        expect(getStatusLabel('returned')).toBe('Dikembalikan');
        expect(getStatusLabel('other')).toBe('other');
    });

    it('STATUS_OPTIONS provides complete dropdown filter options', () => {
        expect(STATUS_OPTIONS.length).toBeGreaterThan(5);
        expect(STATUS_OPTIONS[0]).toEqual({ label: 'Semua Status', value: null });
        expect(STATUS_OPTIONS.some((o) => o.value === 'approved')).toBe(true);
    });
});

describe('roleUtils', () => {
    it('roleOf extracts role property safely', () => {
        expect(roleOf({ kd_role: 'admin_sit' })).toBe('admin_sit');
        expect(roleOf({ role: 'staff_it' })).toBe('staff_it');
        expect(roleOf(null)).toBeNull();
    });

    it('getPrimaryRole distinguishes admin from user', () => {
        expect(getPrimaryRole('admin_sit')).toBe('admin');
        expect(getPrimaryRole('admin_sis')).toBe('admin');
        expect(getPrimaryRole('admin_super_app')).toBe('admin');
        expect(getPrimaryRole('staff_it')).toBe('user');
        expect(getPrimaryRole('kepala_it')).toBe('user');
    });

    it('isAdmin and isSuperAdmin detect privileges', () => {
        expect(isAdmin({ role: 'admin_sit' })).toBe(true);
        expect(isAdmin({ kd_role: 'staff_it' })).toBe(false);

        expect(isSuperAdmin({ role: 'admin_super_app' })).toBe(true);
        expect(isSuperAdmin({ role: 'admin_sit', isSuper: true })).toBe(true);
        expect(isSuperAdmin({ role: 'admin_sit' })).toBe(false);
    });

    it('isSubstituteRequired only false for staff_it', () => {
        expect(isSubstituteRequired({ role: 'staff_it' })).toBe(false);
        expect(isSubstituteRequired({ kd_role: 'staff_seksi' })).toBe(true);
        expect(isSubstituteRequired({ role: 'kepala_it' })).toBe(true);
    });

    it('getAdminDivision extracts correct division', () => {
        expect(getAdminDivision({ role: 'admin_super_app' })).toBeNull();
        expect(getAdminDivision({ role: 'admin_sit' })).toBe('SIT');
        expect(getAdminDivision({ role: 'admin_sis' })).toBe('SIS');
        expect(getAdminDivision({ role: 'admin_division', adminDivision: 'SIT' })).toBe('SIT');
        expect(getAdminDivision({ role: 'custom', department: 'SIS' })).toBe('SIS');
        expect(getAdminDivision(null)).toBeNull();
    });

    it('uses registered currentUser getter when no user passed', () => {
        registerCurrentUserGetter(() => ({ role: 'admin_sit', kd_role: 'admin_sit' }));
        expect(isAdmin()).toBe(true);
        expect(isSubstituteRequired()).toBe(true);

        registerCurrentUserGetter(() => ({ role: 'staff_it', kd_role: 'staff_it' }));
        expect(isAdmin()).toBe(false);
        expect(isSubstituteRequired()).toBe(false);

        registerCurrentUserGetter(() => null);
        expect(isAdmin()).toBe(false);
    });
});
