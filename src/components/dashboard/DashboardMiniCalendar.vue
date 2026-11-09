<script setup>
import { computed, ref, onMounted } from 'vue';
import { leaveService } from '@/service/leaveService';
import { PhCaretLeft, PhCaretRight, PhCalendarBlank } from '@phosphor-icons/vue';

const props = defineProps({
    approvedLeaves: {
        type: Array,
        default: () => []
    }
});

const todayDate = new Date();
const calYear = ref(todayDate.getFullYear());
const calMonth = ref(todayDate.getMonth());
const selectedCalCell = ref(null);
const holidays = ref([]);
// Gagal muat hari libur tidak boleh tampil sebagai "tidak ada libur" (audit-036 #1).
const holidaysFailed = ref(false);

const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const calMonthName = computed(() => {
    return `${monthNames[calMonth.value]} ${calYear.value}`;
});

async function loadHolidays() {
    try {
        holidays.value = await leaveService.getHolidays(calYear.value);
        holidaysFailed.value = false;
    } catch {
        holidays.value = [];
        holidaysFailed.value = true;
    }
}

onMounted(async () => {
    await loadHolidays();
    const foundToday = calendarDays.value.find((c) => c.isToday);
    if (foundToday) {
        selectedCalCell.value = foundToday;
    } else {
        selectedCalCell.value = calendarDays.value.find((c) => !c.isBlank) || null;
    }
});

const approvedLeaveDates = computed(() => {
    const approvedMap = new Map();
    for (const req of props.approvedLeaves || []) {
        if (['approved', 'completed'].includes(req.status) && req.start_date && req.end_date) {
            const s = new Date(req.start_date);
            const e = new Date(req.end_date);
            const cur = new Date(s);
            while (cur <= e) {
                const y = cur.getFullYear();
                const m = String(cur.getMonth() + 1).padStart(2, '0');
                const d = String(cur.getDate()).padStart(2, '0');
                const ds = `${y}-${m}-${d}`;
                approvedMap.set(ds, {
                    type: req.nm_leave_type || req.kd_leave_type || 'Cuti'
                });
                cur.setDate(cur.getDate() + 1);
            }
        }
    }
    return approvedMap;
});

const holidayMap = computed(() => {
    const map = new Map();
    (holidays.value || []).forEach((h) => {
        const startStr = (h.holiday_date || h.date || '').split('T')[0];
        const endStr = (h.end_date || startStr).split('T')[0];
        const name = h.nm_holiday || h.description || h.name || 'Hari Libur Nasional';
        const isCollective = h.type === 'collective';
        const typeLabel = isCollective ? 'Cuti Bersama' : 'Libur Resmi Nasional';
        if (startStr) {
            try {
                const s = new Date(startStr);
                const e = new Date(endStr || startStr);
                const cur = new Date(s);
                while (cur <= e) {
                    const y = cur.getFullYear();
                    const m = String(cur.getMonth() + 1).padStart(2, '0');
                    const d = String(cur.getDate()).padStart(2, '0');
                    const ds = `${y}-${m}-${d}`;
                    map.set(ds, {
                        name,
                        isCollective,
                        typeLabel
                    });
                    cur.setDate(cur.getDate() + 1);
                }
            } catch {
                map.set(startStr, {
                    name,
                    isCollective,
                    typeLabel
                });
            }
        }
    });
    return map;
});

const calendarDays = computed(() => {
    const firstDay = new Date(calYear.value, calMonth.value, 1).getDay();
    const daysInMonth = new Date(calYear.value, calMonth.value + 1, 0).getDate();
    const today = new Date();

    const cells = [];
    for (let i = 0; i < firstDay; i++) {
        cells.push({ day: null, isBlank: true });
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const mm = String(calMonth.value + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const dateStr = `${calYear.value}-${mm}-${dd}`;
        const holiday = holidayMap.value.get(dateStr);
        const approvedLeave = approvedLeaveDates.value.get(dateStr);
        const isToday =
            today.getDate() === d &&
            today.getMonth() === calMonth.value &&
            today.getFullYear() === calYear.value;

        cells.push({
            day: d,
            isBlank: false,
            dateStr,
            isToday,
            isHoliday: Boolean(holiday),
            holidayName: holiday?.name || null,
            holidayInfo: holiday || null,
            isApprovedLeave: Boolean(approvedLeave),
            leaveInfo: approvedLeave || null
        });
    }

    return cells;
});

function selectDate(cell) {
    if (!cell || cell.isBlank) return;
    selectedCalCell.value = cell;
}

function formatInspectorDate(dateStr) {
    if (!dateStr) return '';
    try {
        const [y, m, d] = dateStr.split('-');
        const date = new Date(Number(y), Number(m) - 1, Number(d));
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const dayName = days[date.getDay()];
        return `${dayName}, ${Number(d)} ${monthNames[Number(m) - 1]} ${y}`;
    } catch {
        return dateStr;
    }
}

function isWeekend(dateStr) {
    if (!dateStr) return false;
    try {
        const [y, m, d] = dateStr.split('-');
        const day = new Date(Number(y), Number(m) - 1, Number(d)).getDay();
        return day === 0 || day === 6;
    } catch {
        return false;
    }
}

function getInspectorDescription(cell) {
    if (!cell) return '';
    if (cell.isHoliday && cell.holidayName) {
        const typeLabel = cell.holidayInfo?.typeLabel || 'Libur Resmi Nasional';
        return `${cell.holidayName} (${typeLabel})`;
    }
    if (cell.isApprovedLeave) {
        return `Cuti Disetujui: ${cell.leaveInfo?.type || 'Cuti Tahunan'}`;
    }
    if (isWeekend(cell.dateStr)) {
        return 'Akhir pekan.';
    }
    if (holidaysFailed.value) return 'Data hari libur belum termuat.';
    return cell.isToday ? 'Hari ini: hari kerja, tanpa cuti atau hari libur.' : 'Hari kerja, tanpa cuti atau hari libur.';
}

async function changeCalMonth(dir) {
    let m = calMonth.value + dir;
    let y = calYear.value;
    if (m > 11) {
        m = 0;
        y++;
    } else if (m < 0) {
        m = 11;
        y--;
    }
    calMonth.value = m;
    const yearChanged = y !== calYear.value;
    calYear.value = y;
    if (yearChanged) await loadHolidays();

    const foundToday = calendarDays.value.find((c) => c.isToday);
    selectedCalCell.value = foundToday || calendarDays.value.find((c) => !c.isBlank) || null;
}
</script>

<template>
    <!-- .card tanpa border/shadow tambahan (00b §6.1, audit-036 #5). -->
    <section class="card !mb-0" aria-labelledby="mini-cal-title">
        <div class="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-surface-200 dark:border-surface-800">
            <div>
                <h2 id="mini-cal-title" class="font-bold text-base text-surface-900 dark:text-surface-0 m-0">Kalender Saya</h2>
                <p class="text-xs text-muted-color mt-0.5" aria-live="polite">{{ calMonthName }}</p>
            </div>
            <div class="flex items-center gap-1">
                <button
                    type="button"
                    class="min-w-11 min-h-11 sm:min-w-9 sm:min-h-9 flex items-center justify-center rounded-border text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    @click="changeCalMonth(-1)"
                    aria-label="Bulan sebelumnya"
                    title="Bulan sebelumnya"
                >
                    <PhCaretLeft :size="16" weight="bold" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    class="min-w-11 min-h-11 sm:min-w-9 sm:min-h-9 flex items-center justify-center rounded-border text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    @click="changeCalMonth(1)"
                    aria-label="Bulan berikutnya"
                    title="Bulan berikutnya"
                >
                    <PhCaretRight :size="16" weight="bold" aria-hidden="true" />
                </button>
            </div>
        </div>

        <!-- Nama hari biasa, bukan kapital berjarak lebar (R-06, audit-036 #6). -->
        <div class="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-color mb-1" aria-hidden="true">
            <span>Min</span><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span>
        </div>

        <div class="grid grid-cols-7 gap-1 text-center">
            <div
                v-for="(cell, idx) in calendarDays"
                :key="idx"
                class="h-11 sm:h-9 flex items-center justify-center"
            >
                <button
                    v-if="!cell.isBlank"
                    type="button"
                    @click="selectDate(cell)"
                    class="h-11 w-full max-w-11 sm:h-9 sm:max-w-9 mx-auto flex items-center justify-center rounded-border text-xs tabular-nums transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-900 cursor-pointer select-none"
                    :class="[
                        selectedCalCell?.dateStr === cell.dateStr
                            ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-surface-900 font-bold z-10'
                            : '',
                        cell.isToday
                            ? 'bg-primary text-primary-contrast'
                            : cell.isApprovedLeave
                              ? selectedCalCell?.dateStr === cell.dateStr
                                  ? 'bg-emerald-600 text-white font-semibold'
                                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold border border-emerald-200/80 dark:border-emerald-800/60'
                              : cell.isHoliday
                                ? selectedCalCell?.dateStr === cell.dateStr
                                    ? 'bg-rose-600 text-white font-semibold'
                                    : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 font-semibold border border-rose-200/80 dark:border-rose-900/60'
                                : selectedCalCell?.dateStr === cell.dateStr
                                  ? 'bg-surface-200 dark:bg-surface-700 text-surface-900 dark:text-surface-0'
                                  : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                    ]"
                    :aria-pressed="selectedCalCell?.dateStr === cell.dateStr"
                    :aria-label="formatInspectorDate(cell.dateStr)"
                    :title="cell.isApprovedLeave ? `Cuti disetujui: ${cell.leaveInfo?.type}` : (cell.holidayName || (cell.isToday ? 'Hari ini' : ''))"
                >
                    {{ cell.day }}
                </button>
            </div>
        </div>

        <div class="mt-3 pt-3 border-t border-surface-200 dark:border-surface-800 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-surface-700 dark:text-surface-300">
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-primary" aria-hidden="true"></span>Hari ini</span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500" aria-hidden="true"></span>Cuti disetujui</span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-rose-500" aria-hidden="true"></span>Hari libur</span>
        </div>
        <p v-if="holidaysFailed" class="mt-2 text-xs text-muted-color">Hari libur {{ calYear }} belum termuat.</p>

        <div class="mt-3 pt-3 border-t border-surface-200 dark:border-surface-800" aria-live="polite">
            <transition
                mode="out-in"
                enter-active-class="transition-opacity duration-150 motion-reduce:transition-none"
                enter-from-class="opacity-0"
                leave-active-class="transition-opacity duration-100 motion-reduce:transition-none"
                leave-to-class="opacity-0"
            >
                <div
                    v-if="selectedCalCell"
                    :key="selectedCalCell.dateStr"
                    class="rounded-border p-3 bg-surface-50 dark:bg-surface-800/40 flex flex-col gap-1.5"
                >
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <span class="text-xs font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-1.5">
                            <PhCalendarBlank :size="14" weight="bold" aria-hidden="true" class="text-muted-color shrink-0" />
                            <span>{{ formatInspectorDate(selectedCalCell.dateStr) }}</span>
                        </span>
                        <Tag v-if="selectedCalCell.isHoliday" :value="selectedCalCell.holidayInfo?.typeLabel || 'Hari libur'" severity="danger" class="text-xs" />
                        <Tag v-else-if="selectedCalCell.isApprovedLeave" value="Cuti disetujui" severity="success" class="text-xs" />
                        <Tag v-else-if="selectedCalCell.isToday" value="Hari ini" severity="info" class="text-xs" />
                    </div>
                    <p class="text-xs text-surface-700 dark:text-surface-300 leading-relaxed m-0">
                        {{ getInspectorDescription(selectedCalCell) }}
                    </p>
                </div>

                <p v-else class="text-center py-2.5 text-xs text-muted-color m-0">
                    Pilih tanggal untuk melihat keterangannya.
                </p>
            </transition>
        </div>
    </section>
</template>
