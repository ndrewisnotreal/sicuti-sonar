<template>
    <!-- Bagian filter dan tabel tanpa kartu sendiri; kartu halaman milik parent (00b §6.1). Susunan dirombak di audit-019. -->
    <div class="monitoring-table space-y-5" :aria-busy="loading">
        <div data-tour="mon-filters" class="space-y-4">
            <!-- Grid filter mengisi lebar kartu; semua field rata bawah dan sama tinggi (audit-019 #1). -->
            <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] gap-4 items-start">
                <div>
                    <span class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1" aria-hidden="true">Cari</span>
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon class="!flex items-center justify-center">
                            <PhMagnifyingGlass :size="14" weight="bold" class="text-muted-color" aria-hidden="true" />
                        </InputIcon>
                        <InputText
                            id="cari-pemantauan"
                            name="cari-pemantauan"
                            aria-label="Cari pengajuan berdasarkan ID, nama, atau NIK"
                            v-model="searchQuery"
                            placeholder="Cari ID / Nama / NIK..."
                            class="w-full !min-h-11 sm:!min-h-9"
                            size="small"
                        />
                    </IconField>
                </div>

                <div v-if="adminDivision">
                    <span class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Divisi</span>
                    <p class="min-h-11 sm:min-h-9 flex items-center text-sm font-semibold text-surface-900 dark:text-surface-100">{{ adminDivision }}</p>
                </div>
                <div v-else-if="isSuper">
                    <span id="mon-dept-label" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Divisi</span>
                    <Select
                        v-model="departmentFilter"
                        :options="[{ label: 'Semua Divisi', value: null }, ...departments.map(d => ({ label: `${d.nm_dept} (${d.kd_dept})`, value: d.kd_dept }))]"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Semua Divisi"
                        ariaLabelledby="mon-dept-label"
                        class="w-full !min-h-11 sm:!min-h-9"
                        :disabled="loading || departmentsError"
                        :aria-describedby="departmentsError ? 'mon-dept-error' : undefined"
                        size="small"
                    />
                    <p v-if="departmentsError" id="mon-dept-error" class="mt-1.5 text-xs leading-relaxed text-(--status-danger-fg)">Pilihan divisi gagal dimuat.</p>
                </div>

                <div>
                    <span id="mon-type-label" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Jenis cuti</span>
                    <Select
                        v-model="leaveTypeFilter"
                        :options="leaveTypeOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Semua Jenis Cuti"
                        ariaLabelledby="mon-type-label"
                        class="w-full !min-h-11 sm:!min-h-9"
                        :disabled="loading || leaveTypesError"
                        :aria-describedby="leaveTypesError ? 'mon-type-error' : undefined"
                        size="small"
                    />
                    <p v-if="leaveTypesError" id="mon-type-error" class="mt-1.5 text-xs leading-relaxed text-(--status-danger-fg)">Pilihan jenis cuti gagal dimuat.</p>
                </div>

                <div>
                    <span class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1" aria-hidden="true">Rentang tanggal cuti</span>
                    <DatePicker
                        v-model="dateRange"
                        selectionMode="range"
                        :manualInput="false"
                        dateFormat="dd M yy"
                        placeholder="Pilih rentang"
                        showIcon
                        iconDisplay="input"
                        showButtonBar
                        size="small"
                        fluid
                        inputClass="!min-h-11 sm:!min-h-9"
                        aria-label="Rentang tanggal cuti"
                    />
                </div>
            </div>

            <div v-if="leaveTypesError || (isSuper && !adminDivision && departmentsError)" role="alert" class="flex flex-wrap items-center justify-between gap-3 text-sm leading-relaxed text-surface-700 dark:text-surface-300">
                <p>Sebagian pilihan filter tidak tersedia. Pilihan sebelumnya tetap tersimpan; filter lain masih dapat digunakan.</p>
                <Button label="Coba lagi filter" severity="secondary" outlined size="small" class="!min-h-11 shrink-0" :loading="loading" @click="emit('refresh')" />
            </div>

            <!-- Status sebagai baris pilihan cepat dengan jumlah per status (audit-019 #2). -->
            <div role="group" aria-labelledby="mon-status-label" class="flex flex-wrap items-center gap-2">
                <span id="mon-status-label" class="text-xs font-medium text-surface-700 dark:text-surface-300 mr-1">Status</span>
                <button
                    v-for="s in statusChips"
                    :key="s.value ?? 'all'"
                    type="button"
                    class="inline-flex items-center gap-1.5 min-h-11 sm:min-h-9 px-3 rounded-border border text-xs font-medium cursor-pointer transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    :class="statusFilter === s.value
                        ? 'border-primary bg-primary-50 text-primary-700 dark:bg-primary/10 dark:text-primary'
                        : 'border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'"
                    :aria-pressed="statusFilter === s.value"
                    @click="statusFilter = s.value"
                >
                    {{ s.label }}
                    <span class="tabular-nums text-surface-600 dark:text-surface-400" :class="{ '!text-current': statusFilter === s.value }">{{ loadError && !staleData ? '–' : s.count }}</span>
                </button>
            </div>
        </div>

        <div data-tour="mon-table" class="space-y-2">
            <!-- Baris hasil menempel pada tabel yang dihitungnya (audit-019 #3). -->
            <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-color">
                <span role="status">Menampilkan <span class="font-semibold text-surface-900 dark:text-surface-100 tabular-nums">{{ loadError && !staleData ? '–' : filteredRequests.length }}</span> pengajuan<template v-if="staleData"> · data terakhir</template></span>
                <Button v-if="hasFilters" label="Atur ulang filter" severity="secondary" text size="small" class="text-xs !min-h-11 sm:!min-h-9" @click="resetFilters" />
            </div>

            <!-- Lima kolom berpusat pada karyawan; tabel mulai xl (lebar konten setelah sidebar), daftar bertumpuk di bawahnya (audit-019 #4). -->
            <div class="hidden xl:block">
                <DataTable
                    :value="filteredRequests"
                    :loading="loading"
                    paginator
                    :rows="10"
                    class="p-datatable-sm text-sm"
                    responsiveLayout="scroll"
                >
                    <template #empty>
                        <div class="text-center py-8 text-muted-color">
                            <p>{{ emptyText }}</p>
                            <Button v-if="hasFilters && (!loadError || staleData)" label="Atur ulang filter" severity="secondary" outlined size="small" class="mt-3 text-xs !min-h-11" @click="resetFilters" />
                        </div>
                    </template>

                    <Column header="Karyawan" style="min-width: 14rem">
                        <template #body="{ data }">
                            <div class="font-semibold text-surface-900 dark:text-surface-100">{{ data.requester_name || data.userName }}</div>
                            <div class="text-xs text-muted-color">NIK {{ data.namecode || '-' }}<template v-if="data.kd_dept"> · {{ data.kd_dept }}</template></div>
                        </template>
                    </Column>

                    <Column header="Cuti" style="min-width: 15rem">
                        <template #body="{ data }">
                            <div class="text-surface-900 dark:text-surface-100">{{ data.nm_leave_type || data.leaveTypeName || data.kd_leave_type }}</div>
                            <div class="text-xs text-muted-color">{{ dateRangeLabel(data) }} · <span class="tabular-nums">{{ data.total_days || data.totalDays }}</span> hari kerja</div>
                        </template>
                    </Column>

                    <Column header="Pengajuan" style="min-width: 11rem">
                        <template #body="{ data }">
                            <div class="font-mono text-xs whitespace-nowrap text-surface-800 dark:text-surface-200">{{ data.id_request || data.id }}</div>
                            <div class="text-xs text-muted-color">Diajukan {{ formatDate(data.created_at || data.createdAt) }}</div>
                        </template>
                    </Column>

                    <Column header="Status" style="width: 1%; white-space: nowrap">
                        <template #body="{ data }">
                            <Tag :value="getStatusLabel(data.status)" :severity="getStatusSeverity(data.status)" />
                        </template>
                    </Column>

                    <Column header="Aksi" style="width: 1%" :pt="{ headerCell: { 'data-tour': 'mon-col-aksi', class: 'text-right' }, bodyCell: { class: 'text-right' } }">
                        <template #body="{ data }">
                            <Button
                                size="small"
                                severity="secondary"
                                text
                                class="text-xs font-semibold !min-h-9 px-2.5 inline-flex items-center gap-1 whitespace-nowrap"
                                :aria-label="`Detail ${data.id_request || data.id}`"
                                @click="emit('view-detail', data)"
                            >
                                <PhEye :size="14" weight="bold" aria-hidden="true" />
                                <span>Detail</span>
                            </Button>
                        </template>
                    </Column>
                </DataTable>
            </div>

            <div class="xl:hidden" :aria-busy="loading">
                <div v-if="!filteredRequests.length" class="py-8 text-center text-xs text-muted-color">
                    <p>{{ emptyText }}</p>
                    <Button v-if="hasFilters && (!loadError || staleData)" label="Atur ulang filter" severity="secondary" outlined size="small" class="mt-3 text-xs !min-h-11" @click="resetFilters" />
                </div>
                <ul v-else class="divide-y divide-surface-200 dark:divide-surface-700" :class="{ 'opacity-60': loading }">
                    <li v-for="(r, i) in mobileRows" :key="r.id_request || r.id" class="py-3 space-y-1.5 text-xs">
                        <div class="flex items-start justify-between gap-2">
                            <div class="min-w-0">
                                <div class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ r.requester_name || r.userName }}</div>
                                <div class="text-muted-color">NIK {{ r.namecode || '-' }}<template v-if="r.kd_dept"> · {{ r.kd_dept }}</template></div>
                            </div>
                            <Tag :value="getStatusLabel(r.status)" :severity="getStatusSeverity(r.status)" />
                        </div>
                        <div class="text-surface-800 dark:text-surface-200">{{ r.nm_leave_type || r.leaveTypeName || r.kd_leave_type }} · {{ dateRangeLabel(r) }} · {{ r.total_days || r.totalDays }} hari kerja</div>
                        <div class="flex items-center justify-between gap-2">
                            <div class="min-w-0">
                                <div class="font-mono text-muted-color break-all">{{ r.id_request || r.id }}</div>
                                <div class="mt-1 text-muted-color">Diajukan {{ formatDate(r.created_at || r.createdAt) }}</div>
                            </div>
                            <!-- Anchor tour kolom Aksi juga di item pertama, karena header tabel tersembunyi di bawah xl. -->
                            <Button
                                size="small"
                                severity="secondary"
                                outlined
                                class="text-xs !min-h-11 shrink-0 flex items-center gap-1"
                                :data-tour="i === 0 ? 'mon-col-aksi' : undefined"
                                :aria-label="`Detail ${r.id_request || r.id}`"
                                @click="emit('view-detail', r)"
                            >
                                <PhEye :size="14" weight="bold" aria-hidden="true" />
                                <span>Detail</span>
                            </Button>
                        </div>
                    </li>
                </ul>
                <Button
                    v-if="filteredRequests.length > mobileLimit"
                    :label="`Tampilkan ${Math.min(10, filteredRequests.length - mobileLimit)} lagi`"
                    severity="secondary"
                    text
                    size="small"
                    class="w-full mt-2 text-xs !min-h-11"
                    @click="mobileLimit += 10"
                />
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import {
    formatDate,
    getStatusLabel,
    getStatusSeverity,
    STATUS_OPTIONS
} from '@/service/sicutiService';
import { PhMagnifyingGlass, PhEye } from '@phosphor-icons/vue';

const props = defineProps({
    requests: {
        type: Array,
        default: () => []
    },
    loading: {
        type: Boolean,
        default: false
    },
    adminDivision: {
        type: String,
        default: ''
    },
    departments: {
        type: Array,
        default: () => []
    },
    leaveTypes: {
        type: Array,
        default: () => []
    },
    isSuper: {
        type: Boolean,
        default: false
    },
    // Opsional: parent memberi tahu data gagal dimuat agar tabel tidak menulis "tidak ada" (audit-018 #2).
    loadError: {
        type: Boolean,
        default: false
    },
    staleData: {
        type: Boolean,
        default: false
    },
    leaveTypesError: {
        type: Boolean,
        default: false
    },
    departmentsError: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['view-detail', 'refresh']);

const searchQuery = ref('');
const statusFilter = ref(null);
const leaveTypeFilter = ref(null);
const departmentFilter = ref(null);
const dateRange = ref(null);

const leaveTypeOptions = computed(() => [
    { label: 'Semua Jenis Cuti', value: null },
    ...(props.leaveTypes || []).map((t) => ({
        label: t.nm_leave_type || t.name,
        value: t.kd_leave_type || t.id
    }))
]);

// Semua filter kecuali status; dipakai untuk hasil akhir dan untuk jumlah per status (audit-019 #2).
function matchesNonStatus(r) {
    if (props.adminDivision && r.kd_dept && r.kd_dept !== props.adminDivision) return false;
    if (departmentFilter.value && r.kd_dept !== departmentFilter.value) return false;

    if (leaveTypeFilter.value) {
        const matchCode = (r.kd_leave_type || r.leaveTypeId) === leaveTypeFilter.value;
        const matchName = (r.nm_leave_type || r.leaveTypeName) === leaveTypeFilter.value;
        if (!matchCode && !matchName) return false;
    }

    if (dateRange.value && dateRange.value[0]) {
        const filterStart = new Date(dateRange.value[0]);
        filterStart.setHours(0, 0, 0, 0);
        const filterEnd = dateRange.value[1] ? new Date(dateRange.value[1]) : new Date(filterStart);
        filterEnd.setHours(23, 59, 59, 999);

        const rStart = new Date(r.start_date || r.startDate);
        const rEnd = new Date(r.end_date || r.endDate || r.start_date || r.startDate);
        if (rEnd < filterStart || rStart > filterEnd) return false;
    }

    if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase().trim();
        const id = (r.id_request || r.id || '').toLowerCase();
        const name = (r.requester_name || r.userName || '').toLowerCase();
        const nik = (r.namecode || '').toLowerCase();
        return id.includes(q) || name.includes(q) || nik.includes(q);
    }

    return true;
}

const baseRequests = computed(() => (props.requests || []).filter(matchesNonStatus));
const filteredRequests = computed(() =>
    statusFilter.value ? baseRequests.value.filter((r) => r.status === statusFilter.value) : baseRequests.value
);

// Baris status: "Semua" + status yang punya data (atau sedang dipilih), dengan jumlahnya.
const statusChips = computed(() => {
    const counts = {};
    for (const r of baseRequests.value) counts[r.status] = (counts[r.status] || 0) + 1;
    return [
        { label: 'Semua', value: null, count: baseRequests.value.length },
        ...STATUS_OPTIONS.filter((o) => o.value && (counts[o.value] || statusFilter.value === o.value)).map((o) => ({
            label: o.label,
            value: o.value,
            count: counts[o.value] || 0
        }))
    ];
});

const hasFilters = computed(() =>
    Boolean(searchQuery.value.trim() || statusFilter.value || leaveTypeFilter.value || departmentFilter.value || dateRange.value?.[0])
);

function resetFilters() {
    searchQuery.value = '';
    statusFilter.value = null;
    leaveTypeFilter.value = null;
    departmentFilter.value = null;
    dateRange.value = null;
}

const emptyText = computed(() => {
    if (props.loading) return 'Memuat pengajuan…';
    if (props.loadError && !props.staleData) return 'Data pengajuan belum termuat.';
    if (hasFilters.value) return 'Tidak ada pengajuan yang cocok dengan filter.';
    return 'Belum ada pengajuan cuti.';
});

// Cuti satu hari ditulis satu tanggal, bukan "X s/d X" (audit-018 #6).
function dateRangeLabel(r) {
    const start = r.start_date || r.startDate;
    const end = r.end_date || r.endDate || start;
    return String(start).slice(0, 10) === String(end).slice(0, 10) ? formatDate(start) : `${formatDate(start)} s/d ${formatDate(end)}`;
}

// Daftar HP dibatasi 10 per tampilan, menggantikan paginator tabel.
const mobileLimit = ref(10);
const mobileRows = computed(() => filteredRequests.value.slice(0, mobileLimit.value));
watch(filteredRequests, () => (mobileLimit.value = 10));

function isoDate(d) {
    if (!d) return undefined;
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

defineExpose({
    filteredCount: computed(() => filteredRequests.value.length),
    exportFilters: computed(() => ({
        kd_dept: departmentFilter.value || undefined,
        status: statusFilter.value || undefined,
        kd_leave_type: leaveTypeFilter.value || undefined,
        start_date: isoDate(dateRange.value?.[0]),
        end_date: isoDate(dateRange.value?.[1] || dateRange.value?.[0]),
        search: searchQuery.value.trim() || undefined
    }))
});
</script>

<style scoped>
.monitoring-table :deep(.p-select-label),
.monitoring-table :deep(.p-inputtext) {
    font-size: 1rem;
}

.monitoring-table :deep(.p-disabled),
.monitoring-table :deep(:disabled) {
    cursor: not-allowed;
}

@media (min-width: 576px) {
    .monitoring-table :deep(.p-select-label),
    .monitoring-table :deep(.p-inputtext) {
        font-size: 0.875rem;
    }
}
</style>
