import { describe, expect, it } from 'vitest';
import { describeAuditDetails } from '@/components/admin/auditLog';

const users = new Map([['USR110', 'Bayu Pratama (NIK OS24980032)']]);
const types = new Map([['LT001', 'Cuti Tahunan']]);

describe('describeAuditDetails (audit trail terbaca manusia)', () => {
    it('ID akun di judul diganti nama dan kunci mentah diganti label Indonesia', () => {
        const raw = 'Sesuaikan saldo USR110 · year: 2026 · reason: QA uji · annual_quota: 13 · carry_over_days: 0';
        expect(describeAuditDetails(raw, users, types)).toBe(
            'Sesuaikan saldo Bayu Pratama (NIK OS24980032) · Tahun: 2026 · Alasan: QA uji · Kuota tahunan: 13 · Carry over (hari): 0'
        );
    });

    it('kode jenis cuti diganti nama jenis; kunci tak dikenal dan ID tak dikenal dibiarkan', () => {
        expect(describeAuditDetails('Ajukan cuti REQ-1 · kd_leave_type: LT001 · foo_bar: 1 · uid_user_system: USR999', users, types)).toBe(
            'Ajukan cuti REQ-1 · Jenis cuti: Cuti Tahunan · foo_bar: 1 · Karyawan: USR999'
        );
    });

    it('teks bebas dalam nilai tidak diubah dan data kosong aman', () => {
        expect(describeAuditDetails('Tolak cuti R1 · reason: lihat USR110', users, types)).toBe('Tolak cuti R1 · Alasan: lihat USR110');
        expect(describeAuditDetails('', users, types)).toBe('');
        expect(describeAuditDetails(undefined)).toBe('');
    });
});
