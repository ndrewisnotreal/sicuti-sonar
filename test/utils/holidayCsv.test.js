import { describe, expect, it } from 'vitest';
import { holidayDateProblem, parseHolidayCsv } from '@/utils/holidayCsv';

const CSV = [
    'holiday_date,nm_holiday,type',
    '2026-12-23,Libur Satu,national',
    '2026-12-24,Libur Dua,collective',
    '2026-12-25,Sudah Ada,national',
    'bukan-tanggal,Salah Format,national',
    '2026-13-45,Bulan Salah,national',
    '2026-02-30,Tanggal Tak Ada,national',
    '2026-12-23,Ganda Di File,national',
    '2026-12-26,,national'
].join('\r\n');

describe('holidayDateProblem', () => {
    it('menerima tanggal ISO nyata dan menolak format salah atau tanggal tak ada', () => {
        expect(holidayDateProblem('2026-12-23')).toBeNull();
        expect(holidayDateProblem('2028-02-29')).toBeNull();
        expect(holidayDateProblem('bukan-tanggal')).toBe('Format tanggal harus YYYY-MM-DD');
        expect(holidayDateProblem('2026-13-45')).toBe('Tanggal tidak ada di kalender');
        expect(holidayDateProblem('2026-02-30')).toBe('Tanggal tidak ada di kalender');
    });
});

describe('parseHolidayCsv (preview impor hari libur)', () => {
    it('menandai tiap baris tak valid dengan alasan dan nomor baris file', () => {
        const { rows } = parseHolidayCsv(CSV, ['2026-12-25']);
        expect(rows.map((r) => [r.line, r.error])).toEqual([
            [2, null],
            [3, null],
            [4, 'Tanggal sudah ada di kalender'],
            [5, 'Format tanggal harus YYYY-MM-DD'],
            [6, 'Tanggal tidak ada di kalender'],
            [7, 'Tanggal tidak ada di kalender'],
            [8, 'Tanggal ganda di file ini'],
            [9, 'Nama hari libur kosong']
        ]);
        expect(rows[2].duplicate).toBe(true);
        expect(rows[1].type).toBe('collective');
    });

    it('file hanya header dianggap kosong', () => {
        expect(parseHolidayCsv('holiday_date,nm_holiday,type\r\n').empty).toBe(true);
    });
});
