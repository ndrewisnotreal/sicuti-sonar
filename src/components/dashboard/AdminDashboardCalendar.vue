<template>
    <div class="card mb-0 flex flex-col justify-between p-5">
        <div>
            <!-- Tag "Tahun" statis dihapus: kalender bisa digeser ke tahun lain (audit-034 #7). -->
            <div class="mb-4 pb-3 border-b border-surface-200 dark:border-surface-800">
                <h2 class="font-bold text-base text-surface-900 dark:text-surface-0 m-0">Kalender Cuti</h2>
                <p class="text-xs text-muted-color mt-0.5">Cuti disetujui dan hari libur. Pilih tanggal untuk melihat siapa yang cuti.</p>
            </div>

            <div class="admin-sakai-calendar">
                <DatePicker
                    v-model="selectedCalendarDate"
                    inline
                    :showOtherMonths="false"
                    class="w-full !border-0 !bg-transparent"
                    :pt="calendarPt"
                >
                    <template #date="{ date }">
                        <div
                            class="w-full h-full flex flex-col items-center justify-center select-none"
                            v-tooltip.top="getDayTooltip(date)"
                        >
                            <span class="leading-none text-xs tabular-nums">
                                {{ date.day }}
                            </span>

                            <span
                                v-if="hasHoliday(date) || hasLeave(date)"
                                class="flex items-center gap-0.5 mt-0.5 h-1"
                            >
                                <span
                                    v-if="hasHoliday(date)"
                                    class="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-2xs"
                                ></span>
                                <span
                                    v-if="hasLeave(date)"
                                    class="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-2xs"
                                ></span>
                            </span>
                        </div>
                    </template>
                </DatePicker>
            </div>

            <div class="mt-3 p-3 rounded-lg bg-surface-50 dark:bg-surface-800/40 border border-surface-200/80 dark:border-surface-700/60">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-1.5 text-xs font-semibold text-surface-800 dark:text-surface-100">
                        <PhCalendarDots :size="14" weight="bold" aria-hidden="true" class="text-primary" />
                        <span>{{ formattedSelectedDate }}</span>
                    </div>
                    <Tag v-if="selectedDateEvents.isHoliday" :value="selectedDateEvents.holidayName" severity="danger" class="text-xs py-0 px-1.5" />
                </div>

                <div v-if="selectedDateEvents.leaves.length > 0" class="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                    <div
                        v-for="(item, idx) in selectedDateEvents.leaves"
                        :key="idx"
                        class="flex items-center justify-between text-xs py-1 px-2 rounded-md bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700/60"
                    >
                        <div class="flex items-center gap-2 truncate">
                            <div class="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                                {{ item.userName?.charAt(0) || 'U' }}
                            </div>
                            <span class="font-medium text-surface-800 dark:text-surface-200 truncate">{{ item.userName }}</span>
                        </div>
                        <Tag :value="item.leaveTypeName" severity="warn" class="text-xs py-0 px-1.5 shrink-0" />
                    </div>
                </div>
                <div v-else-if="!dataReady" class="text-xs text-muted-color">
                    Data cuti belum tersedia.
                </div>
                <div v-else-if="!selectedDateEvents.isHoliday" class="text-xs text-muted-color">
                    Tidak ada cuti atau hari libur pada tanggal ini.
                </div>
            </div>
        </div>

        <div class="mt-4 pt-3 border-t border-surface-100 dark:border-surface-800 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-surface-700 dark:text-surface-300">
            <span class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-500" aria-hidden="true"></span>
                Cuti karyawan
            </span>
            <span class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-rose-500" aria-hidden="true"></span>
                Hari libur
            </span>
            <span class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-primary" aria-hidden="true"></span>
                Tanggal dipilih
            </span>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { getUser, sicutiState } from '@/service/sicutiService';
import { PhCalendarDots } from '@phosphor-icons/vue';

const props = defineProps({
    divisionRequests: {
        type: Array,
        default: () => []
    },
    adminDivision: {
        type: String,
        default: ''
    },
    // false saat data memuat/gagal: "tidak ada cuti" belum tentu benar (audit-034 #3).
    dataReady: {
        type: Boolean,
        default: true
    }
});

const today = new Date();
const selectedCalendarDate = ref(new Date(today.getFullYear(), today.getMonth(), today.getDate()));

const holidayCalendarMap = computed(() => {
    const map = new Map();
    (sicutiState.holidays || []).forEach((h) => {
        if (!h.date) return;
        const start = new Date(`${h.date}T00:00:00`);
        const end = new Date(`${h.date2 || h.date}T00:00:00`);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            map.set(key, h.name || 'Hari Libur');
        }
    });
    return map;
});

const leaveDetailsByDate = computed(() => {
    const map = {};
    const approvedRequests = (props.divisionRequests || []).filter((r) => r.status === 'approved');
    approvedRequests.forEach((request) => {
        if (!request.startDate || !request.endDate) return;
        const start = new Date(`${request.startDate}T00:00:00`);
        const end = new Date(`${request.endDate}T00:00:00`);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!map[key]) map[key] = [];
            const user = getUser(request.userId);
            const userName = user?.name || request.userName || 'Karyawan';
            map[key].push({
                requestId: request.id,
                userId: request.userId,
                userName,
                department: user?.department || request.department || '',
                leaveTypeName: request.leaveTypeName || 'Cuti Tahunan',
                reason: request.reason || ''
            });
        }
    });
    return map;
});

function getDateKey(d) {
    if (!d) return '';
    if (d instanceof Date) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (typeof d === 'object' && d.day !== undefined) {
        return `${d.year}-${String(d.month + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
    }
    return String(d);
}

function hasHoliday(dateObj) {
    return holidayCalendarMap.value.has(getDateKey(dateObj));
}

function hasLeave(dateObj) {
    return Boolean(leaveDetailsByDate.value[getDateKey(dateObj)]?.length);
}

function getDayTooltip(dateObj) {
    const key = getDateKey(dateObj);
    const holiday = holidayCalendarMap.value.get(key);
    const leaves = leaveDetailsByDate.value[key] || [];

    const parts = [];
    if (holiday) parts.push(`Libur: ${holiday}`);
    if (leaves.length > 0) parts.push(`Cuti (${leaves.length}): ${leaves.map((l) => l.userName).join(', ')}`);
    return parts.length > 0 ? parts.join(' | ') : null;
}

function getDayCellClass(context) {
    if (!context || !context.date) return '';
    const dateObj = context.date;
    const isSelected = context.selected;

    if (isSelected) {
        return '!bg-primary !text-primary-contrast !border-0 font-bold shadow-xs';
    }

    const holiday = hasHoliday(dateObj);
    const leave = hasLeave(dateObj);

    if (holiday && leave) {
        return '!bg-gradient-to-br !from-amber-100/70 !to-rose-100/70 dark:!from-amber-950/40 dark:!to-rose-950/40 !border !border-amber-300/80 dark:!border-amber-700/60 !text-surface-900 dark:!text-surface-0 font-semibold';
    }
    if (holiday) {
        return '!bg-rose-50 dark:!bg-rose-950/40 !border !border-rose-200 dark:!border-rose-900/50 !text-rose-600 dark:!text-rose-400 font-semibold';
    }
    if (leave) {
        return '!bg-amber-50 dark:!bg-amber-950/40 !border !border-amber-200 dark:!border-amber-800/50 !text-amber-800 dark:!text-amber-300 font-semibold';
    }
    return 'hover:!bg-surface-100 dark:hover:!bg-surface-800 !text-surface-700 dark:!text-surface-200 !border-0';
}

const calendarPt = computed(() => ({
    root: { class: '!border-0 !bg-transparent w-full shadow-none p-0' },
    panel: { class: '!border-0 !bg-transparent w-full shadow-none p-0' },
    header: { class: '!border-b border-surface-200 dark:border-surface-800 !pb-2.5 !mb-2.5 !bg-transparent' },
    // Target sentuh 44px di HP (audit-034 #4).
    pcPrevButton: { root: { class: '!min-w-11 !min-h-11 sm:!min-w-10 sm:!min-h-10' } },
    pcNextButton: { root: { class: '!min-w-11 !min-h-11 sm:!min-w-10 sm:!min-h-10' } },
    selectMonth: { class: '!min-h-11 sm:!min-h-9' },
    selectYear: { class: '!min-h-11 sm:!min-h-9' },
    table: { class: 'w-full' },
    tableHeaderCell: { class: 'text-xs font-semibold text-muted-color pb-1.5' },
    dayView: { class: 'w-full' },
    day: ({ context }) => ({
        class: [
            '!w-full !h-11 sm:!h-8.5 !rounded-md !transition-colors !p-0 flex flex-col items-center justify-center cursor-pointer',
            getDayCellClass(context)
        ]
    })
}));

const selectedDateEvents = computed(() => {
    const key = getDateKey(selectedCalendarDate.value);
    const holidayName = holidayCalendarMap.value.get(key) || null;
    const leaves = leaveDetailsByDate.value[key] || [];
    return {
        key,
        isHoliday: Boolean(holidayName),
        holidayName,
        leaves
    };
});

const formattedSelectedDate = computed(() => {
    if (!selectedCalendarDate.value) return '';
    const d = selectedCalendarDate.value instanceof Date
        ? selectedCalendarDate.value
        : new Date(selectedCalendarDate.value.year, selectedCalendarDate.value.month, selectedCalendarDate.value.day);

    return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});
</script>

<style scoped>
:deep(.admin-sakai-calendar) {
    .p-datepicker {
        border: none !important;
        background: transparent !important;
        padding: 0 !important;
        width: 100% !important;
    }
    .p-datepicker-day-cell {
        padding: 2px !important;
    }
}
</style>
