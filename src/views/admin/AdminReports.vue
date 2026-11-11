<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import api from '@/service/api';
import { adminService } from '@/service/adminService';
import {
    getAdminDivision,
    currentUser,
    isSuperAdmin,
    formatDate,
    getStatusLabel,
    STATUS_OPTIONS,
    YEAR_OPTIONS
} from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { downloadExcel, printReportPdf } from '@/utils/reportExport';
import { PhFileXls, PhFileText, PhMagnifyingGlass, PhArrowsClockwise, PhChartBar } from '@phosphor-icons/vue';
import ReportLeaveHistoryTable from '@/components/admin/reports/ReportLeaveHistoryTable.vue';
import ReportBalanceTable from '@/components/admin/reports/ReportBalanceTable.vue';
import ReportLeaveTypeSummary from '@/components/admin/reports/ReportLeaveTypeSummary.vue';

const toast = useToast();
const loading = ref(false);
const summaryLoading = ref(false);
const exporting = ref(false);
const adminDivision = computed(() => getAdminDivision(currentUser.value));
const isSuper = computed(() => isSuperAdmin(currentUser.value));

const activeTab = ref(0);

const leaveReports = ref([]);
const balanceReports = ref([]);
const typeSummary = ref([]);
const leaveTypes = ref([]);
const departments = ref([]);

// Gagal per sumber, agar gagal dimuat tidak tampil sebagai angka 0 (audit-022 #1).
const requestsError = ref(false);
const balancesError = ref(false);
const summaryError = ref(false);
const leaveTypesError = ref(false);
const departmentsError = ref(false);

const selectedYear = ref(new Date().getFullYear());
const yearOptions = YEAR_OPTIONS;
const departmentFilter = ref(null);
const leaveTypeFilter = ref(null);
const statusFilter = ref(null);
const searchQuery = ref('');
const dateRange = ref(null);
const statusOptions = STATUS_OPTIONS;

function iso(d) {
    if (!d) return undefined;
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
const rangeStart = computed(() => iso(dateRange.value?.[0]));
const rangeEnd = computed(() => iso(dateRange.value?.[1] || dateRange.value?.[0]));
const targetDept = computed(() => adminDivision.value || departmentFilter.value || null);

// Ekspor hanya membawa filter yang terlihat di tab aktif, sehingga berkas sama dengan layar (audit-022 #2).
const exportParams = computed(() => {
    const base = { year: selectedYear.value, kd_dept: targetDept.value || undefined };
    const search = searchQuery.value.trim() || undefined;
    if (activeTab.value === 0) {
        return {
            ...base,
            kd_leave_type: leaveTypeFilter.value || undefined,
            status: statusFilter.value || undefined,
            start_date: rangeStart.value,
            end_date: rangeEnd.value,
            search
        };
    }
    if (activeTab.value === 1) return { ...base, search };
    return { ...base, start_date: rangeStart.value, end_date: rangeEnd.value };
});

async function loadSummary() {
    summaryLoading.value = true;
    summaryError.value = false;
    try {
        const res = await api.get('/sicuti/report/leave-type-summary', {
            year: selectedYear.value,
            kd_dept: targetDept.value || undefined,
            start_date: rangeStart.value,
            end_date: rangeEnd.value
        });
        typeSummary.value = Array.isArray(res?.data) ? res.data : [];
    } catch {
        typeSummary.value = [];
        summaryError.value = true;
    } finally {
        summaryLoading.value = false;
    }
}

async function loadData() {
    loading.value = true;
    requestsError.value = false;
    balancesError.value = false;
    leaveTypesError.value = false;
    departmentsError.value = false;
    // Pemanggilan dan parameter sama; tiap sumber kini dicatat gagal/berhasil sendiri.
    const [rep, bal, types, depts] = await Promise.allSettled([
        adminService.getLeaveRequests({ year: selectedYear.value }),
        adminService.getBalances(selectedYear.value),
        adminService.getLeaveTypes(),
        adminService.getDepartments()
    ]);
    if (rep.status === 'fulfilled') {
        leaveReports.value = Array.isArray(rep.value) ? rep.value : [];
    } else {
        leaveReports.value = [];
        requestsError.value = true;
    }
    if (bal.status === 'fulfilled') {
        balanceReports.value = Array.isArray(bal.value) ? bal.value : [];
    } else {
        balanceReports.value = [];
        balancesError.value = true;
    }
    if (types.status === 'fulfilled') leaveTypes.value = Array.isArray(types.value) ? types.value : [];
    else leaveTypesError.value = true;
    if (depts.status === 'fulfilled') departments.value = Array.isArray(depts.value) ? depts.value : [];
    else departmentsError.value = true;

    await loadSummary();
    loading.value = false;

    if (rep.status === 'rejected' || bal.status === 'rejected' || summaryError.value) {
        const err = rep.reason || bal.reason;
        toast.add({ severity: 'error', summary: 'Gagal Memuat Laporan', detail: err?.message || 'Sebagian data laporan gagal dimuat', life: 3000 });
    }
}

watch(selectedYear, loadData);
watch([departmentFilter, dateRange], loadSummary);

const leaveTypeOptions = computed(() => [
    { label: 'Semua Jenis Cuti', value: null },
    ...leaveTypes.value.map((t) => ({ label: t.nm_leave_type || t.name, value: t.kd_leave_type || t.id }))
]);

const departmentOptions = computed(() => [{ label: 'Semua Divisi', value: null }, ...departments.value.map((d) => ({ label: `${d.nm_dept} (${d.kd_dept})`, value: d.kd_dept }))]);

const filteredLeaveReports = computed(() =>
    leaveReports.value.filter((r) => {
        if (targetDept.value && r.kd_dept !== targetDept.value) return false;
        if (leaveTypeFilter.value && r.kd_leave_type !== leaveTypeFilter.value) return false;
        if (statusFilter.value && r.status !== statusFilter.value) return false;
        const s = String(r.start_date || '').slice(0, 10);
        const e = String(r.end_date || r.start_date || '').slice(0, 10);
        if (rangeStart.value && e < rangeStart.value) return false;
        if (rangeEnd.value && s > rangeEnd.value) return false;
        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase();
            const hay = `${r.requester_name || ''} ${r.namecode || ''} ${r.id_request || ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    })
);

const filteredBalanceReports = computed(() =>
    balanceReports.value.filter((b) => {
        if (targetDept.value && b.kd_dept !== targetDept.value) return false;
        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase();
            if (!`${b.nama || ''} ${b.namecode || ''}`.toLowerCase().includes(q)) return false;
        }
        return true;
    })
);

// Per tab: jumlah baris, status gagal, dan filter yang terlihat.
const tabs = computed(() => [
    { label: 'Riwayat Cuti', count: filteredLeaveReports.value.length, error: requestsError.value },
    { label: 'Saldo Karyawan', count: filteredBalanceReports.value.length, error: balancesError.value },
    { label: 'Rekap per Jenis Cuti', count: typeSummary.value.length, error: summaryError.value }
]);
const activeError = computed(() => tabs.value[activeTab.value].error);
const activeLoading = computed(() => loading.value || (activeTab.value === 2 && summaryLoading.value));

const hasFilters = computed(() => {
    const dept = !adminDivision.value && departmentFilter.value;
    if (activeTab.value === 0) return Boolean(searchQuery.value.trim() || dept || dateRange.value || leaveTypeFilter.value || statusFilter.value);
    if (activeTab.value === 1) return Boolean(searchQuery.value.trim() || dept);
    return Boolean(dept || dateRange.value);
});

function resetFilters() {
    searchQuery.value = '';
    departmentFilter.value = null;
    dateRange.value = null;
    leaveTypeFilter.value = null;
    statusFilter.value = null;
}

const emptyText = computed(() => {
    if (activeLoading.value) return 'Memuat data laporan...';
    if (activeError.value) return 'Data laporan belum termuat.';
    if (hasFilters.value) return 'Tidak ada data yang cocok dengan pencarian atau filter.';
    return ['Belum ada pengajuan cuti pada tahun ini.', 'Belum ada data saldo cuti pada tahun ini.', 'Belum ada jenis cuti.'][activeTab.value];
});

const remaining = (b) => (b.remaining !== undefined ? b.remaining : Number(b.annual_quota || 0) + Number(b.carry_over_days || 0) - Number(b.used_days || 0));
const scopeLabel = computed(() => {
    const parts = [targetDept.value ? `Divisi ${targetDept.value}` : 'Semua divisi', `Tahun ${selectedYear.value}`];
    if (rangeStart.value && activeTab.value !== 1) parts.push(`${formatDate(rangeStart.value)} – ${formatDate(rangeEnd.value)}`);
    return parts.join(' · ');
});

// Ekspor ditolak bila data tab gagal dimuat atau kosong (audit-022 #3, pola item 06/12).
function canExport() {
    if (activeError.value) {
        toast.add({ severity: 'warn', summary: 'Data belum termuat', detail: 'Muat ulang data laporan sebelum mengekspor.', life: 3000 });
        return false;
    }
    if (!tabs.value[activeTab.value].count) {
        toast.add({ severity: 'warn', summary: 'Tidak ada data', detail: 'Tidak ada data yang sesuai filter untuk diekspor.', life: 3000 });
        return false;
    }
    return true;
}

async function exportExcel() {
    if (!canExport()) return;
    exporting.value = true;
    try {
        const types = ['leave-request', 'leave-balance', 'leave-type-summary'];
        const filenames = [
            `laporan_cuti_${selectedYear.value}.xlsx`,
            `rekap_saldo_${selectedYear.value}.xlsx`,
            `rekap_jenis_cuti_${selectedYear.value}.xlsx`
        ];
        await downloadExcel('/sicuti/report/export', { type: types[activeTab.value], ...exportParams.value }, filenames[activeTab.value]);
        toast.add({ severity: 'success', summary: 'Ekspor Berhasil', detail: 'Berkas Excel (.xlsx) diunduh.', life: 3000 });
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal Ekspor', detail: err.message, life: 4000 });
    } finally {
        exporting.value = false;
    }
}

function exportPdf() {
    if (!canExport()) return;
    const configs = [
        {
            title: 'Laporan Rekapitulasi Riwayat Cuti',
            filename: `laporan_cuti_${selectedYear.value}`,
            rows: filteredLeaveReports.value,
            columns: [
                { header: 'No. Pengajuan', value: (r) => r.id_request },
                { header: 'Nama', value: (r) => r.requester_name },
                { header: 'NIK', value: (r) => r.namecode || '-' },
                { header: 'Divisi', value: (r) => r.kd_dept || '-' },
                { header: 'Jenis Cuti', value: (r) => r.nm_leave_type },
                { header: 'Mulai', value: (r) => formatDate(r.start_date) },
                { header: 'Selesai', value: (r) => formatDate(r.end_date) },
                { header: 'Hari', value: (r) => r.total_days },
                { header: 'Status', value: (r) => getStatusLabel(r.status) }
            ]
        },
        {
            title: 'Laporan Rekapitulasi Saldo Cuti Karyawan',
            filename: `rekap_saldo_${selectedYear.value}`,
            rows: filteredBalanceReports.value,
            columns: [
                { header: 'NIK', value: (b) => b.namecode || '-' },
                { header: 'Nama Karyawan', value: (b) => b.nama },
                { header: 'Divisi', value: (b) => b.kd_dept || '-' },
                // Terpakai dihitung per periode cuti karyawan; kolom sama dengan berkas CSV backend (audit-022 #10).
                { header: 'Periode', value: (b) => b.period_label || '-' },
                { header: 'Kuota', value: (b) => b.annual_quota },
                { header: 'Carry Over', value: (b) => b.carry_over_days || 0 },
                { header: 'Terpakai', value: (b) => b.used_days || 0 },
                { header: 'Sisa', value: remaining }
            ]
        },
        {
            title: 'Laporan Rekap Penggunaan per Jenis Cuti',
            filename: `rekap_jenis_cuti_${selectedYear.value}`,
            rows: typeSummary.value,
            columns: [
                { header: 'Jenis Cuti', value: (s) => s.nm_leave_type },
                { header: 'Total Pengajuan', value: (s) => s.total },
                { header: 'Disetujui', value: (s) => s.approved },
                { header: 'Ditolak', value: (s) => s.rejected },
                { header: 'Dibatalkan', value: (s) => s.cancelled },
                { header: 'Dalam Proses', value: (s) => s.pending },
                { header: 'Total Hari Disetujui', value: (s) => s.approved_days }
            ]
        }
    ];
    const cfg = configs[activeTab.value];
    if (!printReportPdf({ ...cfg, subtitle: scopeLabel.value })) {
        toast.add({ severity: 'warn', summary: 'Jendela Diblokir', detail: 'Izinkan pop-up untuk mencetak laporan PDF.', life: 4000 });
    }
}

onMounted(loadData);
</script>

<template>
    <div class="space-y-6">
        <!-- Satu kartu: judul dan aksi, tab, filter, lalu hasil (acuan 00b §6.1, audit-022 #8). -->
        <div class="card !mb-0">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                        <PhChartBar :size="22" weight="regular" class="text-primary shrink-0" aria-hidden="true" />
                        <span>Laporan & Ekspor Data Cuti</span>
                    </h1>
                    <p class="text-xs text-muted-color">
                        Rekapitulasi riwayat pengajuan, saldo, dan penggunaan per jenis cuti<template v-if="adminDivision"> Divisi {{ adminDivision }}</template>. Ekspor mengikuti tab dan filter yang terlihat.
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <Button severity="secondary" outlined size="small" class="text-xs font-semibold flex items-center gap-1.5 !min-h-11 sm:!min-h-9" :loading="loading" @click="loadData">
                        <PhArrowsClockwise :size="14" weight="bold" aria-hidden="true" />
                        <span>Segarkan</span>
                    </Button>
                    <Button data-tour="rep-pdf" severity="secondary" outlined size="small" class="text-xs font-semibold flex items-center gap-1.5 !min-h-11 sm:!min-h-9" :disabled="activeLoading" @click="exportPdf">
                        <PhFileText :size="14" weight="bold" aria-hidden="true" />
                        <span>Ekspor PDF</span>
                    </Button>
                    <Button data-tour="export-excel" severity="success" size="small" class="text-xs font-bold flex items-center gap-1.5 !min-h-11 sm:!min-h-9" :disabled="activeLoading" :loading="exporting" @click="exportExcel">
                        <PhFileXls :size="14" weight="bold" aria-hidden="true" />
                        <span>Ekspor Excel</span>
                    </Button>
                </div>
            </div>

            <!-- Tabs PrimeVue: role tab/tabpanel, aria-controls, dan navigasi panah/Home/End bawaan (audit-022 #4). -->
            <Tabs v-model:value="activeTab" class="mt-6">
                <TabList data-tour="rep-tabs" aria-label="Jenis laporan">
                    <!-- Di HP ketiga tab berbagi lebar dan labelnya membungkus, agar tidak ada tab yang tersembunyi di balik gulir. -->
                    <Tab v-for="(t, i) in tabs" :key="t.label" :value="i" class="!min-h-11 text-sm flex-1 sm:flex-none !whitespace-normal !px-2 sm:!px-4 flex flex-col sm:flex-row items-center justify-center text-center gap-x-2 leading-tight">
                        <span>{{ t.label }}</span>
                        <span class="text-xs font-normal tabular-nums text-surface-600 dark:text-surface-400">{{ loading || t.error ? '–' : t.count }}</span>
                    </Tab>
                </TabList>

                <div data-tour="rep-filters" class="mt-5 space-y-3">
                    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                        <div v-if="activeTab !== 2">
                            <span class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1" aria-hidden="true">Cari</span>
                            <IconField iconPosition="left" class="w-full">
                                <InputIcon class="!flex items-center justify-center">
                                    <PhMagnifyingGlass :size="14" weight="bold" class="text-muted-color" aria-hidden="true" />
                                </InputIcon>
                                <InputText id="cari-laporan" name="cari-laporan" aria-label="Cari laporan berdasarkan karyawan atau NIK" v-model="searchQuery" placeholder="Cari Karyawan / NIK..." class="w-full text-xs !min-h-11 sm:!min-h-9" size="small" />
                            </IconField>
                        </div>
                        <div>
                            <span id="rep-year-label" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Tahun</span>
                            <Select v-model="selectedYear" :options="yearOptions" optionLabel="label" optionValue="value" placeholder="Pilih Tahun" ariaLabelledby="rep-year-label" class="w-full text-xs !min-h-11 sm:!min-h-9" size="small" />
                        </div>
                        <div v-if="adminDivision">
                            <span class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Divisi</span>
                            <p class="min-h-11 sm:min-h-9 flex items-center text-sm font-semibold text-surface-900 dark:text-surface-100">{{ adminDivision }}</p>
                        </div>
                        <div v-else-if="isSuper">
                            <span id="rep-dept-label" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Divisi</span>
                            <Select
                                v-model="departmentFilter"
                                :options="departmentOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="Semua Divisi"
                                ariaLabelledby="rep-dept-label"
                                class="w-full text-xs !min-h-11 sm:!min-h-9"
                                :disabled="departmentsError && !departments.length"
                                size="small"
                            />
                        </div>
                        <div v-if="activeTab !== 1">
                            <span class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1" aria-hidden="true">Rentang tanggal cuti</span>
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
                                aria-label="Rentang tanggal cuti"
                            />
                        </div>
                        <template v-if="activeTab === 0">
                            <div>
                                <span id="rep-type-label" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Jenis cuti</span>
                                <Select v-model="leaveTypeFilter" :options="leaveTypeOptions" optionLabel="label" optionValue="value" placeholder="Semua Jenis Cuti" ariaLabelledby="rep-type-label" class="w-full text-xs !min-h-11 sm:!min-h-9" :disabled="leaveTypesError && !leaveTypes.length" size="small" />
                            </div>
                            <div>
                                <span id="rep-status-label" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Status</span>
                                <Select v-model="statusFilter" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="Semua Status" ariaLabelledby="rep-status-label" class="w-full text-xs !min-h-11 sm:!min-h-9" size="small" />
                            </div>
                        </template>
                    </div>

                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <p class="text-xs text-muted-color" aria-live="polite">
                            Menampilkan <span class="font-bold text-surface-900 dark:text-surface-100">{{ activeLoading || activeError ? '–' : tabs[activeTab].count }}</span>
                            {{ ['pengajuan', 'karyawan', 'jenis cuti'][activeTab] }}
                        </p>
                        <Button v-if="hasFilters" label="Atur ulang filter" severity="secondary" text size="small" class="text-xs !min-h-11 sm:!min-h-9" @click="resetFilters" />
                    </div>

                    <p v-if="(isSuper && !adminDivision && departmentsError) || (activeTab === 0 && leaveTypesError)" class="text-xs leading-relaxed text-(--status-danger-fg)">
                        Sebagian pilihan filter gagal dimuat. Tekan Segarkan untuk mencoba lagi.
                    </p>
                </div>

                <div v-if="activeError" role="alert" class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                    <span>Data {{ tabs[activeTab].label.toLowerCase() }} gagal dimuat. Angka dan ekspor belum tersedia.</span>
                    <Button label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11" :loading="activeLoading" @click="activeTab === 2 ? loadSummary() : loadData()" />
                </div>

                <TabPanels class="!px-0 !pb-0 mt-4">
                    <TabPanel :value="0">
                        <ReportLeaveHistoryTable data-tour="rep-table" :items="filteredLeaveReports" :loading="loading" :empty-text="emptyText" />
                    </TabPanel>
                    <TabPanel :value="1">
                        <ReportBalanceTable data-tour="rep-table" :items="filteredBalanceReports" :loading="loading" :empty-text="emptyText" />
                    </TabPanel>
                    <TabPanel :value="2">
                        <ReportLeaveTypeSummary data-tour="rep-table" :items="typeSummary" :loading="activeLoading" :empty-text="emptyText" :load-error="summaryError" />
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </div>
    </div>
</template>
