<script setup>
import { computed } from 'vue';

const props = defineProps({
    items: {
        type: Array,
        default: () => []
    },
    loading: {
        type: Boolean,
        default: false
    },
    // Pesan kosong dari parent: gagal dimuat atau memang kosong (audit-022 #1).
    emptyText: {
        type: String,
        default: 'Belum ada jenis cuti.'
    },
    // Saat gagal dimuat, angka ringkasan ditulis "–", bukan 0 (audit-022 #1).
    loadError: {
        type: Boolean,
        default: false
    }
});

const summaryTotals = computed(() =>
    props.items.reduce(
        (acc, r) => ({
            total: acc.total + Number(r.total || 0),
            approved: acc.approved + Number(r.approved || 0),
            days: acc.days + Number(r.approved_days || 0)
        }),
        { total: 0, approved: 0, days: 0 }
    )
);

const maxSummary = computed(() => Math.max(1, ...props.items.map((r) => Number(r.total || 0))));

const shown = (n) => (props.loadError ? '–' : n);
</script>

<template>
    <div class="space-y-4">
        <!-- Ringkasan sebagai baris angka tanpa kotak, dipisah garis (audit-022 #8). -->
        <dl class="grid grid-cols-3 divide-x divide-surface-200 dark:divide-surface-700 border-y border-surface-200 dark:border-surface-700 py-3 text-center text-xs">
            <div class="px-2">
                <dt class="text-muted-color">Total pengajuan</dt>
                <dd class="text-xl font-bold tabular-nums text-surface-900 dark:text-surface-100">{{ shown(summaryTotals.total) }}</dd>
            </div>
            <div class="px-2">
                <dt class="text-muted-color">Disetujui</dt>
                <dd class="text-xl font-bold tabular-nums text-surface-900 dark:text-surface-100">{{ shown(summaryTotals.approved) }}</dd>
            </div>
            <div class="px-2">
                <dt class="text-muted-color">Hari cuti disetujui</dt>
                <dd class="text-xl font-bold tabular-nums text-surface-900 dark:text-surface-100">{{ shown(summaryTotals.days) }}</dd>
            </div>
        </dl>

        <!-- Angka netral: nama kolom sudah menyebut status, warna per sel tidak menambah arti (audit-022 #9). -->
        <div class="hidden sm:block">
            <DataTable :value="items" :loading="loading" class="p-datatable-sm text-xs" responsiveLayout="scroll">
                <template #empty>
                    <div class="text-center py-8 text-muted-color">{{ emptyText }}</div>
                </template>
                <Column header="Jenis Cuti" style="width: 26%">
                    <template #body="{ data }">
                        <div class="font-semibold text-surface-900 dark:text-surface-100">{{ data.nm_leave_type }}</div>
                        <div class="h-1.5 mt-1 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden" aria-hidden="true">
                            <div class="h-full bg-primary rounded-full" :style="{ width: `${(Number(data.total || 0) / maxSummary) * 100}%` }" />
                        </div>
                    </template>
                </Column>
                <Column header="Pengajuan" style="width: 12%">
                    <template #body="{ data }"><span class="tabular-nums font-bold text-surface-900 dark:text-surface-100">{{ data.total }}</span></template>
                </Column>
                <Column header="Disetujui" style="width: 12%">
                    <template #body="{ data }"><span class="tabular-nums text-surface-900 dark:text-surface-100">{{ data.approved }}</span></template>
                </Column>
                <Column header="Ditolak" style="width: 12%">
                    <template #body="{ data }"><span class="tabular-nums text-surface-900 dark:text-surface-100">{{ data.rejected }}</span></template>
                </Column>
                <Column header="Dibatalkan" style="width: 12%">
                    <template #body="{ data }"><span class="tabular-nums text-surface-900 dark:text-surface-100">{{ data.cancelled }}</span></template>
                </Column>
                <Column header="Dalam Proses" style="width: 12%">
                    <template #body="{ data }"><span class="tabular-nums text-surface-900 dark:text-surface-100">{{ data.pending }}</span></template>
                </Column>
                <Column header="Hari Disetujui" style="width: 14%">
                    <template #body="{ data }"><span class="tabular-nums font-bold text-surface-900 dark:text-surface-100">{{ data.approved_days }}</span></template>
                </Column>
            </DataTable>
        </div>

        <div class="sm:hidden" :aria-busy="loading">
            <p v-if="!items.length" class="py-8 text-center text-xs text-muted-color">{{ loading ? 'Memuat data...' : emptyText }}</p>
            <ul v-else class="divide-y divide-surface-200 dark:divide-surface-700" :class="{ 'opacity-60': loading }">
                <li v-for="s in items" :key="s.kd_leave_type || s.nm_leave_type" class="py-3 space-y-2 text-xs">
                    <div class="flex items-baseline justify-between gap-3">
                        <span class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ s.nm_leave_type }}</span>
                        <span class="tabular-nums text-surface-900 dark:text-surface-100"><span class="font-bold">{{ s.total }}</span> pengajuan</span>
                    </div>
                    <div class="h-1.5 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden" aria-hidden="true">
                        <div class="h-full bg-primary rounded-full" :style="{ width: `${(Number(s.total || 0) / maxSummary) * 100}%` }" />
                    </div>
                    <dl class="grid grid-cols-3 gap-2">
                        <div>
                            <dt class="text-muted-color">Disetujui</dt>
                            <dd class="tabular-nums text-surface-900 dark:text-surface-100">{{ s.approved }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted-color">Ditolak</dt>
                            <dd class="tabular-nums text-surface-900 dark:text-surface-100">{{ s.rejected }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted-color">Dibatalkan</dt>
                            <dd class="tabular-nums text-surface-900 dark:text-surface-100">{{ s.cancelled }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted-color">Dalam proses</dt>
                            <dd class="tabular-nums text-surface-900 dark:text-surface-100">{{ s.pending }}</dd>
                        </div>
                        <div class="col-span-2">
                            <dt class="text-muted-color">Hari disetujui</dt>
                            <dd class="tabular-nums font-bold text-surface-900 dark:text-surface-100">{{ s.approved_days }}</dd>
                        </div>
                    </dl>
                </li>
            </ul>
        </div>
    </div>
</template>
