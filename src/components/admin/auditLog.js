import { AUDIT_ACTION_LABEL, AUDIT_ENTITY_LABEL } from '@/service/adminService';

// Satu sumber label dan warna untuk tabel dan dialog audit (audit-023 #7).
export const auditActionLabel = (code) => AUDIT_ACTION_LABEL[code] || code || '-';
export const auditEntityLabel = (code) => AUDIT_ENTITY_LABEL[code] || (code && code !== 'SYSTEM' ? code : 'Sistem');

// Warna hanya untuk kejadian yang perlu perhatian: akses ditolak, gagal, terkunci, atau penghapusan (audit-023 #9).
export const isAttentionAction = (code) => /DENIED|FAIL|LOCKOUT|DELETE/.test(String(code || '').toUpperCase()) && !/UNLOCK/.test(String(code || '').toUpperCase());

// Pengguna: nama bila ada, NIK sebagai rujukan.
export const auditUserName = (log) => log?.user_name || log?.username || log?.user || '-';
