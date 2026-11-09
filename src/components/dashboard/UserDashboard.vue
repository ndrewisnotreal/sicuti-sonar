<script setup>
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { leaveService } from '@/service/leaveService';
import {
    getStatusSeverity,
    getStatusLabel,
    formatDate,
    can
} from '@/service/sicutiService';
import LeaveDetailDialog from '@/components/leave/LeaveDetailDialog.vue';
import StatStrip from '@/components/common/StatStrip.vue';
import DashboardMiniCalendar from '@/components/dashboard/DashboardMiniCalendar.vue';
import {
    PhPlus,
    PhFolderOpen,
    PhEye,
    PhCalendarCheck,
    PhCalendarDots,
    PhCalendarMinus,
    PhClockCounterClockwise
} from '@phosphor-icons/vue';

const router = useRouter();

const loading = ref(false);
const balances = ref([]);
const recentLeaves = ref([]);
// Gagal muat tidak boleh tampil sebagai saldo 0 atau "belum ada pengajuan" (audit-036 #1).
const balanceFailed = ref(false);
const leavesFailed = ref(false);
const loadedOnce = ref(false);
const firstLoad = computed(() => loading.value && !loadedOnce.value);

const selectedRequest = ref(null);
const detailVisible = ref(false);

const todayDate = new Date();
const balanceYear = todayDate.getFullYear();

// Tanpa data saldo: null, bukan kuota 12 karangan (audit-036 #2).
const activeBalance = computed(() => {
    if (!balances.value.length) return null;
    const found = balances.value.find((b) => Number(b.year) === balanceYear) || balances.value[0];
    return {
        remaining: Number(found.remaining ?? (Number(found.annual_quota || 0) + Number(found.carry_over_days || 0) - Number(found.used_days || 0))),
        annual_quota: Number(found.annual_quota ?? 0),
        used_days: Number(found.used_days ?? 0),
        carry_over_days: Number(found.carry_over_days ?? 0),
        carry_over_expiry_date: found.carry_over_expiry_date || null,
        year: found.year || balanceYear,
        period_label: found.period_label || ''
    };
});

const statItems = computed(() => {
    const b = activeBalance.value;
    if (!b) {
        const hint = firstLoad.value ? 'Memuat…' : balanceFailed.value ? 'Saldo belum termuat' : 'Belum ada data saldo';
        return [
            { label: 'Saldo tersisa', value: '–', hint, accent: true, icon: PhCalendarCheck },
            { label: 'Hak kuota tahunan', value: '–', hint, icon: PhCalendarDots },
            { label: 'Cuti terpakai', value: '–', hint, icon: PhCalendarMinus },
            { label: 'Carry over', value: '–', hint, icon: PhClockCounterClockwise }
        ];
    }
    return [
        {
            label: 'Saldo tersisa',
            value: b.remaining,
            unit: 'hari',
            hint: `dari ${b.annual_quota + b.carry_over_days} hari`,
            accent: true,
            icon: PhCalendarCheck
        },
        {
            label: 'Hak kuota tahunan',
            value: b.annual_quota,
            unit: 'hari',
            hint: `Periode ${b.period_label || b.year}`,
            icon: PhCalendarDots
        },
        {
            label: 'Cuti terpakai',
            value: b.used_days,
            unit: 'hari',
            hint: 'Sudah disetujui',
            icon: PhCalendarMinus
        },
        {
            label: 'Carry over',
            value: b.carry_over_days,
            unit: 'hari',
            hint: b.carry_over_days > 0 && b.carry_over_expiry_date ? `Hangus ${formatDate(b.carry_over_expiry_date)}` : 'Tidak ada carry over',
            icon: PhClockCounterClockwise
        }
    ];
});

const recentFiveLeaves = computed(() => {
    return (recentLeaves.value || []).slice(0, 5);
});

async function loadDashboardData() {
    loading.value = true;
    try {
        const [balRes, leavesRes] = await Promise.allSettled([
            leaveService.getBalances({ year: balanceYear }),
            leaveService.getMyLeaves({ limit: 20 })
        ]);

        balanceFailed.value = balRes.status === 'rejected';
        leavesFailed.value = leavesRes.status === 'rejected';
        const bal = balRes.value;
        balances.value = balanceFailed.value ? [] : Array.isArray(bal) ? bal : bal ? [bal] : [];
        recentLeaves.value = !leavesFailed.value && Array.isArray(leavesRes.value) ? leavesRes.value : [];
    } catch (err) {
        console.error('Failed to load dashboard data:', err);
    } finally {
        loading.value = false;
        loadedOnce.value = true;
    }
}

const requestId = (r) => r.id_request || r.id;
const startOf = (r) => r.start_date || r.startDate;
const endOf = (r) => r.end_date || r.endDate;
function periodText(r) {
    const s = formatDate(startOf(r));
    return String(startOf(r)).slice(0, 10) === String(endOf(r)).slice(0, 10) ? s : `${s} – ${formatDate(endOf(r))}`;
}

onMounted(() => {
    loadDashboardData();
});

function startNewLeave() {
    router.push({ path: '/leave/history', query: { action: 'new_leave' } });
}

function editFromDetail(req) {
    router.push({ path: '/leave/history', query: { editId: req.id_request || req.id } });
}

function viewDetail(request) {
    selectedRequest.value = request;
    detailVisible.value = true;
}
</script>

<template>
    <div class="space-y-6">
        <div>
            <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Dashboard Karyawan</h1>
            <p class="text-xs text-muted-color">Saldo dan riwayat pengajuan cuti Anda</p>
        </div>

        <div v-if="balanceFailed || leavesFailed" role="alert" class="flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
            <span>{{ balanceFailed && leavesFailed ? 'Saldo dan riwayat pengajuan gagal dimuat.' : balanceFailed ? 'Saldo cuti gagal dimuat.' : 'Riwayat pengajuan gagal dimuat.' }}</span>
            <Button label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11 sm:!min-h-9" :loading="loading" @click="loadDashboardData" />
        </div>
        <p v-else-if="firstLoad" role="status" class="sr-only">Memuat dashboard…</p>

        <StatStrip data-tour="dash-stats" :items="statItems" :aria-busy="firstLoad" />

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div class="lg:col-span-8">
                <!-- .card tanpa border/shadow tambahan (00b §6.1, audit-036 #5). -->
                <section data-tour="dash-riwayat" class="card !mb-0" aria-labelledby="dash-riwayat-title">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-200 dark:border-surface-800">
                        <div>
                            <h2 id="dash-riwayat-title" class="font-bold text-base text-surface-900 dark:text-surface-0 m-0">Riwayat Pengajuan</h2>
                            <p class="text-xs text-muted-color mt-0.5">Lima pengajuan terbaru Anda</p>
                        </div>
                        <Button
                            v-if="can('pengajuan_cuti.submit')"
                            data-tour="dash-ajukan"
                            size="small"
                            class="text-xs font-semibold flex items-center justify-center gap-1.5 self-stretch sm:self-auto !min-h-11 sm:!min-h-9"
                            @click="startNewLeave"
                        >
                            <PhPlus :size="14" weight="bold" aria-hidden="true" />
                            <span>Ajukan Cuti</span>
                        </Button>
                    </div>

                    <p v-if="firstLoad" class="py-10 text-center text-xs text-muted-color">Memuat riwayat…</p>
                    <p v-else-if="leavesFailed" class="py-10 text-center text-sm text-muted-color">Riwayat belum termuat.</p>
                    <div v-else-if="!recentFiveLeaves.length" class="text-center py-10 px-4">
                        <PhFolderOpen :size="32" weight="light" aria-hidden="true" class="text-muted-color mb-2 block mx-auto" />
                        <p class="font-semibold text-sm text-surface-900 dark:text-surface-100">Belum ada pengajuan cuti</p>
                        <!-- Satu ajakan saja: tombol Ajukan Cuti di judul kartu (audit-036 #8). -->
                        <p class="text-xs text-muted-color mt-1 max-w-xs mx-auto">
                            Anda belum pernah mengajukan cuti.<template v-if="can('pengajuan_cuti.submit')"> Gunakan tombol Ajukan Cuti untuk membuat permohonan.</template>
                        </p>
                    </div>

                    <template v-else>
                        <!-- Tabel mulai xl; di bawahnya daftar agar kolom Aksi tidak perlu digeser (pola item 19). -->
                        <div class="hidden xl:block mt-1">
                            <DataTable :value="recentFiveLeaves" :loading="loading" class="p-datatable-sm text-xs">
                                <Column header="Diajukan">
                                    <template #body="{ data }">
                                        <span class="whitespace-nowrap tabular-nums text-surface-900 dark:text-surface-0">{{ formatDate(data.created_at || data.createdAt) }}</span>
                                    </template>
                                </Column>
                                <Column header="Jenis Cuti" style="min-width: 7.5rem">
                                    <template #body="{ data }">
                                        <span class="font-medium whitespace-nowrap text-surface-900 dark:text-surface-0">{{ data.nm_leave_type || data.leaveTypeName || data.kd_leave_type || '-' }}</span>
                                    </template>
                                </Column>
                                <Column header="Periode & Durasi">
                                    <template #body="{ data }">
                                        <div class="whitespace-nowrap tabular-nums">{{ periodText(data) }}</div>
                                        <div class="text-muted-color"><span class="tabular-nums">{{ data.total_days ?? data.totalDays ?? '-' }}</span> hari kerja</div>
                                    </template>
                                </Column>
                                <Column header="Status" style="width: 1%">
                                    <template #body="{ data }">
                                        <Tag :value="getStatusLabel(data.status)" :severity="getStatusSeverity(data.status)" class="text-xs font-medium whitespace-nowrap" />
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

                        <ul class="block xl:hidden divide-y divide-surface-200 dark:divide-surface-700" :class="{ 'opacity-60': loading }">
                            <li v-for="item in recentFiveLeaves" :key="requestId(item)" class="py-3 flex items-start justify-between gap-3 text-xs">
                                <div class="min-w-0 space-y-0.5">
                                    <div class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ item.nm_leave_type || item.leaveTypeName || item.kd_leave_type || 'Cuti' }}</div>
                                    <div class="text-surface-800 dark:text-surface-200 tabular-nums">{{ periodText(item) }} · {{ item.total_days ?? item.totalDays ?? '-' }} hari kerja</div>
                                    <div class="font-mono text-muted-color break-all">{{ requestId(item) }}</div>
                                    <Tag :value="getStatusLabel(item.status)" :severity="getStatusSeverity(item.status)" class="text-xs font-medium mt-1" />
                                </div>
                                <Button severity="secondary" outlined size="small" class="text-xs shrink-0 !min-h-11 flex items-center gap-1.5" :aria-label="`Detail ${requestId(item)}`" @click="viewDetail(item)">
                                    <PhEye :size="14" weight="bold" aria-hidden="true" />
                                    <span>Detail</span>
                                </Button>
                            </li>
                        </ul>
                    </template>

                    <div class="mt-3 pt-3 border-t border-surface-200 dark:border-surface-800 text-center">
                        <router-link
                            to="/leave/history"
                            class="inline-flex items-center min-h-11 sm:min-h-9 px-3 rounded-border text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                            Lihat seluruh riwayat cuti
                        </router-link>
                    </div>
                </section>
            </div>

            <div class="lg:col-span-4">
                <DashboardMiniCalendar data-tour="dash-kalender" :approved-leaves="recentLeaves" />
            </div>
        </div>

        <LeaveDetailDialog v-model:visible="detailVisible" :request="selectedRequest" @refresh="loadDashboardData" @edit="editFromDetail" />
    </div>
</template>
