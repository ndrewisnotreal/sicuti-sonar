<script setup>
import { ref, watch } from 'vue';
import { adminService } from '@/service/adminService';
import { formatDateTime } from '@/service/sicutiService';
import { statusReasonLabel } from '@/service/statusReason';

const props = defineProps({
    visible: { type: Boolean, default: false },
    user: { type: Object, default: null }
});
const emit = defineEmits(['update:visible']);

const loading = ref(false);
const history = ref([]);
const error = ref('');

async function load() {
    if (!props.user?.uid_user_system) return;
    loading.value = true;
    error.value = '';
    try {
        history.value = await adminService.getStatusHistory(props.user.uid_user_system);
    } catch (err) {
        history.value = [];
        error.value = err.message || 'Riwayat status gagal dimuat';
    } finally {
        loading.value = false;
    }
}

watch(
    () => [props.visible, props.user?.uid_user_system],
    ([open]) => {
        if (open) load();
    },
    { immediate: true }
);
</script>

<template>
    <Dialog
        :visible="visible"
        @update:visible="emit('update:visible', $event)"
        modal
        :header="`Riwayat Status · ${user?.nama || user?.username || ''}`"
        :style="{ width: '480px' }"
        :breakpoints="{ '640px': '92vw' }"
        dismissableMask
    >
        <div class="pt-1 text-xs">
            <div v-if="loading" class="py-8 text-center text-muted-color">Memuat riwayat...</div>
            <div v-else-if="error" class="py-6 text-center text-rose-500">{{ error }}</div>
            <div v-else-if="!history.length" class="py-8 text-center text-muted-color">
                Belum ada riwayat perubahan status.
                <span v-if="user?.status_user === 'N'" class="block mt-1">Akun ini dinonaktifkan sebelum alasan mulai dicatat.</span>
            </div>
            <ol v-else class="divide-y divide-surface-200 dark:divide-surface-700">
                <li v-for="h in history" :key="h.id_log" class="py-3 first:pt-0 last:pb-0">
                    <div class="flex items-center justify-between gap-2">
                        <Tag :value="h.status === 'N' ? 'Dinonaktifkan' : 'Diaktifkan'" :severity="h.status === 'N' ? 'secondary' : 'success'" class="text-[11px]" />
                        <span class="text-[11px] text-muted-color">{{ formatDateTime(h.created_at) }}</span>
                    </div>
                    <div v-if="h.reason_code" class="mt-2 font-semibold text-surface-900 dark:text-surface-100">{{ h.reason_label || statusReasonLabel(h.reason_code) }}</div>
                    <p v-if="h.note" class="mt-1 text-surface-700 dark:text-surface-300 leading-relaxed">{{ h.note }}</p>
                    <div class="mt-1.5 text-[11px] text-muted-color">oleh {{ h.changed_by_name || h.changed_by || 'sistem' }}</div>
                </li>
            </ol>
        </div>
    </Dialog>
</template>
