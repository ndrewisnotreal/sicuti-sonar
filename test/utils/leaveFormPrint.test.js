import { describe, expect, it } from 'vitest';
import { formJenis, pickBalanceForLeave } from '@/utils/leaveFormPrint';

describe('formJenis: centang jenis cuti di surat', () => {
    it('Cuti Melahirkan Perempuan mencentang Hamil', () => {
        expect(formJenis('Cuti Melahirkan Perempuan')).toBe('Hamil');
    });

    it('Cuti Melahirkan Laki-laki tidak mencentang Hamil, masuk ke Lainnya', () => {
        expect(formJenis('Cuti Melahirkan Laki-laki')).toBeNull();
    });
});

describe('pickBalanceForLeave: saldo di surat mengikuti periode yang dipotong', () => {
    const p2026 = { year: 2026, used_days: 6, remaining: 6, period_start: '2026-02-05', period_end: '2027-02-04' };
    const p2027 = { year: 2027, used_days: 0, remaining: 12, period_start: '2027-02-05', period_end: '2028-02-04' };

    it('cuti Jan 2027 memakai baris periode 2026, bukan baris year 2027', () => {
        expect(pickBalanceForLeave([p2027, p2026], '2027-01-13')).toBe(p2026);
    });

    it('batas periode inklusif', () => {
        expect(pickBalanceForLeave([p2026, p2027], '2027-02-04')).toBe(p2026);
        expect(pickBalanceForLeave([p2026, p2027], '2027-02-05')).toBe(p2027);
    });

    it('tanpa periode yang cocok kembali ke baris pertama; kosong menghasilkan null', () => {
        expect(pickBalanceForLeave([p2026], '2030-01-01')).toBe(p2026);
        expect(pickBalanceForLeave([], '2027-01-13')).toBeNull();
    });
});
