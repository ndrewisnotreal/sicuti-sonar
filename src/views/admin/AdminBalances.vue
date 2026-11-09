<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { adminService } from '@/service/adminService';
import { getAdminDivision, currentUser, isSuperAdmin, can, YEAR_OPTIONS, formatDate } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { PhWallet, PhMagnifyingGlass, PhPencilSimple, PhArrowsClockwise, PhClockCounterClockwise } from '@phosphor-icons/vue';
import ReadOnlyNotice from '@/components/common/ReadOnlyNotice.vue';
import BalanceEditDialog from '@/components/admin/BalanceEditDialog.vue';
import BalanceHistoryDialog from '@/components/admin/BalanceHistoryDialog.vue';

const toast = useToast();
const loading = ref(false);
const loadError = ref(false);
const departmentsError = ref(false);
const balances = ref([]);
const departments = ref([]);

const adminDivision = computed(() => getAdminDivision(currentUser.value));
const isSuper = computed(() => isSuperAdmin(currentUser.value));
const canManage = computed(() => isSuper.value || can('master_data.manage_balance'));

const selectedYear = ref(new Date().getFullYear());
const yearOptions = YEAR_OPTIONS;

const searchQuery = ref('');
const departmentFilter = ref(null);

const editDialogVisible = ref(false);
const historyDialogVisible = ref(false);
const selectedBalance = ref(null);

async function loadBalances() {
    loading.value = true;
    loadError.value = false;
    departmentsError.value = false;
    try {
        const [balData, deptsData] = await Promise.all([
            adminService.getBalances(selectedYear.value),
            // Kegagalan daftar divisi ditandai sendiri, tidak lagi menjadi array kosong diam-diam (audit-021 #2).
            adminService.getDepartments().catch(() => {
                departmentsError.value = true;
                return null;
            })
        ]);

        balances.value = Array.isArray(balData) ? balData : [];
        if (deptsData) departments.value = Array.isArray(deptsData) ? deptsData : [];
    } catch (err) {
        loadError.value = true;
        // Dikosongkan agar saldo tahun sebelumnya tidak tampil di bawah tahun yang baru dipilih (audit-021 #2).
        balances.value = [];
        toast.add({
            severity: 'error',
            summary: 'Gagal Memuat Saldo',
            detail: err.message || 'Gagal mengambil data saldo cuti karyawan',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
}

watch(selectedYear, () => {
    loadBalances();
});

const filteredBalances = computed(() => {
    return balances.value.filter((b) => {
        const targetDept = adminDivision.value || departmentFilter.value;
        if (targetDept && b.kd_dept !== targetDept) {
            return false;
        }

        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase();
            const name = (b.nama || '').toLowerCase();
            const nik = (b.namecode || '').toLowerCase();
            if (!name.includes(q) && !nik.includes(q)) {
                return false;
            }
        }

        return true;
    });
});

const departmentOptions = computed(() => [{ label: 'Semua Divisi', value: null }, ...departments.value.map((d) => ({ label: `${d.nm_dept} (${d.kd_dept})`, value: d.kd_dept }))]);

const hasFilters = computed(() => Boolean(searchQuery.value.trim() || departmentFilter.value));

function resetFilters() {
    searchQuery.value = '';
    departmentFilter.value = null;
}

const emptyText = computed(() => {
    if (loading.value) return 'Memuat data saldo...';
    if (loadError.value) return 'Data saldo belum termuat.';
    if (hasFilters.value) return 'Tidak ada karyawan yang cocok dengan pencarian atau filter.';
    return 'Belum ada data saldo cuti untuk tahun ini.';
});

// Rumus tampilan tetap sama dengan sebelumnya; backend selalu mengirim `remaining`.
function remainingOf(b) {
    return b.remaining ?? Math.max(0, Number(b.annual_quota || 0) + Number(b.carry_over_days || 0) - Number(b.used_days || 0));
}

// Tanggal kadaluarsa hanya berarti bila masih ada carry over (audit-021 #12).
function carryOverExpiry(b) {
    return Number(b.carry_over_days || 0) > 0 && b.carry_over_expiry_date ? formatDate(String(b.carry_over_expiry_date).slice(0, 10)) : '';
}

// Daftar bertumpuk di HP dimuat bertahap, pengganti paginator tabel.
const mobileLimit = ref(10);
watch([searchQuery, departmentFilter, balances], () => {
    mobileLimit.value = 10;
});
const mobileRows = computed(() => filteredBalances.value.slice(0, mobileLimit.value));

function openEdit(item) {
    selectedBalance.value = item;
    editDialogVisible.value = true;
}

function openHistory(item) {
    selectedBalance.value = item;
    historyDialogVisible.value = true;
}

onMounted(() => {
    loadBalances();
});
</script>

<template>
    <div class="space-y-6">
        <ReadOnlyNotice data-tour="readonly-notice" v-if="!canManage" module="saldo cuti" />

        <!-- Satu kartu halaman: judul dan aksi, filter dan total, lalu tabel (acuan 00b §6.1, audit-021 #9). -->
        <div class="card !mb-0">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                        <PhWallet :size="22" weight="regular" class="text-primary shrink-0" aria-hidden="true" />
                        <span>Manajemen Saldo Cuti Karyawan</span>
                    </h1>
                    <p class="text-xs text-muted-color">
                        Pantau kuota tahunan, pemakaian, dan sesuaikan saldo cuti karyawan<template v-if="adminDivision"> Divisi {{ adminDivision }}</template>. Cuti terpakai dihitung dalam periode cuti masing-masing karyawan.
                    </p>
                </div>
                <div class="flex items-center gap-2">
                    <Button
                        severity="secondary"
                        outlined
                        size="small"
                        class="text-xs font-semibold flex items-center gap-1.5 !min-h-11 sm:!min-h-9"
                        :loading="loading"
                        @click="loadBalances"
                    >
                        <PhArrowsClockwise :size="14" weight="bold" aria-hidden="true" />
                        <span>Segarkan</span>
                    </Button>
                </div>
            </div>

            <div data-tour="bal-filters" class="mt-6 space-y-3">
                <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                    <div class="grid grid-cols-1 sm:grid-cols-[16rem_12rem_9rem] gap-3 w-full sm:w-auto">
                        <div>
                            <span class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1" aria-hidden="true">Cari</span>
                            <IconField iconPosition="left" class="w-full">
                                <InputIcon class="!flex items-center justify-center">
                                    <PhMagnifyingGlass :size="14" weight="bold" class="text-muted-color" aria-hidden="true" />
                                </InputIcon>
                                <InputText id="cari-saldo" name="cari-saldo" aria-label="Cari saldo berdasarkan nama atau NIK" v-model="searchQuery" placeholder="Cari Nama / NIK..." class="w-full text-xs !min-h-11 sm:!min-h-9" size="small" />
                            </IconField>
                        </div>

                        <div v-if="adminDivision">
                            <span class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Divisi</span>
                            <p class="min-h-11 sm:min-h-9 flex items-center text-sm font-semibold text-surface-900 dark:text-surface-100">{{ adminDivision }}</p>
                        </div>
                        <div v-else-if="isSuper">
                            <span id="bal-dept-label" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Divisi</span>
                            <Select
                                v-model="departmentFilter"
                                :options="departmentOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="Semua Divisi"
                                ariaLabelledby="bal-dept-label"
                                class="w-full text-xs !min-h-11 sm:!min-h-9"
                                :disabled="departmentsError && !departments.length"
                                :aria-describedby="departmentsError ? 'bal-dept-error' : undefined"
                                size="small"
                            />
                        </div>

                        <div>
                            <span id="bal-year-label" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Tahun</span>
                            <!-- optionValue wajib: YEAR_OPTIONS berisi objek {label, value}; tanpa ini request mengirim [object Object] (audit-021 #1). -->
                            <Select
                                v-model="selectedYear"
                                :options="yearOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="Pilih Tahun"
                                ariaLabelledby="bal-year-label"
                                class="w-full text-xs !min-h-11 sm:!min-h-9"
                                size="small"
                            />
                        </div>
                    </div>
                    <p class="text-xs text-muted-color sm:text-right sm:pb-2" aria-live="polite">
                        Total: <span class="font-bold text-surface-900 dark:text-surface-100">{{ loadError ? '–' : filteredBalances.length }}</span> karyawan
                    </p>
                </div>

                <div v-if="isSuper && !adminDivision && departmentsError" id="bal-dept-error" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-relaxed text-(--status-danger-fg)">
                    <span>Pilihan divisi gagal dimuat. Filter divisi belum bisa dipakai.</span>
                    <Button label="Coba lagi" severity="secondary" text size="small" class="text-xs !min-h-11 sm:!min-h-9" :loading="loading" @click="loadBalances" />
                </div>
            </div>

            <div v-if="loadError" role="alert" class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                <span>Data saldo tahun {{ selectedYear }} gagal dimuat. Daftar dikosongkan agar tidak tertukar dengan data lain.</span>
                <Button label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11" :loading="loading" @click="loadBalances" />
            </div>

            <div data-tour="bal-table" class="mt-4">
                <!-- Tabel mulai sm; di bawahnya daftar bertumpuk agar sisa saldo dan aksi tidak terdorong keluar layar (audit-021 #4). -->
                <div class="hidden sm:block">
                    <DataTable
                        :value="filteredBalances"
                        :loading="loading"
                        paginator
                        :rows="10"
                        class="p-datatable-sm text-xs"
                        responsiveLayout="scroll"
                    >
                        <template #empty>
                            <div class="text-center py-8 text-muted-color">
                                <p>{{ emptyText }}</p>
                                <Button v-if="hasFilters && !loadError && !loading" label="Atur ulang filter" severity="secondary" outlined size="small" class="mt-3 text-xs" @click="resetFilters" />
                            </div>
                        </template>

                        <Column header="Karyawan" style="width: 30%">
                            <template #body="{ data }">
                                <div class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ data.nama || '-' }}</div>
                                <div class="text-xs text-muted-color">NIK {{ data.namecode || '-' }}</div>
                                <div v-if="data.period_label" class="text-xs text-muted-color">Periode {{ data.period_label }}</div>
                            </template>
                        </Column>

                        <!-- Kode divisi adalah kategori: teks biasa, warna hanya untuk status (audit-021 #10). -->
                        <Column header="Divisi" style="width: 9%">
                            <template #body="{ data }">
                                <span class="font-semibold text-surface-800 dark:text-surface-200">{{ data.kd_dept || '-' }}</span>
                            </template>
                        </Column>

                        <Column header="Kuota (hari)" style="width: 11%">
                            <template #body="{ data }">
                                <span class="tabular-nums text-surface-900 dark:text-surface-100">{{ data.annual_quota ?? '-' }}</span>
                            </template>
                        </Column>

                        <Column header="Carry over (hari)" style="width: 15%">
                            <template #body="{ data }">
                                <div class="tabular-nums text-surface-900 dark:text-surface-100">{{ data.carry_over_days ?? 0 }}</div>
                                <div v-if="carryOverExpiry(data)" class="text-xs text-muted-color">Berlaku s.d. {{ carryOverExpiry(data) }}</div>
                            </template>
                        </Column>

                        <Column header="Terpakai (hari)" style="width: 11%">
                            <template #body="{ data }">
                                <span class="tabular-nums text-surface-900 dark:text-surface-100">{{ data.used_days ?? 0 }}</span>
                            </template>
                        </Column>

                        <Column header="Sisa (hari)" style="width: 12%">
                            <template #body="{ data }">
                                <div class="flex items-center gap-2">
                                    <span class="tabular-nums text-sm font-bold text-surface-900 dark:text-surface-100">{{ remainingOf(data) }}</span>
                                    <Tag v-if="remainingOf(data) <= 0" value="Habis" severity="warn" />
                                </div>
                            </template>
                        </Column>

                        <Column header="Aksi" style="width: 12%" :pt="{ headerCell: { 'data-tour': 'bal-col-aksi' } }">
                            <template #body="{ data }">
                                <div class="flex items-center gap-1">
                                    <button
                                        type="button"
                                        class="inline-flex items-center justify-center min-w-9 min-h-9 text-surface-600 dark:text-surface-300 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 rounded-border transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                        :aria-label="`Riwayat saldo ${data.nama || data.namecode}`"
                                        title="Riwayat mutasi saldo"
                                        @click="openHistory(data)"
                                    >
                                        <PhClockCounterClockwise :size="16" weight="bold" aria-hidden="true" />
                                    </button>
                                    <button
                                        v-if="canManage"
                                        type="button"
                                        class="inline-flex items-center justify-center min-w-9 min-h-9 text-surface-600 dark:text-surface-300 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 rounded-border transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                        :aria-label="`Sesuaikan saldo ${data.nama || data.namecode}`"
                                        title="Sesuaikan saldo"
                                        @click="openEdit(data)"
                                    >
                                        <PhPencilSimple :size="16" weight="bold" aria-hidden="true" />
                                    </button>
                                </div>
                            </template>
                        </Column>
                    </DataTable>
                </div>

                <div class="sm:hidden" :aria-busy="loading">
                    <div v-if="!filteredBalances.length" class="py-8 text-center text-xs text-muted-color">
                        <p>{{ emptyText }}</p>
                        <Button v-if="hasFilters && !loadError && !loading" label="Atur ulang filter" severity="secondary" outlined size="small" class="mt-3 text-xs !min-h-11" @click="resetFilters" />
                    </div>
                    <ul v-else class="divide-y divide-surface-200 dark:divide-surface-700" :class="{ 'opacity-60': loading }">
                        <li v-for="(b, i) in mobileRows" :key="b.uid_user_system || b.id_balance" class="py-3 space-y-2 text-xs">
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <div class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ b.nama || '-' }}</div>
                                    <div class="text-muted-color">NIK {{ b.namecode || '-' }}<template v-if="b.kd_dept"> · {{ b.kd_dept }}</template></div>
                                </div>
                                <div class="text-right shrink-0">
                                    <div class="tabular-nums text-base font-bold text-surface-900 dark:text-surface-100">{{ remainingOf(b) }} hari</div>
                                    <Tag v-if="remainingOf(b) <= 0" value="Habis" severity="warn" />
                                    <div v-else class="text-muted-color">sisa</div>
                                </div>
                            </div>
                            <div v-if="b.period_label" class="text-muted-color">Periode {{ b.period_label }}</div>
                            <dl class="grid grid-cols-3 gap-2">
                                <div>
                                    <dt class="text-muted-color">Kuota</dt>
                                    <dd class="tabular-nums text-surface-900 dark:text-surface-100">{{ b.annual_quota ?? '-' }} hari</dd>
                                </div>
                                <div>
                                    <dt class="text-muted-color">Carry over</dt>
                                    <dd class="tabular-nums text-surface-900 dark:text-surface-100">{{ b.carry_over_days ?? 0 }} hari</dd>
                                </div>
                                <div>
                                    <dt class="text-muted-color">Terpakai</dt>
                                    <dd class="tabular-nums text-surface-900 dark:text-surface-100">{{ b.used_days ?? 0 }} hari</dd>
                                </div>
                            </dl>
                            <div v-if="carryOverExpiry(b)" class="text-muted-color">Carry over berlaku s.d. {{ carryOverExpiry(b) }}</div>
                            <!-- Anchor tour kolom Aksi juga dipasang pada item pertama, karena header tabel tersembunyi di HP. -->
                            <div class="flex gap-2 pt-1" :data-tour="i === 0 ? 'bal-col-aksi' : undefined">
                                <Button
                                    severity="secondary"
                                    outlined
                                    size="small"
                                    class="flex-1 text-xs !min-h-11 flex items-center justify-center gap-1.5"
                                    :aria-label="`Riwayat saldo ${b.nama || b.namecode}`"
                                    @click="openHistory(b)"
                                >
                                    <PhClockCounterClockwise :size="14" weight="bold" aria-hidden="true" />
                                    <span>Riwayat</span>
                                </Button>
                                <Button
                                    v-if="canManage"
                                    severity="secondary"
                                    outlined
                                    size="small"
                                    class="flex-1 text-xs !min-h-11 flex items-center justify-center gap-1.5"
                                    :aria-label="`Sesuaikan saldo ${b.nama || b.namecode}`"
                                    @click="openEdit(b)"
                                >
                                    <PhPencilSimple :size="14" weight="bold" aria-hidden="true" />
                                    <span>Sesuaikan</span>
                                </Button>
                            </div>
                        </li>
                    </ul>
                    <Button
                        v-if="filteredBalances.length > mobileLimit"
                        :label="`Tampilkan ${Math.min(10, filteredBalances.length - mobileLimit)} lagi`"
                        severity="secondary"
                        text
                        size="small"
                        class="w-full mt-2 text-xs !min-h-11"
                        @click="mobileLimit += 10"
                    />
                </div>
            </div>
        </div>

        <BalanceEditDialog
            v-model:visible="editDialogVisible"
            :balance-data="selectedBalance"
            @saved="loadBalances"
        />

        <BalanceHistoryDialog
            v-model:visible="historyDialogVisible"
            :user="selectedBalance"
            :year="selectedYear"
        />
    </div>
</template>
