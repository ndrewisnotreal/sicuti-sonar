<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { adminService } from '@/service/adminService';
import { rbacService } from '@/service/rbacService';
import { currentUser, getAdminDivision, isSuperAdmin } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { statusSummary } from '@/service/statusReason';
import { formatDate } from '@/utils/dateUtils';
import StatusHistoryDialog from '@/components/admin/StatusHistoryDialog.vue';
import AccountFormDialog from '@/components/admin/AccountFormDialog.vue';
import ResetPasswordDialog from '@/components/admin/ResetPasswordDialog.vue';
import DeactivateAccountDialog from '@/components/admin/DeactivateAccountDialog.vue';
import { PhPlus, PhPencilSimple, PhMagnifyingGlass, PhUserGear, PhKey, PhLockOpen, PhUserMinus, PhUserCheck, PhArrowsClockwise, PhClockCounterClockwise, PhSpinner } from '@phosphor-icons/vue';

const toast = useToast();
const loading = ref(false);
// Gagal per sumber, agar gagal dimuat tidak tampil sebagai "tidak ada akun" (audit-024 #2).
const loadError = ref(false);
const rolesError = ref(false);
const departmentsError = ref(false);
const users = ref([]);
const roles = ref([]);
const departments = ref([]);
const searchQuery = ref('');
const departmentFilter = ref(null);

const adminDivision = computed(() => getAdminDivision(currentUser.value));
const isSuper = computed(() => isSuperAdmin(currentUser.value));

const formDialogVisible = ref(false);
const isEditing = ref(false);
const selectedUser = ref(null);

const resetPasswordVisible = ref(false);
const resetPasswordUser = ref(null);

const historyDialog = ref({ visible: false, user: null });
const deactivateDialog = ref({ visible: false, user: null });

// Baris yang sedang diproses (buka kunci / aktifkan): cegah tekan ganda tanpa men-disable tombol (audit-024 #11).
const busyUid = ref(null);

async function loadData() {
    loading.value = true;
    loadError.value = false;
    rolesError.value = false;
    departmentsError.value = false;
    // Pemanggilan dan parameter sama; tiap sumber kini dicatat gagal/berhasil sendiri.
    const [usersRes, rolesRes, deptsRes] = await Promise.allSettled([adminService.getUsers(), rbacService.getRoles(), adminService.getDepartments()]);
    if (usersRes.status === 'fulfilled') {
        users.value = Array.isArray(usersRes.value) ? usersRes.value : [];
    } else {
        users.value = [];
        loadError.value = true;
        toast.add({
            severity: 'error',
            summary: 'Gagal Memuat Data',
            detail: usersRes.reason?.message || 'Gagal mengambil data akun & role',
            life: 3000
        });
    }
    if (rolesRes.status === 'fulfilled') roles.value = Array.isArray(rolesRes.value) ? rolesRes.value : [];
    else rolesError.value = true;
    if (deptsRes.status === 'fulfilled') departments.value = Array.isArray(deptsRes.value) ? deptsRes.value : [];
    else departmentsError.value = true;
    loading.value = false;
}

const filteredUsers = computed(() => {
    return users.value.filter((u) => {
        const targetDept = adminDivision.value || departmentFilter.value;
        if (targetDept && u.kd_dept !== targetDept) return false;

        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase();
            const name = (u.nama || '').toLowerCase();
            const uname = (u.username || '').toLowerCase();
            const nik = (u.namecode || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            const role = (u.nm_role || u.kd_role || '').toLowerCase();
            if (!name.includes(q) && !uname.includes(q) && !nik.includes(q) && !email.includes(q) && !role.includes(q)) {
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
    if (loading.value) return 'Memuat data akun...';
    if (loadError.value) return 'Data akun belum termuat.';
    if (hasFilters.value) return 'Tidak ada akun yang cocok dengan pencarian atau filter.';
    return 'Belum ada akun.';
});

const isActive = (u) => u.status_user === 'A' || u.status === 'A';
const displayName = (u) => u.nama || u.username;

function openCreate() {
    selectedUser.value = null;
    isEditing.value = false;
    formDialogVisible.value = true;
}

function openEdit(u) {
    selectedUser.value = u;
    isEditing.value = true;
    formDialogVisible.value = true;
}

function openResetPassword(u) {
    resetPasswordUser.value = u;
    resetPasswordVisible.value = true;
}

function openHistory(u) {
    historyDialog.value = { visible: true, user: u };
}

function toggleUserActive(u) {
    const nextStatus = isActive(u) ? 'N' : 'A';
    if (nextStatus === 'A') return applyUserStatus(u, nextStatus);
    deactivateDialog.value = { visible: true, user: u };
}

// Setelah daftar dimuat ulang, fokus dikembalikan ke tombol Ubah pada baris yang sama (pola item 10b).
async function refocusRow(u) {
    await nextTick();
    const label = `Ubah akun ${displayName(u)}`;
    [...document.querySelectorAll('button[aria-label]')].find((b) => b.getAttribute('aria-label') === label && b.offsetParent)?.focus();
}

async function applyUserStatus(u, nextStatus, extra = {}) {
    if (busyUid.value) return false;
    busyUid.value = u.uid_user_system;
    try {
        await adminService.updateUser({
            uid_user_system: u.uid_user_system,
            status: nextStatus,
            ...extra
        });
        toast.add({
            severity: 'info',
            summary: 'Status Diubah',
            detail: `Akun ${u.nama || u.username} ${nextStatus === 'A' ? 'diaktifkan' : 'dinonaktifkan'}`,
            life: 3000
        });
        await loadData();
        refocusRow(u);
        return true;
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Gagal',
            detail: err.message || 'Gagal mengubah status akun',
            life: 3000
        });
        return false;
    } finally {
        busyUid.value = null;
    }
}

async function unlockAccount(u) {
    if (busyUid.value) return;
    busyUid.value = u.uid_user_system;
    try {
        await adminService.unlockUser(u.uid_user_system);
        toast.add({
            severity: 'success',
            summary: 'Akun Dibuka',
            detail: `Kunci akun ${u.nama || u.username} berhasil dibuka`,
            life: 3000
        });
        await loadData();
        refocusRow(u);
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Gagal',
            detail: err.message || 'Gagal membuka kunci akun',
            life: 3000
        });
    } finally {
        busyUid.value = null;
    }
}

// Daftar HP dimuat bertahap, pengganti paginator tabel.
const mobileLimit = ref(10);
watch([searchQuery, departmentFilter, users], () => {
    mobileLimit.value = 10;
});
const mobileRows = computed(() => filteredUsers.value.slice(0, mobileLimit.value));

const iconBtn = 'inline-flex items-center justify-center min-w-9 min-h-9 rounded-border text-surface-600 dark:text-surface-300 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

onMounted(() => {
    loadData();
});
</script>

<template>
    <div class="space-y-6">
        <!-- Satu kartu: judul dan aksi, filter dan jumlah, lalu daftar (acuan 00b §6.1, audit-024 #8). -->
        <div class="card !mb-0">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                        <PhUserGear :size="22" weight="regular" class="text-primary shrink-0" aria-hidden="true" />
                        <span>Manajemen Akun & Peran Pengguna</span>
                    </h1>
                    <p class="text-xs text-muted-color">
                        Kelola data login, kata sandi, penugasan peran, dan atasan karyawan<template v-if="adminDivision"> Divisi {{ adminDivision }}</template>.
                    </p>
                </div>
                <div class="flex items-center gap-2">
                    <Button
                        severity="secondary"
                        outlined
                        size="small"
                        class="text-xs font-semibold flex items-center gap-1.5 !min-h-11 sm:!min-h-9"
                        :loading="loading"
                        @click="loadData"
                    >
                        <PhArrowsClockwise :size="14" weight="bold" aria-hidden="true" />
                        <span>Segarkan</span>
                    </Button>
                    <Button data-tour="acc-add"
                        severity="primary"
                        size="small"
                        class="text-xs font-bold flex items-center gap-1.5 !min-h-11 sm:!min-h-9"
                        @click="openCreate"
                    >
                        <PhPlus :size="14" weight="bold" aria-hidden="true" />
                        <span>Tambah Akun Baru</span>
                    </Button>
                </div>
            </div>

            <div data-tour="acc-filters" class="mt-6 space-y-3">
                <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                    <div class="grid grid-cols-1 sm:grid-cols-[18rem_14rem] gap-3 w-full sm:w-auto">
                        <div>
                            <span class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1" aria-hidden="true">Cari</span>
                            <IconField iconPosition="left" class="w-full">
                                <InputIcon class="!flex items-center justify-center">
                                    <PhMagnifyingGlass :size="14" weight="bold" class="text-muted-color" aria-hidden="true" />
                                </InputIcon>
                                <InputText id="cari-akun" name="cari-akun" aria-label="Cari akun berdasarkan nama, username, atau NIK" v-model="searchQuery" placeholder="Cari Nama / Username / NIK..." class="w-full text-xs !min-h-11 sm:!min-h-9" size="small" />
                            </IconField>
                        </div>
                        <div v-if="adminDivision">
                            <span class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Divisi</span>
                            <p class="min-h-11 sm:min-h-9 flex items-center text-sm font-semibold text-surface-900 dark:text-surface-100">{{ adminDivision }}</p>
                        </div>
                        <div v-else-if="isSuper">
                            <span id="acc-dept-filter-label" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Divisi</span>
                            <Select
                                v-model="departmentFilter"
                                :options="departmentOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="Semua Divisi"
                                ariaLabelledby="acc-dept-filter-label"
                                class="w-full text-xs !min-h-11 sm:!min-h-9"
                                :disabled="departmentsError && !departments.length"
                                size="small"
                            />
                        </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-2 sm:justify-end">
                        <Button v-if="hasFilters" label="Atur ulang filter" severity="secondary" text size="small" class="text-xs !min-h-11 sm:!min-h-9" @click="resetFilters" />
                        <p class="text-xs text-muted-color sm:pb-2" aria-live="polite">
                            Total: <span class="font-bold text-surface-900 dark:text-surface-100">{{ loading || loadError ? '–' : filteredUsers.length }}</span> akun
                        </p>
                    </div>
                </div>
                <p v-if="rolesError || (isSuper && !adminDivision && departmentsError)" class="text-xs leading-relaxed text-(--status-danger-fg)">
                    {{ rolesError ? 'Daftar peran gagal dimuat, jadi akun belum bisa ditambah atau diubah.' : 'Pilihan divisi gagal dimuat.' }} Tekan Segarkan untuk mencoba lagi.
                </p>
            </div>

            <div v-if="loadError" role="alert" class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                <span>Data akun gagal dimuat. Daftar dikosongkan agar tidak menampilkan data lama.</span>
                <Button label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11" :loading="loading" @click="loadData" />
            </div>

            <div data-tour="acc-table" class="mt-4">
                <!-- Tabel mulai xl (1200px); di bawahnya daftar bertumpuk agar kolom Aksi tidak terpotong (audit-024 #5). -->
                <div class="hidden xl:block">
                    <DataTable
                        :value="filteredUsers"
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

                        <Column header="Pengguna" style="width: 26%">
                            <template #body="{ data }">
                                <div class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ displayName(data) }}</div>
                                <div class="text-xs text-muted-color">{{ data.username }}<template v-if="data.namecode && data.namecode !== data.username"> · NIK {{ data.namecode }}</template></div>
                                <div v-if="data.email" class="text-xs text-muted-color break-all">{{ data.email }}</div>
                            </template>
                        </Column>

                        <!-- Peran dan divisi kategori: teks biasa, warna hanya untuk status (audit-024 #9). -->
                        <Column header="Peran" style="width: 14%" :pt="{ headerCell: { 'data-tour': 'acc-col-role' } }">
                            <template #body="{ data }">
                                <span class="font-medium text-surface-900 dark:text-surface-100">{{ data.nm_role || data.kd_role }}</span>
                            </template>
                        </Column>

                        <Column header="Divisi" style="width: 8%">
                            <template #body="{ data }">
                                <span class="text-surface-800 dark:text-surface-200">{{ data.kd_dept || '-' }}</span>
                            </template>
                        </Column>

                        <Column header="Jabatan" style="width: 15%">
                            <template #body="{ data }">
                                <div class="text-surface-800 dark:text-surface-200">{{ data.position || '-' }}</div>
                                <div class="text-xs text-muted-color">
                                    <template v-if="data.join_date">Masuk {{ formatDate(data.join_date) }}</template>
                                    <template v-else>Tanggal masuk belum diisi</template>
                                </div>
                            </template>
                        </Column>

                        <Column header="Atasan Langsung" style="width: 14%">
                            <template #body="{ data }">
                                <span class="text-surface-800 dark:text-surface-200">{{ data.supervisor_nama || '-' }}</span>
                            </template>
                        </Column>

                        <Column header="Status" style="width: 10%">
                            <template #body="{ data }">
                                <Tag v-if="data.is_locked" value="Terkunci" severity="danger" />
                                <Tag v-else :value="isActive(data) ? 'Aktif' : 'Nonaktif'" :severity="isActive(data) ? 'success' : 'secondary'" />
                                <button
                                    v-if="statusSummary(data)"
                                    type="button"
                                    class="block mt-1 min-h-6 text-xs text-muted-color underline decoration-dotted underline-offset-2 hover:text-primary text-left leading-tight line-clamp-2 cursor-pointer"
                                    :aria-label="`Lihat riwayat status ${displayName(data)}: ${statusSummary(data)}`"
                                    @click="openHistory(data)"
                                >
                                    {{ statusSummary(data) }}
                                </button>
                            </template>
                        </Column>

                        <Column header="Aksi" style="width: 13%" :pt="{ headerCell: { 'data-tour': 'acc-col-aksi' } }">
                            <template #body="{ data }">
                                <div class="flex items-center gap-1">
                                    <button type="button" :class="iconBtn" :aria-label="`Ubah akun ${displayName(data)}`" title="Ubah akun & peran" @click="openEdit(data)">
                                        <PhPencilSimple :size="16" weight="bold" aria-hidden="true" />
                                    </button>
                                    <button type="button" :class="iconBtn" :aria-label="`Atur ulang kata sandi ${displayName(data)}`" title="Atur ulang kata sandi" @click="openResetPassword(data)">
                                        <PhKey :size="16" weight="bold" aria-hidden="true" />
                                    </button>
                                    <button type="button" :class="iconBtn" :aria-label="`Riwayat status ${displayName(data)}`" title="Riwayat status" @click="openHistory(data)">
                                        <PhClockCounterClockwise :size="16" weight="bold" aria-hidden="true" />
                                    </button>
                                    <button
                                        v-if="data.is_locked"
                                        type="button"
                                        :class="iconBtn"
                                        :aria-label="`Buka kunci akun ${displayName(data)}`"
                                        :aria-busy="busyUid === data.uid_user_system"
                                        title="Buka kunci akun"
                                        @click="unlockAccount(data)"
                                    >
                                        <PhSpinner v-if="busyUid === data.uid_user_system" :size="16" weight="bold" class="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                                        <PhLockOpen v-else :size="16" weight="bold" aria-hidden="true" />
                                    </button>
                                    <button
                                        v-else-if="!data.is_super"
                                        type="button"
                                        :class="iconBtn"
                                        :aria-label="`${isActive(data) ? 'Nonaktifkan' : 'Aktifkan'} akun ${displayName(data)}`"
                                        :aria-busy="busyUid === data.uid_user_system"
                                        :title="isActive(data) ? 'Nonaktifkan akun' : 'Aktifkan akun'"
                                        @click="toggleUserActive(data)"
                                    >
                                        <PhSpinner v-if="busyUid === data.uid_user_system" :size="16" weight="bold" class="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                                        <PhUserMinus v-else-if="isActive(data)" :size="16" weight="bold" aria-hidden="true" />
                                        <PhUserCheck v-else :size="16" weight="bold" aria-hidden="true" />
                                    </button>
                                </div>
                            </template>
                        </Column>
                    </DataTable>
                </div>

                <div class="xl:hidden" :aria-busy="loading">
                    <div v-if="!filteredUsers.length" class="py-8 text-center text-xs text-muted-color">
                        <p>{{ emptyText }}</p>
                        <Button v-if="hasFilters && !loadError && !loading" label="Atur ulang filter" severity="secondary" outlined size="small" class="mt-3 text-xs !min-h-11" @click="resetFilters" />
                    </div>
                    <ul v-else class="divide-y divide-surface-200 dark:divide-surface-700" :class="{ 'opacity-60': loading }">
                        <li v-for="(u, i) in mobileRows" :key="u.uid_user_system" class="py-3 space-y-2 text-xs">
                            <div class="flex items-start justify-between gap-2">
                                <div class="min-w-0">
                                    <div class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ displayName(u) }}</div>
                                    <div class="text-muted-color">{{ u.username }}<template v-if="u.namecode && u.namecode !== u.username"> · NIK {{ u.namecode }}</template></div>
                                    <div v-if="u.email" class="text-muted-color break-all">{{ u.email }}</div>
                                </div>
                                <Tag v-if="u.is_locked" value="Terkunci" severity="danger" />
                                <Tag v-else :value="isActive(u) ? 'Aktif' : 'Nonaktif'" :severity="isActive(u) ? 'success' : 'secondary'" />
                            </div>
                            <div class="text-surface-800 dark:text-surface-200" :data-tour="i === 0 ? 'acc-col-role' : undefined">{{ u.nm_role || u.kd_role }} · {{ u.kd_dept || '-' }}<template v-if="u.position"> · {{ u.position }}</template></div>
                            <div class="text-muted-color">Atasan: {{ u.supervisor_nama || '-' }}</div>
                            <button
                                v-if="statusSummary(u)"
                                type="button"
                                class="block min-h-6 text-xs text-muted-color underline decoration-dotted underline-offset-2 text-left cursor-pointer"
                                :aria-label="`Lihat riwayat status ${displayName(u)}: ${statusSummary(u)}`"
                                @click="openHistory(u)"
                            >
                                {{ statusSummary(u) }}
                            </button>
                            <!-- Anchor tour kolom Aksi juga di item pertama, karena header tabel tersembunyi di HP. -->
                            <div class="grid grid-cols-2 gap-2 pt-1" :data-tour="i === 0 ? 'acc-col-aksi' : undefined">
                                <Button severity="secondary" outlined size="small" class="text-xs !min-h-11 flex items-center justify-center gap-1.5" :aria-label="`Ubah akun ${displayName(u)}`" @click="openEdit(u)">
                                    <PhPencilSimple :size="14" weight="bold" aria-hidden="true" />
                                    <span>Ubah</span>
                                </Button>
                                <Button severity="secondary" outlined size="small" class="text-xs !min-h-11 flex items-center justify-center gap-1.5" :aria-label="`Atur ulang kata sandi ${displayName(u)}`" @click="openResetPassword(u)">
                                    <PhKey :size="14" weight="bold" aria-hidden="true" />
                                    <span>Kata sandi</span>
                                </Button>
                                <Button severity="secondary" outlined size="small" class="text-xs !min-h-11 flex items-center justify-center gap-1.5" :aria-label="`Riwayat status ${displayName(u)}`" @click="openHistory(u)">
                                    <PhClockCounterClockwise :size="14" weight="bold" aria-hidden="true" />
                                    <span>Riwayat</span>
                                </Button>
                                <Button
                                    v-if="u.is_locked"
                                    severity="secondary"
                                    outlined
                                    size="small"
                                    class="text-xs !min-h-11 flex items-center justify-center gap-1.5"
                                    :loading="busyUid === u.uid_user_system"
                                    :aria-label="`Buka kunci akun ${displayName(u)}`"
                                    @click="unlockAccount(u)"
                                >
                                    <PhLockOpen :size="14" weight="bold" aria-hidden="true" />
                                    <span>Buka kunci</span>
                                </Button>
                                <Button
                                    v-else-if="!u.is_super"
                                    severity="secondary"
                                    outlined
                                    size="small"
                                    class="text-xs !min-h-11 flex items-center justify-center gap-1.5"
                                    :loading="busyUid === u.uid_user_system"
                                    :aria-label="`${isActive(u) ? 'Nonaktifkan' : 'Aktifkan'} akun ${displayName(u)}`"
                                    @click="toggleUserActive(u)"
                                >
                                    <PhUserMinus v-if="isActive(u)" :size="14" weight="bold" aria-hidden="true" />
                                    <PhUserCheck v-else :size="14" weight="bold" aria-hidden="true" />
                                    <span>{{ isActive(u) ? 'Nonaktifkan' : 'Aktifkan' }}</span>
                                </Button>
                            </div>
                        </li>
                    </ul>
                    <Button
                        v-if="filteredUsers.length > mobileLimit"
                        :label="`Tampilkan ${Math.min(10, filteredUsers.length - mobileLimit)} lagi`"
                        severity="secondary"
                        text
                        size="small"
                        class="w-full mt-2 text-xs !min-h-11"
                        @click="mobileLimit += 10"
                    />
                </div>
            </div>
        </div>

        <AccountFormDialog
            v-model:visible="formDialogVisible"
            :is-editing="isEditing"
            :user-data="selectedUser"
            :roles="roles"
            :departments="departments"
            :users="users"
            :admin-division="adminDivision"
            :roles-error="rolesError"
            @saved="loadData"
        />

        <ResetPasswordDialog
            v-model:visible="resetPasswordVisible"
            :user="resetPasswordUser"
            @saved="loadData"
        />

        <StatusHistoryDialog
            v-model:visible="historyDialog.visible"
            :user="historyDialog.user"
        />

        <DeactivateAccountDialog
            v-model:visible="deactivateDialog.visible"
            :user="deactivateDialog.user"
            @saved="loadData"
        />
    </div>
</template>
