<template>
    <Dialog
        :visible="visible"
        modal
        header="Rincian Log Aktivitas"
        :style="{ width: '520px', maxWidth: '95vw' }"
        @update:visible="emit('update:visible', $event)"
    >
        <!-- Satu bingkai: daftar label/nilai tanpa kotak; label sama dengan tabel (audit-023 #7, #8). -->
        <div v-if="log" class="space-y-4 pt-1 text-sm">
            <dl class="divide-y divide-surface-200 dark:divide-surface-700">
                <div class="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-x-4 gap-y-0.5 py-2">
                    <dt class="text-surface-600 dark:text-surface-400">Waktu</dt>
                    <dd class="tabular-nums text-surface-900 dark:text-surface-100">{{ formattedTime }}</dd>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-x-4 gap-y-0.5 py-2">
                    <dt class="text-surface-600 dark:text-surface-400">Pengguna</dt>
                    <dd class="text-surface-900 dark:text-surface-100">
                        <span class="font-semibold">{{ auditUserName(log) }}</span>
                        <span class="block text-xs text-surface-600 dark:text-surface-400">NIK {{ log.username || log.user || '-' }}<template v-if="log.user_role"> · {{ log.user_role }}</template></span>
                    </dd>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-x-4 gap-y-0.5 py-2">
                    <dt class="text-surface-600 dark:text-surface-400">Aksi</dt>
                    <dd class="text-surface-900 dark:text-surface-100">
                        <Tag v-if="isAttentionAction(log.action)" :value="auditActionLabel(log.action)" severity="danger" />
                        <span v-else>{{ auditActionLabel(log.action) }}</span>
                        <span class="block font-mono text-xs text-surface-600 dark:text-surface-400">{{ log.action || '-' }}</span>
                    </dd>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-x-4 gap-y-0.5 py-2">
                    <dt class="text-surface-600 dark:text-surface-400">Entitas</dt>
                    <dd class="text-surface-900 dark:text-surface-100">
                        {{ auditEntityLabel(log.entity) }}
                        <span class="block font-mono text-xs text-surface-600 dark:text-surface-400 break-all">{{ log.entity || '-' }}</span>
                    </dd>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-x-4 gap-y-0.5 py-2">
                    <dt class="text-surface-600 dark:text-surface-400">Alamat IP</dt>
                    <dd class="font-mono text-surface-900 dark:text-surface-100 break-all">{{ log.ip_address || '-' }}</dd>
                </div>
            </dl>

            <div>
                <h3 class="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-1.5">Keterangan</h3>
                <p class="px-3 py-2.5 rounded-border bg-surface-100 dark:bg-surface-800 text-surface-800 dark:text-surface-200 leading-relaxed whitespace-pre-wrap break-words">{{ log.details || log.description || '-' }}</p>
            </div>

            <div v-if="log.payload">
                <h3 class="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-1.5">Data (JSON)</h3>
                <pre class="px-3 py-2.5 rounded-border bg-surface-100 dark:bg-surface-800 text-surface-800 dark:text-surface-200 font-mono text-xs overflow-x-auto max-h-48">{{ JSON.stringify(log.payload, null, 2) }}</pre>
            </div>
        </div>

        <template #footer>
            <Button label="Tutup" severity="secondary" size="small" @click="closeDialog" />
        </template>
    </Dialog>
</template>

<script setup>
import { computed } from 'vue';
import { formatDate } from '@/service/sicutiService';
import { auditActionLabel, auditEntityLabel, auditUserName, isAttentionAction } from './auditLog';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    log: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['update:visible']);

function closeDialog() {
    emit('update:visible', false);
}

// Waktu sudah dikonversi service ke zona perangkat; label zona tidak dipaksakan (audit-023 #11).
const formattedTime = computed(() => {
    if (!props.log) return '-';
    const raw = String(props.log.timestamp || props.log.created_at || '');
    if (!raw) return '-';
    const datePart = raw.split(/[ T]/)[0];
    const timePart = raw.split(/[ T]/)[1]?.slice(0, 8);
    const formattedDate = datePart ? formatDate(datePart) : '';
    return timePart ? `${formattedDate}, ${timePart}` : formattedDate;
});
</script>
