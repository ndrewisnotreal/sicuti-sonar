import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import LeaveFormValidationAlert from '@/components/leave/LeaveFormValidationAlert.vue';
import LeaveFormDurationInfo from '@/components/leave/LeaveFormDurationInfo.vue';
import { validateLeaveForm, validateDraftForm } from '@/utils/leaveFormValidation';

describe('LeaveFormValidationAlert', () => {
    it('renders nothing when returnNote and validationAlert are null', () => {
        const wrapper = mount(LeaveFormValidationAlert, {
            props: { returnNote: null, validationAlert: null }
        });
        expect(wrapper.html()).toBe('<!--v-if-->');
    });

    it('renders return note with approver name and notes', () => {
        const wrapper = mount(LeaveFormValidationAlert, {
            props: {
                returnNote: { approverName: 'Budi Santoso', notes: 'Perbaiki tanggal pengajuan' },
                validationAlert: null
            }
        });
        expect(wrapper.text()).toContain('Dikembalikan oleh Budi Santoso');
        expect(wrapper.text()).toContain('Perbaiki tanggal pengajuan');
    });

    it('renders validation alert and emits dismiss on close click', async () => {
        const wrapper = mount(LeaveFormValidationAlert, {
            props: {
                returnNote: null,
                validationAlert: {
                    severity: 'error',
                    title: 'Bentrok Jadwal Cuti',
                    message: 'Tanggal bentrok dengan pengajuan lain.'
                }
            }
        });
        expect(wrapper.text()).toContain('Bentrok Jadwal Cuti');
        expect(wrapper.text()).toContain('Tanggal bentrok dengan pengajuan lain.');

        const closeBtn = wrapper.find('button[title="Tutup pesan"]');
        expect(closeBtn.exists()).toBe(true);
        await closeBtn.trigger('click');
        expect(wrapper.emitted('dismiss')).toHaveLength(1);
    });
});

describe('LeaveFormDurationInfo', () => {
    it('renders nothing when calculatedDays is 0 or negative', () => {
        const wrapper = mount(LeaveFormDurationInfo, {
            props: { calculatedDays: 0, usesQuota: true, estimatedRemaining: 5 }
        });
        expect(wrapper.html()).toBe('<!--v-if-->');
    });

    it('renders calculated days and normal estimated remaining quota', () => {
        const wrapper = mount(LeaveFormDurationInfo, {
            props: { calculatedDays: 3, usesQuota: true, estimatedRemaining: 7 }
        });
        expect(wrapper.text()).toContain('Durasi Hari Kerja: 3 hari');
        expect(wrapper.text()).toContain('Estimasi sisa saldo: 7 hari');
    });

    it('applies negative quota highlight when estimatedRemaining < 0', () => {
        const wrapper = mount(LeaveFormDurationInfo, {
            props: { calculatedDays: 5, usesQuota: true, estimatedRemaining: -2 }
        });
        expect(wrapper.text()).toContain('Estimasi sisa saldo: -2 hari');
        const strong = wrapper.find('strong.text-red-600');
        expect(strong.exists()).toBe(true);
    });

    it('does not display remaining balance when usesQuota is false', () => {
        const wrapper = mount(LeaveFormDurationInfo, {
            props: { calculatedDays: 2, usesQuota: false, estimatedRemaining: 10 }
        });
        expect(wrapper.text()).toContain('Durasi Hari Kerja: 2 hari');
        expect(wrapper.text()).not.toContain('Estimasi sisa saldo');
    });
});

describe('leaveFormValidation utils', () => {
    const validForm = {
        leaveTypeId: 'CT',
        startDate: '2025-06-10',
        endDate: '2025-06-12',
        substituteId: 'USR-2',
        reason: 'Keperluan keluarga',
        documentName: ''
    };

    const leaveType = {
        name: 'Cuti Tahunan',
        usesQuota: true,
        requiresDocument: false,
        maxDays: 12,
        allowLateDocument: false
    };

    it('validates a correct form successfully', () => {
        const res = validateLeaveForm({
            form: validForm,
            selectedLeaveType: leaveType,
            calculatedDays: 3,
            remainingBalance: 10,
            substituteRequired: true
        });
        expect(res.valid).toBe(true);
    });

    it('fails when leaveTypeId is missing', () => {
        const res = validateLeaveForm({
            form: { ...validForm, leaveTypeId: '' },
            selectedLeaveType: leaveType,
            calculatedDays: 3,
            remainingBalance: 10
        });
        expect(res.valid).toBe(false);
        expect(res.error.detail).toContain('pilih jenis cuti');
    });

    it('fails when startDate or endDate is missing', () => {
        const res1 = validateLeaveForm({
            form: { ...validForm, startDate: null },
            selectedLeaveType: leaveType,
            calculatedDays: 3,
            remainingBalance: 10
        });
        expect(res1.valid).toBe(false);
        expect(res1.error.detail).toContain('mulai');

        const res2 = validateLeaveForm({
            form: { ...validForm, endDate: null },
            selectedLeaveType: leaveType,
            calculatedDays: 3,
            remainingBalance: 10
        });
        expect(res2.valid).toBe(false);
        expect(res2.error.detail).toContain('selesai');
    });

    it('fails when endDate is before startDate', () => {
        const res = validateLeaveForm({
            form: { ...validForm, startDate: '2025-06-15', endDate: '2025-06-10' },
            selectedLeaveType: leaveType,
            calculatedDays: 1,
            remainingBalance: 10
        });
        expect(res.valid).toBe(false);
        expect(res.error.detail).toContain('setelah tanggal mulai');
    });

    it('fails when calculatedDays is 0 or less', () => {
        const res = validateLeaveForm({
            form: validForm,
            selectedLeaveType: leaveType,
            calculatedDays: 0,
            remainingBalance: 10
        });
        expect(res.valid).toBe(false);
        expect(res.error.detail).toContain('tidak memuat hari kerja');
    });

    it('fails when quota is insufficient', () => {
        const res = validateLeaveForm({
            form: validForm,
            selectedLeaveType: leaveType,
            calculatedDays: 5,
            remainingBalance: 3
        });
        expect(res.valid).toBe(false);
        expect(res.error.summary).toBe('Saldo Kurang');
    });

    it('fails when calculatedDays exceeds maxDays', () => {
        const maxType = { ...leaveType, maxDays: 2, name: 'Cuti Khusus' };
        const res = validateLeaveForm({
            form: validForm,
            selectedLeaveType: maxType,
            calculatedDays: 3,
            remainingBalance: 10
        });
        expect(res.valid).toBe(false);
        expect(res.error.summary).toBe('Melebihi Batas Hari');
    });

    it('fails when document is required and late document is not allowed', () => {
        const docType = { ...leaveType, requiresDocument: true, allowLateDocument: false, name: 'Cuti Sakit' };
        const res = validateLeaveForm({
            form: { ...validForm, documentName: '' },
            selectedLeaveType: docType,
            calculatedDays: 2,
            remainingBalance: 10
        });
        expect(res.valid).toBe(false);
        expect(res.error.summary).toBe('Dokumen Wajib');
    });

    it('passes when document is required but allowLateDocument is true', () => {
        const docType = { ...leaveType, requiresDocument: true, allowLateDocument: true, name: 'Cuti Sakit' };
        const res = validateLeaveForm({
            form: { ...validForm, documentName: '' },
            selectedLeaveType: docType,
            calculatedDays: 2,
            remainingBalance: 10
        });
        expect(res.valid).toBe(true);
    });

    it('fails when substitute is required but substituteId is missing', () => {
        const res = validateLeaveForm({
            form: { ...validForm, substituteId: '' },
            selectedLeaveType: leaveType,
            calculatedDays: 2,
            remainingBalance: 10,
            substituteRequired: true
        });
        expect(res.valid).toBe(false);
        expect(res.error.detail).toContain('rekan pengganti');
    });

    it('fails when reason is empty or only whitespace', () => {
        const res = validateLeaveForm({
            form: { ...validForm, reason: '   ' },
            selectedLeaveType: leaveType,
            calculatedDays: 2,
            remainingBalance: 10
        });
        expect(res.valid).toBe(false);
        expect(res.error.detail).toContain('Alasan pengajuan cuti wajib diisi');
    });

    it('mengumpulkan semua error field sekaligus pada form kosong', () => {
        const res = validateLeaveForm({
            form: { leaveTypeId: 'CT', startDate: null, endDate: null, reason: '', substituteId: '' },
            selectedLeaveType: leaveType,
            calculatedDays: 0,
            remainingBalance: 10,
            substituteRequired: true
        });
        expect(res.valid).toBe(false);
        expect(Object.keys(res.errors).sort()).toEqual(['reason', 'startDate', 'substituteId']);
    });

    it('tidak mengeluarkan error tanggal selesai bila tanggal mulai kosong', () => {
        const base = { form: { ...validForm, startDate: null, endDate: null }, selectedLeaveType: leaveType, calculatedDays: 0, remainingBalance: 10 };
        expect(Object.keys(validateLeaveForm(base).errors)).toEqual(['startDate']);
        expect(Object.keys(validateDraftForm({ form: base.form, calculatedDays: 0 }).errors)).toEqual(['startDate']);
    });

    describe('validateDraftForm', () => {
        it('validates a valid draft', () => {
            const res = validateDraftForm({
                form: { leaveTypeId: 'CT', startDate: '2025-06-10', endDate: '2025-06-12' },
                calculatedDays: 3
            });
            expect(res.valid).toBe(true);
        });

        it('rejects draft without dates or leaveTypeId', () => {
            expect(validateDraftForm({ form: { leaveTypeId: '' }, calculatedDays: 1 }).valid).toBe(false);
            expect(validateDraftForm({ form: { leaveTypeId: 'CT', startDate: null, endDate: null }, calculatedDays: 1 }).valid).toBe(false);
        });
    });
});
