<script setup>
import { ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { PhCloudArrowUp, PhFileText, PhTrash } from '@phosphor-icons/vue';

const props = defineProps({
    modelValue: {
        type: Object,
        default: null
    },
    existingUrl: {
        type: String,
        default: ''
    },
    disabled: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:modelValue', 'remove']);

const toast = useToast();
const fileInputRef = ref(null);
const isDragging = ref(false);

function formatFileSize(bytes) {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function processFile(file) {
    if (!file || props.disabled) return;

    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (ext !== '.pdf') {
        toast.add({
            severity: 'error',
            summary: 'Format Tidak Didukung',
            detail: 'Dokumen pendukung harus berupa PDF',
            life: 3500
        });
        if (fileInputRef.value) fileInputRef.value.value = '';
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        toast.add({
            severity: 'error',
            summary: 'Ukuran Terlalu Besar',
            detail: 'Ukuran berkas maksimal 2 MB',
            life: 3500
        });
        if (fileInputRef.value) fileInputRef.value.value = '';
        return;
    }

    emit('update:modelValue', {
        file,
        name: file.name,
        size: file.size
    });
}

function handleFileUpload(event) {
    const file = event.target.files?.[0];
    processFile(file);
}

function handleDrop(event) {
    isDragging.value = false;
    const file = event.dataTransfer?.files?.[0];
    processFile(file);
}

function removeFile() {
    if (fileInputRef.value) {
        fileInputRef.value.value = '';
    }
    emit('update:modelValue', null);
    emit('remove');
}
</script>

<template>
    <div class="space-y-2">
        <div
            v-if="modelValue?.name || existingUrl"
            class="p-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/60 flex items-center justify-between gap-3 shadow-2xs"
        >
            <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <PhFileText :size="16" weight="bold" aria-hidden="true" />
                </div>
                <div class="min-w-0">
                    <div class="text-xs font-semibold text-surface-900 dark:text-surface-0 truncate">
                        {{ modelValue?.name || existingUrl.split('/').pop() }}
                    </div>
                    <div class="text-[11px] text-muted-color flex items-center gap-2">
                        <span v-if="modelValue?.size">{{ formatFileSize(modelValue.size) }}</span>
                        <span v-if="modelValue?.file" class="text-emerald-600 dark:text-emerald-400 font-medium">&bull; Siap diunggah ke server</span>
                        <span v-else-if="existingUrl" class="text-primary font-medium">&bull; Berkas tersimpan</span>
                    </div>
                </div>
            </div>
            <button
                v-if="!disabled"
                type="button"
                class="p-1.5 rounded-lg text-surface-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                @click="removeFile"
                title="Hapus / Ganti Dokumen"
            >
                <PhTrash :size="14" weight="bold" aria-hidden="true" />
            </button>
        </div>

        <div v-else>
            <label
                class="border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all text-center group"
                :class="[
                    isDragging
                        ? 'border-primary bg-primary/10'
                        : 'border-surface-300 dark:border-surface-700 hover:border-primary/60 dark:hover:border-primary/60 bg-surface-50/50 dark:bg-surface-800/30 hover:bg-primary/5',
                    disabled ? 'opacity-60 pointer-events-none' : ''
                ]"
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="handleDrop"
            >
                <PhCloudArrowUp :size="22" weight="regular" aria-hidden="true" class="text-muted-color group-hover:text-primary transition-colors" />
                <div class="text-xs font-semibold text-surface-800 dark:text-surface-200">
                    Pilih Dokumen Pendukung Fisik
                </div>
                <p class="text-[11px] text-muted-color">
                    Unggah berkas PDF (maks. 2 MB)
                </p>
                <input
                    ref="fileInputRef"
                    type="file"
                    class="hidden"
                    accept=".pdf,application/pdf"
                    :disabled="disabled"
                    @change="handleFileUpload"
                />
            </label>
        </div>
    </div>
</template>
