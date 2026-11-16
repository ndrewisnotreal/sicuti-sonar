import QRCode from 'qrcode';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const JENIS_OPTIONS = ['Sakit', 'Berduka Cita', 'Cuti Tanpa Bayar', 'Izin Pribadi / Keluarga', 'Hamil'];

const GRID = [568, 1559, 426, 567, 1153, 665, 1300, 851, 425, 2126];
const mm = (twips) => `${((twips * 25.4) / 1440).toFixed(2)}mm`;

const BOX = '☐';
const BOX_CHECKED = '☑';
const DOTS_EMPLOYEE = '.............................................';
const DOTS_APPROVER = '…'.repeat(19) + '..';

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function toDate(value) {
    if (!value) return null;
    const s = String(value);
    const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    const d = plain ? new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3])) : new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}

function monthYear(value) {
    const d = toDate(value);
    return d ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
}

function dayAndDate(value) {
    const d = toDate(value);
    return d ? [`${DAYS[d.getDay()]},`, `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`] : ['', ''];
}

export function formJenis(leaveTypeName) {
    const n = String(leaveTypeName || '').toLowerCase();
    if (/sakit/.test(n)) return 'Sakit';
    if (/duka/.test(n)) return 'Berduka Cita';
    if (/tanpa bayar|unpaid/.test(n)) return 'Cuti Tanpa Bayar';
    if (/hamil|melahirkan/.test(n) && !/laki/.test(n)) return 'Hamil';
    if (/tahunan|pribadi|keluarga/.test(n)) return 'Izin Pribadi / Keluarga';
    return null;
}

// used_days backend menghitung cuti disetujui yang tanggal mulainya jatuh di period_start..period_end baris itu,
// jadi baris yang memuat potongan pengajuan adalah yang periodenya mencakup tanggal mulai (bukan baris year = tahun mulai).
// Tanpa kecocokan: kembali ke baris pertama (periode aktif), bukan menebak dari tahun.
export function pickBalanceForLeave(balances, startDate) {
    const list = Array.isArray(balances) ? balances : [];
    const start = String(startDate || '').slice(0, 10);
    const match = list.find((b) => b?.period_start && b?.period_end && start >= String(b.period_start).slice(0, 10) && start <= String(b.period_end).slice(0, 10));
    return match || list[0] || null;
}

const lines = (arr) => arr.map((t) => `<div class="ln">${t === '' ? '&nbsp;' : t}</div>`).join('');

export function publicAppOrigin() {
    const configured = import.meta.env?.VITE_PUBLIC_APP_URL;
    return String(configured || `${window.location.origin}${import.meta.env.BASE_URL}`).replace(/\/+$/, '');
}

export function isQrReachableFromPhone() {
    return !['localhost', '127.0.0.1'].includes(new URL(publicAppOrigin()).hostname);
}

export function validationUrl(token) {
    return `${publicAppOrigin()}/validasi/${encodeURIComponent(token)}`;
}

export async function buildLeaveFormHtml(d) {
    const toDataURL = QRCode?.toDataURL || QRCode?.default?.toDataURL;
    const qrImage = async (url) => (url ? `<img src="${await toDataURL(url, { width: 240, margin: 0 })}" alt="QR validasi pengesah" />` : '');
    const qrAtasan = await qrImage(d.atasan?.qrUrl);
    const qrMengetahui = await qrImage(d.mengetahui?.qrUrl);

    const jenis = formJenis(d.leaveTypeName);
    const jenisRows = JENIS_OPTIONS.map(
        (label) => `<tr class="cb">
            <td>${jenis === label ? BOX_CHECKED : BOX}</td><td colspan="5">${esc(label)}</td><td colspan="2"></td><td colspan="2"></td></tr>`
    ).join('');
    const lainnya = jenis ? '' : ` ${esc(d.leaveTypeName)}`;

    const decision = d.status === 'rejected' ? 'Ditolak' : d.status === 'returned' ? 'Ditangguhkan' : ['approved', 'completed'].includes(d.status) ? 'Disetujui' : '';
    const decisionRows = ['Disetujui', 'Ditolak', 'Ditangguhkan']
        .map(
            (label, i, all) => `<tr class="cb${i === all.length - 1 ? ' cb-last' : ''}">
            <td>${decision === label ? BOX_CHECKED : BOX}</td><td colspan="2">${label}</td><td colspan="5"></td><td colspan="2"></td></tr>`
        )
        .join('');

    const [fromDay, fromDate] = dayAndDate(d.startDate);
    const [toDay, toDateText] = dayAndDate(d.endDate);
    const employee = String(d.employeeName || '').toUpperCase();

    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Formulir Permohonan Cuti - ${esc(d.ticketId)}</title>
<style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { position: relative; width: 210mm; height: 297mm; padding-top: 12.5mm; background: #fff; overflow: hidden; }
    .ticket { position: absolute; top: 12.5mm; left: 19.8mm; font-size: 8pt; line-height: 9.8pt; }
    @media screen { body { background: #e5e5e5; } .page { margin: 8mm auto; box-shadow: 0 1px 6px rgba(0,0,0,.25); } }
    table { border-collapse: collapse; table-layout: fixed; }
    td { padding: 0 1.9mm; vertical-align: middle; line-height: 12.2pt; overflow-wrap: anywhere; }
    .ln { height: 12.2pt; white-space: pre; }
    .form-code { margin-left: 132.3mm; }
    .form-code td { border: 0.5pt solid #a6a6a6; color: #808080; font-size: 8pt; line-height: 9.8pt; white-space: nowrap; }
    .sheet { margin-left: 19.8mm; width: 170mm; }
    .sheet table { width: 170mm; }
    .sheet td { border: 0.5pt solid #000; }
    .head { margin-top: 8.8mm; }
    .head .logo img { width: 39mm; display: block; margin: 0 auto; }
    .head .company { text-align: center; }
    .head .company .name { font-size: 20pt; font-weight: bold; line-height: 26.8pt; }
    .head .spacer td { height: 4mm; padding: 0; line-height: 0; border-left: none; border-right: none; }
    .bar td, td.bar { background: #000; color: #fff; font-weight: bold; text-align: center; }
    .title td { font-size: 14pt; line-height: 17.1pt; }
    .gap { height: 5.5mm; }
    .b { font-weight: bold; }
    .c { text-align: center; }
    .r { text-align: right; }
    .no-b { border-bottom: none !important; }
    .no-t { border-top: none !important; }
    .no-l { border-left: none !important; }
    .no-r { border-right: none !important; }
    .cb td { border-top: none; border-bottom: none; border-left: none; border-right: none; }
    .cb td:first-child { border-left: 0.5pt solid #000; }
    .cb td:last-child { border-right: 0.5pt solid #000; }
    .cb-last td { border-bottom: 0.5pt solid #000; }
    .h3 { height: 36.6pt; }
    .sign-employee td { height: 29.6mm; vertical-align: top; padding-top: 1.2mm; }
    .komentar td { height: 13.7mm; }
    .sign-approver td { height: 39.8mm; vertical-align: top; padding-top: 0.6mm; }
    .qr { height: 48.8pt; display: flex; align-items: center; }
    .qr img { width: 16mm; height: 16mm; display: block; }
</style>
</head>
<body>
<div class="page">
    ${d.ticketId ? `<div class="ticket">No. Pengajuan: <b>${esc(d.ticketId)}</b></div>` : ''}
    <table class="form-code">
        <colgroup><col style="width:${mm(1907)}" /><col style="width:${mm(607)}" /><col style="width:${mm(577)}" /></colgroup>
        <tr><td>FORM – Pengajuan Cuti</td><td>2023</td><td>Rev.0</td></tr>
    </table>

    <div class="sheet head">
        <table>
            <colgroup><col style="width:${mm(2978)}" /><col style="width:${mm(6662)}" /></colgroup>
            <tr>
                <td class="logo">${d.logoUrl ? `<img src="${esc(d.logoUrl)}" alt="Sinergi Mitra Lestari Indonesia" />` : ''}</td>
                <td class="company">
                    <div class="name">PT Sinergi Mitra Lestari Indonesia</div>
                    <div>Gedung Antam Office Park Tower B, Lantai 5</div>
                    <div>Jl. Letjen TB. Simatupang No.1, Tanjung Barat, Jakarta Selatan 12530</div>
                </td>
            </tr>
            <tr class="spacer"><td></td><td></td></tr>
            <tr class="bar title"><td colspan="2">Formulir Permohonan Cuti</td></tr>
        </table>
    </div>

    <div class="gap"></div>

    <div class="sheet">
        <table>
            <colgroup>${GRID.map((w) => `<col style="width:${mm(w)}" />`).join('')}</colgroup>
            <tr class="bar"><td colspan="10">Informasi Izin/Cuti</td></tr>
            <tr><td colspan="4" class="b">Nama</td><td colspan="3">${esc(employee)}</td><td colspan="2" class="r">No. Pegawai</td><td>${esc(d.nik)}</td></tr>
            <tr><td colspan="4" class="b">Departemen</td><td colspan="6">${esc(d.department)}</td></tr>
            <tr><td colspan="4" class="b">Cuti kerja yang terpakai</td><td class="r">${esc(d.usedDays)}</td><td colspan="5" class="no-b"></td></tr>
            <tr><td colspan="4" class="b">Sisa Cuti yang masih berlaku</td><td class="r">${esc(d.remainingDays)}</td><td colspan="5" class="no-t"></td></tr>
            <tr><td colspan="4" class="b">Atasan Langsung</td><td colspan="6">${esc(d.atasan?.name)}</td></tr>
            <tr><td colspan="4" class="no-r"><div class="ln">&nbsp;</div></td><td colspan="6" class="no-l"></td></tr>
            <tr><td colspan="10" class="b">Jenis Izin/Cuti yang Diminta (pilih alasan yang relevan)</td></tr>
            ${jenisRows}
            <tr class="cb cb-last"><td>${jenis ? BOX : BOX_CHECKED}</td><td colspan="9">Lainnya , Sebutkan: ${lainnya}</td></tr>
            <tr>
                <td colspan="2" class="b">Lama Cuti</td><td colspan="3" class="b">Dari:</td><td colspan="3" class="b">Hingga:</td><td colspan="2" class="b">Nomor yang bisa dihubungi:</td>
            </tr>
            <tr>
                <td colspan="2" class="c h3">${esc(d.totalDays)} Hari</td>
                <td colspan="3" class="c">${lines([esc(fromDay), esc(fromDate)])}</td>
                <td colspan="3" class="c">${lines([esc(toDay), esc(toDateText)])}</td>
                <td colspan="2" class="c">${esc(d.phone)}</td>
            </tr>
            <tr>
                <td colspan="2" class="b">Alasan Izin/Cuti</td><td colspan="3" class="b">Nama Pengganti Tugas</td><td colspan="3" class="b">Tanda Tangan Pengganti Tugas</td><td colspan="2" class="b">Lokasi Selama Cuti</td>
            </tr>
            <tr>
                <td colspan="2" class="c h3">${esc(d.reason)}</td>
                <td colspan="3" class="c">${esc(d.substituteName)}</td>
                <td colspan="3" class="c"></td>
                <td colspan="2" class="c">${esc(d.location)}</td>
            </tr>
            <tr><td colspan="10">Catatan: </td></tr>
            <tr class="sign-employee">
                <td colspan="5">${lines(['', '', '', '', `<u>${DOTS_EMPLOYEE}</u>`, 'Tanda Tangan Karyawan'])}</td>
                <td colspan="5">${lines(['', '', '', '', `<u>${esc(employee)}</u>`, `     ${esc(monthYear(d.submittedAt))}`])}</td>
            </tr>
            <tr class="bar"><td colspan="10">Persetujuan dari Atasan Langsung</td></tr>
            ${decisionRows}
            <tr><td colspan="10">Komentar :</td></tr>
            <tr class="komentar"><td colspan="10">${esc(d.komentar)}</td></tr>
            <tr class="sign-approver">
                <td colspan="5">
                    ${lines(['Atasan Langsung', `    ${esc(monthYear(d.atasan?.date))}`])}
                    <div class="qr">${qrAtasan}</div>
                    ${lines([`<u>${DOTS_APPROVER}</u>`, esc(d.atasan?.name), ''])}
                </td>
                <td colspan="5">
                    ${lines(['Mengetahui,', `    ${esc(monthYear(d.mengetahui?.date))}`])}
                    <div class="qr">${qrMengetahui}</div>
                    ${lines([`<u>${DOTS_APPROVER}</u>`, esc(d.mengetahui?.name), ''])}
                </td>
            </tr>
        </table>
    </div>
</div>
<script>
    window.addEventListener('load', function () { window.focus(); window.print(); });
</script>
</body>
</html>`;
}
