<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import api from '@/service/api';
import { can, currentUser, formatDate, getStatusLabel, getStatusSeverity, isSuperAdmin, sicutiState } from '@/service/sicutiService';
import { PhCaretLeft, PhCaretRight, PhCalendarDots } from '@phosphor-icons/vue';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const today = new Date();
const year = ref(today.getFullYear());
const month = ref(today.getMonth());
const deptFilter = ref(null);
const showPending = ref(true);
const loading = ref(false);
const loadError = ref(false);
const leaves = ref([]);
const holidays = ref([]);
const selectedKey = ref(isoOf(today));

const canPickDept = computed(() => isSuperAdmin() || can('master_data.view_processed', 'dashboard_laporan.view_reports'));
const deptOptions = computed(() => [
    { label: 'Semua Divisi', value: null },
    ...(sicutiState.departments || []).map((d) => ({ label: d.name || d.nm_dept || d.code, value: d.code || d.kd_dept || d.id }))
]);
const scopeLabel = computed(() => {
    if (canPickDept.value) return deptFilter.value ? `Divisi ${deptFilter.value}` : 'Semua divisi yang bisa Anda lihat';
    return `Divisi ${currentUser.value?.department || currentUser.value?.kd_dept || 'Anda'}`;
});

function isoOf(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const range = computed(() => {
    const first = new Date(year.value, month.value, 1);
    const last = new Date(year.value, month.value + 1, 0);
    return { start: isoOf(first), end: isoOf(last), daysInMonth: last.getDate(), lead: (first.getDay() + 6) % 7 };
});

async function load() {
    loading.value = true;
    loadError.value = false;
    try {
        const res = await api.get('/sicuti/leave-request/calendar', {
            start: range.value.start,
            end: range.value.end,
            kd_dept: canPickDept.value ? deptFilter.value : undefined
        });
        leaves.value = res?.data?.leaves || [];
        holidays.value = res?.data?.holidays || [];
    } catch {
        leaves.value = [];
        holidays.value = [];
        loadError.value = true;
    } finally {
        loading.value = false;
    }
}

onMounted(load);
watch([year, month, deptFilter], load);
watch(() => sicutiState.dataVersion, load);

const visibleLeaves = computed(() =>
    leaves.value.filter((l) => showPending.value || ['approved', 'completed'].includes(l.status))
);

function within(key, start, end) {
    return key >= String(start).slice(0, 10) && key <= String(end || start).slice(0, 10);
}

const cells = computed(() => {
    const out = [];
    for (let i = 0; i < range.value.lead; i++) out.push(null);
    for (let d = 1; d <= range.value.daysInMonth; d++) {
        const date = new Date(year.value, month.value, d);
        const key = isoOf(date);
        const dow = date.getDay();
        out.push({
            day: d,
            key,
            weekend: dow === 0 || dow === 6,
            isToday: key === isoOf(today),
            holiday: holidays.value.find((h) => within(key, h.date, h.end_date)) || null,
            leaves: visibleLeaves.value.filter((l) => within(key, l.start_date, l.end_date))
        });
    }
    while (out.length % 7) out.push(null);
    return out;
});

const selected = computed(() => cells.value.find((c) => c?.key === selectedKey.value) || null);
const monthSummary = computed(() => ({
    people: new Set(visibleLeaves.value.map((l) => l.uid_user_system)).size,
    requests: visibleLeaves.value.length,
    holidays: holidays.value.length
}));

function shift(delta) {
    const d = new Date(year.value, month.value + delta, 1);
    year.value = d.getFullYear();
    month.value = d.getMonth();
    selectedKey.value = isoOf(d);
}

function goToday() {
    year.value = today.getFullYear();
    month.value = today.getMonth();
    selectedKey.value = isoOf(today);
}

const HIDDEN_NAME = 'Karyawan';

function shortName(name) {
    if (!name) return HIDDEN_NAME;
    const parts = String(name).split(' ').filter(Boolean);
    return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0] || '-';
}

// Warna status memakai alias --status-* (nilai token Tag PrimeVue) dari styles.scss, sama dengan label status di seluruh aplikasi.
const isApproved = (status) => ['approved', 'completed'].includes(status);
const chipClass = (status) =>
    isApproved(status) ? 'bg-(--status-success-bg) text-(--status-success-fg)' : 'bg-(--status-warn-bg) text-(--status-warn-fg)';
const dotClass = (status) => (isApproved(status) ? 'bg-(--status-success-fg)' : 'bg-(--status-warn-fg)');
</script>

<template>
    <!-- Satu kartu halaman: judul dan filter, grid, lalu inspektor yang dipisah garis (acuan 00b §6.1, audit-010 #1). -->
    <div class="card !mb-0">
        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Kalender Cuti</h1>
                <p class="text-xs text-muted-color">Jadwal cuti karyawan dan hari libur · {{ scopeLabel }}</p>
            </div>
            <div data-tour="cal-filters" class="flex flex-wrap items-center gap-2">
                <Select
                    v-if="canPickDept"
                    v-model="deptFilter"
                    :options="deptOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Semua Divisi"
                    size="small"
                    class="text-xs w-48"
                />
                <label class="flex items-center gap-1.5 min-h-6 text-xs text-surface-700 dark:text-surface-300 cursor-pointer select-none">
                    <input id="tampilkan-diproses" name="tampilkan-diproses" v-model="showPending" type="checkbox" class="w-4 h-4 shrink-0 cursor-pointer" />
                    Tampilkan yang masih diproses
                </label>
            </div>
        </div>

        <div class="mt-6 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <section data-tour="cal-grid" class="min-w-0 xl:pr-6">
                <div class="flex items-center justify-between gap-2 mb-3">
                    <div class="flex items-center gap-1">
                        <button type="button" class="w-11 h-11 flex items-center justify-center rounded-border hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer" aria-label="Bulan sebelumnya" @click="shift(-1)">
                            <PhCaretLeft :size="16" weight="bold" aria-hidden="true" />
                        </button>
                        <h2 class="text-base font-bold text-surface-900 dark:text-surface-0 w-36 sm:w-40 text-center tabular-nums">{{ MONTHS[month] }} {{ year }}</h2>
                        <button type="button" class="w-11 h-11 flex items-center justify-center rounded-border hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer" aria-label="Bulan berikutnya" @click="shift(1)">
                            <PhCaretRight :size="16" weight="bold" aria-hidden="true" />
                        </button>
                    </div>
                    <Button label="Bulan Ini" severity="secondary" outlined size="small" class="text-xs !min-h-11" @click="goToday" />
                </div>

                <div v-if="loadError" role="alert" class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                    <span>Kalender gagal dimuat. Data cuti dan hari libur bulan ini belum tampil.</span>
                    <Button label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11" @click="load" />
                </div>

                <div class="grid grid-cols-7 gap-px rounded-border overflow-hidden border border-surface-200 dark:border-surface-700 bg-surface-200 dark:bg-surface-700" :class="{ 'opacity-60': loading }">
                    <div v-for="d in DAYS" :key="d" class="bg-surface-50 dark:bg-surface-800 text-xs font-semibold text-muted-color text-center py-1.5">{{ d }}</div>
                    <template v-for="(c, i) in cells" :key="c?.key || `kosong-${i}`">
                        <div v-if="!c" class="bg-surface-50/60 dark:bg-surface-950 min-h-16 sm:min-h-24" />
                        <button
                            v-else
                            type="button"
                            class="text-left min-h-16 sm:min-h-24 p-1 sm:p-1.5 flex flex-col gap-0.5 cursor-pointer hover:bg-primary-50/60 dark:hover:bg-primary-950/30 focus-visible:outline-2 focus-visible:outline-primary"
                            :class="[c.holiday ? 'bg-(--status-danger-bg)/50' : 'bg-surface-0 dark:bg-surface-900', { 'ring-2 ring-inset ring-primary': c.key === selectedKey }]"
                            :aria-label="`${c.day} ${MONTHS[month]}${c.isToday ? ', hari ini' : ''}: ${c.leaves.length} cuti${c.holiday ? ', ' + c.holiday.name : ''}`"
                            :aria-pressed="c.key === selectedKey"
                            :aria-current="c.isToday ? 'date' : undefined"
                            @click="selectedKey = c.key"
                        >
                            <span
                                class="text-xs font-semibold tabular-nums w-6 h-6 flex items-center justify-center rounded-full"
                                :class="c.isToday ? 'bg-primary text-primary-contrast' : c.holiday || c.weekend ? 'text-(--status-danger-fg)' : 'text-surface-800 dark:text-surface-200'"
                            >
                                {{ c.day }}
                            </span>
                            <span v-if="c.holiday" class="hidden sm:block text-xs leading-tight text-(--status-danger-fg) truncate">{{ c.holiday.name }}</span>
                            <span v-for="l in c.leaves.slice(0, 2)" :key="l.id_request" class="hidden sm:block text-xs leading-tight px-1 py-0.5 rounded truncate" :class="chipClass(l.status)">
                                {{ shortName(l.nama) }}
                            </span>
                            <span v-if="c.leaves.length > 2" class="hidden sm:block text-xs text-muted-color">+{{ c.leaves.length - 2 }} lainnya</span>
                            <span v-if="c.leaves.length" class="sm:hidden flex gap-0.5">
                                <span v-for="l in c.leaves.slice(0, 3)" :key="l.id_request" class="w-1.5 h-1.5 rounded-full" :class="dotClass(l.status)" />
                            </span>
                        </button>
                    </template>
                </div>

                <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-muted-color">
                    <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-(--status-success-fg)" /> Cuti disetujui</span>
                    <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-(--status-warn-fg)" /> Masih diproses</span>
                    <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-(--status-danger-fg)" /> Hari libur</span>
                    <span v-if="loading" role="status" class="ml-auto">Memuat kalender…</span>
                </div>
            </section>

            <aside class="min-w-0 mt-6 pt-6 border-t xl:mt-0 xl:pt-0 xl:pl-6 xl:border-t-0 xl:border-l border-surface-200 dark:border-surface-700">
                <section data-tour="cal-day-detail">
                    <h3 class="text-sm font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                        <PhCalendarDots :size="14" weight="bold" aria-hidden="true" class="text-primary" />
                        {{ selected ? formatDate(selected.key) : '-' }}
                    </h3>
                    <p v-if="selected?.holiday" class="mt-2 text-xs px-2.5 py-1.5 rounded-border bg-(--status-danger-bg) text-(--status-danger-fg)">{{ selected.holiday.name }}</p>
                    <ul v-if="selected?.leaves.length" class="mt-3 space-y-2">
                        <li v-for="l in selected.leaves" :key="l.id_request" class="text-xs border-b border-surface-100 dark:border-surface-800 pb-2 last:border-0 last:pb-0">
                            <div class="flex items-center justify-between gap-2">
                                <span class="font-semibold text-surface-900 dark:text-surface-100 truncate">{{ l.nama || HIDDEN_NAME }}</span>
                                <Tag :value="getStatusLabel(l.status)" :severity="getStatusSeverity(l.status)" class="!text-xs shrink-0" />
                            </div>
                            <div class="text-muted-color mt-0.5" title="Sabtu, Minggu & libur nasional tidak dihitung">{{ l.nm_leave_type }} · {{ l.total_days }} hari kerja</div>
                            <div class="text-muted-color">{{ formatDate(l.start_date) }}<template v-if="l.end_date !== l.start_date"> – {{ formatDate(l.end_date) }}</template></div>
                        </li>
                    </ul>
                    <p v-else-if="loadError" class="mt-3 text-xs text-muted-color">Data tanggal ini belum bisa ditampilkan karena kalender gagal dimuat.</p>
                    <p v-else-if="!selected?.holiday" class="mt-3 text-xs text-muted-color">Tidak ada karyawan yang cuti pada tanggal ini.</p>
                </section>

                <section data-tour="cal-summary" class="mt-6 pt-6 border-t border-surface-200 dark:border-surface-700 text-xs">
                    <h3 class="text-sm font-bold text-surface-900 dark:text-surface-100 mb-2">Ringkasan {{ MONTHS[month] }}</h3>
                    <dl class="grid grid-cols-3 gap-2 text-center">
                        <div><dt class="text-muted-color">Karyawan</dt><dd class="text-lg font-bold tabular-nums">{{ loadError ? '–' : monthSummary.people }}</dd></div>
                        <div><dt class="text-muted-color">Pengajuan</dt><dd class="text-lg font-bold tabular-nums">{{ loadError ? '–' : monthSummary.requests }}</dd></div>
                        <div><dt class="text-muted-color">Hari libur</dt><dd class="text-lg font-bold tabular-nums">{{ loadError ? '–' : monthSummary.holidays }}</dd></div>
                    </dl>
                </section>
            </aside>
        </div>
    </div>
</template>
