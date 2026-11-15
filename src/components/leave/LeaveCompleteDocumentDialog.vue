<script setup>
import { ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { leaveService } from '@/service/leaveService';
import { formatDate, syncFromBackend } from '@/service/sicutiService';
import { PhFileArrowUp } from '@phosphor-icons/vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    request: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['update:visible', 'uploaded']);
const toast = useToast();

const docFile = ref(null);
const docUploading = ref(false);

watch(
    () => props.visible,
    (val) => {
        if (val) {
            docFile.value = null;
        }
    }
);

function onDocSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (ext !== '.pdf') {
        toast.add({ severity: 'error', summary: 'Format Tidak Didukung', detail: 'Dokumen pendukung harus berupa PDF.', life: 3500 });
        event.target.value = '';
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        toast.add({ severity: 'error', summary: 'Ukuran Terlalu Besar', detail: 'Ukuran berkas maksimal 2 MB.', life: 3500 });
        event.target.value = '';
        return;
    }
    docFile.value = file;
}

async function submitDocument() {
    if (!docFile.value || !props.request) return;
    docUploading.value = true;
    try {
        const id = props.request.id_request || props.request.id;
        await leaveService.completeDocument(id, docFile.value);
        void syncFromBackend({ fresh: true });
        toast.add({
            severity: 'success',
            summary: 'Dokumen Terkirim',
            detail: `Dokumen pendukung pengajuan #${id} sudah diunggah dan diteruskan ke approver.`,
            life: 4000
        });
        emit('update:visible', false);
        emit('uploaded');
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Gagal Mengunggah',
            detail: err.message || 'Coba lagi beberapa saat.',
            life: 4500
        });
    } finally {
        docUploading.value = false;
    }
}
</script>

<template>
    <Dialog
        :visible="visible"
        modal
        header="Lengkapi Dokumen Pendukung"
        :style="{ width: '460px' }"
        :breakpoints="{ '640px': '95vw' }"
        :closable="!docUploading"
        @update:visible="emit('update:visible', $event)"
    >
        <div v-if="request" class="space-y-3 pt-1 text-xs">
            <p class="text-muted-color leading-relaxed">
                Pengajuan <strong class="text-surface-900 dark:text-surface-100">#{{ request.id_request || request.id }}</strong>
                ({{ request.nm_leave_type || request.leaveTypeName }}) menunggu dokumen pendukung paling lambat
                <strong class="text-surface-900 dark:text-surface-100">{{ formatDate(request.document_due_date) }}</strong>.
            </p>
            <label for="doc-file" class="block text-sm font-medium text-surface-700 dark:text-surface-200">Berkas dokumen <span class="text-red-500">*</span></label>
            <input id="doc-file" type="file" accept=".pdf,application/pdf" class="block w-full text-xs" @change="onDocSelected" />
            <p class="text-[11px] text-muted-color">PDF, maksimal 2 MB.</p>
        </div>
        <template #footer>
            <div class="flex items-center justify-between gap-2 w-full pt-3.5 border-t border-surface-100 dark:border-surface-800">
                <Button
                    label="Batal"
                    severity="secondary"
                    text
                    size="small"
                    class="text-xs font-semibold"
                    :disabled="docUploading"
                    @click="emit('update:visible', false)"
                />
                <Button
                    size="small"
                    class="text-xs font-semibold flex items-center gap-1.5"
                    :loading="docUploading"
                    :disabled="!docFile"
                    @click="submitDocument"
                >
                    <PhFileArrowUp :size="14" weight="bold" aria-hidden="true" />
                    <span>Unggah Dokumen</span>
                </Button>
            </div>
        </template>
    </Dialog>
</template>
