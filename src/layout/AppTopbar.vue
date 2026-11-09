<script setup>
import { publicPath } from '@/utils/publicPath';
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useLayout } from '@/layout/composables/layout';
import { currentUser, logout, persistCurrentUser, ROLE_LABELS, isAdmin, isSuperAdmin, can } from '@/service/sicutiService';
import { showSidebar } from '@/layout/composables/sidebarMenu';
import api, { assetUrl } from '@/service/api';
import AppNotificationMenu from './AppNotificationMenu.vue';
import AppTourMenu from './AppTourMenu.vue';
import AppTourMenuItems from './AppTourMenuItems.vue';
import { useTour } from '@/tour/useTour';
import {
    PhList,
    PhSidebarSimple,
    PhMoon,
    PhSun,
    PhSignOut,
    PhUser,
    PhCaretDown,
    PhCaretRight
} from '@phosphor-icons/vue';

const router = useRouter();
const {
    toggleMobileMenu,
    toggleDarkMode,
    isDarkTheme,
    isSidebarCollapsed,
    toggleSidebarCollapse
} = useLayout();
const sidebarToggleLabel = computed(() => (isSidebarCollapsed.value ? 'Lebarkan bilah samping' : 'Ciutkan bilah samping'));

const profileMenuOpen = ref(false);
const profileContainerRef = ref(null);

const photoFailed = ref(false);
let photoRetried = false;

const userPhoto = computed(() => (photoFailed.value ? null : assetUrl(currentUser.value?.foto_profil)));

// Foto bisa diganti dari perangkat lain dan berkas lamanya terhapus, jadi path yang tersimpan di browser bisa usang.
async function refreshUserPhoto() {
    if (!currentUser.value) return;
    try {
        const res = await api.get('/master/user/profile');
        currentUser.value.foto_profil = res?.data?.foto_profil || null;
        persistCurrentUser();
    } catch {}
}

async function handlePhotoError(event) {
    const failedPath = currentUser.value?.foto_profil;
    if (event.target.getAttribute('src') !== assetUrl(failedPath)) return;
    if (!photoRetried) {
        photoRetried = true;
        await refreshUserPhoto();
        if (currentUser.value?.foto_profil !== failedPath) return;
    }
    photoFailed.value = true;
}

watch(
    () => currentUser.value?.foto_profil,
    () => {
        photoFailed.value = false;
        photoRetried = false;
    }
);

onMounted(refreshUserPhoto);

function handleClickOutside(event) {
    if (profileContainerRef.value && !profileContainerRef.value.contains(event.target)) {
        profileMenuOpen.value = false;
    }
}

function handleKeydown(event) {
    if (event.key === 'Escape' && profileMenuOpen.value) {
        profileMenuOpen.value = false;
    }
}

onMounted(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleKeydown);
});

const userInitials = computed(() => {
    if (!currentUser.value?.name) return 'U';
    return currentUser.value.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('');
});

const userRoleBadge = computed(() => {
    const r = currentUser.value?.role || currentUser.value?.kd_role || '';
    return ROLE_LABELS[r] || currentUser.value?.roleName || r || 'Karyawan';
});
const idLabel = computed(() => (isAdmin(currentUser.value) ? 'Username' : 'NIK'));
const unitLabel = computed(() => {
    const u = currentUser.value;
    if (isSuperAdmin(u)) return 'Semua divisi';
    return u?.adminDivision || u?.department || u?.kd_dept || '-';
});
const showRoleBadge = computed(() => userRoleBadge.value !== currentUser.value?.name);
const canViewProfile = computed(() => can('login_user.view_profile'));

function toggleProfileMenu() {
    profileMenuOpen.value = !profileMenuOpen.value;
}

const { pageTour, introTour } = useTour();

function handleLogout() {
    profileMenuOpen.value = false;
    logout();
    router.push('/auth/login');
}
</script>

<template>
    <header
        class="sticky top-0 z-40 w-full h-16 bg-surface-0 dark:bg-surface-900 px-3 sm:px-6 flex items-center justify-between gap-2"
        :class="{ 'lg:pl-1': showSidebar }"
    >
        <div class="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
                v-if="showSidebar"
                type="button"
                class="lg:hidden w-11 h-11 flex items-center justify-center text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-surface-0 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                data-tour="menu-mobile"
                @click="toggleMobileMenu"
                aria-label="Buka menu navigasi utama"
            >
                <PhList :size="22" weight="regular" aria-hidden="true" />
            </button>
            <button
                v-if="showSidebar"
                type="button"
                class="hidden lg:flex w-11 h-11 items-center justify-center text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-surface-0 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                @click="toggleSidebarCollapse"
                :aria-label="sidebarToggleLabel"
                :title="sidebarToggleLabel"
                :aria-expanded="!isSidebarCollapsed"
                aria-controls="app-sidebar"
            >
                <PhSidebarSimple v-if="isSidebarCollapsed" :size="22" weight="regular" aria-hidden="true" />
                <PhSidebarSimple v-else :size="22" weight="regular" aria-hidden="true" />
            </button>
            <router-link to="/" :class="['flex items-center gap-2 sm:gap-2.5 min-w-0', { 'lg:hidden': showSidebar }]">
                <img :src="publicPath('logo-inalum.png')" alt="Logo PT INALUM" class="h-7 sm:h-8 w-auto object-contain shrink-0" />
                <div class="flex flex-col min-w-0 max-[359px]:hidden">
                    <span class="font-bold text-base leading-tight text-primary">Lebur</span>
                    <span class="hidden sm:block text-xs text-muted-color font-normal whitespace-nowrap">PT Indonesia Asahan Aluminium</span>
                </div>
            </router-link>
        </div>

        <div class="flex items-center gap-1 sm:gap-3 shrink-0">
            <AppTourMenu />
            <AppNotificationMenu />

            <button
                type="button"
                @click="toggleDarkMode($event)"
                class="w-9 h-9 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-surface-0 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                :aria-label="isDarkTheme ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'"
                title="Ganti Mode Gelap/Terang"
            >
                <PhSun v-if="isDarkTheme" :size="16" weight="bold" aria-hidden="true" />
                <PhMoon v-else :size="16" weight="bold" aria-hidden="true" />
            </button>

            <div class="h-6 w-px bg-surface-200 dark:bg-surface-800 mx-1 hidden sm:block"></div>

            <div ref="profileContainerRef" class="relative">
                <button
                    type="button"
                    data-tour="profile"
                    @click="toggleProfileMenu"
                    class="flex items-center gap-2 p-1 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    :aria-expanded="profileMenuOpen"
                    aria-haspopup="dialog"
                    aria-label="Menu akun pengguna"
                >
                    <img
                        v-if="userPhoto"
                        :src="userPhoto"
                        :alt="`Foto profil ${currentUser?.name || ''}`"
                        class="w-8 h-8 rounded-full object-cover border border-primary/20 shrink-0 shadow-xs"
                        @error="handlePhotoError"
                    />
                    <div
                        v-else
                        class="w-8 h-8 rounded-full bg-primary/10 text-primary dark:bg-primary/20 font-bold text-xs flex items-center justify-center border border-primary/20 shrink-0 select-none shadow-xs"
                        :title="currentUser?.name"
                    >
                        {{ userInitials }}
                    </div>
                    <span class="text-xs font-semibold truncate text-surface-900 dark:text-surface-100 hidden sm:block max-w-[140px]" :title="currentUser?.name">
                        {{ currentUser?.name || 'Karyawan' }}
                    </span>
                    <PhCaretDown :size="14" weight="bold" aria-hidden="true" class="text-muted-color hidden sm:block transition-transform duration-200" :class="{ 'rotate-180': profileMenuOpen }" />
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
                        v-if="profileMenuOpen"
                        role="dialog"
                        aria-label="Profil dan opsi akun"
                        class="absolute right-0 top-full mt-2 w-80 bg-surface-0 dark:bg-surface-900 border border-surface rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col text-left origin-top-right"
                    >
                        <div class="p-4 border-b border-surface flex items-start gap-3.5">
                            <img
                                v-if="userPhoto"
                                :src="userPhoto"
                                :alt="`Foto profil ${currentUser?.name || ''}`"
                                class="w-12 h-12 rounded-full object-cover border border-primary/20 shrink-0 select-none shadow-xs mt-0.5"
                                @error="handlePhotoError"
                            />
                            <div
                                v-else
                                class="w-12 h-12 rounded-full bg-primary/10 text-primary dark:bg-primary/20 font-bold text-base flex items-center justify-center border border-primary/20 shrink-0 select-none shadow-xs mt-0.5"
                            >
                                {{ userInitials }}
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="text-sm font-bold text-surface-900 dark:text-surface-0 truncate leading-snug" :title="currentUser?.name">
                                    {{ currentUser?.name || 'Karyawan' }}
                                </div>
                                <div class="mt-1 flex items-center gap-1.5 flex-wrap">
                                    <span v-if="showRoleBadge" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                                        {{ userRoleBadge }}
                                    </span>
                                    <span class="text-[11px] font-medium text-muted-color">
                                        {{ idLabel }}: {{ currentUser?.namecode || currentUser?.username || '-' }}
                                    </span>
                                </div>
                                <div class="text-[11px] text-muted-color mt-1 truncate" :title="unitLabel">
                                    {{ unitLabel }}
                                </div>
                            </div>
                        </div>

                        <div class="p-2 space-y-1">
                            <component
                                :is="canViewProfile ? RouterLink : 'div'"
                                :to="canViewProfile ? '/profile' : undefined"
                                :aria-disabled="!canViewProfile || undefined"
                                :title="canViewProfile ? undefined : 'Izin melihat profil tidak aktif untuk peran Anda'"
                                @click="canViewProfile && (profileMenuOpen = false)"
                                class="flex items-center justify-between p-2.5 rounded-xl transition-colors group text-decoration-none"
                                :class="canViewProfile ? 'hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer' : 'opacity-50 cursor-not-allowed'"
                            >
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-lg bg-surface-100 dark:bg-surface-800 group-hover:bg-primary/10 group-hover:text-primary transition-colors flex items-center justify-center text-surface-600 dark:text-surface-300">
                                        <PhUser :size="16" weight="bold" aria-hidden="true" />
                                    </div>
                                    <div class="flex flex-col">
                                        <span class="text-xs font-semibold text-surface-800 dark:text-surface-100 group-hover:text-primary transition-colors">
                                            Profil & Pengaturan Akun
                                        </span>
                                        <span class="text-[10px] text-muted-color">
                                            Foto, kontak notifikasi & kata sandi
                                        </span>
                                    </div>
                                </div>
                                <PhCaretRight :size="14" weight="bold" aria-hidden="true" class="text-muted-color group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                            </component>

                            <div v-if="pageTour || introTour" class="sm:hidden">
                                <AppTourMenuItems @select="profileMenuOpen = false" />
                            </div>

                            <div class="h-px bg-surface-100 dark:bg-surface-800 my-1"></div>

                            <button
                                type="button"
                                @click="handleLogout"
                                class="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors group cursor-pointer border-none bg-transparent text-left"
                            >
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 group-hover:bg-rose-100 dark:group-hover:bg-rose-900/60 transition-colors flex items-center justify-center text-rose-500">
                                        <PhSignOut :size="14" weight="bold" aria-hidden="true" />
                                    </div>
                                    <div class="flex flex-col">
                                        <span class="text-xs font-semibold text-rose-600 dark:text-rose-400">
                                            Keluar
                                        </span>
                                        <span class="text-[10px] text-muted-color">
                                            Akhiri sesi kerja di portal
                                        </span>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                </transition>
            </div>
        </div>
    </header>
</template>
