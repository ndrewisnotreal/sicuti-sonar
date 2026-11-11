<script setup>
import { PhCompass, PhCursorClick } from '@phosphor-icons/vue';
import { useTour } from '@/tour/useTour';

const emit = defineEmits(['select']);
const { pageTour, introTour, startIntro, startPageTour } = useTour();

function run(action) {
    emit('select');
    action();
}

const itemClass =
    'w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors border-none bg-transparent enabled:hover:bg-surface-100 dark:enabled:hover:bg-surface-800 enabled:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
</script>

<template>
    <button type="button" role="menuitem" :disabled="!pageTour" :class="itemClass" @click="run(startPageTour)">
        <div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <PhCursorClick :size="16" weight="bold" aria-hidden="true" />
        </div>
        <div class="flex flex-col min-w-0">
            <span class="text-xs font-semibold text-surface-800 dark:text-surface-100">Tur halaman ini</span>
            <span class="text-[11px] text-muted-color truncate">{{ pageTour ? pageTour.title : 'Belum tersedia untuk halaman ini' }}</span>
        </div>
    </button>
    <button type="button" role="menuitem" :disabled="!introTour" :class="itemClass" @click="run(startIntro)">
        <div class="w-8 h-8 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 flex items-center justify-center shrink-0">
            <PhCompass :size="16" weight="bold" aria-hidden="true" />
        </div>
        <div class="flex flex-col min-w-0">
            <span class="text-xs font-semibold text-surface-800 dark:text-surface-100">Tur pengenalan</span>
            <span class="text-[11px] text-muted-color truncate">Kenali menu dan fitur utama</span>
        </div>
    </button>
</template>
