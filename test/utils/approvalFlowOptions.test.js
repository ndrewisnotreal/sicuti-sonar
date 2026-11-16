import { describe, expect, it } from 'vitest';
import { approverChoices, defaultApprovers, flowFormProblems, memberChoices } from '@/utils/approvalFlowOptions';

const ELIGIBLE = [
    { uid_user_system: 'USR001', nama: 'Mawan', kd_role: 'pic_approval', nm_role: 'PIC Approval', kd_dept: 'SIT' },
    { uid_user_system: 'USR002', nama: 'Raka', kd_role: 'staff_approval', nm_role: 'Staff Approval', kd_dept: 'SIT' },
    { uid_user_system: 'USR014', nama: 'Hizkia', kd_role: 'staff_approval', nm_role: 'Staff Approval', kd_dept: null },
    { uid_user_system: 'USR300', nama: 'Staff SIS', kd_role: 'staff_approval', nm_role: 'Staff Approval', kd_dept: 'SIS' },
    { uid_user_system: 'USR500', nama: 'Emil', kd_role: 'kepala_dept', nm_role: 'Kepala Departemen', kd_dept: 'SIT' }
];
const FLOWS = [
    { id_flow: 'AF1', nm_flow: 'PIC Approval', approvers: [{ uid_user_system: 'USR001' }] },
    { id_flow: 'AF2', nm_flow: 'Staff Approval', approvers: [{ uid_user_system: 'USR002' }] }
];

describe('approverChoices (dialog Ubah Tingkat)', () => {
    it('semua akun berizin approve, peran apa pun; yang sudah di tingkat lain templat ini tidak bisa dipilih', () => {
        const opts = approverChoices(ELIGIBLE, FLOWS, 'AF2');
        expect(opts.map((o) => o.value)).toEqual(['USR001', 'USR002', 'USR014', 'USR300', 'USR500']);
        expect(opts.find((o) => o.value === 'USR001')).toMatchObject({ disabled: true, label: 'Mawan · PIC Approval · sudah di tingkat PIC Approval' });
        expect(opts.find((o) => o.value === 'USR002')).toMatchObject({ disabled: false, label: 'Raka · Staff Approval' });
        expect(opts.find((o) => o.value === 'USR500')).toMatchObject({ disabled: false, label: 'Emil · Kepala Departemen' });
    });
});

describe('approverChoices: approver hanya dari departemen templat', () => {
    it('akun departemen lain redup dengan keterangan; akun tanpa departemen tetap bisa dipilih', () => {
        const opts = approverChoices(ELIGIBLE, [], null, 'SIT');
        expect(opts.find((o) => o.value === 'USR300')).toMatchObject({ disabled: true, label: 'Staff SIS · Staff Approval · departemen SIS' });
        expect(opts.find((o) => o.value === 'USR014')).toMatchObject({ disabled: false });
        expect(opts.find((o) => o.value === 'USR001')).toMatchObject({ disabled: false });
        expect(approverChoices(ELIGIBLE, [], null, null).every((o) => !o.disabled)).toBe(true);
    });
});

describe('defaultApprovers (isi awal tingkat baru)', () => {
    it('pemegang peran sedepartemen templat (akun tanpa departemen ikut), belum di tingkat lain', () => {
        expect(defaultApprovers(ELIGIBLE, FLOWS, 'staff_approval', 'SIT')).toEqual(['USR014']);
        expect(defaultApprovers(ELIGIBLE, [], 'staff_approval', 'SIT')).toEqual(['USR002', 'USR014']);
        expect(defaultApprovers(ELIGIBLE, [], 'staff_approval', null)).toEqual(['USR002', 'USR014', 'USR300']);
        expect(defaultApprovers(ELIGIBLE, [], '', 'SIT')).toEqual([]);
    });
});

describe('memberChoices (dialog Tambah Anggota)', () => {
    it('karyawan yang sudah di templat lain tampil tapi tidak bisa dipilih', () => {
        const opts = memberChoices([
            { uid_user_system: 'USR201', nama: 'Ahmad Syarif', kd_role: 'staff_it', nm_role: 'Staff IT', nm_template: 'SIT Developer', is_approver: false },
            { uid_user_system: 'USR101', nama: 'Ikhsan', kd_role: 'staff_it', nm_role: 'Staff IT', nm_template: null, is_approver: false },
            { uid_user_system: 'USR002', nama: 'Raka', kd_role: 'staff_approval', nm_role: 'Staff Approval', nm_template: null, is_approver: true }
        ]);
        expect(opts).toEqual([
            { value: 'USR201', label: 'Ahmad Syarif · Staff IT · sudah di SIT Developer', disabled: true },
            { value: 'USR101', label: 'Ikhsan · Staff IT', disabled: false },
            { value: 'USR002', label: 'Raka · Staff Approval · approver', disabled: false }
        ]);
    });
});

describe('flowFormProblems (validasi dialog tingkat)', () => {
    it('peran dan approver wajib, keduanya dilaporkan sekaligus, di mode Tambah maupun Ubah', () => {
        expect(flowFormProblems({ id_flow: '', assigned_role: '', users: [] })).toEqual({
            role: 'Pilih peran untuk tingkat ini.',
            users: 'Pilih minimal satu approver untuk tingkat ini.'
        });
        expect(flowFormProblems({ id_flow: 'AF1', assigned_role: 'kepala_it', users: [] })).toEqual({ role: '', users: 'Pilih minimal satu approver untuk tingkat ini.' });
        expect(flowFormProblems({ id_flow: 'AF1', assigned_role: '', users: ['USR007'] })).toEqual({ role: 'Pilih peran untuk tingkat ini.', users: '' });
        expect(flowFormProblems({ id_flow: '', assigned_role: 'kepala_it', users: ['USR007'] })).toEqual({ role: '', users: '' });
    });
});

describe('memberChoices: anggota hanya dari departemen templat', () => {
    const CANDS = [
        { uid_user_system: 'USR014', nama: 'Hizkia', kd_role: 'staff_it', nm_role: 'Staff IT', kd_dept: 'SIT', nm_template: null, is_approver: false },
        { uid_user_system: 'USR300', nama: 'Staff SIS', kd_role: 'staff_seksi', nm_role: 'Staff Seksi', kd_dept: 'SIS', nm_template: null, is_approver: false },
        { uid_user_system: 'USR400', nama: 'Tanpa Dept', kd_role: 'staff_seksi', nm_role: 'Staff Seksi', kd_dept: null, nm_template: null, is_approver: false }
    ];

    it('karyawan departemen lain tampil tapi tidak bisa dipilih; tanpa departemen boleh', () => {
        expect(memberChoices(CANDS, 'SIS')).toEqual([
            { value: 'USR014', label: 'Hizkia · Staff IT · departemen SIT', disabled: true },
            { value: 'USR300', label: 'Staff SIS · Staff Seksi', disabled: false },
            { value: 'USR400', label: 'Tanpa Dept · Staff Seksi', disabled: false }
        ]);
    });

    it('templat tanpa departemen menerima karyawan dari departemen mana pun', () => {
        expect(memberChoices(CANDS, null).every((o) => !o.disabled)).toBe(true);
    });
});
