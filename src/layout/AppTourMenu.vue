<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { PhQuestion } from '@phosphor-icons/vue';
import { useTour } from '@/tour/useTour';
import AppTourMenuItems from './AppTourMenuItems.vue';

const { pageTour, introTour, hasUnseen } = useTour();

const open = ref(false);
const containerRef = ref(null);

function handleClickOutside(event) {
    if (containerRef.value && !containerRef.value.contains(event.target)) open.value = false;
}

function handleKeydown(event) {
    if (event.key === 'Escape' && open.value) open.value = false;
}

onMounted(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
    <div v-if="introTour || pageTour" ref="containerRef" class="relative hidden sm:block">
        <button
            type="button"
            data-tour="tour-button"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-surface-0 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer relative"
            :aria-label="hasUnseen ? 'Panduan & tur, ada panduan yang belum dibuka' : 'Panduan & tur'"
            aria-haspopup="menu"
            :aria-expanded="open"
            title="Panduan & Tur"
            @click="open = !open"
        >
            <PhQuestion :size="16" weight="bold" aria-hidden="true" />
            <span
                v-if="hasUnseen"
                class="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary ring-2 ring-surface-0 dark:ring-surface-900"
            ></span>
        </button>

        <transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
        >
            <div
                v-if="open"
                role="menu"
                aria-label="Panduan & tur"
                class="absolute right-0 top-full mt-2 w-72 bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl shadow-xl z-50 p-2 origin-top-right"
            >
                <AppTourMenuItems @select="open = false" />
            </div>
        </transition>
    </div>
</template>
