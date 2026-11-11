<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { approvalService } from '@/service/approvalService';
import { formatDate, attachmentInfo, documentPending, syncFromBackend } from '@/service/sicutiService';
import LeaveAttachment from '@/components/leave/LeaveAttachment.vue';
import TourHelpButton from '@/components/common/TourHelpButton.vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { approvalConfirmOptions } from '@/utils/approvalConfirm';
import { PhCheck, PhX, PhArrowUUpLeft, PhCalendarBlank, PhArrowRight } from '@phosphor-icons/vue';

const props = defineProps({
    visible: { type: Boolean, default: false },
    request: { type: Object, default: null },
    reload: { type: Function, required: true }
});
const emit = defineEmits(['update:visible']);

const toast = useToast();
const confirm = useConfirm();

const activeRequest = computed(() => props.request);
const activeAttachment = computed(() => attachmentInfo(activeRequest.value));
const waitingDocument = computed(() => documentPending(activeRequest.value));
const isProcessing = ref(false);
const approvalNotes = ref('');
const notesError = ref('');

watch(
    () => props.visible,
    (open) => {
        if (open) {
            approvalNotes.value = '';
            notesError.value = '';
        }
    }
);
watch(approvalNotes, (v) => {
    if (v.trim()) notesError.value = '';
});

// Satu tanggal untuk cuti satu hari (audit-029 #15).
const singleDay = computed(() => {
    const r = activeRequest.value;
    return Boolean(r) && formatDate(r.start_date || r.startDate) === formatDate(r.end_date || r.endDate);
});

function close() {
    emit('update:visible', false);
}

function handleAction(actionType) {
    if (!activeRequest.value) return;

    const idReq = activeRequest.value.id_request || activeRequest.value.id;

    // Validasi di field, bukan toast; fokus dipindah ke catatan (DESIGN.md Form, audit-029 #14).
    if ((actionType === 'reject' || actionType === 'return') && !approvalNotes.value.trim()) {
        notesError.value = `Catatan wajib diisi saat ${actionType === 'reject' ? 'menolak' : 'mengembalikan'} pengajuan cuti.`;
        nextTick(() => document.getElementById('approval-notes')?.focus());
        return;
    }

    confirm.require({
        ...approvalConfirmOptions(actionType, activeRequest.value),
        // Fokus awal di Batal: Enter tidak langsung mengirim keputusan (DESIGN.md, audit-029 #13).
        defaultFocus: 'reject',
        accept: () => processAction(actionType, idReq)
    });
}

async function processAction(actionType, idReq) {
    if (isProcessing.value) return;
    isProcessing.value = true;
    try {
        await approvalService.processApproval({
            idRequest: idReq,
            action: actionType,
            notes: approvalNotes.value.trim()
        });
        void syncFromBackend({ fresh: true });

        const actionText = actionType === 'approve' ? 'disetujui' : (actionType === 'reject' ? 'ditolak' : 'dikembalikan');
        toast.add({
            severity: 'success',
            summary: 'Aksi Berhasil',
            detail: `Pengajuan cuti #${idReq} berhasil ${actionText}.`,
            life: 4000
        });

        close();
        await props.reload();
    } catch (err) {
        const msg = err?.data?.message || err?.message || 'Gagal memproses persetujuan';
        const alreadyProcessed = err?.status === 409;
        toast.add({
            severity: alreadyProcessed ? 'warn' : 'error',
            summary: alreadyProcessed ? 'Sudah Diproses' : 'Gagal',
            detail: msg,
            life: 5000
        });
        if (alreadyProcessed) {
            close();
            await props.reload();
        }
    } finally {
        isProcessing.value = false;
    }
}
</script>

<template>
    <Dialog
        :visible="visible"
        @update:visible="emit('update:visible', $event)"
        modal
        :header="`Proses Persetujuan Cuti #${activeRequest?.id_request || activeRequest?.id || ''}`"
        :style="{ width: '640px' }"
        :breakpoints="{ '960px': '92vw', '640px': '95vw' }"
        :closable="true"
        dismissableMask
        :pt="{ title: { class: '!text-base sm:!text-lg min-w-0 pr-3 break-words' } }"
    >
        <div v-if="activeRequest" class="space-y-4 pt-1 text-xs">
            <div data-tour="action-summary" class="space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pb-3 border-b border-surface-100 dark:border-surface-800 text-xs">
                    <div>
                        <span class="text-muted-color block mb-1">Pemohon</span>
                        <div class="font-bold text-surface-900 dark:text-surface-0 text-sm">
                            {{ activeRequest.requester_name || activeRequest.userName }}
                        </div>
                        <div class="text-xs text-muted-color mt-0.5">
                            NIK: {{ activeRequest.namecode || '-' }} &bull; {{ activeRequest.nm_dept || activeRequest.kd_dept || activeRequest.department || '-' }}
                        </div>
                    </div>
                    <div>
                        <span class="text-muted-color block mb-1">Jenis Cuti</span>
                        <div class="font-bold text-surface-900 dark:text-surface-0 text-sm">
                            {{ activeRequest.nm_leave_type || activeRequest.kd_leave_type }}
                        </div>
                        <div class="text-xs font-semibold text-surface-700 dark:text-surface-300 mt-0.5">
                            {{ activeRequest.total_days ?? activeRequest.totalDays }} Hari Kerja
                        </div>
                    </div>
                    <div class="sm:col-span-2">
                        <span class="text-muted-color block mb-1">Rentang Tanggal Pelaksanaan</span>
                        <div class="flex items-center gap-2 font-medium text-surface-800 dark:text-surface-200">
                            <PhCalendarBlank :size="14" weight="bold" aria-hidden="true" class="text-primary shrink-0" />
                            <span>{{ formatDate(activeRequest.start_date || activeRequest.startDate) }}</span>
                            <template v-if="!singleDay">
                                <PhArrowRight :size="14" weight="bold" aria-hidden="true" class="text-muted-color shrink-0" />
                                <span class="sr-only">sampai</span>
                                <span>{{ formatDate(activeRequest.end_date || activeRequest.endDate) }}</span>
                            </template>
                        </div>
                    </div>
                    <div v-if="activeAttachment || waitingDocument" data-tour="action-attachment" class="sm:col-span-2 pt-0.5">
                        <span class="text-muted-color block mb-1">Dokumen Lampiran</span>
                        <LeaveAttachment :request="activeRequest" />
                    </div>
                </div>

                <div v-if="activeRequest.reason" class="text-xs">
                    <span class="text-muted-color block mb-1 font-medium">Alasan Permohonan Cuti</span>
                    <p class="text-surface-800 dark:text-surface-200 leading-relaxed bg-surface-100 dark:bg-surface-800/80 p-3 rounded-border">
                        {{ activeRequest.reason }}
                    </p>
                </div>
            </div>

            <div data-tour="action-notes">
                <div class="flex items-center justify-between mb-1">
                    <label for="approval-notes" class="text-xs font-semibold text-surface-800 dark:text-surface-200">
                        Catatan Persetujuan
                    </label>
                    <span class="text-xs text-muted-color">Wajib jika menolak/mengembalikan</span>
                </div>
                <Textarea
                    id="approval-notes"
                    v-model="approvalNotes"
                    rows="2"
                    class="w-full text-xs"
                    placeholder="Tuliskan instruksi atau alasan bila menolak/mengembalikan..."
                    :invalid="Boolean(notesError)"
                    :aria-invalid="notesError ? 'true' : undefined"
                    :aria-describedby="notesError ? 'approval-notes-error' : undefined"
                />
                <p v-if="notesError" id="approval-notes-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ notesError }}</p>
            </div>
        </div>

        <template #footer>
            <!-- 640px cukup untuk satu baris (576px tombol); wrap hanya pengaman agar Setujui tidak terpotong (audit-029 #9). -->
            <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 w-full pt-3 border-t border-surface-100 dark:border-surface-800">
                <div class="flex flex-wrap items-center gap-1.5">
                    <TourHelpButton tour-id="approval.proses" class="!min-h-11 sm:!min-h-9" />
                    <Button
                        label="Batal"
                        severity="secondary"
                        text
                        class="text-xs font-semibold !min-h-11 sm:!min-h-9"
                        @click="close"
                        :disabled="isProcessing"
                    />
                    <Button
                        data-tour="action-return"
                        severity="warn"
                        text
                        class="text-xs font-semibold flex items-center gap-1 !min-h-11 sm:!min-h-9 !text-(--status-warn-fg) hover:!bg-(--status-warn-bg)"
                        :loading="isProcessing"
                        @click="handleAction('return')"
                    >
                        <PhArrowUUpLeft :size="14" weight="bold" aria-hidden="true" />
                        <span>Kembalikan</span>
                    </Button>
                    <Button
                        data-tour="action-reject"
                        severity="danger"
                        text
                        class="text-xs font-semibold flex items-center gap-1 !min-h-11 sm:!min-h-9 !text-(--status-danger-fg) hover:!bg-(--status-danger-bg)"
                        :loading="isProcessing"
                        @click="handleAction('reject')"
                    >
                        <PhX :size="14" weight="bold" aria-hidden="true" />
                        <span>Tolak</span>
                    </Button>
                </div>

                <Button
                    data-tour="action-approve"
                    severity="success"
                    class="w-full sm:w-auto sm:ml-auto shrink-0 justify-center text-xs font-semibold flex items-center gap-1.5 shadow-xs px-4 whitespace-nowrap !min-h-11 sm:!min-h-9"
                    :loading="isProcessing"
                    :disabled="waitingDocument"
                    v-tooltip.top="waitingDocument ? 'Menunggu dokumen pendukung dari pemohon' : null"
                    @click="handleAction('approve')"
                >
                    <PhCheck :size="16" weight="bold" aria-hidden="true" class="shrink-0" />
                    <span>Setujui Permohonan</span>
                </Button>
            </div>
        </template>
    </Dialog>
</template>
