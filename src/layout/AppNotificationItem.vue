<template>
    <button
        type="button"
        class="w-full text-left p-3.5 flex items-start gap-3 transition-colors cursor-pointer group hover:bg-surface-50 dark:hover:bg-surface-800/60 relative"
        :class="{
            'bg-primary-50/25 dark:bg-primary-950/15': !item.isRead
        }"
        @click="emit('click', item)"
    >
        <div
            class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs"
            :class="getIconBadgeClass(item.group)"
        >
            <component :is="getNotifIcon(item.group)" :size="14" weight="bold" aria-hidden="true" />
        </div>

        <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
                <div class="flex items-center gap-1.5 min-w-0">
                    <span class="text-xs font-semibold truncate text-surface-900 dark:text-surface-100">
                        {{ item.title }}
                    </span>
                    <span
                        v-if="!item.isRead"
                        class="w-2 h-2 rounded-full bg-primary shrink-0"
                        title="Belum dibaca"
                    ></span>
                </div>
                <span class="text-[11px] text-surface-400 dark:text-surface-500 whitespace-nowrap shrink-0">
                    {{ item.timeAgo }}
                </span>
            </div>

            <p class="text-xs text-surface-600 dark:text-surface-300 leading-snug line-clamp-2 mt-1">
                {{ item.message }}
            </p>

            <div v-if="item.requestId" class="mt-1.5 flex items-center gap-1.5">
                <span class="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300">
                    {{ item.requestId }}
                </span>
                <span class="text-[11px] text-primary group-hover:underline flex items-center gap-0.5">
                    <span>Buka detail</span>
                    <PhCaretRight :size="14" weight="bold" aria-hidden="true" />
                </span>
            </div>
        </div>
    </button>
</template>

<script setup>
import {
    PhCheckCircle,
    PhXCircle,
    PhWarning,
    PhClock,
    PhFileText,
    PhSealCheck,
    PhCalendarBlank,
    PhBell,
    PhCaretRight
} from '@phosphor-icons/vue';

defineProps({
    item: {
        type: Object,
        required: true
    }
});

const emit = defineEmits(['click']);

function getNotifIcon(type) {
    switch (type) {
        case 'approved': return PhCheckCircle;
        case 'rejected': return PhXCircle;
        case 'returned': return PhWarning;
        case 'pending': return PhClock;
        case 'submitted': return PhFileText;
        case 'role_request': return PhSealCheck;
        case 'info': return PhCalendarBlank;
        default: return PhBell;
    }
}

function getIconBadgeClass(type) {
    switch (type) {
        case 'approved': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400';
        case 'rejected': return 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400';
        case 'returned': return 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400';
        case 'pending': return 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400';
        case 'role_request':
        case 'submitted': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400';
        case 'info': return 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400';
        default: return 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300';
    }
}
</script>
