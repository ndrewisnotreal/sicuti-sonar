<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { adminService } from '@/service/adminService';
import {
    getAdminDivision,
    currentUser,
    isSuperAdmin,
    sicutiState
} from '@/service/sicutiService';
import LeaveDetailDialog from '@/components/leave/LeaveDetailDialog.vue';
import AdminDashboardMonitoringTable from '@/components/dashboard/AdminDashboardMonitoringTable.vue';
import { downloadExcel } from '@/utils/reportExport';
import { useToast } from 'primevue/usetoast';
import {
    PhClipboardText,
    PhArrowsClockwise,
    PhFileXls
} from '@phosphor-icons/vue';

const toast = useToast();
const loading = ref(false);
const loadError = ref(false);
const requests = ref([]);
const leaveTypes = ref([]);
const departments = ref([]);
const leaveTypesError = ref(false);
const departmentsError = ref(false);
const lastLoadedAt = ref(null);
let loadSequence = 0;

const staleData = computed(() => loadError.value && lastLoadedAt.value !== null);
const lastLoadedLabel = computed(() => lastLoadedAt.value
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'medium' }).format(lastLoadedAt.value)
    : '');

const adminDivision = computed(() => getAdminDivision(currentUser.value));
const isSuper = computed(() => isSuperAdmin(currentUser.value));

const selectedRequest = ref(null);
const detailVisible = ref(false);
const exporting = ref(false);

async function loadData() {
    const sequence = ++loadSequence;
    loading.value = true;
    const [leaves, types, depts] = await Promise.allSettled([
        adminService.getLeaveRequests(),
        adminService.getLeaveTypes(),
        adminService.getDepartments()
    ]);
    // Respons lama tidak boleh menimpa hasil refresh yang lebih baru.
    if (sequence !== loadSequence) return;

    loadError.value = leaves.status === 'rejected';
    leaveTypesError.value = types.status === 'rejected';
    departmentsError.value = depts.status === 'rejected';
    if (!loadError.value) {
        requests.value = Array.isArray(leaves.value) ? leaves.value : [];
        lastLoadedAt.value = new Date();
    } else {
        toast.add({
            severity: 'error',
            summary: 'Gagal Memuat Data',
            detail: leaves.reason?.message || 'Gagal mengambil data pemantauan cuti',
            life: 3000
        });
    }
    // Simpan pilihan sebelumnya saat sumber filter gagal; jangan diam-diam mengosongkannya.
    if (!leaveTypesError.value) leaveTypes.value = Array.isArray(types.value) ? types.value : [];
    if (!departmentsError.value) departments.value = Array.isArray(depts.value) ? depts.value : [];
    loading.value = false;
}

function viewDetail(req) {
    selectedRequest.value = req;
    detailVisible.value = true;
}

const tableRef = ref(null);

async function exportExcel() {
    if (loading.value || loadError.value || exporting.value) return;
    // Samakan dengan Data Karyawan: tidak mengunduh file kosong (audit-018 #7).
    if (!(tableRef.value?.filteredCount ?? requests.value.length)) {
        toast.add({ severity: 'warn', summary: 'Tidak ada data', detail: 'Tidak ada pengajuan yang sesuai filter untuk diekspor.', life: 3000 });
        return;
    }
    exporting.value = true;
    try {
        const filters = tableRef.value?.exportFilters || {};
        await downloadExcel(
            '/sicuti/report/export',
            { type: 'leave-request', ...filters, kd_dept: adminDivision.value || filters.kd_dept },
            'pemantauan_cuti.xlsx'
        );
        toast.add({ severity: 'success', summary: 'Ekspor Berhasil', detail: 'Data pemantauan sesuai filter diunduh sebagai Excel.', life: 3000 });
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Ekspor Gagal', detail: err.message || 'Coba lagi beberapa saat.', life: 4000 });
    } finally {
        exporting.value = false;
    }
}

onMounted(() => {
    loadData();
});
watch(() => sicutiState.dataVersion, loadData);
</script>

<template>
    <!-- Satu kartu halaman milik parent; filter dan tabel child menjadi bagiannya (00b §6.1, audit-018 #3). -->
    <div class="card !mb-0">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-surface-200 dark:border-surface-800 pb-5">
            <div>
                <h1 class="text-xl font-semibold text-surface-900 dark:text-surface-100 flex items-start gap-2">
                    <PhClipboardText :size="22" weight="regular" class="text-primary shrink-0 mt-1" aria-hidden="true" />
                    <span>Pemantauan Pengajuan Cuti</span>
                </h1>
                <!-- Tanpa klaim real-time: data dimuat saat dibuka, disegarkan, atau saat data berubah (audit-018 #5). -->
                <p class="mt-2 text-sm leading-relaxed text-surface-600 dark:text-surface-400">
                    Pantau pengajuan cuti karyawan<template v-if="adminDivision"> Divisi {{ adminDivision }}</template>. Tekan Segarkan untuk data terbaru.
                </p>
            </div>
            <div class="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                    severity="secondary"
                    outlined
                    size="small"
                    class="text-xs font-semibold !min-h-11 flex items-center gap-1.5"
                    :loading="loading"
                    @click="loadData"
                >
                    <PhArrowsClockwise :size="14" weight="bold" aria-hidden="true" />
                    <span>Segarkan</span>
                </Button>
                <Button
                    data-tour="export-excel"
                    severity="success"
                    size="small"
                    class="text-xs font-semibold !min-h-11 flex items-center gap-1.5"
                    :loading="exporting"
                    :disabled="loading || loadError"
                    :aria-describedby="loadError ? 'mon-load-error' : undefined"
                    @click="exportExcel"
                >
                    <PhFileXls :size="14" weight="bold" aria-hidden="true" />
                    <span>Ekspor Excel</span>
                </Button>
            </div>
        </div>

        <div v-if="loadError" id="mon-load-error" role="alert" class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-3 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
            <div class="min-w-0">
                <p class="font-semibold">{{ staleData ? 'Gagal memperbarui pengajuan.' : 'Data pengajuan gagal dimuat.' }}</p>
                <p v-if="staleData">Menampilkan data terakhir dimuat pada {{ lastLoadedLabel }}. Ekspor tersedia setelah data berhasil diperbarui.</p>
                <p v-else>Tekan Coba lagi untuk memuat daftar dan mengaktifkan ekspor.</p>
            </div>
            <Button label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11" :loading="loading" @click="loadData" />
        </div>

        <AdminDashboardMonitoringTable
            ref="tableRef"
            class="mt-6"
            :requests="requests"
            :loading="loading"
            :load-error="loadError"
            :stale-data="staleData"
            :leave-types-error="leaveTypesError"
            :departments-error="departmentsError"
            :admin-division="adminDivision"
            :departments="departments"
            :leave-types="leaveTypes"
            :is-super="isSuper"
            @view-detail="viewDetail"
            @refresh="loadData"
        />

        <LeaveDetailDialog
            v-model:visible="detailVisible"
            :request="selectedRequest"
            @refresh="loadData"
        />
    </div>
</template>
