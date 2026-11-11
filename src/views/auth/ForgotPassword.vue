<script setup>
import { publicPath } from '@/utils/publicPath';
import { useLayout } from '@/layout/composables/layout';
import { PhArrowLeft } from '@phosphor-icons/vue';

const { isDarkTheme } = useLayout();
</script>

<template>
    <div class="min-h-screen flex flex-col items-center justify-center p-4 relative bg-surface-50 dark:bg-surface-950 overflow-hidden">
        <!-- Latar sama dengan Login: foto digelapkan sesuai tema, tanpa blur berlapis (audit-033 #2). -->
        <div class="absolute inset-0 bg-cover bg-center" :style="{ backgroundImage: `url('${publicPath('assets/Pabrik-INALUM.jpg')}')` }"></div>
        <div :class="['absolute inset-0', isDarkTheme ? 'bg-black/60' : 'bg-slate-900/40']"></div>

        <div class="relative z-10 w-full max-w-md bg-surface-0 dark:bg-surface-900 rounded-xl p-6 sm:p-8 shadow-xl">
            <div class="text-center mb-6">
                <img :src="publicPath('logo-inalum.png')" alt="Logo PT INALUM" class="h-16 w-auto object-contain mx-auto mb-3" />
                <p class="text-2xl font-bold text-primary leading-tight">Lebur</p>
                <p class="text-xs text-muted-color mt-1">Pemulihan Akun · PT INALUM</p>
            </div>

            <h1 class="text-base font-bold text-surface-900 dark:text-surface-100 mb-3">Lupa kata sandi?</h1>

            <div class="space-y-3 text-sm text-surface-700 dark:text-surface-200 leading-relaxed">
                <p>Kata sandi tidak bisa diatur ulang sendiri dari halaman ini. Hubungi admin untuk mendapatkan kata sandi baru:</p>
                <ul class="list-disc pl-5 space-y-1">
                    <li><strong>Admin Seksi</strong> di divisi Anda (SIT atau SIS), atau</li>
                    <li><strong>Admin Super App</strong> bila admin seksi tidak tersedia.</li>
                </ul>
                <p>Sebutkan NIK atau username Anda. Setelah masuk dengan kata sandi dari admin, ganti kata sandi lewat menu profil, bagian <strong>Ubah kata sandi</strong>.</p>
                <p class="text-muted-color">Akun yang terkunci karena salah kata sandi berkali-kali juga dibuka oleh admin.</p>
            </div>

            <div class="pt-5">
                <router-link
                    to="/auth/login"
                    class="inline-flex w-full items-center justify-center gap-1.5 min-h-11 rounded-border border border-surface-300 dark:border-surface-600 text-sm font-semibold text-surface-800 dark:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                    <PhArrowLeft :size="16" weight="bold" aria-hidden="true" />
                    <span>Kembali ke halaman masuk</span>
                </router-link>
            </div>
        </div>
    </div>
</template>
