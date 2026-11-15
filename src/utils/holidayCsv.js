const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const unquote = (v) => v.trim().replace(/^["']|["']$/g, '');

export function holidayDateProblem(raw) {
    const m = ISO_DATE.exec(raw || '');
    if (!m) return 'Format tanggal harus YYYY-MM-DD';
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    // Date.UTC menggulung tanggal tak ada (mis. 2026-02-30); bandingkan balik agar ditolak.
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? null : 'Tanggal tidak ada di kalender';
}

/**
 * Baca CSV hari libur. Tiap baris data mendapat `error` (null bila valid) dan `line` (nomor baris di file).
 * `existingDates` menandai baris yang sudah ada di kalender agar dilewati dan dilaporkan, bukan diam-diam.
 */
export function parseHolidayCsv(text, existingDates = []) {
    const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) return { rows: [], empty: true };
    const headers = lines[0].split(',').map((h) => unquote(h).toLowerCase());
    const known = new Set(existingDates);
    const seen = new Set();
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(unquote);
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
        });
        const date = row.holiday_date || row.date || row.tanggal || '';
        const name = row.nm_holiday || row.name || row.nama || '';
        const typeText = (row.type || row.kategori || 'national').toLowerCase();
        const type = typeText === 'collective' || typeText.includes('bersama') ? 'collective' : 'national';
        let error = null;
        let duplicate = false;
        if (!date) error = 'Tanggal kosong';
        else if (!name) error = 'Nama hari libur kosong';
        else error = holidayDateProblem(date);
        if (!error) {
            if (known.has(date)) {
                error = 'Tanggal sudah ada di kalender';
                duplicate = true;
            } else if (seen.has(date)) {
                error = 'Tanggal ganda di file ini';
                duplicate = true;
            }
            seen.add(date);
        }
        rows.push({ line: i + 1, date, name, type, error, duplicate });
    }
    return { rows, empty: false };
}
