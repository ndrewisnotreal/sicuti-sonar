import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/service/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import api from '@/service/api';
import { leaveService } from '@/service/leaveService';

describe('leaveService draf pengajuan (QA #7)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('createLeave mengirim is_draft saat menyimpan draf', async () => {
        api.post.mockResolvedValue({ data: { id_request: 'REQ-1', status: 'draft' } });
        await leaveService.createLeave({ kd_leave_type: 'LT001', start_date: '2030-01-07', end_date: '2030-01-07', is_draft: true });
        expect(api.post).toHaveBeenCalledWith('/sicuti/leave-request', expect.objectContaining({ is_draft: true }));
    });

    it('createLeave biasa tidak mengirim is_draft', async () => {
        api.post.mockResolvedValue({ data: {} });
        await leaveService.createLeave({ kd_leave_type: 'LT001', start_date: '2030-01-07', end_date: '2030-01-07' });
        expect(api.post.mock.calls[0][1]).not.toHaveProperty('is_draft');
    });

    it('resubmitLeave meneruskan is_draft untuk simpan perubahan draf', async () => {
        api.put.mockResolvedValue({ data: {} });
        await leaveService.resubmitLeave('REQ-SIT-0001/2030', { kd_leave_type: 'LT001', start_date: '2030-01-07', end_date: '2030-01-07', is_draft: true });
        expect(api.put).toHaveBeenCalledWith('/sicuti/leave-request/REQ-SIT-0001%2F2030', expect.objectContaining({ is_draft: true }));
    });
});

describe('leaveService tanpa request ganda (revisi uji UI)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('getLeaveTypes(false) memakai URL yang sama dengan sinkronisasi (tanpa ?all=false)', async () => {
        api.get.mockResolvedValue({ data: [] });
        await leaveService.getLeaveTypes(false);
        expect(api.get).toHaveBeenLastCalledWith('/sicuti/leave-type', {});
        await leaveService.getLeaveTypes(true);
        expect(api.get).toHaveBeenLastCalledWith('/sicuti/leave-type', { all: 'true' });
    });

    it('getBalanceMutations memakai saldo yang sudah dimuat halaman (tidak memuat saldo dua kali)', async () => {
        api.get.mockResolvedValue({ data: [] });
        const balances = [{ year: 2026, annual_quota: 12, carry_over_days: 0, used_days: 6 }];
        const muts = await leaveService.getBalanceMutations({ year: 2026, balances });
        const urls = api.get.mock.calls.map((c) => c[0]);
        expect(urls).toEqual(['/sicuti/leave-balance/history']);
        expect(muts[0]).toMatchObject({ type: 'credit', amount: 12 });
    });

    it('getBalanceMutations meneruskan galat riwayat ke pemanggil (audit-028 #11)', async () => {
        api.get.mockRejectedValueOnce(new Error('500'));
        await expect(leaveService.getBalanceMutations({ year: 2026, balances: [] })).rejects.toThrow('500');
    });

    it('getBalanceMutations tanpa saldo dari halaman tetap memuat saldonya sendiri', async () => {
        api.get.mockResolvedValue({ data: [] });
        await leaveService.getBalanceMutations({ year: 2026 });
        expect(api.get.mock.calls.map((c) => c[0]).sort()).toEqual(['/sicuti/leave-balance/history', '/sicuti/leave-balance/me']);
    });
});
