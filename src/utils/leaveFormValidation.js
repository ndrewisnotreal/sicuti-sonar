export function defaultFormatDate(d) {
    if (!d) return '';
    if (typeof d === 'string') {
        return d.split('T')[0];
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// `errors` = pesan per field (kunci: leaveTypeId, startDate, endDate, substituteId, reason); `error` = toast untuk masalah yang tidak terikat satu field
// (saldo, batas hari, dokumen) dan hanya terisi bila semua field lolos, supaya pengguna tidak melihat dua jenis pesan sekaligus.
export function validateLeaveForm({
    form,
    selectedLeaveType,
    calculatedDays,
    remainingBalance = 0,
    substituteRequired = false,
    formatDate = defaultFormatDate
}) {
    const s = formatDate(form?.startDate);
    const e = formatDate(form?.endDate);
    const errors = {};

    if (!form?.leaveTypeId) errors.leaveTypeId = 'Silakan pilih jenis cuti';
    if (!s) errors.startDate = 'Pilih tanggal mulai cuti';
    else if (!e) errors.endDate = 'Pilih tanggal selesai yang sama dengan atau setelah tanggal mulai';
    else if (new Date(e) < new Date(s)) errors.endDate = 'Tanggal selesai harus setelah tanggal mulai';
    else if (calculatedDays <= 0) errors.endDate = 'Rentang tanggal tidak memuat hari kerja (akhir pekan/libur)';
    if (substituteRequired && !form?.substituteId) errors.substituteId = 'Pilih rekan pengganti tugas selama Anda cuti';
    if (!form?.reason || !form.reason.trim()) errors.reason = 'Alasan pengajuan cuti wajib diisi';

    if (Object.keys(errors).length) {
        const first = Object.values(errors)[0];
        return { valid: false, errors, error: { severity: 'error', summary: 'Validasi', detail: first, life: 3000 } };
    }

    if (selectedLeaveType?.usesQuota && calculatedDays > remainingBalance) {
        return {
            valid: false,
            errors,
            error: {
                severity: 'error',
                summary: 'Saldo Kurang',
                detail: `Saldo cuti Anda (${remainingBalance} hari) tidak mencukupi untuk pengajuan ${calculatedDays} hari kerja`,
                life: 4000
            }
        };
    }

    if (selectedLeaveType?.maxDays && calculatedDays > selectedLeaveType.maxDays) {
        return {
            valid: false,
            errors,
            error: {
                severity: 'error',
                summary: 'Melebihi Batas Hari',
                detail: `${selectedLeaveType.name} maksimal ${selectedLeaveType.maxDays} hari kerja per pengajuan (dipilih ${calculatedDays} hari)`,
                life: 4500
            }
        };
    }

    if (selectedLeaveType?.requiresDocument && !form?.documentName && !selectedLeaveType.allowLateDocument) {
        return {
            valid: false,
            errors,
            error: {
                severity: 'error',
                summary: 'Dokumen Wajib',
                detail: `Jenis cuti ${selectedLeaveType.name} mensyaratkan dokumen fisik pendukung (misal: Surat Dokter)`,
                life: 4000
            }
        };
    }

    return { valid: true, errors };
}

export function validateDraftForm({ form, calculatedDays, formatDate = defaultFormatDate }) {
    const errors = {};
    if (!form?.leaveTypeId) errors.leaveTypeId = 'Pilih jenis cuti terlebih dahulu';
    if (!form?.startDate) errors.startDate = 'Isi tanggal mulai cuti';
    else if (!form?.endDate) errors.endDate = 'Isi tanggal selesai cuti';
    else if (new Date(formatDate(form.endDate)) < new Date(formatDate(form.startDate))) errors.endDate = 'Tanggal selesai harus setelah tanggal mulai';
    else if (calculatedDays <= 0) errors.endDate = 'Rentang tanggal tidak memuat hari kerja (akhir pekan/libur)';
    if (Object.keys(errors).length) return { valid: false, errors };
    return { valid: true, errors };
}
