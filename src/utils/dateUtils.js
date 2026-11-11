// shortcut: dihitung sekali saat modul dimuat, jadi tab yang tetap terbuka melewati 1 Januari memakai tahun lama sampai dimuat ulang; ubah jadi fungsi bila itu jadi keluhan.
export const CURRENT_YEAR = new Date().getFullYear();

export const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1].map((y) => ({ label: `Tahun ${y}`, value: y }));

export function formatDate(dateStr) {
    if (!dateStr) return '-';
    let clean = String(dateStr).split('T')[0];
    if (String(dateStr).includes('T')) {
        const d = new Date(dateStr);
        if (!Number.isNaN(d.getTime())) {
            clean = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
    }
    const parts = clean.split('-');
    if (parts.length === 3) {
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        const d = parseInt(parts[2], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parts[0];
        if (months[m]) {
            return `${d} ${months[m]} ${y}`;
        }
    }
    return clean;
}

export function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Baru saja';
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} mnt lalu`;
    if (diffHour < 24) return `${diffHour} jam lalu`;
    if (diffDays === 1) return 'Kemarin';
    if (diffDays < 7) return `${diffDays} hr lalu`;
    return formatDate(dateStr);
}
