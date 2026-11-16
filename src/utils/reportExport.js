import api, { saveBlob } from '@/service/api';

export async function downloadExcel(endpoint, params, fallbackName) {
    const { blob, filename } = await api.blob(endpoint, { ...params, format: 'xlsx' });
    saveBlob(blob, filename || fallbackName);
}

const esc = (v) =>
    String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

export function printReportPdf({ title, subtitle, columns, rows }) {
    const win = window.open('', '_blank');
    if (!win) return false;
    const printedAt = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
    const head = columns.map((c) => `<th>${esc(c.header)}</th>`).join('');
    const body = rows.length
        ? rows.map((r) => `<tr>${columns.map((c) => `<td>${esc(c.value(r))}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${columns.length}" class="empty">Tidak ada data untuk filter ini.</td></tr>`;
    win.document.open();
    win.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #0f172a; font-size: 11px; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0077b8; padding-bottom: 8px; margin-bottom: 12px; }
  h1 { font-size: 16px; margin: 0; color: #0077b8; }
  .sub { color: #475569; margin-top: 2px; }
  .meta { color: #64748b; text-align: right; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #eff8ff; font-weight: 700; }
  tr:nth-child(even) td { background: #f8fafc; }
  .empty { text-align: center; color: #64748b; padding: 16px; }
  footer { margin-top: 10px; color: #94a3b8; font-size: 10px; }
</style></head><body>
<header><div><h1>${esc(title)}</h1><div class="sub">${esc(subtitle)}</div></div>
<div class="meta">SiCuti - Sistem Cuti PT Inalum<br>Dicetak ${esc(printedAt)}</div></header>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<footer>${rows.length} baris data</footer>
<script>window.onload = function () { window.print(); };<\/script>
</body></html>`);
    win.document.close();
    return true;
}
