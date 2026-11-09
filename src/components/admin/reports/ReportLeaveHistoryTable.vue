<script setup>
import { computed, ref, watch } from 'vue';
import { formatDate, getStatusSeverity, getStatusLabel } from '@/service/sicutiService';

const props = defineProps({
    items: {
        type: Array,
        default: () => []
    },
    loading: {
        type: Boolean,
        default: false
    },
    // Pesan kosong dari parent: gagal dimuat, tidak cocok filter, atau memang kosong (audit-022 #1).
    emptyText: {
        type: String,
        default: 'Tidak ada data riwayat cuti untuk filter ini.'
    }
});

// Cuti satu hari ditulis satu tanggal (audit-022 #12, pola item 12).
function dateRangeLabel(r) {
    const start = r.start_date;
    const end = r.end_date || start;
    return String(start).slice(0, 10) === String(end).slice(0, 10) ? formatDate(start) : `${formatDate(start)} s/d ${formatDate(end)}`;
}

// Daftar HP dimuat bertahap, pengganti paginator tabel.
const mobileLimit = ref(10);
watch(
    () => props.items,
    () => {
        mobileLimit.value = 10;
    }
);
const mobileRows = computed(() => props.items.slice(0, mobileLimit.value));
</script>

<template>
    <div>
        <div class="hidden sm:block">
            <DataTable :value="items" :loading="loading" paginator :rows="10" class="p-datatable-sm text-xs" responsiveLayout="scroll">
                <template #empty>
                    <div class="text-center py-8 text-muted-color">{{ emptyText }}</div>
                </template>
                <Column header="No. Pengajuan" style="width: 15%">
                    <template #body="{ data }">
                        <span class="font-mono whitespace-nowrap text-surface-900 dark:text-surface-100">{{ data.id_request }}</span>
                    </template>
                </Column>
                <Column header="Karyawan" style="width: 22%">
                    <template #body="{ data }">
                        <div class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ data.requester_name }}</div>
                        <div class="text-xs text-muted-color">NIK {{ data.namecode || '-' }} · {{ data.kd_dept || '-' }}</div>
                    </template>
                </Column>
                <Column header="Jenis Cuti" style="width: 14%">
                    <template #body="{ data }">
                        <span class="text-surface-900 dark:text-surface-100">{{ data.nm_leave_type }}</span>
                    </template>
                </Column>
                <Column header="Tanggal Cuti" style="width: 19%">
                    <template #body="{ data }">
                        <div class="text-surface-900 dark:text-surface-100">{{ dateRangeLabel(data) }}</div>
                        <div class="text-xs text-muted-color"><span class="tabular-nums">{{ data.total_days }}</span> hari kerja</div>
                    </template>
                </Column>
                <Column header="Status" style="width: 12%">
                    <template #body="{ data }">
                        <Tag :value="getStatusLabel(data.status)" :severity="getStatusSeverity(data.status)" />
                    </template>
                </Column>
                <!-- Alasan dibungkus 2 baris, bukan dipotong satu baris dengan teks lengkap hanya di title (audit-022 #12). -->
                <Column header="Alasan" style="width: 18%">
                    <template #body="{ data }">
                        <span class="text-surface-700 dark:text-surface-300 line-clamp-2 break-words">{{ data.reason || '-' }}</span>
                    </template>
                </Column>
            </DataTable>
        </div>

        <div class="sm:hidden" :aria-busy="loading">
            <p v-if="!items.length" class="py-8 text-center text-xs text-muted-color">{{ loading ? 'Memuat data...' : emptyText }}</p>
            <ul v-else class="divide-y divide-surface-200 dark:divide-surface-700" :class="{ 'opacity-60': loading }">
                <li v-for="r in mobileRows" :key="r.id_request" class="py-3 space-y-1.5 text-xs">
                    <div class="flex items-start justify-between gap-2">
                        <span class="font-mono break-all text-surface-800 dark:text-surface-200">{{ r.id_request }}</span>
                        <Tag :value="getStatusLabel(r.status)" :severity="getStatusSeverity(r.status)" />
                    </div>
                    <div>
                        <div class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ r.requester_name }}</div>
                        <div class="text-muted-color">NIK {{ r.namecode || '-' }} · {{ r.kd_dept || '-' }}</div>
                    </div>
                    <div class="text-surface-800 dark:text-surface-200">{{ r.nm_leave_type }} · {{ dateRangeLabel(r) }} · {{ r.total_days }} hari kerja</div>
                    <p v-if="r.reason" class="text-surface-700 dark:text-surface-300 break-words">Alasan: {{ r.reason }}</p>
                </li>
            </ul>
            <Button
                v-if="items.length > mobileLimit"
                :label="`Tampilkan ${Math.min(10, items.length - mobileLimit)} lagi`"
                severity="secondary"
                text
                size="small"
                class="w-full mt-2 text-xs !min-h-11"
                @click="mobileLimit += 10"
            />
        </div>
    </div>
</template>
