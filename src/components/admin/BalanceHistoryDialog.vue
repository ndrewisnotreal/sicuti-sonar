<script setup>
import { ref, watch } from 'vue';
import api from '@/service/api';
import { formatDateTime } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    user: {
        type: Object,
        default: null
    },
    year: {
        type: Number,
        default: null
    }
});

const emit = defineEmits(['update:visible']);
const toast = useToast();

const historyRows = ref([]);
const historyLoading = ref(false);
// Gagal dimuat dibedakan dari riwayat yang memang kosong (audit-021 #3).
const historyError = ref(false);

const HISTORY_LABEL = {
    DEDUCT: 'Pemakaian',
    REFUND: 'Pengembalian',
    ADJUST: 'Penyesuaian admin',
    EXPIRED: 'Carry over hangus',
    INIT: 'Saldo awal'
};

async function loadHistory() {
    historyLoading.value = true;
    historyError.value = false;
    try {
        const yr = props.year || props.user.year || new Date().getFullYear();
        const res = await api.get('/sicuti/leave-balance/history', {
            uid: props.user.uid_user_system,
            year: yr
        });
        historyRows.value = Array.isArray(res?.data) ? res.data : [];
    } catch (err) {
        historyRows.value = [];
        historyError.value = true;
        toast.add({ severity: 'error', summary: 'Riwayat Gagal Dimuat', detail: err.message, life: 3000 });
    } finally {
        historyLoading.value = false;
    }
}

watch(
    () => props.visible,
    (isOpen) => {
        if (!isOpen || !props.user?.uid_user_system) {
            historyRows.value = [];
            historyError.value = false;
            return;
        }
        loadHistory();
    }
);
</script>

<template>
    <Dialog
        :visible="visible"
        modal
        :header="`Riwayat Saldo · ${user?.nama || ''}`"
        :style="{ width: '620px' }"
        :breakpoints="{ '640px': '95vw' }"
        @update:visible="emit('update:visible', $event)"
    >
        <div v-if="historyError" role="alert" class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
            <span>Riwayat saldo gagal dimuat.</span>
            <Button label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11 sm:!min-h-9" :loading="historyLoading" @click="loadHistory" />
        </div>
        <DataTable :value="historyRows" :loading="historyLoading" class="p-datatable-sm text-xs" :rows="10" paginator responsiveLayout="scroll">
            <template #empty>
                <div class="text-center py-6 text-muted-color">
                    <template v-if="historyLoading">Memuat riwayat...</template>
                    <template v-else-if="historyError">Riwayat belum termuat.</template>
                    <template v-else>Belum ada mutasi saldo pada tahun ini.</template>
                </div>
            </template>
            <Column header="Waktu" style="width: 26%">
                <template #body="{ data }">{{ formatDateTime(data.created_at) }}</template>
            </Column>
            <Column header="Jenis" style="width: 22%">
                <template #body="{ data }">{{ HISTORY_LABEL[data.type] || data.type }}</template>
            </Column>
            <Column header="Hari" style="width: 10%">
                <template #body="{ data }">
                    <span class="font-semibold tabular-nums">{{ Number(data.amount) > 0 && data.type !== 'DEDUCT' ? '+' : '' }}{{ data.type === 'DEDUCT' ? -Math.abs(data.amount) : data.amount }}</span>
                </template>
            </Column>
            <Column header="Keterangan">
                <template #body="{ data }">{{ data.reason || '-' }}</template>
            </Column>
        </DataTable>
    </Dialog>
</template>
