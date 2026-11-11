<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { leaveService } from '@/service/leaveService';
import {
    getStatusSeverity,
    getStatusLabel,
    formatDate,
    can,
    lastReturnNote,
    documentPending,
    sicutiState,
    syncFromBackend
} from '@/service/sicutiService';
import LeaveDetailDialog from '@/components/leave/LeaveDetailDialog.vue';
import LeaveFormDialog from '@/components/leave/LeaveFormDialog.vue';
import LeaveCompleteDocumentDialog from '@/components/leave/LeaveCompleteDocumentDialog.vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { PhPlus, PhMagnifyingGlass, PhEye, PhTrash, PhPencilSimple, PhFolderOpen, PhArrowUUpLeft, PhX, PhFileArrowUp } from '@phosphor-icons/vue';

// Tombol ikon di baris tabel: minimal 36px (DESIGN.md, audit-027 #6).
const iconBtn = 'inline-flex items-center justify-center min-w-9 min-h-9 rounded-border text-surface-600 dark:text-surface-300 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const toast = useToast();
const confirm = useConfirm();
const router = useRouter();
const route = useRoute();

const loading = ref(false);
const loadError = ref(false);
const myRequests = ref([]);
const selectedRequest = ref(null);
const detailVisible = ref(false);
const statusFilter = ref(null);
const searchQuery = ref('');
const first = ref(0);
const rows = ref(10);
const paginatedMobileRequests = computed(() => {
    return filteredRequests.value.slice(first.value, first.value + rows.value);
});

const isLeaveFormVisible = ref(false);
const editingLeaveId = ref(null);
const editingLeaveData = ref(null);

watch(searchQuery, () => {
    first.value = 0;
});

async function fetchRequests() {
    loading.value = true;
    loadError.value = false;
    try {
        const list = await leaveService.getMyLeaves({ limit: 100 });
        myRequests.value = Array.isArray(list) ? list : [];
    } catch (err) {
        console.error('Failed to fetch leave history:', err);
        // Gagal muat tidak boleh tampil sebagai "belum ada pengajuan"; data lama dikosongkan (audit-027 #1).
        loadError.value = true;
        myRequests.value = [];
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    fetchRequests();
});
watch(() => sicutiState.dataVersion, fetchRequests);

const docDialogVisible = ref(false);
const docRequest = ref(null);

function openCompleteDocument(req) {
    docRequest.value = req;
    docDialogVisible.value = true;
}

const canSubmit = computed(() => can('pengajuan_cuti.submit'));
const canEditReturned = computed(() => can('pengajuan_cuti.edit_returned'));
const canCancel = computed(() => can('pengajuan_cuti.cancel'));

function openNewLeave() {
    if (!canSubmit.value) return;
    editingLeaveId.value = null;
    editingLeaveData.value = null;
    isLeaveFormVisible.value = true;
}

function openEditLeave(reqOrId) {
    if (!canSubmit.value && !canEditReturned.value) return;
    if (reqOrId && typeof reqOrId === 'object') {
        editingLeaveData.value = reqOrId;
        editingLeaveId.value = reqOrId.id_request || reqOrId.id;
    } else {
        editingLeaveId.value = reqOrId;
        const found = myRequests.value.find((r) => (r.id_request || r.id) === reqOrId);
        editingLeaveData.value = found || (reqOrId ? { id: reqOrId } : null);
    }
    isLeaveFormVisible.value = true;
}

watch(
    () => [route.query.action, route.query.editId],
    ([action, editId]) => {
        if (action === 'new_leave') {
            openNewLeave();
            router.replace({ query: {} });
        } else if (editId) {
            openEditLeave(editId);
            router.replace({ query: {} });
        }
    },
    { immediate: true }
);

const stats = computed(() => {
    const list = myRequests.value;
    const total = list.length;
    const pending = list.filter((r) => r.status === 'submitted' || r.status === 'pending_validation').length;
    const approved = list.filter((r) => r.status === 'approved' || r.status === 'completed').length;
    const count = (status) => list.filter((r) => r.status === status).length;
    return { total, draft: count('draft'), pending, approved, returned: count('returned'), rejected: count('rejected'), cancelled: count('cancelled') };
});

const statusTabs = computed(() => [
    { key: null, label: 'Semua', count: stats.value.total },
    { key: 'draft', label: 'Draf', count: stats.value.draft },
    { key: 'pending_group', label: 'Menunggu Approval', count: stats.value.pending },
    { key: 'approved', label: 'Disetujui', count: stats.value.approved },
    { key: 'returned', label: 'Dikembalikan', count: stats.value.returned },
    { key: 'rejected', label: 'Ditolak', count: stats.value.rejected },
    { key: 'cancelled', label: 'Dibatalkan', count: stats.value.cancelled }
]);

const filteredRequests = computed(() => {
    return myRequests.value.filter((r) => {
        if (statusFilter.value) {
            if (statusFilter.value === 'pending_group') {
                if (r.status !== 'submitted' && r.status !== 'pending_validation') return false;
            } else if (statusFilter.value === 'approved') {
                if (r.status !== 'approved' && r.status !== 'completed') return false;
            } else if (r.status !== statusFilter.value) {
                return false;
            }
        }
        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase().trim();
            const id = (r.id_request || r.id || '').toLowerCase();
            const typeName = (r.nm_leave_type || r.leaveTypeName || r.kd_leave_type || '').toLowerCase();
            const reason = (r.reason || '').toLowerCase();
            if (!id.includes(q) && !typeName.includes(q) && !reason.includes(q)) {
                return false;
            }
        }
        return true;
    });
});

const hasFilters = computed(() => statusFilter.value !== null || Boolean(searchQuery.value));

const emptyTitle = computed(() => {
    if (loadError.value) return 'Pengajuan belum termuat';
    return hasFilters.value ? 'Data cuti tidak ditemukan' : 'Belum ada pengajuan cuti';
});
const emptyText = computed(() => {
    if (loadError.value) return 'Daftar gagal dimuat. Tekan Coba lagi di atas.';
    return hasFilters.value ? 'Coba ubah kata kunci pencarian atau atur ulang filter status.' : 'Anda belum pernah membuat permohonan cuti.';
});

// Catatan panjang dipotong dua baris di tabel; teks lengkapnya ada di Detail (audit-027 #14).
const isLongNote = (req) => (lastReturnNote(req)?.notes || '').length > 70;

function setQuickFilter(val) {
    first.value = 0;
    statusFilter.value = val;
}

function resetFilters() {
    searchQuery.value = '';
    statusFilter.value = null;
    first.value = 0;
}

// Rentang ringkas: "4 – 7 November 2026", "28 Oktober – 3 November 2026"; beda tahun tetap lengkap.
function formatPeriod(start, end) {
    if (!start) return '-';
    const s = formatDate(start);
    const e = end ? formatDate(end) : s;
    if (s === e) return s;
    const [sd, sm, sy] = s.split(' ');
    const [, em, ey] = e.split(' ');
    if (!sy || sy !== ey) return `${s} – ${e}`;
    return sm === em ? `${sd} – ${e}` : `${sd} ${sm} – ${e}`;
}

function viewDetail(req) {
    selectedRequest.value = req;
    detailVisible.value = true;
}

function cancelRequest(req) {
    const id = req.id_request || req.id;

    confirm.require({
        message: `Batalkan pengajuan cuti #${id}? Pengajuan yang dibatalkan tidak dapat diproses lagi.`,
        header: 'Konfirmasi Pembatalan Cuti',
        rejectProps: { label: 'Kembali', severity: 'secondary', outlined: true },
        acceptProps: { label: 'Ya, Batalkan Pengajuan', severity: 'danger' },
        // Fokus awal di Kembali: Enter tidak langsung membatalkan (DESIGN.md, audit-027 #2).
        defaultFocus: 'reject',
        accept: async () => {
            try {
                await leaveService.cancelLeave(id);
                void syncFromBackend({ fresh: true });
                toast.add({
                    severity: 'info',
                    summary: 'Cuti Dibatalkan',
                    detail: `Pengajuan #${id} berhasil dibatalkan`,
                    life: 4500
                });
                await fetchRequests();
            } catch (err) {
                const msg = err?.data?.message || err?.message || 'Gagal membatalkan pengajuan cuti';
                toast.add({
                    severity: 'error',
                    summary: 'Gagal Membatalkan',
                    detail: msg,
                    life: 4000
                });
            }
        }
    });
}
</script>

<template>
    <div class="space-y-6">
        <!-- Satu kartu: judul dan aksi, filter, lalu daftar (acuan 00b §6.1, audit-027 #7). -->
        <div class="card !mb-0">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Pengajuan Cuti</h1>
                    <p class="text-xs text-muted-color">Ajukan cuti dan pantau proses persetujuannya</p>
                </div>
                <Button v-if="canSubmit" data-tour="leave-add" @click="openNewLeave" size="small" class="font-semibold text-xs flex items-center gap-1.5 self-start sm:self-auto !min-h-11 sm:!min-h-9">
                    <PhPlus :size="14" weight="bold" aria-hidden="true" />
                    <span>Tambah Pengajuan</span>
                </Button>
            </div>

            <div class="mt-6 space-y-4">
                <!-- Status sebagai pilihan cepat dengan jumlah, pola Pemantauan (audit-027 #5, #8). -->
                <div data-tour="leave-status-tabs" role="group" aria-labelledby="leave-status-label" class="flex flex-wrap items-center gap-2">
                    <span id="leave-status-label" class="text-xs font-medium text-surface-700 dark:text-surface-300 mr-1">Status</span>
                    <button
                        v-for="tab in statusTabs"
                        :key="tab.key || 'all'"
                        type="button"
                        class="inline-flex items-center gap-1.5 min-h-11 sm:min-h-9 px-3 rounded-border border text-xs font-medium cursor-pointer transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        :class="statusFilter === tab.key
                            ? 'border-primary bg-primary-50 text-primary-700 dark:bg-primary/10 dark:text-primary'
                            : 'border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'"
                        :aria-pressed="statusFilter === tab.key"
                        @click="setQuickFilter(tab.key)"
                    >
                        {{ tab.label }}
                        <span class="tabular-nums text-surface-600 dark:text-surface-400" :class="{ '!text-current': statusFilter === tab.key }">{{ loadError ? '–' : tab.count }}</span>
                    </button>
                </div>

                <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                    <div data-tour="leave-search" class="w-full sm:w-80 md:w-96">
                        <label for="cari-pengajuan" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Cari</label>
                        <div class="relative">
                            <IconField iconPosition="left" class="w-full">
                                <InputIcon class="!flex items-center justify-center">
                                    <PhMagnifyingGlass :size="14" weight="bold" aria-hidden="true" class="text-muted-color" />
                                </InputIcon>
                                <InputText
                                    id="cari-pengajuan"
                                    name="cari-pengajuan"
                                    v-model="searchQuery"
                                    placeholder="Nomor, jenis cuti, atau alasan"
                                    class="w-full text-xs !min-h-11 sm:!min-h-9 !pr-10"
                                />
                            </IconField>
                            <button
                                v-if="searchQuery"
                                type="button"
                                :class="[iconBtn, 'absolute right-1 top-1/2 -translate-y-1/2 hover:text-surface-900 dark:hover:text-surface-0 hover:bg-surface-100 dark:hover:bg-surface-800']"
                                aria-label="Hapus pencarian"
                                @click="searchQuery = ''"
                            >
                                <PhX :size="14" weight="bold" aria-hidden="true" />
                            </button>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-2 sm:justify-end">
                        <!-- Tanpa ikon: ikon panah balik di kamus berarti "dikembalikan" (audit-027 #12). -->
                        <Button v-if="hasFilters" label="Atur ulang filter" severity="secondary" text size="small" class="text-xs !min-h-11 sm:!min-h-9" @click="resetFilters" />
                        <p class="text-xs text-muted-color sm:pb-2" aria-live="polite">
                            Total: <span class="font-bold text-surface-900 dark:text-surface-100">{{ loading || loadError ? '–' : filteredRequests.length }}</span> pengajuan
                        </p>
                    </div>
                </div>
            </div>

            <div v-if="loadError" role="alert" class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                <span>Daftar pengajuan gagal dimuat. Data lama tidak ditampilkan agar tidak keliru.</span>
                <Button label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11" :loading="loading" @click="fetchRequests" />
            </div>

            <!-- Tabel mulai xl; di bawahnya daftar bertumpuk agar kolom Aksi tidak terpotong (audit-027 #3, pola Akun). -->
            <div class="hidden xl:block mt-4">
                <DataTable
                    v-model:first="first"
                    :value="filteredRequests"
                    :loading="loading"
                    paginator
                    :rows="rows"
                    :rowsPerPageOptions="[5, 10, 20, 50]"
                    paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
                    currentPageReportTemplate="Menampilkan {first} - {last} dari {totalRecords} data"
                    :rowHover="true"
                    class="p-datatable-sm text-xs"
                    responsiveLayout="scroll"
                >
                    <template #empty>
                        <div class="text-center py-12 text-sm">
                            <PhFolderOpen :size="40" weight="light" aria-hidden="true" class="text-muted-color mb-3 block mx-auto" />
                            <p class="font-medium text-surface-700 dark:text-surface-300 mb-1">{{ emptyTitle }}</p>
                            <p class="text-xs text-muted-color mb-4">{{ emptyText }}</p>
                            <Button v-if="hasFilters && !loadError" label="Atur ulang filter" severity="secondary" outlined size="small" class="text-xs font-semibold !min-h-9" @click="resetFilters" />
                            <Button v-else-if="canSubmit && !loadError" label="Tambah Pengajuan" size="small" class="text-xs font-semibold !min-h-9" @click="openNewLeave" />
                        </div>
                    </template>

                    <!-- Nomor pengajuan teks netral (bukan tautan) dengan tanggal diajukan; kolom "No" dihapus (audit-027 #3, #10). -->
                    <Column field="created_at" header="Pengajuan" sortable>
                        <template #body="{ data }">
                            <div class="font-mono text-xs whitespace-nowrap text-surface-800 dark:text-surface-200">{{ data.id_request || data.id }}</div>
                            <div class="text-xs text-muted-color whitespace-nowrap">Diajukan {{ formatDate(data.created_at || data.createdAt) }}</div>
                        </template>
                    </Column>

                    <Column header="Jenis Cuti & Alasan" style="min-width: 10rem">
                        <template #body="{ data }">
                            <div class="font-semibold text-xs text-surface-900 dark:text-surface-0">
                                {{ data.nm_leave_type || data.leaveTypeName || data.kd_leave_type || '-' }}
                            </div>
                            <div class="max-w-48 truncate text-xs text-muted-color" :title="data.reason || '-'">{{ data.reason || '-' }}</div>
                        </template>
                    </Column>

                    <Column field="start_date" header="Periode & Durasi" sortable style="min-width: 8rem">
                        <template #body="{ data }">
                            <div class="text-xs text-surface-800 dark:text-surface-200 tabular-nums">
                                {{ formatPeriod(data.start_date || data.startDate, data.end_date || data.endDate) }}
                            </div>
                            <div class="text-xs text-muted-color whitespace-nowrap" title="Sabtu, Minggu & libur nasional tidak dihitung">
                                <span class="tabular-nums">{{ data.total_days ?? data.totalDays ?? '-' }}</span> hari kerja
                            </div>
                        </template>
                    </Column>

                    <Column field="status" header="Status" sortable :pt="{ headerCell: { 'data-tour': 'leave-col-status' } }">
                        <template #body="{ data }">
                            <Tag :value="getStatusLabel(data.status)" :severity="getStatusSeverity(data.status)" class="whitespace-nowrap" />
                            <template v-if="data.status === 'returned' && lastReturnNote(data)?.notes">
                                <p class="mt-1 max-w-44 text-xs leading-snug text-(--status-warn-fg) line-clamp-2">{{ lastReturnNote(data).notes }}</p>
                                <button
                                    v-if="isLongNote(data)"
                                    type="button"
                                    class="mt-0.5 min-h-6 text-xs text-primary underline underline-offset-2 cursor-pointer"
                                    :aria-label="`Baca catatan pengembalian ${data.id_request || data.id}`"
                                    @click="viewDetail(data)"
                                >
                                    Baca catatan
                                </button>
                            </template>
                        </template>
                    </Column>

                    <Column header="Aksi" style="width: 1%" :pt="{ headerCell: { 'data-tour': 'leave-col-aksi', class: 'text-right' }, bodyCell: { class: 'text-right' } }">
                        <template #body="{ data }">
                            <div class="flex items-center justify-end gap-1 whitespace-nowrap">
                                <button
                                    type="button"
                                    :class="[iconBtn, 'hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800']"
                                    :aria-label="`Detail ${data.id_request || data.id}`"
                                    title="Detail"
                                    @click="viewDetail(data)"
                                >
                                    <PhEye :size="16" weight="bold" aria-hidden="true" />
                                </button>

                                <Button
                                    v-if="documentPending(data) && ['submitted', 'pending_validation', 'returned'].includes(data.status)"
                                    size="small"
                                    severity="warn"
                                    text
                                    class="text-xs font-semibold flex items-center gap-1 !min-h-9 !text-(--status-warn-fg)"
                                    :title="`Unggah dokumen paling lambat ${formatDate(data.document_due_date)}`"
                                    @click="openCompleteDocument(data)"
                                >
                                    <PhFileArrowUp :size="14" weight="bold" aria-hidden="true" />
                                    <span>Lengkapi Dokumen</span>
                                </Button>

                                <Button
                                    v-else-if="data.status === 'returned' && canEditReturned"
                                    size="small"
                                    text
                                    class="text-xs font-semibold flex items-center gap-1 !min-h-9"
                                    @click="openEditLeave(data)"
                                >
                                    <PhArrowUUpLeft :size="14" weight="bold" aria-hidden="true" />
                                    <span>Ajukan Ulang</span>
                                </Button>

                                <button
                                    v-else-if="data.status === 'draft' && canSubmit"
                                    type="button"
                                    :class="[iconBtn, 'hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800']"
                                    :aria-label="`Ubah draf ${data.id_request || data.id}`"
                                    title="Ubah draf"
                                    @click="openEditLeave(data)"
                                >
                                    <PhPencilSimple :size="16" weight="bold" aria-hidden="true" />
                                </button>

                                <button
                                    v-if="['submitted', 'draft'].includes(data.status) && canCancel"
                                    type="button"
                                    :class="[iconBtn, 'hover:text-(--status-danger-fg) hover:bg-(--status-danger-bg)']"
                                    :aria-label="`Batalkan ${data.id_request || data.id}`"
                                    title="Batalkan pengajuan"
                                    @click="cancelRequest(data)"
                                >
                                    <PhTrash :size="16" weight="bold" aria-hidden="true" />
                                </button>
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>

            <!-- Daftar HP tanpa kartu bertumpuk: baris dengan pemisah, pola Akun (audit-027 #7, #13). -->
            <div data-tour="leave-list-mobile" class="block xl:hidden mt-4" :aria-busy="loading">
                <p v-if="loading && !filteredRequests.length" class="py-8 text-center text-xs text-muted-color" role="status">Memuat pengajuan…</p>
                <div v-else-if="!filteredRequests.length" class="py-8 text-center text-sm">
                    <PhFolderOpen :size="40" weight="light" aria-hidden="true" class="text-muted-color mb-2.5 block mx-auto" />
                    <p class="font-medium text-surface-700 dark:text-surface-300 mb-1">{{ emptyTitle }}</p>
                    <p class="text-xs text-muted-color mb-3">{{ emptyText }}</p>
                    <Button v-if="hasFilters && !loadError" label="Atur ulang filter" severity="secondary" outlined size="small" class="text-xs font-semibold !min-h-11" @click="resetFilters" />
                    <Button v-else-if="canSubmit && !loadError" label="Tambah Pengajuan" size="small" class="text-xs font-semibold !min-h-11" @click="openNewLeave" />
                </div>

                <ul v-else class="divide-y divide-surface-200 dark:divide-surface-700" :class="{ 'opacity-60': loading }">
                    <li v-for="(item, i) in paginatedMobileRequests" :key="item.id_request || item.id" class="py-3 space-y-2 text-xs">
                        <div class="flex items-start justify-between gap-2">
                            <div class="min-w-0">
                                <div class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ item.nm_leave_type || item.leaveTypeName || item.kd_leave_type || '-' }}</div>
                                <div class="font-mono text-muted-color break-all">{{ item.id_request || item.id }}</div>
                            </div>
                            <!-- Anchor tour kolom Status/Aksi juga di item pertama, karena header tabel tersembunyi di bawah xl. -->
                            <Tag :value="getStatusLabel(item.status)" :severity="getStatusSeverity(item.status)" class="shrink-0" :data-tour="i === 0 ? 'leave-col-status' : undefined" />
                        </div>
                        <div class="text-surface-800 dark:text-surface-200">
                            <span class="tabular-nums">{{ formatPeriod(item.start_date || item.startDate, item.end_date || item.endDate) }}</span> · <span class="tabular-nums">{{ item.total_days ?? item.totalDays ?? '-' }}</span> hari kerja
                        </div>
                        <div class="text-muted-color">Diajukan {{ formatDate(item.created_at || item.createdAt) }}</div>
                        <p v-if="item.reason" class="text-surface-700 dark:text-surface-300 line-clamp-2">{{ item.reason }}</p>
                        <p v-if="item.status === 'returned' && lastReturnNote(item)?.notes" class="leading-snug text-(--status-warn-fg) bg-(--status-warn-bg) p-2 rounded-border">
                            <strong>Catatan pengembalian:</strong> {{ lastReturnNote(item).notes }}
                        </p>
                        <div class="grid grid-cols-2 gap-2 pt-1" :data-tour="i === 0 ? 'leave-col-aksi' : undefined">
                            <Button severity="secondary" outlined size="small" class="text-xs !min-h-11 flex items-center justify-center gap-1.5" :aria-label="`Detail ${item.id_request || item.id}`" @click="viewDetail(item)">
                                <PhEye :size="14" weight="bold" aria-hidden="true" />
                                <span>Detail</span>
                            </Button>
                            <Button
                                v-if="documentPending(item) && ['submitted', 'pending_validation', 'returned'].includes(item.status)"
                                severity="warn"
                                outlined
                                size="small"
                                class="text-xs !min-h-11 flex items-center justify-center gap-1.5 !text-(--status-warn-fg)"
                                @click="openCompleteDocument(item)"
                            >
                                <PhFileArrowUp :size="14" weight="bold" aria-hidden="true" />
                                <span>Lengkapi Dokumen</span>
                            </Button>
                            <Button
                                v-else-if="item.status === 'returned' && canEditReturned"
                                outlined
                                size="small"
                                class="text-xs !min-h-11 flex items-center justify-center gap-1.5"
                                @click="openEditLeave(item)"
                            >
                                <PhArrowUUpLeft :size="14" weight="bold" aria-hidden="true" />
                                <span>Ajukan Ulang</span>
                            </Button>
                            <Button
                                v-else-if="item.status === 'draft' && canSubmit"
                                severity="secondary"
                                outlined
                                size="small"
                                class="text-xs !min-h-11 flex items-center justify-center gap-1.5"
                                @click="openEditLeave(item)"
                            >
                                <PhPencilSimple :size="14" weight="bold" aria-hidden="true" />
                                <span>Ubah Draf</span>
                            </Button>
                            <Button
                                v-if="['submitted', 'draft'].includes(item.status) && canCancel"
                                severity="danger"
                                outlined
                                size="small"
                                class="text-xs !min-h-11 flex items-center justify-center gap-1.5 !text-(--status-danger-fg)"
                                @click="cancelRequest(item)"
                            >
                                <PhTrash :size="14" weight="bold" aria-hidden="true" />
                                <span>Batalkan</span>
                            </Button>
                        </div>
                    </li>
                </ul>

                <Paginator
                    v-if="filteredRequests.length > rows"
                    v-model:first="first"
                    :rows="rows"
                    :totalRecords="filteredRequests.length"
                    template="PrevPageLink PageLinks NextPageLink"
                    class="mt-2 border-0 bg-transparent"
                />
            </div>
        </div>

        <LeaveDetailDialog v-model:visible="detailVisible" :request="selectedRequest" @refresh="fetchRequests" @edit="openEditLeave" />

        <LeaveCompleteDocumentDialog
            v-model:visible="docDialogVisible"
            :request="docRequest"
            @uploaded="fetchRequests"
        />
        <LeaveFormDialog v-model:visible="isLeaveFormVisible" :editId="editingLeaveId" :editingLeave="editingLeaveData" @saved="fetchRequests" />
    </div>
</template>

<style scoped>
/* Judul kolom tidak terlipat ("Tgl. / Pengajuan"); lebar kolom mengikuti isi. */
:deep(.p-datatable-column-title) {
    white-space: nowrap;
}
:deep(.header-center .p-datatable-column-header-content),
:deep(th.text-center .p-datatable-column-header-content) {
    justify-content: center;
}
:deep(.header-right .p-datatable-column-header-content),
:deep(th.text-right .p-datatable-column-header-content) {
    justify-content: flex-end;
}
</style>
