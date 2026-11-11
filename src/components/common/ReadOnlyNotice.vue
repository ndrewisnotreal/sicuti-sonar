<script setup>
import { PhEye } from '@phosphor-icons/vue';

defineProps({
    module: { type: String, default: 'data ini' }
});
</script>

<template>
    <div role="status" class="p-3 rounded-border border text-xs flex items-start gap-2.5 bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800 text-primary-900 dark:text-primary-100">
        <PhEye :size="16" weight="bold" aria-hidden="true" class="mt-0.5 shrink-0" />
        <p class="leading-relaxed">
            <strong class="font-semibold">Mode lihat saja.</strong>
            Anda bisa melihat {{ module }}, tetapi belum diberi izin oleh Super Admin untuk menambah, mengubah, atau menghapusnya.
            Hubungi Super Admin bila perlu akses ubah.
        </p>
    </div>
</template>
