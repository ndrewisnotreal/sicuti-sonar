import { AUDIT_ACTION_LABEL, AUDIT_ENTITY_LABEL } from '@/service/adminService';

// Satu sumber label dan warna untuk tabel dan dialog audit (audit-023 #7).
export const auditActionLabel = (code) => AUDIT_ACTION_LABEL[code] || code || '-';
export const auditEntityLabel = (code) => AUDIT_ENTITY_LABEL[code] || (code && code !== 'SYSTEM' ? code : 'Sistem');

// Warna hanya untuk kejadian yang perlu perhatian: akses ditolak, gagal, terkunci, atau penghapusan (audit-023 #9).
export const isAttentionAction = (code) => /DENIED|FAIL|LOCKOUT|DELETE/.test(String(code || '').toUpperCase()) && !/UNLOCK/.test(String(code || '').toUpperCase());

// Pengguna: nama bila ada, NIK sebagai rujukan.
export const auditUserName = (log) => log?.user_name || log?.username || log?.user || '-';

// Kunci payload yang muncul di log -> label Indonesia. Kunci tak dikenal tetap tampil apa adanya.
export const AUDIT_FIELD_LABEL = {
    year: 'Tahun',
    reason: 'Alasan',
    notes: 'Catatan',
    annual_quota: 'Kuota tahunan',
    carry_over_days: 'Carry over (hari)',
    max_carry_over: 'Maks carry over (hari)',
    carry_over_expiry_months: 'Masa berlaku carry over (bulan)',
    kd_leave_type: 'Jenis cuti',
    nm_leave_type: 'Nama jenis cuti',
    start_date: 'Tanggal mulai',
    end_date: 'Tanggal selesai',
    total_days: 'Jumlah hari',
    id_request: 'No. pengajuan',
    uid_user_system: 'Karyawan',
    status: 'Status',
    status_reason: 'Alasan status',
    status_note: 'Keterangan status',
    nm_holiday: 'Nama hari libur',
    holiday_date: 'Tanggal libur',
    description: 'Deskripsi',
    employment_status: 'Status kepegawaian',
    kd_dept: 'Departemen',
    kd_role: 'Peran',
    nm_role: 'Nama peran',
    nm_template: 'Nama templat',
    nama: 'Nama',
    namecode: 'NIK',
    username: 'Username',
    email: 'Email',
    no_hp: 'No. HP',
    position: 'Jabatan',
    max_days: 'Maks hari',
    code: 'Kode',
    is_active: 'Aktif',
    is_draft: 'Draf',
    uses_quota: 'Potong kuota',
    requires_document: 'Wajib dokumen',
    allow_backdate: 'Boleh mundur',
    allow_late_document: 'Boleh dokumen terlambat',
    late_document_days: 'Batas dokumen terlambat (hari)',
    substitute_id: 'Pengganti',
    type: 'Tipe'
};

const UID_TOKEN = /\b(?:USR|ADM)\d+\b/g;

/**
 * Terjemahkan teks keterangan log: "key: value" -> "Label: value" dan ID akun -> nama karyawan.
 * `users` = Map uid_user_system -> nama; `leaveTypes` = Map kd_leave_type -> nama (keduanya opsional).
 */
export function describeAuditDetails(details, users = new Map(), leaveTypes = new Map()) {
    if (!details) return '';
    const named = (text) => text.replace(UID_TOKEN, (id) => users.get(id) || id);
    return String(details)
        .split(' · ')
        .map((part) => {
            const m = /^([a-z][a-z0-9_]*): (.*)$/s.exec(part);
            const label = m && AUDIT_FIELD_LABEL[m[1]];
            // Bagian tanpa kunci dikenal = judul ("Sesuaikan saldo USR110") atau teks bebas; hanya ID akun yang diganti.
            if (!label) return named(part);
            const value = m[1] === 'kd_leave_type' ? leaveTypes.get(m[2]) || m[2] : m[1] === 'uid_user_system' ? named(m[2]) : m[2];
            return `${label}: ${value}`;
        })
        .join(' · ');
}
