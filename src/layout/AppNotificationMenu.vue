<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/service/api';
import { currentUser, sicutiState, formatTimeAgo, isAdmin, isApprover, refreshPendingApprovalCount } from '@/service/sicutiService';
import LeaveDetailDialog from '@/components/leave/LeaveDetailDialog.vue';
import AppNotificationItem from '@/layout/AppNotificationItem.vue';
import {
    PhBell,
    PhChecks,
    PhTray,
    PhCaretRight
} from '@phosphor-icons/vue';

const router = useRouter();

const notifOpen = ref(false);
const notifTab = ref('all');
const selectedRequest = ref(null);
const isDetailDialogVisible = ref(false);

const notifications = ref([]);
const unreadCount = ref(0);
let pollTimer = null;
let lastTopId = null;
const POLL_MS = 15000;

const TYPE_GROUP = {
    leave_approved: 'approved',
    leave_progress: 'approved',
    leave_rejected: 'rejected',
    leave_cancelled: 'rejected',
    leave_returned: 'returned',
    leave_pending_approval: 'pending',
    leave_reminder: 'pending',
    leave_submitted: 'submitted',
    leave_new: 'submitted',
    leave_document_added: 'submitted',
    document_reminder: 'returned'
};

async function loadNotifications() {
    if (!currentUser.value) {
        notifications.value = [];
        unreadCount.value = 0;
        return;
    }
    try {
        const res = await api.get('/sicuti/notification');
        const data = res?.data || {};
        notifications.value = (data.items || []).map((n) => ({
            id: n.id,
            type: n.type,
            group: TYPE_GROUP[n.type] || 'info',
            title: n.title,
            message: n.message,
            requestId: n.id_request,
            isRead: n.is_read,
            timeAgo: formatTimeAgo(n.created_at)
        }));
        unreadCount.value = Number(data.unread_count || 0);
        const topId = notifications.value[0]?.id ?? null;
        if (lastTopId !== null && topId !== null && topId !== lastTopId) {
            sicutiState.dataVersion++;
            void refreshPendingApprovalCount();
        }
        lastTopId = topId;
    } catch {
    }
}

let marking = false;
async function markRead(ids) {
    if (marking) return;
    marking = true;
    try {
        await api.put('/sicuti/notification/read', ids ? { ids } : {}).catch(() => {});
        await loadNotifications();
    } finally {
        marking = false;
    }
}

const displayedNotifications = computed(() => {
    if (notifTab.value === 'unread') {
        return notifications.value.filter((n) => !n.isRead);
    }
    return notifications.value;
});

function onKeydown(e) {
    if (e.key === 'Escape' && notifOpen.value) closeNotif();
}

function toggleNotif() {
    notifOpen.value = !notifOpen.value;
    if (notifOpen.value) loadNotifications();
}

function closeNotif() {
    notifOpen.value = false;
}

function handleMarkAllRead() {
    markRead(null);
}

function pollIfVisible() {
    if (document.visibilityState === 'visible') loadNotifications();
}

onMounted(() => {
    loadNotifications();
    pollTimer = setInterval(pollIfVisible, POLL_MS);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('visibilitychange', pollIfVisible);
});
onBeforeUnmount(() => {
    clearInterval(pollTimer);
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('visibilitychange', pollIfVisible);
});
watch(() => currentUser.value?.id, loadNotifications);


function handleNotifClick(notif) {
    if (!notif.isRead) markRead([notif.id]);
    closeNotif();

    if (notif.group === 'pending') {
        router.push('/approval/pending');
        return;
    }
    if (notif.type === 'leave_new') {
        router.push('/admin/monitoring');
        return;
    }
    if (notif.requestId) {
        // Approver tidak punya pengajuan orang lain di state; dialog mengambil detail lengkap sendiri lewat id.
        selectedRequest.value = sicutiState.leaveRequests.find((r) => r.id === notif.requestId) || { id: notif.requestId };
        isDetailDialogVisible.value = true;
        return;
    }
    router.push('/leave/history');
}

function handleDetailEdit(req) {
    isDetailDialogVisible.value = false;
    router.push({ path: '/leave/history', query: { editId: req.id } });
}

const isAdminRole = computed(() => isAdmin(currentUser.value));
const isApprovalRole = computed(() => isApprover(currentUser.value));

const footerNavText = computed(() => {
    if (isAdminRole.value) return 'Buka Pemantauan Divisi';
    if (isApprovalRole.value) return 'Buka Antrean Persetujuan';
    return 'Buka Pengajuan Cuti';
});

function navigateFooter() {
    closeNotif();
    if (isAdminRole.value) router.push('/admin/monitoring');
    else if (isApprovalRole.value) router.push('/approval/pending');
    else router.push('/leave/history');
}
</script>

<template>
    <div class="relative">
        <button
            type="button"
            data-tour="notifications"
            @click="toggleNotif"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-surface-0 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer relative"
            :aria-label="unreadCount > 0 ? `Buka notifikasi, ${unreadCount} pesan belum dibaca` : 'Buka notifikasi'"
            title="Notifikasi"
        >
            <PhBell :size="16" weight="bold" aria-hidden="true" />
            <span
                v-if="unreadCount > 0"
                class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center leading-none ring-2 ring-surface-0 dark:ring-surface-900"
            >
                {{ unreadCount > 9 ? '9+' : unreadCount }}
            </span>
        </button>

        <div
            v-if="notifOpen"
            role="dialog"
            aria-label="Notifikasi"
            class="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-full mt-2 w-auto sm:w-[380px] bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col"
        >
            <div class="px-4 py-3 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between bg-surface-50/60 dark:bg-surface-800/30">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-surface-900 dark:text-surface-100 uppercase tracking-wider">Notifikasi</span>
                    <span
                        v-if="unreadCount > 0"
                        class="px-2 py-0.5 text-xs font-bold rounded-full bg-primary/10 text-primary dark:bg-primary/20"
                    >
                        {{ unreadCount }} Baru
                    </span>
                </div>
                <div class="flex items-center gap-1">
                    <button
                        v-if="unreadCount > 0"
                        type="button"
                        @click="handleMarkAllRead"
                        class="px-2 py-1 rounded-md text-xs font-medium text-surface-500 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors flex items-center gap-1 cursor-pointer"
                        aria-label="Tandai semua pesan notifikasi telah dibaca"
                        title="Tandai semua telah dibaca"
                    >
                        <PhChecks :size="14" weight="bold" aria-hidden="true" />
                        <span>Tandai dibaca</span>
                    </button>
                    <button
                        type="button"
                        @click="closeNotif"
                        class="w-7 h-7 flex items-center justify-center rounded-md text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer text-xs"
                        aria-label="Tutup panel notifikasi"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div role="tablist" aria-label="Saring notifikasi" class="px-3 pt-2 pb-1.5 border-b border-surface-100 dark:border-surface-800/80 flex gap-2">
                <button
                    type="button"
                    role="tab"
                    :aria-selected="notifTab === 'all'"
                    @click="notifTab = 'all'"
                    :class="[
                        'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                        notifTab === 'all'
                            ? 'bg-primary text-primary-contrast shadow-xs'
                            : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                    ]"
                >
                    Semua ({{ notifications.length }})
                </button>
                <button
                    type="button"
                    role="tab"
                    :aria-selected="notifTab === 'unread'"
                    @click="notifTab = 'unread'"
                    :class="[
                        'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                        notifTab === 'unread'
                            ? 'bg-primary text-primary-contrast shadow-xs'
                            : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                    ]"
                >
                    Belum Dibaca ({{ unreadCount }})
                </button>
            </div>
            <div class="max-h-[380px] overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800/60">
                <div v-if="displayedNotifications.length === 0" class="py-10 px-4 text-center">
                    <div class="w-10 h-10 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center mx-auto mb-2.5 text-surface-400">
                        <PhTray :size="22" weight="regular" aria-hidden="true" />
                    </div>
                    <p class="text-xs font-medium text-surface-700 dark:text-surface-200">
                        {{ notifTab === 'unread' ? 'Semua notifikasi sudah dibaca' : 'Tidak ada notifikasi' }}
                    </p>
                    <p class="text-[11px] text-muted-color mt-0.5">
                        Notifikasi aktivitas pengajuan dan mutasi cuti akan muncul di sini.
                    </p>
                </div>

                <AppNotificationItem
                    v-for="notif in displayedNotifications"
                    :key="notif.id"
                    :item="notif"
                    @click="handleNotifClick(notif)"
                />
            </div>

            <div class="p-2 border-t border-surface-100 dark:border-surface-800 bg-surface-50/60 dark:bg-surface-800/30 text-center">
                <button
                    type="button"
                    @click="navigateFooter"
                    class="w-full py-1.5 text-xs font-semibold text-primary hover:text-primary-600 dark:hover:text-primary-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                    <span>{{ footerNavText }}</span>
                    <PhCaretRight :size="14" weight="bold" aria-hidden="true" />
                </button>
            </div>
        </div>

        <div v-if="notifOpen" class="fixed inset-0 z-40" @click="closeNotif"></div>
    </div>

    <LeaveDetailDialog
        v-model:visible="isDetailDialogVisible"
        :request="selectedRequest"
        @edit="handleDetailEdit"
    />
</template>


