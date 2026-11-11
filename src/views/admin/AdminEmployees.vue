<script setup>
import { ref, computed, onMounted } from 'vue';
import { adminService } from '@/service/adminService';
import { getAdminDivision, currentUser, isSuperAdmin, can } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { PhMagnifyingGlass, PhUsers, PhArrowsClockwise, PhFileXls } from '@phosphor-icons/vue';
import { downloadExcel } from '@/utils/reportExport';
import ReadOnlyNotice from '@/components/common/ReadOnlyNotice.vue';
import StatusHistoryDialog from '@/components/admin/StatusHistoryDialog.vue';
import { isAccountActive, statusSummary } from '@/service/statusReason';

const toast = useToast();
const loading = ref(false);
const loadError = ref(false);
const exporting = ref(false);
const employees = ref([]);
const searchQuery = ref('');
const departmentFilter = ref(null);
const statusFilter = ref(null);

const adminDivision = computed(() => getAdminDivision(currentUser.value));
const isSuper = computed(() => isSuperAdmin(currentUser.value));
const canManage = computed(() => isSuper.value || can('master_data.manage_employees'));

const deptOptions = [
    { label: 'Semua Divisi', value: null },
    { label: 'Divisi SIT', value: 'SIT' },
    { label: 'Divisi SIS', value: 'SIS' }
];

const statusOptions = [
    { label: 'Semua Status', value: null },
    { label: 'Aktif', value: 'A' },
    { label: 'Nonaktif', value: 'N' }
];

const historyDialog = ref({ visible: false, user: null });
function openHistory(emp) {
    historyDialog.value = { visible: true, user: emp };
}

async function exportExcel() {
    const count = filteredEmployees.value.length;
    if (!count) {
        toast.add({ severity: 'warn', summary: 'Tidak ada data', detail: 'Tidak ada karyawan yang sesuai filter untuk diekspor.', life: 3000 });
        return;
    }
    exporting.value = true;
    try {
        await downloadExcel(
            '/master/user/export',
            {
                kd_dept: adminDivision.value || departmentFilter.value || undefined,
                status: statusFilter.value || undefined,
                search: searchQuery.value.trim() || undefined
            },
            'data_karyawan.xlsx'
        );
        toast.add({ severity: 'success', summary: 'Ekspor Berhasil', detail: `${count} data karyawan diekspor ke Excel.`, life: 3000 });
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal Ekspor', detail: err.message || 'Coba lagi beberapa saat.', life: 4000 });
    } finally {
        exporting.value = false;
    }
}

async function loadEmployees() {
    loading.value = true;
    loadError.value = false;
    try {
        const data = await adminService.getEmployees();
        employees.value = Array.isArray(data) ? data : [];
    } catch (err) {
        loadError.value = true;
        toast.add({
            severity: 'error',
            summary: 'Gagal Memuat Data',
            detail: err.message || 'Gagal mengambil data karyawan',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
}

const filteredEmployees = computed(() => {
    return employees.value.filter((emp) => {
        const targetDept = adminDivision.value || departmentFilter.value;
        if (targetDept && (emp.kd_dept || emp.department) !== targetDept) {
            return false;
        }

        if (statusFilter.value) {
            const st = emp.status_user || emp.status || (emp.isActive !== false ? 'A' : 'N');
            if (st !== statusFilter.value) return false;
        }

        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase();
            const name = (emp.nama || emp.name || '').toLowerCase();
            const nik = (emp.namecode || emp.username || '').toLowerCase();
            const email = (emp.email || '').toLowerCase();
            const pos = (emp.position || '').toLowerCase();
            if (!name.includes(q) && !nik.includes(q) && !email.includes(q) && !pos.includes(q)) {
                return false;
            }
        }

        return true;
    });
});

// Membedakan "tidak cocok dengan filter" dari "belum ada data" pada pesan tabel kosong.
const hasFilters = computed(() => Boolean(searchQuery.value.trim() || departmentFilter.value || statusFilter.value));

onMounted(() => {
    loadEmployees();
});
</script>

<template>
    <div class="space-y-6">
        <ReadOnlyNotice data-tour="readonly-notice" v-if="!canManage" module="data karyawan" />

        <!-- Satu kartu halaman: judul dan aksi, filter dan total, lalu tabel (acuan 00b §6.1, audit-011 #3). -->
        <div class="card !mb-0">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                        <PhUsers :size="22" weight="regular" class="text-primary shrink-0" aria-hidden="true" />
                        <span>Data Karyawan</span>
                    </h1>
                    <p class="text-xs text-muted-color">Direktori data pegawai (NIK, Nama, Email, Jabatan, Departemen, Status, dan Atasan)</p>
                </div>
                <div class="flex items-center gap-2">
                    <Button
                        severity="secondary"
                        outlined
                        size="small"
                        class="text-xs font-semibold flex items-center gap-1.5"
                        :loading="loading"
                        @click="loadEmployees"
                    >
                        <PhArrowsClockwise :size="14" weight="bold" aria-hidden="true" />
                        <span>Segarkan</span>
                    </Button>
                    <Button data-tour="export-excel"
                        severity="success"
                        size="small"
                        class="text-xs font-bold flex items-center gap-1.5"
                        :disabled="loading"
                        :loading="exporting"
                        @click="exportExcel"
                    >
                        <PhFileXls :size="14" weight="bold" aria-hidden="true" />
                        <span>Ekspor Excel</span>
                    </Button>
                </div>
            </div>

            <div data-tour="emp-filters" class="mt-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <IconField iconPosition="left" class="w-full sm:w-64">
                        <InputIcon class="!flex items-center justify-center">
                            <PhMagnifyingGlass :size="14" weight="bold" class="text-muted-color" aria-hidden="true" />
                        </InputIcon>
                        <InputText id="cari-karyawan" name="cari-karyawan" aria-label="Cari karyawan berdasarkan nama, NIK, atau email" v-model="searchQuery" placeholder="Cari Nama / NIK / Email..." class="w-full text-xs" size="small" />
                    </IconField>

                    <p v-if="adminDivision" class="text-xs text-muted-color">
                        Divisi: <span class="font-semibold text-surface-900 dark:text-surface-100">{{ adminDivision }}</span>
                    </p>
                    <Select
                        v-else-if="isSuper"
                        v-model="departmentFilter"
                        :options="deptOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Pilih Divisi"
                        class="w-full sm:w-44 text-xs"
                        size="small"
                    />

                    <Select
                        v-model="statusFilter"
                        :options="statusOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Pilih Status"
                        class="w-full sm:w-36 text-xs"
                        size="small"
                    />
                </div>
                <div class="text-xs text-muted-color w-full sm:w-auto text-right">
                    Total: <span class="font-bold text-surface-900 dark:text-surface-100">{{ loadError ? '–' : filteredEmployees.length }}</span> Karyawan
                </div>
            </div>

            <div v-if="loadError" role="alert" class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                <span>Data karyawan gagal dimuat. Daftar di bawah belum lengkap.</span>
                <Button label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11" :loading="loading" @click="loadEmployees" />
            </div>

            <div data-tour="emp-table" class="mt-4">
                <DataTable
                    :value="filteredEmployees"
                    :loading="loading"
                    paginator
                    :rows="10"
                    class="p-datatable-sm text-xs"
                    responsiveLayout="scroll"
                >
                    <template #empty>
                        <div class="text-center py-8 text-muted-color">
                            <template v-if="loadError">Data karyawan belum termuat.</template>
                            <template v-else-if="hasFilters">Tidak ada karyawan yang cocok dengan pencarian atau filter.</template>
                            <template v-else>Belum ada data karyawan.</template>
                        </div>
                    </template>

                    <Column header="NIK / Username" style="width: 15%">
                        <template #body="{ data }">
                            <span class="font-mono font-bold text-surface-900 dark:text-surface-100">
                                {{ data.namecode || data.username }}
                            </span>
                        </template>
                    </Column>

                    <Column header="Nama Lengkap & Email" style="width: 25%">
                        <template #body="{ data }">
                            <div class="font-bold text-surface-900 dark:text-surface-100">{{ data.nama || data.name }}</div>
                            <div class="text-xs text-muted-color">{{ data.email || '-' }}</div>
                        </template>
                    </Column>

                    <!-- Kode divisi adalah kategori, bukan status: teks biasa, warna hanya untuk status (audit-011 #4). -->
                    <Column header="Departemen / Divisi" style="width: 14%">
                        <template #body="{ data }">
                            <span class="font-semibold text-surface-800 dark:text-surface-200">{{ data.kd_dept || data.nm_dept || data.department || '-' }}</span>
                        </template>
                    </Column>

                    <Column header="Jabatan" style="width: 18%">
                        <template #body="{ data }">
                            <span class="text-surface-800 dark:text-surface-200">{{ data.position || '-' }}</span>
                        </template>
                    </Column>

                    <Column header="Atasan Langsung" style="width: 18%">
                        <template #body="{ data }">
                            <span v-if="data.supervisor_nama" class="font-medium text-surface-700 dark:text-surface-300">
                                {{ data.supervisor_nama }}
                            </span>
                            <span v-else class="text-muted-color">-</span>
                        </template>
                    </Column>

                    <Column header="Status" style="width: 10%" :pt="{ headerCell: { 'data-tour': 'emp-col-status' } }">
                        <template #body="{ data }">
                            <Tag v-if="data.is_locked" value="Terkunci" severity="danger" />
                            <Tag v-else :value="isAccountActive(data) ? 'Aktif' : 'Nonaktif'" :severity="isAccountActive(data) ? 'success' : 'secondary'" />
                            <button
                                v-if="statusSummary(data)"
                                type="button"
                                class="block mt-1 min-h-6 text-xs text-muted-color underline decoration-dotted underline-offset-2 hover:text-primary text-left leading-tight line-clamp-2 cursor-pointer"
                                :title="'Lihat riwayat status: ' + statusSummary(data)"
                                @click="openHistory(data)"
                            >
                                {{ statusSummary(data) }}
                            </button>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <StatusHistoryDialog v-model:visible="historyDialog.visible" :user="historyDialog.user" />
    </div>
</template>
