<script setup>
import { onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { currentUser } from '@/service/sicutiService';
import { authService } from '@/service/authService';
import { sidebarModel } from '@/layout/composables/sidebarMenu';
import { PhLock } from '@phosphor-icons/vue';

const route = useRoute();
// Menu aktif memakai ikon bobot fill sebagai penanda keadaan, selain warna latar (audit-026 opsi B).
const isCurrent = (item) => route.path === item.to;

const props = defineProps({
    collapsed: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['item-click']);

async function reloadMenu() {
    if (authService.isAuthenticated()) {
        try {
            await authService.getMenu();
        } catch {}
    }
}

function handleVisibilityChange() {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        reloadMenu();
    }
}

onMounted(() => {
    reloadMenu();
    if (typeof window !== 'undefined') {
        window.addEventListener('visibilitychange', handleVisibilityChange);
    }
});

onUnmounted(() => {
    if (typeof window !== 'undefined') {
        window.removeEventListener('visibilitychange', handleVisibilityChange);
    }
});

watch(
    () => [currentUser.value?.id, currentUser.value?.role],
    () => {
        reloadMenu();
    }
);

const model = sidebarModel;

const menuLabel = (item) => (item.badge ? `${item.label}, ${item.badge} aktif` : item.label);

// Tooltip PrimeVue hanya mendengar hover ATAU fokus; fokus keyboard diteruskan sebagai hover agar label tetap terlihat.
function relayTooltip(event, type) {
    if (props.collapsed) event.currentTarget.dispatchEvent(new MouseEvent(type));
}
</script>

<template>
    <nav class="flex flex-col gap-3">
        <div v-for="(group, gIdx) in model" :key="group.label" :data-tour="`menu-group:${group.label}`" class="flex flex-col">
            <div
                v-if="!collapsed"
                class="text-[11px] font-semibold uppercase tracking-wider text-muted-color navy:text-white/50 whitespace-nowrap select-none mb-1.5"
            >
                {{ group.label }}
            </div>

            <div
                v-if="collapsed && gIdx > 0"
                class="w-6 border-t border-surface navy:border-white/15 mx-auto my-2"
            />

            <div class="flex flex-col gap-1">
                <template v-for="item in group.items" :key="item.to">
                    <div
                        v-if="item.disabled"
                        :data-tour="`menu:${item.to}`"
                        role="link"
                        aria-disabled="true"
                        :title="`${item.label}: tidak ada izin. Hubungi Super Admin untuk membukanya.`"
                        :class="[
                            collapsed
                                ? 'w-11 h-11 justify-center mx-auto'
                                : 'w-full h-11 px-3 justify-start gap-3',
                            'flex items-center rounded-xl cursor-not-allowed select-none opacity-50 text-surface-500 dark:text-surface-400 navy:text-white/70'
                        ]"
                    >
                        <div class="w-6 h-6 flex items-center justify-center shrink-0">
                            <component :is="item.icon" :size="22" weight="regular" aria-hidden="true" class="text-surface-400 dark:text-surface-500 navy:text-white/60" />
                        </div>
                        <template v-if="!collapsed">
                            <span class="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis flex-1">
                                {{ item.label }}
                            </span>
                            <PhLock :size="14" weight="bold" aria-hidden="true" class="shrink-0" />
                        </template>
                    </div>
                    <router-link
                        v-else
                        :data-tour="`menu:${item.to}`"
                        :to="item.to"
                        @click="emit('item-click')"
                        v-tooltip.right="collapsed ? menuLabel(item) : null"
                        @focus="relayTooltip($event, 'mouseenter')"
                        @blur="relayTooltip($event, 'mouseleave')"
                        :aria-label="collapsed ? menuLabel(item) : undefined"
                        :class="[
                            collapsed
                                ? 'w-11 h-11 justify-center mx-auto'
                                : 'w-full h-11 px-3 justify-start gap-3',
                            'flex items-center rounded-xl transition-colors cursor-pointer relative group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary navy:focus-visible:outline-white text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-surface-0 hover:bg-surface-100 dark:hover:bg-surface-800 navy:text-white/75 navy:hover:text-white navy:hover:bg-white/15'
                        ]"
                        exact-active-class="!bg-primary/10 !text-primary dark:!bg-primary/20 dark:!text-primary-300 navy:!bg-primary-500 navy:!text-white navy:dark:!bg-primary/15 navy:dark:!text-primary-300 navy:dark:inset-shadow-[2px_0_0_var(--p-primary-400)] font-semibold"
                    >
                        <div class="w-6 h-6 flex items-center justify-center shrink-0">
                            <component
                                :is="item.icon"
                                :size="22"
                                :weight="isCurrent(item) ? 'fill' : 'regular'"
                                aria-hidden="true"
                                class="text-surface-500 dark:text-surface-400 group-hover:text-primary group-[.router-link-exact-active]:!text-primary dark:group-[.router-link-exact-active]:!text-primary-300 navy:text-white/60 navy:group-hover:text-white navy:group-[.router-link-exact-active]:!text-white navy:dark:group-aria-[current=page]:!text-primary-300 transition-colors"
                            />
                        </div>
                    
                        <template v-if="!collapsed">
                            <span class="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis flex-1">
                                {{ item.label }}
                            </span>
                        
                            <span
                                v-if="item.badge"
                                class="px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-white navy:bg-white navy:text-primary-900 shadow-xs shrink-0"
                            >
                                {{ item.badge }}
                            </span>
                        </template>

                        <span
                            v-if="collapsed && item.badge"
                            class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary-300 ring-2 ring-primary-900 dark:ring-surface-900"
                            aria-hidden="true"
                        ></span>
                    </router-link>
                </template>
            </div>
        </div>
    </nav>
</template>
