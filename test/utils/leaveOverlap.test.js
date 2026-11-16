import { describe, expect, it } from 'vitest';
import { findOverlappingRequests, formatRangeId, overlapConflictNote } from '@/utils/leaveOverlap';

const reqs = [
    { id: 'REQ-SIT-0008/2026', userId: 'U1', startDate: '2026-12-02', endDate: '2026-12-03', status: 'submitted' },
    { id: 'REQ-SIT-0009/2026', userId: 'U1', startDate: '2026-12-02', endDate: '2026-12-03', status: 'cancelled' },
    { id: 'REQ-SIT-0010/2026', userId: 'U1', startDate: '2026-12-02', endDate: '2026-12-03', status: 'rejected' },
    { id: 'REQ-SIT-0011/2026', userId: 'U2', startDate: '2026-12-02', endDate: '2026-12-03', status: 'approved' },
    { id: 'REQ-SIT-0012/2026', userId: 'U1', startDate: '2026-12-10', endDate: '2026-12-11', status: 'approved' }
];

describe('findOverlappingRequests', () => {
    it('mengembalikan pengajuan aktif milik sendiri yang beririsan', () => {
        const res = findOverlappingRequests(reqs, { start: '2026-12-03', end: '2026-12-05', userId: 'U1' });
        expect(res.map((r) => r.id)).toEqual(['REQ-SIT-0008/2026']);
    });

    it('melewati pengajuan yang sedang diubah dan yang tidak beririsan', () => {
        expect(findOverlappingRequests(reqs, { start: '2026-12-02', end: '2026-12-03', userId: 'U1', excludeId: 'REQ-SIT-0008/2026' })).toEqual([]);
        expect(findOverlappingRequests(reqs, { start: '2026-12-04', end: '2026-12-09', userId: 'U1' })).toEqual([]);
    });
});

describe('overlapConflictNote', () => {
    it('menyebut id dan rentang tanggal', () => {
        expect(overlapConflictNote([reqs[0]])).toBe('Bentrok dengan REQ-SIT-0008/2026 (2–3 Des 2026).');
        expect(overlapConflictNote([])).toBe('');
    });

    it('memformat rentang lintas bulan dan satu hari', () => {
        expect(formatRangeId('2026-11-30', '2026-12-02')).toBe('30 Nov – 2 Des 2026');
        expect(formatRangeId('2026-12-05', '2026-12-05')).toBe('5 Des 2026');
    });
});
