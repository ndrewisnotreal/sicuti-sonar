<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { adminService, AUDIT_ACTION_LABEL, AUDIT_ENTITY_LABEL } from '@/service/adminService';
import { saveBlob } from '@/service/api';
import { formatDate } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import AuditDetailDialog from '@/components/admin/AuditDetailDialog.vue';
import { auditActionLabel, auditEntityLabel, auditUserName, isAttentionAction } from '@/components/admin/auditLog';
import { PhListMagnifyingGlass, PhMagnifyingGlass, PhArrowsClockwise, PhFileXls, PhEye } from '@phosphor-icons/vue';

// Sama dengan limit yang diminta adminService.getAuditLogs; dipakai untuk menulis jujur bila daftar terpotong (audit-023 #12).
const LOG_LIMIT = 500;

const toast = useToast();
const loading = ref(false);
const loadError = ref(false);
const exporting = ref(false);
const logs = ref([]);
const searchQuery = ref('');
const actionFilter = ref(null);
const entityFilter = ref(null);

const detailDialogVisible = ref(false);
const selectedLog = ref(null);

const actionOptions = [{ label: 'Semua Aksi', value: null }, ...Object.entries(AUDIT_ACTION_LABEL).map(([value, label]) => ({ label, value }))];
const entityOptions = [{ label: 'Semua Entitas', value: null }, ...Object.entries(AUDIT_ENTITY_LABEL).map(([value, label]) => ({ label, value }))];

const dateRange = ref(null);
function iso(d) {
    if (!d) return undefined;
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

const filterParams = computed(() => ({
    action: actionFilter.value || undefined,
    entity: entityFilter.value || undefined,
    search: searchQuery.value.trim() || undefined,
    start_date: iso(dateRange.value?.[0]),
    end_date: iso(dateRange.value?.[1] || dateRange.value?.[0])
}));

// Hanya respons permintaan terakhir yang dipakai, agar hasil filter lama tidak menimpa yang baru (audit-023 #2).
let requestSeq = 0;
async function loadAuditLogs() {
    const seq = ++requestSeq;
    loading.value = true;
    loadError.value = false;
    try {
        const data = await adminService.getAuditLogs(filterParams.value);
        if (seq !== requestSeq) return;
        logs.value = Array.isArray(data) ? data : [];
    } catch (err) {
        if (seq !== requestSeq) return;
        loadError.value = true;
        // Dikosongkan agar log dari filter sebelumnya tidak tampil di bawah filter yang baru.
        logs.value = [];
        toast.add({
            severity: 'error',
            summary: 'Gagal Memuat Log',
            detail: err.message || 'Gagal memuat data riwayat audit',
            life: 3000
        });
    } finally {
        if (seq === requestSeq) loading.value = false;
    }
}

const filteredLogs = computed(() => logs.value);
const capped = computed(() => logs.value.length >= LOG_LIMIT);

let searchTimer = null;
watch([actionFilter, entityFilter, dateRange], loadAuditLogs);
watch(searchQuery, () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadAuditLogs, 400);
});

const hasFilters = computed(() => Boolean(searchQuery.value.trim() || actionFilter.value || entityFilter.value || dateRange.value));
function resetFilters() {
    searchQuery.value = '';
    actionFilter.value = null;
    entityFilter.value = null;
    dateRange.value = null;
}

const emptyText = computed(() => {
    if (loading.value) return 'Memuat log audit...';
    if (loadError.value) return 'Log audit belum termuat.';
    if (hasFilters.value) return 'Tidak ada log yang cocok dengan pencarian atau filter.';
    return 'Belum ada catatan log audit.';
});

const datePart = (log) => formatDate(String(log.timestamp || log.created_at || '').split(/[ T]/)[0]);
const timePart = (log) => String(log.timestamp || log.created_at || '').split(/[ T]/)[1]?.slice(0, 8) || '';

function viewDetail(item) {
    selectedLog.value = item;
    detailDialogVisible.value = true;
}

// Backend belum punya route ekspor audit trail (404). Pengguna memilih CSV dari log yang sudah dimuat (audit-023 #1, opsi A).
// shortcut: CSV memuat paling banyak LOG_LIMIT entri terbaru; ganti ke route backend bila ekspor seluruh log dibutuhkan.
const csvCell = (value) => {
    let text = String(value ?? '');
    // Nilai log bisa berisi masukan pengguna: cegah formula dieksekusi saat dibuka di Excel.
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function exportCsv() {
    if (loadError.value) {
        toast.add({ severity: 'warn', summary: 'Data belum termuat', detail: 'Muat ulang log audit sebelum mengekspor.', life: 3000 });
        return;
    }
    if (!filteredLogs.value.length) {
        toast.add({ severity: 'warn', summary: 'Tidak ada data', detail: 'Tidak ada log yang sesuai filter untuk diekspor.', life: 3000 });
        return;
    }
    exporting.value = true;
    try {
        const header = ['Tanggal', 'Jam', 'Nama', 'NIK', 'Peran', 'Aksi', 'Kode Aksi', 'Entitas', 'Kode Entitas', 'Alamat IP', 'Keterangan'];
        const rows = filteredLogs.value.map((l) => [
            datePart(l),
            timePart(l),
            auditUserName(l),
            l.username || l.user || '-',
            l.user_role || '-',
            auditActionLabel(l.action),
            l.action || '-',
            auditEntityLabel(l.entity),
            l.entity || '-',
            l.ip_address || '-',
            l.details || l.description || '-'
        ]);
        const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
        const stamp = new Date().toISOString().slice(0, 10);
        saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `audit_trail_${stamp}.csv`);
        toast.add({
            severity: 'success',
            summary: 'Ekspor Berhasil',
            detail: `${rows.length} entri log diunduh sebagai CSV${capped.value ? ` (dibatasi ${LOG_LIMIT} entri terbaru)` : ''}.`,
            life: 3000
        });
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal Ekspor', detail: err.message || 'Coba lagi beberapa saat.', life: 4000 });
    } finally {
        exporting.value = false;
    }
}

// Daftar HP dimuat bertahap, pengganti paginator tabel.
const mobileLimit = ref(10);
watch(logs, () => {
    mobileLimit.value = 10;
});
const mobileRows = computed(() => filteredLogs.value.slice(0, mobileLimit.value));

onMounted(() => {
    loadAuditLogs();
});
</script>

<template>
    <div class="space-y-6">
        <!-- Satu kartu: judul dan aksi, filter dan jumlah, lalu daftar (acuan 00b §6.1, audit-023 #8). -->
        <div class="card !mb-0">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                        <PhListMagnifyingGlass :size="22" weight="regular" class="text-primary shrink-0" aria-hidden="true" />
                        <span>Audit Trail & Log Aktivitas</span>
                    </h1>
                    <p class="text-xs text-muted-color">
                        Catatan rekaman jejak audit sistem: login, pengajuan cuti, keputusan persetujuan, dan perubahan master data
                    </p>
                </div>
                <div class="flex items-center gap-2">
                    <Button
                        severity="secondary"
                        outlined
                        size="small"
                        class="text-xs font-semibold flex items-center gap-1.5 !min-h-11 sm:!min-h-9"
                        :loading="loading"
                        @click="loadAuditLogs"
                    >
                        <PhArrowsClockwise :size="14" weight="bold" aria-hidden="true" />
                        <span>Segarkan</span>
                    </Button>
                    <Button data-tour="export-excel"
                        severity="success"
                        size="small"
                        class="text-xs font-bold flex items-center gap-1.5 !min-h-11 sm:!min-h-9"
                        :disabled="loading"
                        :loading="exporting"
                        @click="exportCsv"
                    >
                        <PhFileXls :size="14" weight="bold" aria-hidden="true" />
                        <span>Ekspor CSV</span>
                    </Button>
                </div>
            </div>

            <div data-tour="audit-filters" class="mt-6 space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] gap-3">
                    <div>
                        <span class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1" aria-hidden="true">Cari</span>
                        <IconField iconPosition="left" class="w-full">
                            <InputIcon class="!flex items-center justify-center">
                                <PhMagnifyingGlass :size="14" weight="bold" class="text-muted-color" aria-hidden="true" />
                            </InputIcon>
                            <InputText
                                id="cari-audit"
                                name="cari-audit"
                                aria-label="Cari audit trail berdasarkan user, aksi, IP, atau detail"
                                v-model="searchQuery"
                                placeholder="Cari user / aksi / IP / detail..."
                                class="w-full text-xs !min-h-11 sm:!min-h-9"
                                size="small"
                            />
                        </IconField>
                    </div>
                    <div>
                        <span id="audit-action-label" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Aksi</span>
                        <Select
                            v-model="actionFilter"
                            :options="actionOptions"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Semua Aksi"
                            ariaLabelledby="audit-action-label"
                            class="w-full text-xs !min-h-11 sm:!min-h-9"
                            size="small"
                        />
                    </div>
                    <div>
                        <span id="audit-entity-label" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Entitas</span>
                        <Select
                            v-model="entityFilter"
                            :options="entityOptions"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Semua Entitas"
                            ariaLabelledby="audit-entity-label"
                            class="w-full text-xs !min-h-11 sm:!min-h-9"
                            size="small"
                        />
                    </div>
                    <div>
                        <span class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1" aria-hidden="true">Rentang tanggal</span>
                        <DatePicker
                            v-model="dateRange"
                            selectionMode="range"
                            :manualInput="false"
                            dateFormat="dd M yy"
                            placeholder="Semua tanggal"
                            showIcon
                            iconDisplay="input"
                            showButtonBar
                            size="small"
                            fluid
                            inputClass="text-xs !min-h-11 sm:!min-h-9"
                            aria-label="Rentang tanggal log"
                        />
                    </div>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="text-xs text-muted-color" aria-live="polite">
                        <template v-if="loading || loadError">Total: <span class="font-bold text-surface-900 dark:text-surface-100">–</span> entri log</template>
                        <template v-else-if="capped">Menampilkan <span class="font-bold text-surface-900 dark:text-surface-100">{{ LOG_LIMIT }}</span> entri terbaru (dibatasi {{ LOG_LIMIT }}). Persempit filter untuk melihat yang lebih lama.</template>
                        <template v-else>Total: <span class="font-bold text-surface-900 dark:text-surface-100">{{ filteredLogs.length }}</span> entri log</template>
                    </p>
                    <Button v-if="hasFilters" label="Atur ulang filter" severity="secondary" text size="small" class="text-xs !min-h-11 sm:!min-h-9" @click="resetFilters" />
                </div>
            </div>

            <div v-if="loadError" role="alert" class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                <span>Log audit gagal dimuat. Daftar dikosongkan agar tidak tertukar dengan filter sebelumnya.</span>
                <Button label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11" :loading="loading" @click="loadAuditLogs" />
            </div>

            <div data-tour="audit-table" class="mt-4">
                <!-- Tabel mulai md; di bawahnya daftar bertumpuk agar tombol detail tidak terdorong keluar layar (audit-023 #3). -->
                <div class="hidden md:block">
                    <DataTable
                        :value="filteredLogs"
                        paginator
                        :rows="10"
                        :rowsPerPageOptions="[10, 25, 50]"
                        class="p-datatable-sm text-xs"
                        responsiveLayout="scroll"
                        :loading="loading"
                    >
                        <template #empty>
                            <div class="text-center py-8 text-muted-color">
                                <p>{{ emptyText }}</p>
                                <Button v-if="hasFilters && !loadError && !loading" label="Atur ulang filter" severity="secondary" outlined size="small" class="mt-3 text-xs" @click="resetFilters" />
                            </div>
                        </template>

                        <Column field="timestamp" header="Waktu" sortable style="width: 13%">
                            <template #body="{ data }">
                                <div class="flex flex-col whitespace-nowrap tabular-nums">
                                    <span class="font-semibold text-surface-900 dark:text-surface-100">{{ datePart(data) }}</span>
                                    <span class="text-muted-color">{{ timePart(data) }}</span>
                                </div>
                            </template>
                        </Column>

                        <Column field="username" header="Pengguna" sortable style="width: 17%">
                            <template #body="{ data }">
                                <div class="font-semibold text-surface-900 dark:text-surface-100">{{ auditUserName(data) }}</div>
                                <div class="text-xs text-muted-color">NIK {{ data.username || data.user || '-' }}<template v-if="data.user_role"> · {{ data.user_role }}</template></div>
                            </template>
                        </Column>

                        <!-- Teks biasa; Tag merah hanya untuk kejadian yang perlu perhatian (audit-023 #9). -->
                        <Column field="action" header="Aksi" sortable style="width: 15%">
                            <template #body="{ data }">
                                <Tag v-if="isAttentionAction(data.action)" :value="auditActionLabel(data.action)" severity="danger" />
                                <span v-else class="text-surface-900 dark:text-surface-100">{{ auditActionLabel(data.action) }}</span>
                            </template>
                        </Column>

                        <Column field="entity" header="Entitas" sortable style="width: 12%">
                            <template #body="{ data }">
                                <span class="text-surface-800 dark:text-surface-200">{{ auditEntityLabel(data.entity) }}</span>
                            </template>
                        </Column>

                        <Column field="ip_address" header="Alamat IP" style="width: 11%">
                            <template #body="{ data }">
                                <span class="font-mono text-surface-700 dark:text-surface-300 break-all">{{ data.ip_address || '-' }}</span>
                            </template>
                        </Column>

                        <Column field="details" header="Keterangan" style="width: 32%" :pt="{ headerCell: { 'data-tour': 'audit-col-detail' } }">
                            <template #body="{ data }">
                                <div class="flex items-start justify-between gap-2">
                                    <span class="text-surface-800 dark:text-surface-200 line-clamp-2 break-words">{{ data.details || data.description || '-' }}</span>
                                    <button
                                        type="button"
                                        class="inline-flex items-center justify-center min-w-9 min-h-9 shrink-0 rounded-border text-surface-600 dark:text-surface-300 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                        :aria-label="`Detail log ${datePart(data)} ${timePart(data)} ${auditUserName(data)}`"
                                        title="Lihat detail lengkap"
                                        @click="viewDetail(data)"
                                    >
                                        <PhEye :size="16" weight="bold" aria-hidden="true" />
                                    </button>
                                </div>
                            </template>
                        </Column>
                    </DataTable>
                </div>

                <div class="md:hidden" :aria-busy="loading">
                    <div v-if="!filteredLogs.length" class="py-8 text-center text-xs text-muted-color">
                        <p>{{ emptyText }}</p>
                        <Button v-if="hasFilters && !loadError && !loading" label="Atur ulang filter" severity="secondary" outlined size="small" class="mt-3 text-xs !min-h-11" @click="resetFilters" />
                    </div>
                    <ul v-else class="divide-y divide-surface-200 dark:divide-surface-700" :class="{ 'opacity-60': loading }">
                        <li v-for="(l, i) in mobileRows" :key="l.id || i" class="py-3 space-y-1.5 text-xs">
                            <div class="flex items-start justify-between gap-2">
                                <div class="min-w-0">
                                    <div class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ auditUserName(l) }}</div>
                                    <div class="text-muted-color">NIK {{ l.username || l.user || '-' }}<template v-if="l.user_role"> · {{ l.user_role }}</template></div>
                                </div>
                                <div class="text-right shrink-0 tabular-nums text-muted-color">
                                    <div>{{ datePart(l) }}</div>
                                    <div>{{ timePart(l) }}</div>
                                </div>
                            </div>
                            <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-surface-800 dark:text-surface-200">
                                <Tag v-if="isAttentionAction(l.action)" :value="auditActionLabel(l.action)" severity="danger" />
                                <span v-else class="font-medium">{{ auditActionLabel(l.action) }}</span>
                                <span class="text-muted-color">· {{ auditEntityLabel(l.entity) }} · <span class="font-mono">{{ l.ip_address || '-' }}</span></span>
                            </div>
                            <p class="text-surface-800 dark:text-surface-200 line-clamp-2 break-words">{{ l.details || l.description || '-' }}</p>
                            <!-- Anchor tour kolom detail juga di item pertama, karena header tabel tersembunyi di HP. -->
                            <Button
                                severity="secondary"
                                outlined
                                size="small"
                                class="w-full text-xs !min-h-11 flex items-center justify-center gap-1.5"
                                :data-tour="i === 0 ? 'audit-col-detail' : undefined"
                                :aria-label="`Detail log ${datePart(l)} ${timePart(l)} ${auditUserName(l)}`"
                                @click="viewDetail(l)"
                            >
                                <PhEye :size="14" weight="bold" aria-hidden="true" />
                                <span>Detail</span>
                            </Button>
                        </li>
                    </ul>
                    <Button
                        v-if="filteredLogs.length > mobileLimit"
                        :label="`Tampilkan ${Math.min(10, filteredLogs.length - mobileLimit)} lagi`"
                        severity="secondary"
                        text
                        size="small"
                        class="w-full mt-2 text-xs !min-h-11"
                        @click="mobileLimit += 10"
                    />
                </div>
            </div>
        </div>

        <AuditDetailDialog
            v-model:visible="detailDialogVisible"
            :log="selectedLog"
        />
    </div>
</template>
