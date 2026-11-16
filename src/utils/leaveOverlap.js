const INACTIVE = ['cancelled', 'rejected', 'draft'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const day = (v) => String(v || '').slice(0, 10);

// Pengajuan milik pengguna yang masih aktif dan rentang tanggalnya beririsan dengan [start, end] (YYYY-MM-DD); pengajuan yang sedang diubah dilewati.
export function findOverlappingRequests(requests, { start, end, userId, excludeId = null }) {
    const s = day(start);
    const e = day(end || start);
    if (!s) return [];
    return (requests || []).filter((r) => {
        if (userId && r.userId !== userId) return false;
        if (excludeId && r.id === excludeId) return false;
        if (INACTIVE.includes(r.status)) return false;
        const rs = day(r.startDate);
        const re = day(r.endDate || r.startDate);
        return rs && rs <= e && re >= s;
    });
}

// "2–3 Des 2026" / "30 Nov – 2 Des 2026" / "5 Des 2026"
export function formatRangeId(start, end) {
    const part = (iso) => {
        const [y, m, d] = day(iso).split('-').map(Number);
        return { y, m: m - 1, d };
    };
    const a = part(start);
    const b = part(end || start);
    if (a.y === b.y && a.m === b.m && a.d === b.d) return `${a.d} ${SHORT_MONTHS[a.m]} ${a.y}`;
    if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${SHORT_MONTHS[a.m]} ${a.y}`;
    if (a.y === b.y) return `${a.d} ${SHORT_MONTHS[a.m]} – ${b.d} ${SHORT_MONTHS[b.m]} ${a.y}`;
    return `${a.d} ${SHORT_MONTHS[a.m]} ${a.y} – ${b.d} ${SHORT_MONTHS[b.m]} ${b.y}`;
}

export function overlapConflictNote(conflicts) {
    if (!conflicts?.length) return '';
    return `Bentrok dengan ${conflicts.map((r) => `${r.id} (${formatRangeId(r.startDate, r.endDate)})`).join(', ')}.`;
}
