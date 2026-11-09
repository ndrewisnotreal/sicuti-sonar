<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { adminService } from '@/service/adminService';
import { defaultAnnualQuota, CURRENT_YEAR } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    balanceData: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['update:visible', 'saved']);
const toast = useToast();

const saving = ref(false);
const reasonError = ref('');

const editingBalance = ref({
    id_balance: '',
    uid_user_system: '',
    nama: '',
    namecode: '',
    kd_dept: '',
    year: CURRENT_YEAR,
    annual_quota: defaultAnnualQuota(),
    carry_over_days: 0,
    used_days: 0,
    carry_over_expiry_date: '',
    reason: ''
});

watch(
    () => props.visible,
    (isOpen) => {
        if (!isOpen) return;
        reasonError.value = '';
        if (props.balanceData) {
            const item = props.balanceData;
            editingBalance.value = {
                id_balance: item.id_balance || '',
                uid_user_system: item.uid_user_system,
                nama: item.nama || '-',
                namecode: item.namecode || '-',
                kd_dept: item.kd_dept || '-',
                year: item.year || CURRENT_YEAR,
                annual_quota: Number(item.annual_quota ?? defaultAnnualQuota()),
                carry_over_days: Number(item.carry_over_days ?? 0),
                used_days: Number(item.used_days ?? 0),
                carry_over_expiry_date: item.carry_over_expiry_date ? String(item.carry_over_expiry_date).slice(0, 10) : '',
                reason: ''
            };
        }
    }
);

// DatePicker bekerja dengan Date; state tetap string YYYY-MM-DD seperti sebelumnya (pola HolidayFormDialog).
const toIso = (value) => {
    if (!value) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};
const fromIso = (iso) => {
    const p = String(iso || '').split('-').map(Number);
    return p.length === 3 && p.every(Boolean) ? new Date(p[0], p[1] - 1, p[2]) : null;
};
const expiryDate = computed({
    get: () => fromIso(editingBalance.value.carry_over_expiry_date),
    set: (value) => {
        editingBalance.value.carry_over_expiry_date = toIso(value);
    }
});

// Sebelum/sesudah ditulis apa adanya, tanpa dipotong ke 0, sama dengan rumus backend (audit-021 #13).
const remainingBefore = computed(() => {
    const b = props.balanceData;
    if (!b) return 0;
    return b.remaining ?? Number(b.annual_quota || 0) + Number(b.carry_over_days || 0) - Number(b.used_days || 0);
});
const remainingAfter = computed(() => Number(editingBalance.value.annual_quota || 0) + Number(editingBalance.value.carry_over_days || 0) - Number(editingBalance.value.used_days || 0));

watch(
    () => editingBalance.value.reason,
    (value) => {
        if (value.trim()) reasonError.value = '';
    }
);

async function saveAdjustBalance() {
    if (!editingBalance.value.reason.trim()) {
        reasonError.value = 'Alasan penyesuaian wajib diisi';
        await nextTick();
        document.getElementById('balance-reason-input')?.focus();
        return;
    }
    reasonError.value = '';
    saving.value = true;
    try {
        const payload = {
            uid_user_system: editingBalance.value.uid_user_system,
            year: Number(editingBalance.value.year),
            annual_quota: Number(editingBalance.value.annual_quota),
            carry_over_days: Number(editingBalance.value.carry_over_days),
            carry_over_expiry_date: editingBalance.value.carry_over_expiry_date || undefined,
            reason: editingBalance.value.reason.trim()
        };

        await adminService.upsertBalance(payload);
        toast.add({
            severity: 'success',
            summary: 'Saldo Diperbarui',
            detail: `Saldo cuti ${editingBalance.value.nama} berhasil disesuaikan`,
            life: 3000
        });
        emit('update:visible', false);
        emit('saved');
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Gagal Menyesuaikan Saldo',
            detail: err.message || 'Terjadi kesalahan saat menyimpan saldo',
            life: 3000
        });
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <Dialog
        :visible="visible"
        modal
        header="Penyesuaian Saldo Cuti Karyawan"
        :style="{ width: '480px' }"
        :breakpoints="{ '640px': '92vw' }"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="space-y-5 pt-1 text-sm">
            <!-- Identitas sebagai tint tanpa garis: dialog tetap satu bingkai (DESIGN.md). -->
            <div class="px-3 py-2.5 rounded-border bg-surface-100 dark:bg-surface-800">
                <div class="font-semibold text-surface-900 dark:text-surface-100">{{ editingBalance.nama }}</div>
                <div class="text-xs text-surface-600 dark:text-surface-400">NIK {{ editingBalance.namecode }} · Divisi {{ editingBalance.kd_dept }} · Tahun {{ editingBalance.year }}</div>
                <div v-if="balanceData?.period_label" class="text-xs text-surface-600 dark:text-surface-400">Periode {{ balanceData.period_label }}</div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label for="balance-quota" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Kuota tahunan (hari)</label>
                    <InputNumber v-model="editingBalance.annual_quota" inputId="balance-quota" :min="0" :max="50" fluid />
                </div>
                <div>
                    <label for="balance-carry" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Carry over (hari)</label>
                    <InputNumber v-model="editingBalance.carry_over_days" inputId="balance-carry" :min="0" :max="30" fluid />
                </div>
                <div>
                    <label for="balance-expiry" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Kadaluarsa carry over</label>
                    <DatePicker
                        v-model="expiryDate"
                        inputId="balance-expiry"
                        dateFormat="dd M yy"
                        showIcon
                        iconDisplay="input"
                        placeholder="Pilih tanggal"
                        fluid
                        aria-describedby="balance-expiry-help"
                    />
                    <!-- Backend memakai COALESCE: tanggal kosong tidak dikirim, jadi tanggal lama tetap tersimpan (audit-021 #14). -->
                    <p id="balance-expiry-help" class="mt-1 text-xs text-surface-600 dark:text-surface-400">Opsional. Mengosongkan tanggal tidak menghapus tanggal yang sudah tersimpan.</p>
                </div>
                <div>
                    <span class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Cuti terpakai</span>
                    <p class="min-h-10 flex items-center font-semibold tabular-nums text-surface-900 dark:text-surface-100">{{ editingBalance.used_days }} hari</p>
                    <p class="text-xs text-surface-600 dark:text-surface-400">Dihitung otomatis dari cuti yang sudah disetujui dalam periode saldo.</p>
                </div>
            </div>

            <div>
                <label for="balance-reason-input" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Alasan penyesuaian <span class="text-(--status-danger-fg)" aria-hidden="true">*</span></label>
                <Textarea
                    id="balance-reason-input"
                    v-model="editingBalance.reason"
                    rows="2"
                    class="w-full"
                    placeholder="Contoh: Koreksi saldo awal sesuai data HR"
                    aria-required="true"
                    :invalid="Boolean(reasonError)"
                    :aria-invalid="Boolean(reasonError)"
                    :aria-describedby="reasonError ? 'balance-reason-error' : 'balance-reason-help'"
                />
                <p v-if="reasonError" id="balance-reason-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ reasonError }}</p>
                <p v-else id="balance-reason-help" class="mt-1 text-xs text-surface-600 dark:text-surface-400">Dicatat di riwayat saldo karyawan.</p>
            </div>

            <!-- Ringkasan netral sebelum/sesudah, karena setiap simpan tercatat permanen di riwayat (audit-021 #13). -->
            <dl class="border-t border-surface-200 dark:border-surface-700 pt-4 space-y-1.5" aria-live="polite">
                <div class="flex items-center justify-between gap-3">
                    <dt class="text-surface-600 dark:text-surface-400">Sisa saat ini</dt>
                    <dd class="tabular-nums text-surface-900 dark:text-surface-100">{{ remainingBefore }} hari</dd>
                </div>
                <div class="flex items-center justify-between gap-3">
                    <dt class="font-medium text-surface-900 dark:text-surface-100">Sisa setelah disimpan</dt>
                    <dd class="tabular-nums text-base font-bold text-surface-900 dark:text-surface-100">{{ remainingAfter }} hari</dd>
                </div>
                <p v-if="remainingAfter < 0" class="text-xs leading-relaxed text-(--status-warn-fg)">
                    Sisa menjadi minus karena kuota dan carry over lebih kecil dari cuti yang sudah terpakai.
                </p>
            </dl>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2 pt-2">
                <Button label="Batal" severity="secondary" size="small" text @click="emit('update:visible', false)" />
                <Button label="Simpan Saldo" severity="primary" size="small" class="font-bold" :loading="saving" @click="saveAdjustBalance" />
            </div>
        </template>
    </Dialog>
</template>
