<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { approvalService } from '@/service/approvalService';
import {
    currentUser,
    can,
    formatDate,
    attachmentInfo,
    documentPending,
    sicutiState,
    setPendingApprovalCount,
    isStepApprover
} from '@/service/sicutiService';
import LeaveDetailDialog from '@/components/leave/LeaveDetailDialog.vue';
import LeaveAttachment from '@/components/leave/LeaveAttachment.vue';
import StatStrip from '@/components/common/StatStrip.vue';
import ApprovalActionDialog from '@/components/approval/ApprovalActionDialog.vue';
import { matchesApprovalSearch } from '@/utils/approvalSearch';
import { localIsoDate, onLeaveToday, shortDate } from '@/utils/onLeaveToday';
import {
    PhCheckCircle,
    PhMagnifyingGlass,
    PhSealCheck,
    PhEye,
    PhArrowsClockwise
} from '@phosphor-icons/vue';

const loading = ref(false);
// Gagal muat tidak boleh tampil sebagai 0 / antrean kosong (audit-035 #1).
const pendingFailed = ref(false);
const historyFailed = ref(false);
const loadedOnce = ref(false);
const loadError = computed(() => pendingFailed.value || historyFailed.value);
// Muat pertama: angka belum ada; muat ulang tetap menampilkan angka lama.
const firstLoad = computed(() => loading.value && !loadedOnce.value);
const pendingRequests = ref([]);
const historyRequests = ref([]);

const searchQuery = ref('');

const selectedRequest = ref(null);
const detailVisible = ref(false);

const actionModalVisible = ref(false);
const activeRequest = ref(null);

const pendingCount = computed(() => pendingRequests.value.length);

const approvedCount = computed(() => {
    const curUid = currentUser.value?.uid_user_system || currentUser.value?.id;
    return historyRequests.value.filter((r) => {
        if (r.status === 'approved') return true;
        if (Array.isArray(r.steps)) {
            return r.steps.some((s) => s.status === 'approved' && (s.uid_approver === curUid || s.approver_id === curUid));
        }
        if (Array.isArray(r.approval_records)) {
            return r.approval_records.some((rec) => rec.action === 'approve' && (rec.uid_approver === curUid || rec.approver_id === curUid));
        }
        return false;
    }).length;
});

const totalProcessedCount = computed(() => historyRequests.value.length);

const statItems = computed(() => {
    const show = (failed, value) => (firstLoad.value || failed ? { value: '–', unit: '' } : { value, unit: 'pengajuan' });
    const pendingKnown = !firstLoad.value && !pendingFailed.value;
    return [
        {
            label: 'Menunggu validasi',
            ...show(pendingFailed.value, pendingCount.value),
            hint: !pendingKnown ? 'Antrean belum termuat' : pendingCount.value > 0 ? 'Perlu keputusan Anda' : 'Antrean kosong',
            accent: pendingKnown && pendingCount.value > 0
        },
        { label: 'Disetujui oleh Anda', ...show(historyFailed.value, approvedCount.value), hint: 'Seluruh riwayat' },
        { label: 'Total diproses', ...show(historyFailed.value, totalProcessedCount.value), hint: 'Disetujui, ditolak, dikembalikan' }
    ];
});

const canSeeTodayLeaves = computed(() => can('approval.view_requests', 'approval.validate'));
const todayIso = ref(localIsoDate());
const todayLeaves = ref([]);
// Endpoint on-leave-today gagal (mis. 404): daftar diambil dari riwayat Anda saja, dan itu harus dikatakan (audit-035 #2).
const todayFailed = ref(false);

const todayISO = computed(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

const onLeaveTodayList = computed(() => {
    if (todayLeaves.value && todayLeaves.value.length > 0) {
        return todayLeaves.value;
    }
    const today = todayISO.value;
    return historyRequests.value.filter((r) => {
        if (r.status !== 'approved' && r.status !== 'completed') return false;
        const start = String(r.start_date || r.startDate || '').slice(0, 10);
        const end = String(r.end_date || r.endDate || '').slice(0, 10);
        return start && end && start <= today && end >= today;
    });
});

const approvedToday = computed(() => {
    const today = todayISO.value;
    const curUid = currentUser.value?.uid_user_system || currentUser.value?.id;
    return historyRequests.value.filter((r) => {
        const isToday = (d) => Boolean(d) && String(d).slice(0, 10) === today;
        if (Array.isArray(r.approval_records)) {
            const rec = r.approval_records.find(
                (a) => a.action === 'approve' && (a.approver_id === curUid || a.uid_approver === curUid) && isToday(a.created_at)
            );
            if (rec) return true;
        }
        if (Array.isArray(r.steps)) {
            const step = r.steps.find(
                (s) => s.status === 'approved' && (s.uid_approver === curUid || s.approver_id === curUid) && isToday(s.acted_at)
            );
            if (step) return true;
        }
        if (r.status === 'approved' && isToday(r.updated_at || r.updatedAt)) {
            return true;
        }
        return false;
    });
});

function formatApprovedTime(req) {
    const curUid = currentUser.value?.uid_user_system || currentUser.value?.id;
    let dateVal = null;
    if (Array.isArray(req.approval_records)) {
        const rec = req.approval_records.find((a) => a.action === 'approve' && (a.approver_id === curUid || a.uid_approver === curUid));
        if (rec?.created_at) dateVal = rec.created_at;
    }
    if (!dateVal && Array.isArray(req.steps)) {
        const step = req.steps.find((s) => s.status === 'approved' && (s.uid_approver === curUid || s.approver_id === curUid));
        if (step?.acted_at) dateVal = step.acted_at;
    }
    if (!dateVal) dateVal = req.updated_at || req.updatedAt;
    if (!dateVal) return 'Hari ini';
    try {
        const d = new Date(dateVal);
        return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    } catch {
        return 'Hari ini';
    }
}

async function loadTodayLeaves() {
    if (!canSeeTodayLeaves.value) {
        todayLeaves.value = [];
        return;
    }
    todayIso.value = localIsoDate();
    try {
        todayLeaves.value = onLeaveToday(await approvalService.getOnLeaveToday(), todayIso.value);
        todayFailed.value = false;
    } catch {
        todayLeaves.value = [];
        todayFailed.value = true;
    }
}
async function loadData() {
    loading.value = true;
    void loadTodayLeaves();
    try {
        const curUid = currentUser.value?.uid_user_system || currentUser.value?.id;
        const [pendingRes, historyRes] = await Promise.allSettled([
            approvalService.getPendingApprovals(),
            approvalService.getApprovalHistory()
        ]);

        pendingFailed.value = pendingRes.status === 'rejected';
        historyFailed.value = historyRes.status === 'rejected';
        // Data lama dikosongkan agar tidak tampil sebagai hasil terbaru (pola audit-029 #1).
        if (pendingFailed.value) pendingRequests.value = [];
        if (historyFailed.value) historyRequests.value = [];

        if (pendingRes.status === 'fulfilled') {
            const list = Array.isArray(pendingRes.value) ? pendingRes.value : [];
            setPendingApprovalCount(list.length);
            pendingRequests.value = list.filter((r) => {
                if (Array.isArray(r.steps) && r.steps.length > 0 && curUid) {
                    const currentStep = r.steps.find((s) => s.is_current || s.isCurrent);
                    if (currentStep) {
                        return isStepApprover(currentStep, curUid);
                    }
                }
                return true;
            });
        }

        if (historyRes.status === 'fulfilled') {
            historyRequests.value = Array.isArray(historyRes.value) ? historyRes.value : [];
        }
    } catch (err) {
        console.error('Failed to load approval dashboard data:', err);
    } finally {
        loading.value = false;
        loadedOnce.value = true;
    }
}

onMounted(() => {
    loadData();
});
watch(() => sicutiState.dataVersion, loadData);

const filteredRequests = computed(() => pendingRequests.value.filter((r) => matchesApprovalSearch(r, searchQuery.value)));

const first = ref(0);
const rows = 10;
watch(searchQuery, () => {
    first.value = 0;
});
const paginatedMobileRequests = computed(() => filteredRequests.value.slice(first.value, first.value + rows));

const queueEmptyText = computed(() => {
    if (pendingFailed.value) return 'Antrean belum termuat.';
    return searchQuery.value ? 'Tidak ada pengajuan yang cocok dengan pencarian.' : 'Tidak ada pengajuan yang menunggu keputusan Anda.';
});

const requestId = (r) => r.id_request || r.id;
const startOf = (r) => r.start_date || r.startDate;
const endOf = (r) => r.end_date || r.endDate;
function periodText(r) {
    const s = formatDate(startOf(r));
    const e = formatDate(endOf(r));
    return String(startOf(r)).slice(0, 10) === String(endOf(r)).slice(0, 10) ? s : `${s} – ${e}`;
}

function viewDetail(req) {
    selectedRequest.value = req;
    detailVisible.value = true;
}

function openApprovalModal(req) {
    activeRequest.value = req;
    actionModalVisible.value = true;
}
</script>

<template>
    <div class="space-y-6">
        <div>
            <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Dashboard Approval</h1>
            <p class="text-xs text-muted-color">Antrean validasi dan ringkasan persetujuan Anda</p>
        </div>

        <div v-if="loadError" role="alert" class="flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
            <span>{{ pendingFailed && historyFailed ? 'Antrean dan riwayat persetujuan gagal dimuat.' : pendingFailed ? 'Antrean validasi gagal dimuat.' : 'Riwayat persetujuan gagal dimuat.' }} Angka yang belum termuat ditandai "–".</span>
            <Button label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11 sm:!min-h-9" :loading="loading" @click="loadData" />
        </div>
        <p v-else-if="firstLoad" role="status" class="sr-only">Memuat dashboard approval…</p>

        <StatStrip data-tour="appr-stats" :items="statItems" :aria-busy="firstLoad" />

        <!-- Kartu tanpa border/shadow tambahan di atas .card (00b §6.1, audit-035 #6). -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <section data-tour="appr-today" class="card !mb-0 p-5" aria-labelledby="appr-today-title">
                <div class="flex items-center justify-between gap-3 pb-3 mb-1 border-b border-surface-200 dark:border-surface-800">
                    <div class="flex items-center gap-2">
                        <h2 id="appr-today-title" class="text-base font-bold text-surface-900 dark:text-surface-100 m-0">Sedang Cuti Hari Ini</h2>
                        <span v-if="!firstLoad" class="text-xs font-semibold px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-muted-color tabular-nums">
                            {{ onLeaveTodayList.length }}
                        </span>
                    </div>
                    <router-link
                        v-if="can('dashboard_laporan.view_calendar')"
                        to="/calendar"
                        class="inline-flex items-center min-h-11 sm:min-h-9 px-2 -mr-2 rounded-border text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                        Buka kalender
                    </router-link>
                </div>
                <p v-if="todayFailed" class="mt-2 text-xs text-muted-color">Hanya dari pengajuan yang pernah Anda proses; data cuti seluruh tim belum tersedia.</p>

                <p v-if="firstLoad" class="py-8 text-center text-xs text-muted-color">Memuat…</p>
                <ul v-else-if="onLeaveTodayList.length > 0" class="divide-y divide-surface-200 dark:divide-surface-800">
                    <li
                        v-for="item in onLeaveTodayList.slice(0, 5)"
                        :key="requestId(item)"
                        class="py-2.5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-3 text-xs"
                    >
                        <div class="min-w-0">
                            <div class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ item.nama || item.requester_name || item.userName }}</div>
                            <div class="text-muted-color">NIK {{ item.namecode || item.userNik || item.nip || '-' }}</div>
                        </div>
                        <div class="sm:text-right sm:shrink-0">
                            <div class="text-surface-800 dark:text-surface-200 font-medium">{{ item.nm_leave_type || item.leaveTypeName || item.kd_leave_type }}</div>
                            <div class="text-muted-color tabular-nums">{{ periodText(item) }} · {{ item.total_days ?? item.totalDays }} hari</div>
                        </div>
                    </li>
                </ul>
                <!-- Tanpa klaim "seluruh tim aktif": daftarnya bisa tidak lengkap (audit-035 #2). -->
                <p v-else class="py-8 text-center text-sm text-muted-color">Tidak ada karyawan yang tercatat cuti hari ini.</p>
            </section>

            <section class="card !mb-0 p-5" aria-labelledby="appr-approved-title">
                <div class="flex items-center justify-between gap-3 pb-3 mb-1 border-b border-surface-200 dark:border-surface-800">
                    <div class="flex items-center gap-2">
                        <h2 id="appr-approved-title" class="text-base font-bold text-surface-900 dark:text-surface-100 m-0">Disetujui Hari Ini</h2>
                        <span v-if="!firstLoad && !historyFailed" class="text-xs font-semibold px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-muted-color tabular-nums">
                            {{ approvedToday.length }}
                        </span>
                    </div>
                    <router-link
                        v-if="can('approval.view_requests')"
                        to="/approval/history"
                        class="inline-flex items-center min-h-11 sm:min-h-9 px-2 -mr-2 rounded-border text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                        Lihat riwayat
                    </router-link>
                </div>

                <p v-if="firstLoad" class="py-8 text-center text-xs text-muted-color">Memuat…</p>
                <p v-else-if="historyFailed" class="py-8 text-center text-sm text-muted-color">Riwayat belum termuat.</p>
                <ul v-else-if="approvedToday.length > 0" class="divide-y divide-surface-200 dark:divide-surface-800">
                    <li
                        v-for="item in approvedToday.slice(0, 5)"
                        :key="requestId(item)"
                        class="py-2 flex items-center justify-between gap-3 text-xs"
                    >
                        <div class="min-w-0">
                            <div class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ item.requester_name || item.userName || item.nama }}</div>
                            <div class="text-muted-color">
                                {{ item.nm_leave_type || item.leaveTypeName || item.kd_leave_type }} · {{ item.total_days ?? item.totalDays }} hari kerja · <span class="tabular-nums">{{ formatApprovedTime(item) }}</span>
                            </div>
                            <div class="font-mono text-muted-color break-all">{{ requestId(item) }}</div>
                        </div>
                        <Button severity="secondary" text size="small" class="text-xs shrink-0 !min-h-11 sm:!min-h-9" :aria-label="`Detail ${requestId(item)}`" @click="viewDetail(item)">
                            <PhEye :size="14" weight="bold" aria-hidden="true" />
                            <span>Detail</span>
                        </Button>
                    </li>
                </ul>
                <p v-else class="py-8 text-center text-sm text-muted-color">Belum ada pengajuan yang Anda setujui hari ini.</p>
            </section>
        </div>

        <!-- Satu kartu: judul, cari, lalu antrean (pola item 21, audit-035 #6). -->
        <section data-tour="appr-queue" class="card !mb-0" aria-labelledby="appr-queue-title">
            <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <h2 id="appr-queue-title" class="text-base font-bold text-surface-900 dark:text-surface-100 m-0">Antrean Menunggu Validasi</h2>
                    <p class="text-xs text-muted-color">Pengajuan yang menunggu keputusan Anda</p>
                </div>
                <p class="text-xs text-muted-color" aria-live="polite">
                    Total: <span class="font-bold text-surface-900 dark:text-surface-100 tabular-nums">{{ firstLoad || pendingFailed ? '–' : filteredRequests.length }}</span> pengajuan
                </p>
            </div>

            <div class="mt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div class="w-full sm:w-72">
                    <label for="cari-antrean-dashboard" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Cari</label>
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon class="!flex items-center justify-center">
                            <PhMagnifyingGlass :size="14" weight="bold" aria-hidden="true" class="text-muted-color" />
                        </InputIcon>
                        <InputText id="cari-antrean-dashboard" name="cari-antrean-dashboard" v-model="searchQuery" placeholder="Nama, nomor, atau jenis cuti" class="w-full text-xs !min-h-11 sm:!min-h-9" size="small" />
                    </IconField>
                </div>
                <Button severity="secondary" outlined size="small" class="text-xs font-semibold flex items-center justify-center gap-1.5 !min-h-11 sm:!min-h-9" :loading="loading" @click="loadData">
                    <PhArrowsClockwise :size="14" weight="bold" aria-hidden="true" />
                    <span>Segarkan</span>
                </Button>
            </div>

            <!-- Tabel mulai xl; di bawahnya daftar agar kolom Aksi tidak perlu digeser (pola item 21). -->
            <div class="hidden xl:block mt-4">
                <DataTable
                    v-model:first="first"
                    :value="filteredRequests"
                    :loading="loading"
                    paginator
                    :rows="rows"
                    class="p-datatable-sm text-xs"
                    dataKey="id_request"
                >
                    <template #empty>
                        <div class="text-center py-10 px-4 text-muted-color">
                            <PhCheckCircle :size="40" weight="light" aria-hidden="true" class="text-muted-color mb-2 block mx-auto" />
                            <p class="max-w-xs mx-auto">{{ queueEmptyText }}</p>
                        </div>
                    </template>

                    <!-- Nomor pengajuan netral (bukan tautan), teks minimal 12px (audit-035 #4). -->
                    <Column header="Pengajuan">
                        <template #body="{ data }">
                            <div class="font-mono whitespace-nowrap text-surface-800 dark:text-surface-200">{{ requestId(data) }}</div>
                            <div class="text-xs text-muted-color">Diajukan {{ formatDate(data.created_at || data.createdAt) }}</div>
                        </template>
                    </Column>

                    <Column header="Karyawan" style="min-width: 10rem">
                        <template #body="{ data }">
                            <div class="font-semibold text-surface-900 dark:text-surface-100">{{ data.requester_name || data.userName }}</div>
                            <div class="text-xs text-muted-color">NIK {{ data.namecode || data.userNik || '-' }}</div>
                        </template>
                    </Column>

                    <Column header="Jenis Cuti" style="min-width: 9rem">
                        <template #body="{ data }">
                            <div class="font-semibold">{{ data.nm_leave_type || data.leaveTypeName || data.kd_leave_type || '-' }}</div>
                            <LeaveAttachment v-if="attachmentInfo(data) || documentPending(data)" :request="data" :preview="false" compact class="mt-0.5" />
                        </template>
                    </Column>

                    <Column header="Periode & Durasi" style="min-width: 9rem">
                        <template #body="{ data }">
                            <div class="tabular-nums">{{ periodText(data) }}</div>
                            <div class="text-xs text-muted-color"><span class="tabular-nums">{{ data.total_days ?? data.totalDays }}</span> hari kerja</div>
                        </template>
                    </Column>

                    <Column header="Aksi" style="width: 1%" :pt="{ headerCell: { class: 'text-right' }, bodyCell: { class: 'text-right' } }">
                        <template #body="{ data }">
                            <div class="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                <button
                                    type="button"
                                    class="inline-flex items-center justify-center min-w-9 min-h-9 rounded-border text-surface-600 dark:text-surface-300 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                    :aria-label="`Detail ${requestId(data)}`"
                                    title="Detail"
                                    @click="viewDetail(data)"
                                >
                                    <PhEye :size="16" weight="bold" aria-hidden="true" />
                                </button>
                                <Button size="small" severity="primary" class="text-xs font-semibold flex items-center gap-1 !min-h-9" :aria-label="`Proses ${requestId(data)}`" @click="openApprovalModal(data)">
                                    <PhSealCheck :size="14" weight="bold" aria-hidden="true" />
                                    <span>Proses</span>
                                </Button>
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>

            <div class="block xl:hidden mt-4" :aria-busy="loading">
                <p v-if="loading && !filteredRequests.length" class="py-8 text-center text-xs text-muted-color">Memuat antrean…</p>
                <div v-else-if="!filteredRequests.length" class="text-center py-10 px-4 text-muted-color">
                    <PhCheckCircle :size="40" weight="light" aria-hidden="true" class="text-muted-color mb-2 block mx-auto" />
                    <p class="max-w-xs mx-auto text-xs">{{ queueEmptyText }}</p>
                </div>
                <ul v-else class="divide-y divide-surface-200 dark:divide-surface-700" :class="{ 'opacity-60': loading }">
                    <li v-for="item in paginatedMobileRequests" :key="requestId(item)" class="py-3 space-y-2 text-xs">
                        <div>
                            <div class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ item.requester_name || item.userName }}</div>
                            <div class="text-muted-color">NIK {{ item.namecode || item.userNik || '-' }}</div>
                        </div>
                        <div class="text-surface-800 dark:text-surface-200">
                            {{ item.nm_leave_type || item.leaveTypeName || item.kd_leave_type || '-' }} · <span class="tabular-nums">{{ periodText(item) }}</span> · <span class="tabular-nums">{{ item.total_days ?? item.totalDays }}</span> hari kerja
                        </div>
                        <div class="font-mono text-muted-color break-all">{{ requestId(item) }} · diajukan {{ formatDate(item.created_at || item.createdAt) }}</div>
                        <LeaveAttachment v-if="attachmentInfo(item) || documentPending(item)" :request="item" :preview="false" compact />
                        <div class="grid grid-cols-2 gap-2 pt-1">
                            <Button severity="secondary" outlined size="small" class="text-xs !min-h-11 flex items-center justify-center gap-1.5" :aria-label="`Detail ${requestId(item)}`" @click="viewDetail(item)">
                                <PhEye :size="14" weight="bold" aria-hidden="true" />
                                <span>Detail</span>
                            </Button>
                            <Button severity="primary" size="small" class="text-xs !min-h-11 flex items-center justify-center gap-1.5" :aria-label="`Proses ${requestId(item)}`" @click="openApprovalModal(item)">
                                <PhSealCheck :size="14" weight="bold" aria-hidden="true" />
                                <span>Proses</span>
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
                    :pt="{ prev: { class: '!min-w-11 !min-h-11' }, next: { class: '!min-w-11 !min-h-11' }, page: { class: '!min-w-11 !min-h-11' } }"
                />
            </div>
        </section>

        <ApprovalActionDialog v-model:visible="actionModalVisible" :request="activeRequest" :reload="loadData" />

        <LeaveDetailDialog
            v-model:visible="detailVisible"
            :request="selectedRequest"
            :showApproveAction="true"
            @process="(req) => { openApprovalModal(req); detailVisible = false; }"
            @refresh="loadData"
        />
    </div>
</template>
