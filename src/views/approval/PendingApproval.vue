<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { approvalService } from '@/service/approvalService';
import {
    currentUser,
    getStatusSeverity,
    getStatusLabel,
    formatDate,
    attachmentInfo,
    documentPending,
    sicutiState,
    setPendingApprovalCount,
    isStepApprover
} from '@/service/sicutiService';
import LeaveDetailDialog from '@/components/leave/LeaveDetailDialog.vue';
import LeaveAttachment from '@/components/leave/LeaveAttachment.vue';
import ApprovalActionDialog from '@/components/approval/ApprovalActionDialog.vue';
import { matchesApprovalSearch } from '@/utils/approvalSearch';
import { PhMagnifyingGlass, PhCheckCircle, PhEye, PhSealCheck, PhArrowsClockwise } from '@phosphor-icons/vue';

const loading = ref(false);
const loadError = ref(false);
const pendingRequests = ref([]);
const selectedRequest = ref(null);
const detailVisible = ref(false);

const searchQuery = ref('');
const departmentFilter = ref(null);
const first = ref(0);
const rows = ref(10);

const paginatedMobileRequests = computed(() => {
    return filteredRequests.value.slice(first.value, first.value + rows.value);
});

watch([searchQuery, departmentFilter], () => {
    first.value = 0;
});
const actionModalVisible = ref(false);
const activeRequest = ref(null);

async function loadPendingApprovals() {
    loading.value = true;
    loadError.value = false;
    try {
        const list = await approvalService.getPendingApprovals();
        setPendingApprovalCount(Array.isArray(list) ? list.length : 0);
        const curUid = currentUser.value?.uid_user_system || currentUser.value?.id;
        pendingRequests.value = (Array.isArray(list) ? list : []).filter((r) => {
            if (Array.isArray(r.steps) && r.steps.length > 0 && curUid) {
                const current = r.steps.filter((s) => s.is_current || s.isCurrent);
                if (current.length) {
                    return current.some((s) => isStepApprover(s, curUid));
                }
            }
            return true;
        });
    } catch (err) {
        console.error('Failed to load pending approvals:', err);
        // Gagal muat tidak boleh tampil sebagai antrean kosong; data lama dikosongkan (audit-029 #1).
        loadError.value = true;
        pendingRequests.value = [];
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    loadPendingApprovals();
});
watch(() => sicutiState.dataVersion, loadPendingApprovals);

const deptOptions = computed(() => {
    const depts = new Set();
    pendingRequests.value.forEach((r) => {
        const d = r.nm_dept || r.kd_dept || r.department;
        if (d) depts.add(d);
    });
    return [
        { label: 'Semua Divisi / Departemen', value: null },
        ...Array.from(depts).map((d) => ({ label: d, value: d }))
    ];
});

const filteredRequests = computed(() => {
    return pendingRequests.value.filter((r) => {
        if (departmentFilter.value) {
            const d = r.nm_dept || r.kd_dept || r.department;
            if (d !== departmentFilter.value) return false;
        }
        return matchesApprovalSearch(r, searchQuery.value);
    });
});

const hasFilters = computed(() => Boolean(searchQuery.value) || departmentFilter.value !== null);

function resetFilters() {
    searchQuery.value = '';
    departmentFilter.value = null;
}

const emptyText = computed(() => {
    if (loadError.value) return 'Antrean belum termuat.';
    return hasFilters.value ? 'Tidak ada pengajuan yang cocok dengan pencarian atau filter.' : 'Tidak ada pengajuan yang menunggu keputusan Anda.';
});

// Rentang ringkas seperti Pengajuan Cuti karyawan: "20 – 22 November 2026" (audit-029 #7).
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
        <!-- Satu kartu: judul, filter dan jumlah, lalu antrean (acuan 00b §6.1, audit-029 #5). -->
        <div class="card !mb-0">
            <div>
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Validasi Pengajuan Cuti</h1>
                <p class="text-xs text-muted-color">Pengajuan cuti yang menunggu validasi dan persetujuan Anda</p>
            </div>

            <div data-tour="pending-filters" class="mt-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div class="grid grid-cols-1 sm:grid-cols-[16rem_14rem] gap-3 w-full sm:w-auto">
                    <div>
                        <label for="cari-antrean-validasi" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Cari</label>
                        <IconField iconPosition="left" class="w-full">
                            <InputIcon class="!flex items-center justify-center">
                                <PhMagnifyingGlass :size="14" weight="bold" aria-hidden="true" class="text-muted-color" />
                            </InputIcon>
                            <InputText id="cari-antrean-validasi" name="cari-antrean-validasi" v-model="searchQuery" placeholder="Nama, nomor, atau jenis cuti" class="w-full text-xs !min-h-11 sm:!min-h-9" size="small" />
                        </IconField>
                    </div>
                    <div>
                        <span id="pending-dept-label" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Divisi</span>
                        <Select
                            v-model="departmentFilter"
                            :options="deptOptions"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Semua Divisi / Departemen"
                            ariaLabelledby="pending-dept-label"
                            class="w-full text-xs !min-h-11 sm:!min-h-9"
                            size="small"
                        />
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Button v-if="hasFilters" label="Atur ulang filter" severity="secondary" text size="small" class="text-xs !min-h-11 sm:!min-h-9" @click="resetFilters" />
                    <p class="text-xs text-muted-color" aria-live="polite">
                        Total: <span class="font-bold text-surface-900 dark:text-surface-100 tabular-nums">{{ loading || loadError ? '–' : filteredRequests.length }}</span> pengajuan
                    </p>
                    <Button severity="secondary" outlined size="small" class="text-xs font-semibold flex items-center gap-1.5 !min-h-11 sm:!min-h-9" :loading="loading" @click="loadPendingApprovals">
                        <PhArrowsClockwise :size="14" weight="bold" aria-hidden="true" />
                        <span>Segarkan</span>
                    </Button>
                </div>
            </div>

            <div v-if="loadError" role="alert" class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                <span>Antrean validasi gagal dimuat. Data lama tidak ditampilkan agar tidak keliru.</span>
                <Button label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11" :loading="loading" @click="loadPendingApprovals" />
            </div>

            <!-- Tabel mulai xl; di bawahnya daftar agar kolom Aksi tidak perlu digeser (pola item 19). -->
            <div data-tour="pending-table" class="hidden xl:block mt-4">
                <DataTable
                    v-model:first="first"
                    :value="filteredRequests"
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

                    <!-- Nomor pengajuan netral satu baris (bukan tautan), teks minimal 12px (audit-029 #6). -->
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

                    <Column header="Jenis Cuti" style="min-width: 9rem">
                        <template #body="{ data }">
                            <div class="font-semibold">{{ data.nm_leave_type || data.leaveTypeName || data.kd_leave_type || '-' }}</div>
                            <LeaveAttachment v-if="attachmentInfo(data) || documentPending(data)" :request="data" :preview="false" compact class="mt-0.5" />
                        </template>
                    </Column>

                    <Column header="Periode & Durasi" style="min-width: 9rem">
                        <template #body="{ data }">
                            <div class="tabular-nums">{{ formatPeriod(data.start_date || data.startDate, data.end_date || data.endDate) }}</div>
                            <div class="text-xs text-muted-color"><span class="tabular-nums">{{ data.total_days ?? data.totalDays }}</span> hari kerja</div>
                        </template>
                    </Column>

                    <Column header="Status" style="width: 1%">
                        <template #body="{ data }">
                            <Tag :value="getStatusLabel(data.status)" :severity="getStatusSeverity(data.status)" class="whitespace-nowrap" />
                        </template>
                    </Column>

                    <Column header="Aksi" style="width: 1%" :pt="{ headerCell: { 'data-tour': 'pending-col-aksi', class: 'text-right' }, bodyCell: { class: 'text-right' } }">
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

            <!-- Daftar HP tanpa kartu bertumpuk: baris dengan pemisah, pola item 19 (audit-029 #5). -->
            <div data-tour="pending-list-mobile" class="block xl:hidden mt-4" :aria-busy="loading">
                <p v-if="loading && !filteredRequests.length" class="py-8 text-center text-xs text-muted-color" role="status">Memuat antrean…</p>
                <div v-else-if="!filteredRequests.length" class="text-center py-10 px-4 text-muted-color">
                    <PhCheckCircle :size="40" weight="light" aria-hidden="true" class="text-muted-color mb-2 block mx-auto" />
                    <p class="max-w-xs mx-auto text-xs">{{ emptyText }}</p>
                </div>

                <!-- Anchor tour tabel/Aksi juga di daftar, karena tabel tersembunyi di bawah xl. -->
                <ul v-else data-tour="pending-table" class="divide-y divide-surface-200 dark:divide-surface-700" :class="{ 'opacity-60': loading }">
                    <li v-for="(item, i) in paginatedMobileRequests" :key="requestId(item)" class="py-3 space-y-2 text-xs">
                        <div class="flex items-start justify-between gap-2">
                            <div class="min-w-0">
                                <div class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ item.requester_name || item.userName }}</div>
                                <div class="text-muted-color">NIK {{ item.namecode || item.userNik || '-' }} · {{ deptOf(item) }}</div>
                            </div>
                            <Tag :value="getStatusLabel(item.status)" :severity="getStatusSeverity(item.status)" class="shrink-0" />
                        </div>
                        <div class="text-surface-800 dark:text-surface-200">
                            {{ item.nm_leave_type || item.leaveTypeName || item.kd_leave_type || '-' }} · <span class="tabular-nums">{{ formatPeriod(item.start_date || item.startDate, item.end_date || item.endDate) }}</span> · <span class="tabular-nums">{{ item.total_days ?? item.totalDays }}</span> hari kerja
                        </div>
                        <div class="font-mono text-muted-color break-all">{{ requestId(item) }}</div>
                        <LeaveAttachment v-if="attachmentInfo(item) || documentPending(item)" :request="item" :preview="false" compact />
                        <div class="grid grid-cols-2 gap-2 pt-1" :data-tour="i === 0 ? 'pending-col-aksi' : undefined">
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
                />
            </div>
        </div>

        <ApprovalActionDialog v-model:visible="actionModalVisible" :request="activeRequest" :reload="loadPendingApprovals" />

        <LeaveDetailDialog
            v-model:visible="detailVisible"
            :request="selectedRequest"
            :showApproveAction="true"
            @process="(req) => { openApprovalModal(req); detailVisible = false; }"
            @refresh="loadPendingApprovals"
        />
    </div>
</template>
