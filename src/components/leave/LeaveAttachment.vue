<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { attachmentInfo, documentPending, fetchAttachmentUrl, formatDate, openAttachment } from '@/service/sicutiService';
import { PhPaperclip, PhArrowSquareOut, PhFileDashed } from '@phosphor-icons/vue';

const props = defineProps({
    request: { type: Object, default: null },
    preview: { type: Boolean, default: true },
    compact: { type: Boolean, default: false }
});

const toast = useToast();
const info = computed(() => attachmentInfo(props.request));
const pending = computed(() => documentPending(props.request));
const imageUrl = ref('');

function release() {
    if (imageUrl.value) URL.revokeObjectURL(imageUrl.value);
    imageUrl.value = '';
}

watch(
    () => [info.value?.idRequest, info.value?.isImage, props.preview, props.request?.attachment_url],
    async () => {
        release();
        if (!props.preview || !info.value?.isImage || !info.value?.hasFile) return;
        try {
            imageUrl.value = await fetchAttachmentUrl(info.value.idRequest);
        } catch {
            imageUrl.value = '';
        }
    },
    { immediate: true }
);

onBeforeUnmount(release);

async function open() {
    try {
        await openAttachment(info.value.idRequest);
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lampiran tidak bisa dibuka', detail: err.message || 'Coba lagi beberapa saat.', life: 3500 });
    }
}
</script>

<template>
    <div v-if="pending" class="inline-flex items-start gap-2 px-3 py-2 rounded-lg border text-xs bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100">
        <PhFileDashed :size="14" weight="bold" aria-hidden="true" class="mt-0.5 shrink-0" />
        <span>
            Dokumen pendukung menyusul, paling lambat <strong>{{ formatDate(request.document_due_date) }}</strong>.
            <template v-if="!compact">Pengajuan belum bisa disetujui sebelum dokumen diunggah.</template>
        </span>
    </div>
    <div v-else-if="info" :class="compact ? '' : 'space-y-2'">
        <button
            v-if="imageUrl && !compact"
            type="button"
            class="block w-fit cursor-zoom-in"
            title="Buka gambar ukuran penuh"
            @click="open"
        >
            <img :src="imageUrl" :alt="'Lampiran ' + info.name" class="max-h-64 max-w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 object-contain" />
        </button>
        <button
            v-if="info.hasFile"
            type="button"
            :class="
                compact
                    ? 'inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer'
                    : 'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-800 dark:text-surface-200 text-xs font-medium hover:text-primary transition-colors cursor-pointer'
            "
            @click="open"
        >
            <PhPaperclip :size="14" weight="bold" aria-hidden="true" class="text-primary shrink-0" />
            <span class="truncate max-w-xs">{{ info.name }}</span>
            <PhArrowSquareOut v-if="!compact" :size="14" weight="bold" aria-hidden="true" class="text-muted-color shrink-0" />
        </button>
        <span v-else class="inline-flex items-center gap-1.5 text-xs text-muted-color">
            <PhPaperclip :size="14" weight="bold" aria-hidden="true" class="shrink-0" />
            <span class="truncate max-w-xs">{{ info.name }}</span>
        </span>
    </div>
</template>
