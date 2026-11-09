import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/service/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import api from '@/service/api';
import { adminService } from '@/service/adminService';

describe('adminService alur approval per templat', () => {
    beforeEach(() => vi.clearAllMocks());

    it('reorderApprovalFlows mengirim semua id_flow sesuai urutan baru', async () => {
        api.put.mockResolvedValue({ data: [{ id_flow: 'B' }, { id_flow: 'A' }] });
        const res = await adminService.reorderApprovalFlows('TPL_SITDEV', ['B', 'A']);
        expect(api.put).toHaveBeenCalledWith('/sicuti/approval-flow/order', { id_template: 'TPL_SITDEV', order: ['B', 'A'] });
        expect(res).toEqual([{ id_flow: 'B' }, { id_flow: 'A' }]);
    });

    it('anggota templat: ambil, tambah, keluarkan', async () => {
        api.get.mockResolvedValue({ data: [{ uid_user_system: 'USR109' }] });
        expect(await adminService.getTemplateMembers('TPL_SITDEV')).toEqual([{ uid_user_system: 'USR109' }]);
        expect(api.get).toHaveBeenCalledWith('/sicuti/approval-template/members', { id_template: 'TPL_SITDEV' });

        api.post.mockResolvedValue({ data: [] });
        await adminService.addTemplateMembers('TPL_SITDEV', ['USR109']);
        expect(api.post).toHaveBeenCalledWith('/sicuti/approval-template/members', { id_template: 'TPL_SITDEV', uids: ['USR109'] });

        api.delete.mockResolvedValue({ data: {} });
        await adminService.removeTemplateMember('USR 1');
        expect(api.delete).toHaveBeenCalledWith('/sicuti/approval-template/members?uid_user_system=USR%201');
    });

    it('peran approver, calon anggota, dan karyawan tanpa templat', async () => {
        api.get.mockResolvedValue({ data: [] });
        await adminService.getApproverRoles();
        await adminService.getMemberCandidates('TPL_SITADM');
        await adminService.getUnassignedEmployees();
        expect(api.get.mock.calls).toEqual([
            ['/sicuti/approval-flow/roles'],
            ['/sicuti/approval-template/candidates', { id_template: 'TPL_SITADM' }],
            ['/sicuti/approval-template/unassigned']
        ]);
    });
});

describe('adminService riwayat status akun', () => {
    beforeEach(() => vi.clearAllMocks());

    it('getStatusHistory mengambil riwayat satu karyawan', async () => {
        api.get.mockResolvedValue({ data: [{ status: 'N', reason_code: 'KONTRAK_HABIS' }] });
        expect(await adminService.getStatusHistory('USR014')).toEqual([{ status: 'N', reason_code: 'KONTRAK_HABIS' }]);
        expect(api.get).toHaveBeenCalledWith('/master/user/status-history', { uid: 'USR014' });
    });

    it('Audit Trail: nonaktifkan akun tampil dengan alasan dan keterangan', async () => {
        api.get.mockResolvedValue({
            data: [
                {
                    id_audit: 'a1',
                    action: 'DEACTIVATE_USER',
                    entity: 'USER',
                    entity_id: 'USR014',
                    created_at: '2026-10-13T02:00:00.000Z',
                    new_data: { method: 'PUT', path: '/master/user', body: { uid_user_system: 'USR014', status: 'N', status_reason: 'KONTRAK_HABIS', status_note: 'Kontrak berakhir' } }
                }
            ]
        });
        const [log] = await adminService.getAuditLogs();
        expect(log.details).toBe('Nonaktifkan akun USR014 · Alasan: Kontrak habis · Keterangan: Kontrak berakhir');
    });
});

describe('adminService teks Audit Trail', () => {
    beforeEach(() => vi.clearAllMocks());

    const details = async (rows) => {
        api.get.mockResolvedValue({ data: rows });
        return (await adminService.getAuditLogs()).map((r) => r.details);
    };

    it('login/logout, body bersarang vs langsung, batas empat field, alasan umum, data kosong', async () => {
        expect(
            await details([
                { action: 'LOGIN', user_name: 'Budi' },
                { action: 'LOGOUT', username: 'budi01' },
                { action: 'CREATE_HOLIDAY', entity_id: 'H1', new_data: { method: 'POST', path: '/x', body: { a: 1, b: '', c: null, d: { x: 1 }, e: 'E', f: 2, g: 3, h: 4 } } },
                { action: 'UPDATE_POLICY', entity_id: '', new_data: { reason: 'koreksi', limit: 12, method: 'PUT' } },
                { action: 'AKSI_BARU', new_data: null },
                { action: 'DEACTIVATE_USER', new_data: {} }
            ])
        ).toEqual([
            'Budi masuk ke aplikasi',
            'budi01 keluar dari aplikasi',
            'Tambah hari libur H1 · a: 1 · e: E · f: 2 · g: 3',
            'Ubah kebijakan cuti (koreksi) · reason: koreksi · limit: 12',
            'AKSI_BARU',
            'Nonaktifkan akun'
        ]);
    });
});

describe('adminService daftar pengajuan (Pemantauan & Laporan)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('getLeaveRequests meminta sampai 1000 baris (tanpa limit backend hanya mengirim 20) dan meneruskan filter', async () => {
        api.get.mockResolvedValue({ data: { data: [{ id_request: 'REQ-SIT-0001/2026' }] } });
        expect(await adminService.getLeaveRequests()).toEqual([{ id_request: 'REQ-SIT-0001/2026' }]);
        expect(await adminService.getLeaveRequests({ year: 2026 })).toEqual([{ id_request: 'REQ-SIT-0001/2026' }]);
        expect(api.get.mock.calls).toEqual([
            ['/sicuti/leave-request', { limit: 1000 }],
            ['/sicuti/leave-request', { limit: 1000, year: 2026 }]
        ]);
    });

    it('getLeaveRequests menerima respons berbentuk daftar langsung', async () => {
        api.get.mockResolvedValue({ data: [{ id_request: 'A' }] });
        expect(await adminService.getLeaveRequests()).toEqual([{ id_request: 'A' }]);
    });
});
