<script setup>
import { formatDateTime } from '@/service/sicutiService';
import { computed } from 'vue';
import { PhCheck, PhClock, PhMinus, PhArrowUUpLeft, PhX } from '@phosphor-icons/vue';

const props = defineProps({
    steps: {
        type: Array,
        default: () => []
    }
});

function getStepBadge(stepStatus, isCurrent) {
    switch (stepStatus?.toLowerCase()) {
        case 'approved':
            return { label: 'Disetujui', severity: 'success', icon: PhCheck };
        case 'rejected':
            return { label: 'Ditolak', severity: 'danger', icon: PhX };
        case 'returned':
            return { label: 'Dikembalikan', severity: 'warn', icon: PhArrowUUpLeft };
        case 'pending':
        default:
            return {
                label: isCurrent ? 'Sedang Ditinjau' : 'Menunggu Antrean',
                severity: isCurrent ? 'info' : 'secondary',
                icon: PhClock
            };
    }
}

const approvedCount = computed(() => props.steps.filter((s) => s.status === 'approved').length);

// Setelah satu tingkat menolak, pengajuan selesai: tingkat sesudahnya tidak lagi "menunggu".
const rejectedIndex = computed(() => props.steps.findIndex((s) => s.status === 'rejected'));
const isSkipped = (step, idx) => rejectedIndex.value >= 0 && idx > rejectedIndex.value && step.status === 'pending';
const SKIPPED_BADGE = { label: 'Tidak dilanjutkan', icon: PhMinus };
const badgeOf = (step, idx) => (isSkipped(step, idx) ? SKIPPED_BADGE : getStepBadge(step.status, step.isCurrent));
const progressText = computed(() =>
    rejectedIndex.value >= 0
        ? `Ditolak di tingkat ${props.steps[rejectedIndex.value].level}`
        : `${approvedCount.value} dari ${props.steps.length} tingkat disetujui`
);

// Satu palet dengan Tag status PrimeVue, jadi hijau/merah/oranye di timeline sama dengan Tag di judul panel dan tabel.
// Tahap aktif sengaja biru merek (token Tag primary): menandai "giliran sekarang", beda dari status pengajuan (DESIGN.md).
// Warna selalu berpasangan dengan ikon penanda dan label teks, jadi status tidak bergantung pada warna saja.
const NEUTRAL = {
    marker: 'border border-surface-400 dark:border-surface-500 bg-surface-0 dark:bg-surface-900 text-surface-600 dark:text-surface-400',
    text: 'text-surface-600 dark:text-surface-400'
};
// Kelas ditulis utuh (bukan dirangkai) agar terdeteksi pemindai Tailwind.
const TONE = {
    approved: { marker: 'bg-(--p-tag-success-background) text-(--p-tag-success-color)', text: 'text-(--p-tag-success-color)' },
    rejected: { marker: 'bg-(--p-tag-danger-background) text-(--p-tag-danger-color)', text: 'text-(--p-tag-danger-color)' },
    returned: { marker: 'bg-(--p-tag-warn-background) text-(--p-tag-warn-color)', text: 'text-(--p-tag-warn-color)' },
    current: { marker: 'bg-(--p-tag-primary-background) text-(--p-tag-primary-color)', text: 'text-(--p-tag-primary-color)' }
};
const toneOf = (step, idx) => (isSkipped(step, idx) ? NEUTRAL : TONE[step.status] || (step.isCurrent ? TONE.current : NEUTRAL));

const NOTE_LABEL = { returned: 'Catatan Pengembalian / Revisi', rejected: 'Alasan Penolakan' };
const noteLabel = (step) => NOTE_LABEL[step.status] || 'Catatan';
</script>

<template>
    <div>
        <div class="mb-5">
            <h3 class="font-semibold text-sm text-surface-900 dark:text-surface-100">Alur persetujuan</h3>
            <p v-if="steps.length" class="mt-1 text-xs text-surface-600 dark:text-surface-400 tabular-nums">{{ progressText }}</p>
        </div>

        <div v-if="steps.length === 0" class="text-center py-4 text-sm text-muted-color">
            Belum ada data tahapan approval untuk pengajuan ini.
        </div>

        <ol v-else>
            <li v-for="(step, idx) in steps" :key="step.id || idx" class="relative flex gap-3 pb-5 last:pb-0">
                <span v-if="idx < steps.length - 1" class="absolute left-[11px] top-7 bottom-1 w-px bg-surface-200 dark:bg-surface-700" aria-hidden="true"></span>
                <span class="relative w-6 h-6 rounded-full flex items-center justify-center shrink-0" :class="toneOf(step, idx).marker" aria-hidden="true">
                    <component :is="badgeOf(step, idx).icon" :size="14" weight="bold" aria-hidden="true" />
                </span>

                <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 min-h-6">
                        <p class="text-xs text-surface-600 dark:text-surface-400">Tingkat {{ step.level }}</p>
                        <span class="text-xs font-medium" :class="toneOf(step, idx).text">
                            {{ badgeOf(step, idx).label }}
                        </span>
                    </div>
                    <p class="mt-0.5 text-sm font-medium leading-relaxed text-surface-900 dark:text-surface-100 break-words">{{ step.approverName }}</p>
                    <p v-if="step.actedAt" class="mt-1 text-xs text-surface-600 dark:text-surface-400">{{ formatDateTime(step.actedAt) }}</p>
                    <div v-if="step.notes" class="mt-2 rounded-border bg-surface-100 dark:bg-surface-800 px-3 py-2 text-sm leading-relaxed text-surface-800 dark:text-surface-200">
                        <span class="block text-xs font-medium mb-0.5" :class="toneOf(step, idx).text">{{ noteLabel(step) }}</span>
                        <p class="whitespace-pre-line break-words">{{ step.notes }}</p>
                    </div>
                </div>
            </li>
        </ol>
    </div>
</template>
