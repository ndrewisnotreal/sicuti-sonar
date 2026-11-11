<script setup>
import { useRouter } from 'vue-router';
import { PhHouse } from '@phosphor-icons/vue';

const router = useRouter();
</script>

<template>
    <!-- Di luar layout: latar dan tema ditetapkan sendiri (audit-033 #6). -->
    <main class="min-h-screen flex items-center justify-center p-4 bg-surface-100 dark:bg-surface-950">
        <div class="w-full max-w-md text-center bg-surface-0 dark:bg-surface-900 rounded-xl p-8">
            <p class="text-5xl font-bold text-primary mb-2 tabular-nums" aria-hidden="true">404</p>
            <h1 class="text-lg font-bold text-surface-900 dark:text-surface-100 mb-2">Halaman tidak ditemukan</h1>
            <p class="text-sm text-surface-700 dark:text-surface-300 mb-6">Alamat ini tidak ada atau sudah dipindahkan. Periksa tautan, atau kembali ke Dashboard.</p>
            <Button class="text-sm font-semibold gap-2 !min-h-11 sm:!min-h-9" @click="router.push('/')">
                <PhHouse :size="16" weight="bold" aria-hidden="true" />
                <span>Kembali ke Dashboard</span>
            </Button>
        </div>
    </main>
</template>
