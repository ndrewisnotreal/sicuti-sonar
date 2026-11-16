<script setup>
import { PhEye, PhEyeSlash } from '@phosphor-icons/vue';

// Pengganti ikon bawaan PrimeVue Password (svg tanpa role/tabindex) agar bisa difokus keyboard (D-F4).
// Dipasang di slot `unmaskicon` (revealed=false) dan `maskicon` (revealed=true).
defineProps({
    revealed: { type: Boolean, default: false }
});
defineEmits(['toggle']);
</script>

<template>
    <button
        type="button"
        class="p-password-toggle-mask-icon !absolute !top-1/2 !mt-0 -translate-y-1/2 !end-1 !inline-flex items-center justify-center !w-11 !h-11 sm:!w-8 sm:!h-8 rounded-border text-muted-color hover:text-surface-900 dark:hover:text-surface-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
        :aria-label="revealed ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'"
        :aria-pressed="revealed"
        @click="$emit('toggle')"
    >
        <PhEyeSlash v-if="revealed" :size="16" weight="bold" aria-hidden="true" />
        <PhEye v-else :size="16" weight="bold" aria-hidden="true" />
    </button>
</template>
