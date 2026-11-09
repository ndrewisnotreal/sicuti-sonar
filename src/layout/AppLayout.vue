<script setup>
import { publicPath } from '@/utils/publicPath';
import { useLayout } from '@/layout/composables/layout';
import AppTopbar from './AppTopbar.vue';
import AppMenu from './AppMenu.vue';
import { showSidebar } from '@/layout/composables/sidebarMenu';
import { ref } from 'vue';

const { mobileMenuOpen, closeMobileMenu, isSidebarCollapsed } = useLayout();
const mainRef = ref(null);
</script>

<template>
    <div class="min-h-screen flex bg-surface-100 dark:bg-surface-950 text-surface-700 dark:text-surface-100 antialiased font-sans">
        <!-- Hash biasa akan diproses vue-router sebagai navigasi, jadi fokus dipindah manual. -->
        <a
            href="#konten-utama"
            class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-3 focus:rounded-lg focus:bg-primary focus:text-primary-contrast focus:font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-primary"
            @click.prevent="mainRef?.focus()"
        >
            Lewati ke konten utama
        </a>

        <aside
            v-if="showSidebar"
            id="app-sidebar"
            :class="[
                'hidden lg:flex flex-col shrink-0 self-start sticky top-0 h-screen z-30 select-none transition-[width] duration-300 ease-in-out motion-reduce:transition-none sidebar-navy bg-primary-900 dark:bg-surface-900 dark:border-r dark:border-surface-800',
                isSidebarCollapsed ? 'w-[68px]' : 'w-64'
            ]"
        >
            <router-link
                to="/"
                :title="isSidebarCollapsed ? 'Lebur, PT Indonesia Asahan Aluminium' : undefined"
                :class="[
                    'flex items-center h-16 shrink-0 gap-3 rounded-lg focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white',
                    isSidebarCollapsed ? 'justify-center' : 'px-4'
                ]"
            >
                <img :src="publicPath('logo-inalum-mark.png')" alt="Logo PT INALUM" class="w-8 h-8 object-contain shrink-0" />
                <div v-if="!isSidebarCollapsed" class="flex flex-col min-w-0">
                    <span class="font-bold text-lg leading-tight text-white">Lebur</span>
                    <span class="text-[11px] text-white/60 whitespace-nowrap truncate">PT Indonesia Asahan Aluminium</span>
                </div>
            </router-link>

            <div class="flex-1 overflow-y-auto overflow-x-hidden scrollbar-navy py-3" :class="isSidebarCollapsed ? 'px-2' : 'px-3'">
                <AppMenu :collapsed="isSidebarCollapsed" />
            </div>
        </aside>

        <Drawer
            v-if="showSidebar"
            v-model:visible="mobileMenuOpen"
            header="Menu Navigasi"
            class="!w-72 sidebar-navy !bg-primary-900 dark:!bg-surface-900 !text-white !border-0"
            :pt="{ pcCloseButton: { root: { class: '!w-11 !h-11 !text-white hover:!bg-white/15' } } }"
        >
            <div class="h-full flex flex-col overflow-y-auto p-1">
                <AppMenu :collapsed="false" @item-click="closeMobileMenu" />
            </div>
        </Drawer>

        <div class="flex-1 flex flex-col min-w-0 overflow-x-clip">
            <AppTopbar />
            <main id="konten-utama" ref="mainRef" tabindex="-1" class="flex-1 p-4 sm:p-6 lg:p-8 w-full focus:outline-none">
                <router-view />
            </main>
        </div>
    </div>

    <!-- Lebar default 25rem melebihi layar HP; di layar kecil toast mengikuti lebar layar dengan jarak 0.75rem. -->
    <Toast :breakpoints="{ '640px': { width: 'calc(100vw - 1.5rem)', right: '0.75rem', left: 'auto', top: '0.75rem' } }" />
    <ConfirmDialog />
</template>
