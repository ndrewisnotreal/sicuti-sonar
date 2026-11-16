<script setup>
import { computed } from 'vue';

const props = defineProps({
    items: { type: Array, required: true }
});
// Tiga kartu (dashboard approver) dulu bertumpuk 1 kolom di HP dan mendorong antrean ke bawah; kini 3 kolom ringkas (audit-013 #9).
const compact = computed(() => props.items.length === 3);
</script>

<template>
    <div
        class="grid gap-3.5 sm:gap-4"
        :class="compact ? 'grid-cols-3 max-sm:gap-2' : 'grid-cols-2 lg:grid-cols-4'"
    >
        <div
            v-for="item in items"
            :key="item.label"
            class="relative min-w-0 bg-surface-0 dark:bg-surface-900 rounded-border sm:p-5"
            :class="compact ? 'p-3' : 'p-4'"
        >
            <div class="flex items-start justify-between gap-2">
                <span class="text-xs font-medium text-surface-500 dark:text-surface-400 leading-tight line-clamp-2">
                    {{ item.label }}
                </span>
                <div
                    v-if="item.icon"
                    class="w-8 h-8 rounded-border flex items-center justify-center shrink-0"
                    :class="item.accent ? 'bg-primary/10 text-primary' : 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400'"
                >
                    <component :is="item.icon" :size="16" weight="bold" aria-hidden="true" />
                </div>
                <span
                    v-else-if="item.badge"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20"
                >
                    {{ item.badge }}
                </span>
            </div>

            <div class="mt-2.5 flex flex-wrap items-baseline gap-x-1.5">
                <span
                    class="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight"
                    :class="item.accent ? 'text-primary' : 'text-surface-900 dark:text-surface-50'"
                >
                    {{ item.value }}
                </span>
                <span
                    v-if="item.unit"
                    class="text-xs font-semibold"
                    :class="item.accent ? 'text-primary' : 'text-surface-500 dark:text-surface-400'"
                >
                    {{ item.unit }}
                </span>
            </div>

            <div
                v-if="item.progress !== undefined"
                class="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800"
                role="progressbar"
                :aria-valuenow="item.progress"
                aria-valuemin="0"
                aria-valuemax="100"
            >
                <div
                    class="h-full rounded-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
                    :style="{ width: `${item.progress}%` }"
                ></div>
            </div>

            <div v-if="item.hint" class="mt-2 text-xs leading-relaxed text-surface-500 dark:text-surface-400 font-normal" :class="{ 'max-sm:hidden': compact }">
                {{ item.hint }}
            </div>
        </div>
    </div>
</template>
