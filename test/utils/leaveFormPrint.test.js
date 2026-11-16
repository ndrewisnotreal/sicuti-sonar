import { describe, expect, it } from 'vitest';
import { approverComments, buildLeaveFormHtml, formJenis, pickBalanceForLeave, signLabel } from '@/utils/leaveFormPrint';

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

describe('kolom tanda tangan mengikuti jumlah penyetuju di alur approval', () => {
    const labels = (n) => Array.from({ length: n }, (_, i) => signLabel(i, n));
    const signer = (name) => ({ name, date: '2026-11-01', qrUrl: '' });
    const signerCount = (html) => (html.match(/class="signer"/g) || []).length;

    it('label: kiri Atasan Langsung, kanan Mengetahui, tengah Menyetujui', () => {
        expect(labels(1)).toEqual(['Atasan Langsung']);
        expect(labels(2)).toEqual(['Atasan Langsung', 'Mengetahui,']);
        expect(labels(3)).toEqual(['Atasan Langsung', 'Menyetujui,', 'Mengetahui,']);
        expect(labels(4)).toEqual(['Atasan Langsung', 'Menyetujui,', 'Menyetujui,', 'Mengetahui,']);
    });

    it('tiga penyetuju dicetak semua, urut sesuai alur; baris Atasan Langsung = penyetuju pertama', async () => {
        const html = await buildLeaveFormHtml({ status: 'approved', signers: ['Raka', 'Mawan', 'Jabbar'].map(signer) });
        expect(signerCount(html)).toBe(3);
        expect(html.indexOf('Raka')).toBeLessThan(html.indexOf('Mawan'));
        expect(html.indexOf('Mawan')).toBeLessThan(html.indexOf('Jabbar'));
        expect(html).toMatch(/Atasan Langsung<\/td><td colspan="6">Raka</);
        expect(html).toContain('repeat(3, 1fr)');
    });

    it('label kolom memakai peran di alur approval bila tersedia, sisanya label cadangan', async () => {
        const html = await buildLeaveFormHtml({
            status: 'approved',
            signers: [{ ...signer('Raka'), role: 'Staff Approval' }, signer('Mawan'), { ...signer('Jabbar'), role: 'Kepala Seksi' }]
        });
        const cellLabels = [...html.matchAll(/<div class="signer">\s*<div class="ln">([^<]*)<\/div>/g)].map((m) => m[1]);
        expect(cellLabels).toEqual(['Staff Approval', 'Menyetujui,', 'Kepala Seksi']);
    });

    it('tanpa penyetuju tetap dua kolom kosong', async () => {
        const html = await buildLeaveFormHtml({ status: 'approved', signers: [] });
        expect(signerCount(html)).toBe(2);
    });
});

describe('komentar surat memuat catatan semua penyetuju', () => {
    it('urut sesuai alur, diberi nama, penyetuju tanpa catatan dilewati', () => {
        const approvers = [
            { approverName: 'Raka', notes: '  Pekerjaan sudah dialihkan. ' },
            { approverName: 'Mawan', notes: null },
            { approverName: 'Hizkia', notes: '   ' },
            { approverName: 'Jabbar', notes: 'Disetujui.' }
        ];
        expect(approverComments(approvers)).toBe('Raka: Pekerjaan sudah dialihkan.\nJabbar: Disetujui.');
        expect(approverComments([])).toBe('');
    });

    it('catatan di-escape di HTML surat', async () => {
        const html = await buildLeaveFormHtml({ status: 'approved', signers: [], komentar: approverComments([{ approverName: 'Raka', notes: '<b>ok</b>' }]) });
        expect(html).toContain('Raka: &lt;b&gt;ok&lt;/b&gt;');
    });
});
