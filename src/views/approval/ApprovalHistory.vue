<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { approvalService } from '@/service/approvalService';
import {
    currentUser,
    getStatusSeverity,
    getStatusLabel,
    formatDate,
    formatDateTime
} from '@/service/sicutiService';
import LeaveDetailDialog from '@/components/leave/LeaveDetailDialog.vue';
import { PhClock, PhMagnifyingGlass, PhEye, PhCheckCircle, PhArrowsClockwise } from '@phosphor-icons/vue';

const loading = ref(false);
const loadError = ref(false);
const historyRequests = ref([]);
const selectedRequest = ref(null);
const detailVisible = ref(false);
const searchQuery = ref('');
const statusFilter = ref(null);
const first = ref(0);
const rows = ref(10);

const paginatedMobileRequests = computed(() => {
    return processedRequests.value.slice(first.value, first.value + rows.value);
});

watch([searchQuery, statusFilter], () => {
    first.value = 0;
});

// Opsi dari status yang ada di data: riwayat juga memuat pengajuan yang masih menunggu approver berikutnya (audit-030 #2).
const statusOptions = computed(() => [
    { label: 'Semua status', value: null },
    ...[...new Set(historyRequests.value.map((r) => r.status).filter(Boolean))].map((s) => ({ label: getStatusLabel(s), value: s }))
]);

async function loadHistory() {
    loading.value = true;
    loadError.value = false;
    try {
        const list = await approvalService.getApprovalHistory();
        historyRequests.value = Array.isArray(list) ? list : [];
    } catch (err) {
        console.error('Failed to load approval history:', err);
        // Gagal muat tidak boleh tampil sebagai riwayat kosong; data lama dikosongkan (audit-030 #1).
        loadError.value = true;
        historyRequests.value = [];
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    loadHistory();
});

const processedRequests = computed(() => {
    return historyRequests.value.filter((r) => {
        if (statusFilter.value && r.status !== statusFilter.value) {
            return false;
        }

        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase().trim();
            const userName = (r.requester_name || r.userName || '').toLowerCase();
            const id = (r.id_request || r.id || '').toLowerCase();
            const type = (r.nm_leave_type || r.leaveTypeName || r.kd_leave_type || '').toLowerCase();
            const note = getLastNotes(r).toLowerCase();
            if (!userName.includes(q) && !id.includes(q) && !type.includes(q) && !note.includes(q)) {
                return false;
            }
        }
        return true;
    });
});

const hasFilters = computed(() => Boolean(searchQuery.value) || statusFilter.value !== null);

function resetFilters() {
    searchQuery.value = '';
    statusFilter.value = null;
}

const emptyText = computed(() => {
    if (loadError.value) return 'Riwayat belum termuat.';
    return hasFilters.value ? 'Tidak ada riwayat yang cocok dengan pencarian atau filter.' : 'Belum ada pengajuan yang Anda proses.';
});

function myLastRecord(r) {
    const uid = currentUser.value?.id;
    const mine = (r.approval_records || [])
        .filter((rec) => rec.approver_id === uid)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return mine[mine.length - 1] || null;
}

function getLastApprovalDate(r) {
    return myLastRecord(r)?.created_at || r.updated_at || r.created_at;
}

function getLastNotes(r) {
    return myLastRecord(r)?.notes || '';
}

// Keputusan approver yang login, terpisah dari status pengajuan sekarang (audit-030 #2).
const ACTION_STATUS = { approve: 'approved', reject: 'rejected', return: 'returned' };
const myDecision = (r) => ACTION_STATUS[myLastRecord(r)?.action] || null;

// Sama dengan Validasi Pengajuan; src/utils tidak diubah. shortcut: salinan ketiga (juga di PendingApproval, LeaveHistory), satukan saat crosscheck global.
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

const requestId = (r) => r.id_request || r.id;
const deptOf = (r) => r.nm_dept || r.kd_dept || r.department || '-';
const leaveTypeOf = (r) => r.nm_leave_type || r.leaveTypeName || r.kd_leave_type || '-';

function viewDetail(req) {
    selectedRequest.value = req;
    detailVisible.value = true;
}
</script>

<template>
    <div class="space-y-6">
        <!-- Satu kartu: judul, filter dan jumlah, lalu riwayat (acuan 00b §6.1, audit-030 #6). -->
        <div class="card !mb-0">
            <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                    <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Riwayat Persetujuan Cuti</h1>
                    <p class="text-xs text-muted-color">Pengajuan cuti yang pernah Anda proses, beserta keputusan Anda dan status sekarang</p>
                </div>
                <Button
                    severity="secondary"
                    outlined
                    size="small"
                    class="text-xs font-semibold flex items-center gap-1.5 self-start shrink-0 !min-h-11 sm:!min-h-9"
                    @click="$router.push('/approval/pending')"
                >
                    <PhClock :size="14" weight="bold" aria-hidden="true" />
                    <span>Lihat Antrean Validasi</span>
                </Button>
            </div>

            <div data-tour="history-filters" class="mt-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div class="grid grid-cols-1 sm:grid-cols-[16rem_14rem] gap-3 w-full sm:w-auto">
                    <div>
                        <label for="cari-riwayat-approval" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Cari</label>
                        <IconField iconPosition="left" class="w-full">
                            <InputIcon class="!flex items-center justify-center">
                                <PhMagnifyingGlass :size="14" weight="bold" aria-hidden="true" class="text-muted-color" />
                            </InputIcon>
                            <InputText id="cari-riwayat-approval" name="cari-riwayat-approval" v-model="searchQuery" placeholder="Nama, nomor, jenis cuti, atau catatan" class="w-full text-xs !min-h-11 sm:!min-h-9" size="small" />
                        </IconField>
                    </div>
                    <div>
                        <span id="history-status-label" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Status sekarang</span>
                        <Select
                            v-model="statusFilter"
                            :options="statusOptions"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Semua status"
                            ariaLabelledby="history-status-label"
                            class="w-full text-xs !min-h-11 sm:!min-h-9"
                            size="small"
                        />
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Button v-if="hasFilters" label="Atur ulang filter" severity="secondary" text size="small" class="text-xs !min-h-11 sm:!min-h-9" @click="resetFilters" />
                    <p class="text-xs text-muted-color" aria-live="polite">
                        Total: <span class="font-bold text-surface-900 dark:text-surface-100 tabular-nums">{{ loading || loadError ? '–' : processedRequests.length }}</span> pengajuan
                    </p>
                    <Button severity="secondary" outlined size="small" class="text-xs font-semibold flex items-center gap-1.5 !min-h-11 sm:!min-h-9" :loading="loading" @click="loadHistory">
                        <PhArrowsClockwise :size="14" weight="bold" aria-hidden="true" />
                        <span>Segarkan</span>
                    </Button>
                </div>
            </div>

            <div v-if="loadError" role="alert" class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                <span>Riwayat persetujuan gagal dimuat. Data lama tidak ditampilkan agar tidak keliru.</span>
                <Button label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11" :loading="loading" @click="loadHistory" />
            </div>

            <!-- Tabel mulai xl; di bawahnya daftar agar kolom Aksi tidak perlu digeser (pola item 19/21, audit-030 #3). -->
            <div class="hidden xl:block mt-4">
                <DataTable
                    v-model:first="first"
                    :value="processedRequests"
                    :loading="loading"
                    paginator
                    :rows="rows"
                    class="p-datatable-sm text-xs"
                    responsiveLayout="scroll"
                    dataKey="id_request"
                >
                    <template #empty>
                        <div class="text-center py-10 px-4 text-muted-color">
                            <PhCheckCircle :size="40" weight="light" aria-hidden="true" class="text-muted-color mb-2 block mx-auto" />
                            <p class="max-w-xs mx-auto">{{ emptyText }}</p>
                        </div>
                    </template>

                    <!-- Nomor netral satu baris (bukan tautan), teks minimal 12px (audit-030 #9, #10). -->
                    <Column header="Pengajuan">
                        <template #body="{ data }">
                            <div class="font-mono whitespace-nowrap text-surface-800 dark:text-surface-200">{{ requestId(data) }}</div>
                            <div class="text-xs text-muted-color">Diajukan {{ formatDate(data.created_at || data.createdAt) }}</div>
                        </template>
                    </Column>

                    <Column header="Karyawan" style="min-width: 10rem">
                        <template #body="{ data }">
                            <div class="font-semibold text-surface-900 dark:text-surface-100">{{ data.requester_name || data.userName }}</div>
                            <div class="text-xs text-muted-color">NIK {{ data.namecode || data.userNik || '-' }} · {{ deptOf(data) }}</div>
                        </template>
                    </Column>

                    <Column header="Cuti" style="min-width: 9rem">
                        <template #body="{ data }">
                            <div class="font-semibold">{{ leaveTypeOf(data) }}</div>
                            <div class="text-xs text-muted-color">
                                <span class="tabular-nums">{{ formatPeriod(data.start_date || data.startDate, data.end_date || data.endDate) }}</span> ·
                                <span class="tabular-nums">{{ data.total_days ?? data.totalDays }}</span> hari kerja
                            </div>
                        </template>
                    </Column>

                    <Column header="Keputusan Anda" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag v-if="myDecision(data)" :value="getStatusLabel(myDecision(data))" :severity="getStatusSeverity(myDecision(data))" class="whitespace-nowrap" />
                            <span v-else class="text-muted-color">–</span>
                            <div class="text-xs text-muted-color mt-0.5 tabular-nums">{{ formatDateTime(getLastApprovalDate(data)) }}</div>
                        </template>
                    </Column>

                    <Column header="Status sekarang" style="width: 1%" :pt="{ headerCell: { 'data-tour': 'history-col-status' } }">
                        <template #body="{ data }">
                            <Tag :value="getStatusLabel(data.status)" :severity="getStatusSeverity(data.status)" class="whitespace-nowrap" />
                        </template>
                    </Column>

                    <Column header="Catatan Anda" style="min-width: 7rem" :pt="{ headerCell: { 'data-tour': 'history-col-notes' } }">
                        <template #body="{ data }">
                            <div v-if="getLastNotes(data)" class="text-surface-700 dark:text-surface-300 line-clamp-2" :title="getLastNotes(data)">{{ getLastNotes(data) }}</div>
                            <span v-else class="text-muted-color">Tanpa catatan</span>
                        </template>
                    </Column>

                    <Column header="Aksi" style="width: 1%" :pt="{ headerCell: { class: 'text-right' }, bodyCell: { class: 'text-right' } }">
                        <template #body="{ data }">
                            <button
                                type="button"
                                class="inline-flex items-center justify-center min-w-9 min-h-9 rounded-border text-surface-600 dark:text-surface-300 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                :aria-label="`Detail ${requestId(data)}`"
                                title="Detail"
                                @click="viewDetail(data)"
                            >
                                <PhEye :size="16" weight="bold" aria-hidden="true" />
                            </button>
                        </template>
                    </Column>
                </DataTable>
            </div>

            <!-- Daftar di bawah xl tanpa kartu bertumpuk: baris dengan pemisah (pola item 21, audit-030 #7). -->
            <div data-tour="history-list-mobile" class="block xl:hidden mt-4" :aria-busy="loading">
                <p v-if="loading && !processedRequests.length" class="py-8 text-center text-xs text-muted-color" role="status">Memuat riwayat…</p>
                <div v-else-if="!processedRequests.length" class="text-center py-10 px-4 text-muted-color">
                    <PhCheckCircle :size="40" weight="light" aria-hidden="true" class="text-muted-color mb-2 block mx-auto" />
                    <p class="max-w-xs mx-auto text-xs">{{ emptyText }}</p>
                </div>

                <ul v-else class="divide-y divide-surface-200 dark:divide-surface-700" :class="{ 'opacity-60': loading }">
                    <li v-for="(item, i) in paginatedMobileRequests" :key="requestId(item)" class="py-3 space-y-2 text-xs">
                        <div class="min-w-0">
                            <div class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ item.requester_name || item.userName }}</div>
                            <div class="text-muted-color">NIK {{ item.namecode || item.userNik || '-' }} · {{ deptOf(item) }}</div>
                        </div>
                        <div class="text-surface-800 dark:text-surface-200">
                            {{ leaveTypeOf(item) }} · <span class="tabular-nums">{{ formatPeriod(item.start_date || item.startDate, item.end_date || item.endDate) }}</span> · <span class="tabular-nums">{{ item.total_days ?? item.totalDays }}</span> hari kerja
                        </div>
                        <div class="font-mono text-muted-color break-all">{{ requestId(item) }}</div>

                        <!-- Anchor tour kolom juga di baris pertama, karena tabel tersembunyi di bawah xl. -->
                        <dl class="grid grid-cols-2 gap-x-3 gap-y-1">
                            <div>
                                <dt class="text-muted-color">Keputusan Anda</dt>
                                <dd class="mt-0.5">
                                    <Tag v-if="myDecision(item)" :value="getStatusLabel(myDecision(item))" :severity="getStatusSeverity(myDecision(item))" />
                                    <span v-else>–</span>
                                    <span class="block text-muted-color tabular-nums mt-0.5">{{ formatDateTime(getLastApprovalDate(item)) }}</span>
                                </dd>
                            </div>
                            <div :data-tour="i === 0 ? 'history-col-status' : undefined">
                                <dt class="text-muted-color">Status sekarang</dt>
                                <dd class="mt-0.5"><Tag :value="getStatusLabel(item.status)" :severity="getStatusSeverity(item.status)" /></dd>
                            </div>
                            <div class="col-span-2 pt-1" :data-tour="i === 0 ? 'history-col-notes' : undefined">
                                <dt class="text-muted-color">Catatan Anda</dt>
                                <dd v-if="getLastNotes(item)" class="mt-0.5 text-surface-800 dark:text-surface-200 line-clamp-3">{{ getLastNotes(item) }}</dd>
                                <dd v-else class="mt-0.5 text-muted-color">Tanpa catatan</dd>
                            </div>
                        </dl>

                        <Button severity="secondary" outlined size="small" class="w-full sm:w-auto text-xs !min-h-11 sm:!min-h-9 flex items-center justify-center gap-1.5" :aria-label="`Detail ${requestId(item)}`" @click="viewDetail(item)">
                            <PhEye :size="14" weight="bold" aria-hidden="true" />
                            <span>Detail</span>
                        </Button>
                    </li>
                </ul>

                <Paginator
                    v-if="processedRequests.length > rows"
                    v-model:first="first"
                    :rows="rows"
                    :totalRecords="processedRequests.length"
                    template="PrevPageLink PageLinks NextPageLink"
                    class="mt-2 border-0 bg-transparent"
                />
            </div>
        </div>

        <LeaveDetailDialog
            v-model:visible="detailVisible"
            :request="selectedRequest"
            @refresh="loadHistory"
        />
    </div>
</template>
