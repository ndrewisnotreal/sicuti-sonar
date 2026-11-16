<script setup>
import { ref, computed, watch } from 'vue';
import { leaveService } from '@/service/leaveService';
import { currentUser, isSubstituteRequired, lastReturnNote, syncFromBackend } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { countWorkingDays, latestEndDate } from '@/utils/workingDays';
import LeaveAttachmentUpload from '@/components/leave/LeaveAttachmentUpload.vue';
import LeaveFormValidationAlert from '@/components/leave/LeaveFormValidationAlert.vue';
import LeaveFormDurationInfo from '@/components/leave/LeaveFormDurationInfo.vue';
import TourHelpButton from '@/components/common/TourHelpButton.vue';
import { validateLeaveForm, validateDraftForm } from '@/utils/leaveFormValidation';
import {
    PhPaperPlaneRight,
    PhFloppyDisk
} from '@phosphor-icons/vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    editId: {
        type: String,
        default: null
    },
    editingLeave: {
        type: [Object, String],
        default: null
    }
});

const emit = defineEmits(['update:visible', 'saved']);
const toast = useToast();
const substituteRequired = computed(() => isSubstituteRequired());

const editingId = computed(() => {
    if (props.editingLeave) {
        if (typeof props.editingLeave === 'string') return props.editingLeave;
        return props.editingLeave.id || props.editingLeave.id_request || null;
    }
    return props.editId || null;
});

const isEditMode = computed(() => Boolean(editingId.value));
const isDraftEdit = computed(() => isEditMode.value && typeof props.editingLeave === 'object' && props.editingLeave?.status === 'draft');
const canSaveDraft = computed(() => !isEditMode.value || isDraftEdit.value);
const isSavingDraft = ref(false);
const returnNote = ref(null);

const isSubmitting = ref(false);
const loadingInit = ref(false);
const validationAlert = ref(null);
const leaveTypes = ref([]);
const holidays = ref([]);
const balances = ref([]);
const colleagues = ref([]);

const form = ref({
    leaveTypeId: '',
    startDate: null,
    endDate: null,
    reason: '',
    substituteId: '',
    documentFile: null,
    documentName: '',
    documentSize: 0,
    existingAttachmentUrl: ''
});

function parseToDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'string') {
        const clean = val.split('T')[0];
        const parts = clean.split('-');
        if (parts.length === 3) {
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        }
        return new Date(val);
    }
    return null;
}

function formatDate(d) {
    if (!d) return '';
    if (typeof d === 'string') {
        return d.split('T')[0];
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const currentYear = computed(() => {
    return form.value.startDate ? new Date(form.value.startDate).getFullYear() : new Date().getFullYear();
});

const remainingBalance = computed(() => {
    if (!balances.value.length) return 0;
    const found = balances.value.find((b) => Number(b.year) === currentYear.value) || balances.value[0];
    return Number(found.remaining ?? (Number(found.annual_quota || 0) + Number(found.carry_over_days || 0) - Number(found.used_days || 0)));
});

const activeLeaveTypes = computed(() => {
    return leaveTypes.value.map((t) => ({
        id: t.kd_leave_type || t.id || t.code,
        name: t.nm_leave_type || t.name,
        usesQuota: t.uses_quota ?? t.usesQuota ?? true,
        requiresDocument: t.requires_attachment ?? t.requires_document ?? t.requiresDocument ?? false,
        maxDays: Number(t.max_days ?? t.maxDays) || null,
        allowBackdate: Boolean(t.allow_backdate ?? t.allowBackdate),
        allowLateDocument: Boolean(t.allow_late_document ?? t.allowLateDocument),
        lateDocumentDays: Number(t.late_document_days ?? t.lateDocumentDays) || 3,
        description: t.description || ''
    }));
});

const selectedLeaveType = computed(() => {
    return activeLeaveTypes.value.find((t) => t.id === form.value.leaveTypeId);
});

const colleagueOptions = computed(() => {
    const curUid = currentUser.value?.uid_user_system || currentUser.value?.id;
    return colleagues.value
        .filter((u) => {
            const uid = u.uid_user_system || u.id;
            return uid !== curUid && u.status_user !== 'N';
        })
        .map((u) => ({
            label: `${u.nama || u.name} (${u.nm_dept || u.kd_dept || u.department || 'Divisi'})`,
            value: u.uid_user_system || u.id
        }));
});

const minEndDate = computed(() => parseToDate(form.value.startDate));

const holidayDateSet = computed(() => {
    const set = new Set();
    holidays.value.forEach((h) => {
        const start = String(h.holiday_date || h.date || '').split('T')[0];
        if (!start) return;
        const end = String(h.end_date || h.endDate || start).split('T')[0];
        const cur = new Date(`${start}T00:00:00Z`);
        const fin = new Date(`${end}T00:00:00Z`);
        while (cur <= fin) {
            set.add(cur.toISOString().slice(0, 10));
            cur.setUTCDate(cur.getUTCDate() + 1);
        }
    });
    return set;
});

const maxEndDate = computed(() => {
    return latestEndDate(form.value.startDate, selectedLeaveType.value?.maxDays, holidayDateSet.value);
});

const calculatedDays = computed(() => {
    return countWorkingDays(form.value.startDate, form.value.endDate, holidayDateSet.value);
});

const estimatedRemaining = computed(() => {
    if (!selectedLeaveType.value?.usesQuota) return remainingBalance.value;
    return remainingBalance.value - (calculatedDays.value || 0);
});

watch(
    () => form.value.startDate,
    (newStart) => {
        validationAlert.value = null;
        const sDate = parseToDate(newStart);
        const eDate = parseToDate(form.value.endDate);
        if (sDate && eDate && eDate < sDate) {
            form.value.endDate = newStart;
        }
    }
);

watch(
    () => form.value.endDate,
    () => {
        validationAlert.value = null;
    }
);

watch(maxEndDate, (max) => {
    const eDate = parseToDate(form.value.endDate);
    if (max && eDate && eDate > max) {
        form.value.endDate = max;
    }
});

watch(selectedLeaveType, (newType, oldType) => {
    validationAlert.value = null;
    if (oldType && !newType?.requiresDocument && !form.value.existingAttachmentUrl) {
        removeFile();
    }
});

function populateFormFromData(detail) {
    if (!detail) return;
    returnNote.value = lastReturnNote(detail) || returnNote.value;
    form.value.leaveTypeId = detail.kd_leave_type || detail.leaveTypeId || detail.id_leave_type || '';
    form.value.startDate = parseToDate(detail.start_date || detail.startDate);
    form.value.endDate = parseToDate(detail.end_date || detail.endDate);
    form.value.reason = detail.reason || '';
    form.value.substituteId = detail.substitute_id || detail.substituteId || '';
    form.value.documentFile = null;
    form.value.documentName = detail.attachment_name || (detail.attachment_url ? detail.attachment_url.split('/').pop() : '');
    form.value.documentSize = 0;
    form.value.existingAttachmentUrl = detail.attachment_url || '';
}

function defaultLeaveTypeId() {
    const annual = leaveTypes.value.find((t) => (t.code || '').toUpperCase() === 'CT') || leaveTypes.value[0];
    return annual ? annual.kd_leave_type || annual.id || annual.code : '';
}

function resetForm() {
    returnNote.value = null;
    form.value = {
        leaveTypeId: defaultLeaveTypeId(),
        startDate: null,
        endDate: null,
        reason: '',
        substituteId: '',
        documentFile: null,
        documentName: '',
        documentSize: 0,
        existingAttachmentUrl: ''
    };
    validationAlert.value = null;
}

async function loadInitialData() {
    loadingInit.value = true;
    try {
        const currentY = new Date().getFullYear();
        const [types, bals, hols, users] = await Promise.all([
            leaveService.getLeaveTypes(false).catch(() => []),
            leaveService.getBalances({ year: currentY }).catch(() => []),
            leaveService.getHolidays(currentY).catch(() => []),
            leaveService.getColleagues().catch(() => [])
        ]);

        leaveTypes.value = Array.isArray(types) ? types : [];
        balances.value = Array.isArray(bals) ? bals : (bals ? [bals] : []);
        holidays.value = Array.isArray(hols) ? hols : [];
        colleagues.value = Array.isArray(users) ? users : [];

        if (isEditMode.value) {
            if (props.editingLeave && typeof props.editingLeave === 'object') {
                populateFormFromData(props.editingLeave);
            }
            if (editingId.value) {
                const detail = await leaveService.getLeaveDetail(editingId.value).catch(() => null);
                if (detail) {
                    populateFormFromData(detail);
                }
            }
        } else {
            if (leaveTypes.value.length > 0 && !form.value.leaveTypeId) {
                form.value.leaveTypeId = defaultLeaveTypeId();
            }
        }
    } catch (err) {
        console.error('Error loading leave form dependencies:', err);
    } finally {
        loadingInit.value = false;
    }
}

watch(
    () => [props.visible, props.editingLeave, props.editId],
    ([visible]) => {
        if (visible) {
            resetForm();
            if (props.editingLeave && typeof props.editingLeave === 'object') {
                populateFormFromData(props.editingLeave);
            }
            loadInitialData();
        }
    },
    { immediate: true }
);

const attachmentModel = computed({
    get: () =>
        form.value.documentName
            ? {
                  file: form.value.documentFile,
                  name: form.value.documentName,
                  size: form.value.documentSize
              }
            : null,
    set: (val) => {
        if (!val) {
            removeFile();
        } else {
            form.value.documentFile = val.file;
            form.value.documentName = val.name;
            form.value.documentSize = val.size;
        }
    }
});

function removeFile() {
    form.value.documentFile = null;
    form.value.documentName = '';
    form.value.documentSize = 0;
    form.value.existingAttachmentUrl = '';
}

function validateForm() {
    const result = validateLeaveForm({
        form: form.value,
        selectedLeaveType: selectedLeaveType.value,
        calculatedDays: calculatedDays.value,
        remainingBalance: remainingBalance.value,
        substituteRequired: substituteRequired.value,
        formatDate
    });

    if (!result.valid) {
        toast.add(result.error);
        return false;
    }
    return true;
}

async function buildPayload() {
    let finalAttachmentUrl = form.value.existingAttachmentUrl || undefined;
    if (form.value.documentFile) {
        try {
            const uploadRes = await leaveService.uploadDocument(form.value.documentFile);
            finalAttachmentUrl = uploadRes?.url || uploadRes?.file_path || uploadRes?.data?.url || form.value.documentName;
        } catch (upErr) {
            const upMsg = upErr?.data?.message || upErr?.message || 'Gagal mengunggah berkas ke server';
            throw new Error(`Upload dokumen gagal: ${upMsg}`);
        }
    }
    return {
        kd_leave_type: form.value.leaveTypeId,
        start_date: formatDate(form.value.startDate),
        end_date: formatDate(form.value.endDate),
        total_days: calculatedDays.value,
        reason: form.value.reason.trim(),
        substitute_id: form.value.substituteId || undefined,
        attachment_url: finalAttachmentUrl,
        attachment_name: form.value.documentName || undefined
    };
}

async function saveDraft() {
    if (isSavingDraft.value || isSubmitting.value) return;
    validationAlert.value = null;
    const result = validateDraftForm({
        form: form.value,
        calculatedDays: calculatedDays.value,
        formatDate
    });
    if (!result.valid) {
        toast.add(result.error);
        return;
    }
    isSavingDraft.value = true;
    try {
        const payload = { ...(await buildPayload()), is_draft: true };
        const res = isDraftEdit.value ? await leaveService.resubmitLeave(editingId.value, payload) : await leaveService.createLeave(payload);
        toast.add({
            severity: 'success',
            summary: 'Draf Disimpan',
            detail: 'Draf belum dikirim ke atasan. Buka tab Draf di Pengajuan Cuti untuk melanjutkan.',
            life: 4000
        });
        void syncFromBackend({ fresh: true });
        emit('saved', res);
        closeDialog();
    } catch (err) {
        const rawMsg = err?.data?.message || err?.message || 'Draf gagal disimpan';
        toast.add({ severity: 'error', summary: 'Draf Gagal Disimpan', detail: Array.isArray(rawMsg) ? rawMsg.join(', ') : String(rawMsg), life: 5000 });
    } finally {
        isSavingDraft.value = false;
    }
}

async function submitLeave() {
    if (isSubmitting.value || isSavingDraft.value) return;
    validationAlert.value = null;
    if (!validateForm()) return;

    isSubmitting.value = true;
    try {
        const payload = await buildPayload();
        const finalAttachmentUrl = payload.attachment_url;

        let res;
        const targetId = editingId.value;
        if (isDraftEdit.value) {
            res = await leaveService.resubmitLeave(targetId, payload);
            toast.add({
                severity: 'success',
                summary: 'Pengajuan Terkirim',
                detail: `Draf #${targetId} berhasil dikirim ke atasan untuk ditinjau.`,
                life: 4000
            });
        } else if (isEditMode.value && targetId) {
            res = await leaveService.resubmitLeave(targetId, payload);
            toast.add({
                severity: 'success',
                summary: 'Pengajuan Berhasil Diajukan Ulang',
                detail: `Pengajuan cuti #${targetId} berhasil diperbaiki dan diajukan ulang ke atasan.`,
                life: 4000
            });
        } else {
            res = await leaveService.createLeave(payload);
            toast.add({
                severity: 'success',
                summary: 'Pengajuan Terkirim',
                detail: finalAttachmentUrl
                    ? 'Pengajuan cuti dan dokumen pendukung berhasil dikirimkan ke atasan untuk ditinjau.'
                    : 'Pengajuan cuti berhasil dikirimkan ke atasan untuk ditinjau.',
                life: 4000
            });
        }

        void syncFromBackend({ fresh: true });
        emit('saved', res);
        closeDialog();
    } catch (err) {
        const status = err?.status || err?.statusCode || (err?.response && err.response.status);
        const rawMsg = err?.data?.message || err?.message || 'Terjadi kesalahan sistem saat mengajukan cuti';
        const errorDetail = Array.isArray(rawMsg) ? rawMsg.join(', ') : String(rawMsg);
        const lower = errorDetail.toLowerCase();

        const isOverlap = status === 409 || lower.includes('bentrok') || lower.includes('overlap') || lower.includes('bertabrakan') || lower.includes('konflik');
        const isBackdate = (status === 400 || status === 422) && (lower.includes('lampau') || lower.includes('backdate') || lower.includes('masa lalu') || lower.includes('minimal hari ini'));

        if (isOverlap) {
            validationAlert.value = {
                severity: 'error',
                title: 'Bentrok Jadwal Cuti (Overlap)',
                message: errorDetail || 'Rentang tanggal cuti yang Anda pilih bertabrakan dengan jadwal pengajuan cuti aktif lainnya. Silakan tentukan rentang tanggal berbeda.'
            };
        } else if (isBackdate) {
            validationAlert.value = {
                severity: 'warn',
                title: 'Tanggal Lampau (Backdate) Tidak Diizinkan',
                message: errorDetail || 'Jenis cuti ini tidak boleh bertanggal lampau. Harap sesuaikan tanggal pengajuan Anda.'
            };
        } else {
            toast.add({
                severity: 'error',
                summary: isEditMode.value ? 'Gagal Mengajukan Ulang' : 'Pengajuan Gagal',
                detail: errorDetail,
                life: 5000
            });
        }
    } finally {
        isSubmitting.value = false;
    }
}

function closeDialog() {
    emit('update:visible', false);
    resetForm();
}
</script>

<template>
    <Dialog
        :visible="visible"
        @update:visible="emit('update:visible', $event)"
        modal
        :header="isDraftEdit ? `Ubah Draf #${editingId || ''}` : isEditMode ? `Ajukan Ulang / Perbaiki Cuti #${editingId || ''}` : 'Formulir Pengajuan Cuti'"
        :breakpoints="{ '960px': '80vw', '640px': '95vw' }"
        :style="{ width: '680px' }"
        :closable="true"
        dismissableMask
    >
        <div class="space-y-4 pt-1 pb-16 sm:pb-4 overflow-y-auto max-h-[calc(85vh-8rem)]">
            <LeaveFormValidationAlert
                :return-note="isEditMode ? returnNote : null"
                :validation-alert="validationAlert"
                @dismiss="validationAlert = null"
            />

            <div data-tour="form-type">
                <div class="flex items-center justify-between mb-1.5">
                    <label class="text-sm font-medium text-surface-700 dark:text-surface-200">
                        Jenis Cuti <span class="text-red-500">*</span>
                    </label>
                    <span class="text-xs text-muted-color">
                        Saldo Tersedia: <strong class="text-surface-900 dark:text-surface-100 font-semibold">{{ remainingBalance }} hari</strong>
                    </span>
                </div>
                <Select
                    v-model="form.leaveTypeId"
                    :options="activeLeaveTypes"
                    optionLabel="name"
                    optionValue="id"
                    placeholder="Pilih Jenis Cuti"
                    class="w-full"
                />
                <div v-if="selectedLeaveType?.description" class="text-xs text-muted-color mt-1.5">
                    {{ selectedLeaveType.description }}
                    <span v-if="!selectedLeaveType.usesQuota" class="text-emerald-600 dark:text-emerald-400 font-medium ml-1">(Bebas pemotongan kuota tahunan)</span>
                </div>
                <ul v-if="selectedLeaveType && (selectedLeaveType.maxDays || selectedLeaveType.allowBackdate)" class="text-[11px] text-muted-color mt-1 flex flex-wrap gap-x-4">
                    <li v-if="selectedLeaveType.maxDays">Maksimal {{ selectedLeaveType.maxDays }} hari kerja per pengajuan</li>
                    <li v-if="selectedLeaveType.allowBackdate">Boleh untuk tanggal yang sudah lewat</li>
                </ul>
            </div>

            <div data-tour="form-dates">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
                    <div>
                        <label class="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
                            Tanggal Mulai <span class="text-red-500">*</span>
                        </label>
                        <DatePicker
                            v-model="form.startDate"
                            dateFormat="dd M yy"
                            placeholder="Pilih Tanggal Mulai"
                            class="w-full"
                            showIcon
                        />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
                            Tanggal Selesai <span class="text-red-500">*</span>
                        </label>
                        <DatePicker
                            v-model="form.endDate"
                            :minDate="minEndDate"
                            :maxDate="maxEndDate"
                            :disabled="!selectedLeaveType || !form.startDate"
                            dateFormat="dd M yy"
                            placeholder="Pilih Tanggal Selesai"
                            class="w-full"
                            showIcon
                        />
                    </div>
                </div>

                <LeaveFormDurationInfo
                    :calculated-days="calculatedDays"
                    :uses-quota="selectedLeaveType?.usesQuota"
                    :estimated-remaining="estimatedRemaining"
                />
            </div>

            <div data-tour="form-substitute">
                <label class="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
                    Pengganti tugas
                    <span v-if="substituteRequired" class="text-red-500">*</span>
                    <span v-else class="text-xs font-normal text-muted-color">(opsional)</span>
                </label>
                <Select
                    v-model="form.substituteId"
                    :options="colleagueOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Pilih rekan pengganti"
                    filter
                    :showClear="!substituteRequired"
                    class="w-full"
                />
            </div>

            <div data-tour="form-reason">
                <label class="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
                    Alasan Pengajuan Cuti <span class="text-red-500">*</span>
                </label>
                <Textarea
                    v-model="form.reason"
                    rows="3"
                    class="w-full"
                    placeholder="Tuliskan alasan / keperluan permohonan cuti..."
                />
            </div>

            <div v-if="selectedLeaveType?.requiresDocument || form.documentName" data-tour="form-attachment">
                <p v-if="selectedLeaveType?.requiresDocument && selectedLeaveType.allowLateDocument && !form.documentName" class="text-[11px] text-muted-color mb-1.5">
                    Belum punya dokumennya? Kirim dulu pengajuannya, lalu lengkapi dokumen dari halaman Pengajuan Cuti paling lambat
                    {{ selectedLeaveType.lateDocumentDays }} hari setelah pengajuan dikirim. Pengajuan baru bisa disetujui setelah dokumen diunggah.
                </p>
                <div class="flex items-center justify-between mb-1.5">
                    <label class="text-sm font-medium text-surface-700 dark:text-surface-200">
                        Dokumen Pendukung Fisik
                        <span v-if="selectedLeaveType?.requiresDocument" class="text-red-500">*</span>
                    </label>
                    <span v-if="selectedLeaveType?.requiresDocument && selectedLeaveType.allowLateDocument" class="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        Wajib, boleh menyusul maks. {{ selectedLeaveType.lateDocumentDays }} hari
                    </span>
                    <span v-else-if="selectedLeaveType?.requiresDocument" class="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                        Wajib untuk {{ selectedLeaveType.name }}
                    </span>
                    <span v-else class="text-[11px] text-muted-color">Opsional</span>
                </div>

                <LeaveAttachmentUpload
                    v-model="attachmentModel"
                    :existing-url="form.existingAttachmentUrl"
                    :disabled="isSubmitting || isSavingDraft"
                    @remove="removeFile"
                />
            </div>
        </div>

        <template #footer>
            <div class="flex items-center justify-between gap-2 w-full pt-3.5 border-t border-surface-100 dark:border-surface-800">
                <div class="flex items-center gap-1">
                    <TourHelpButton tour-id="karyawan.formulir" />
                    <Button
                        label="Batal"
                        severity="secondary"
                        text
                        size="small"
                        class="text-xs font-semibold"
                        @click="closeDialog"
                    />
                </div>
                <div data-tour="form-actions" class="flex items-center gap-2">
                    <Button
                        v-if="canSaveDraft"
                        severity="secondary"
                        outlined
                        size="small"
                        class="text-xs flex items-center gap-1.5 font-semibold"
                        :loading="isSavingDraft"
                        :disabled="isSubmitting"
                        @click="saveDraft"
                    >
                        <PhFloppyDisk :size="14" weight="bold" aria-hidden="true" />
                        <span>Simpan Draf</span>
                    </Button>
                    <Button
                        severity="primary"
                        size="small"
                        class="text-xs flex items-center gap-1.5 font-semibold shadow-xs"
                        :loading="isSubmitting"
                        :disabled="isSavingDraft"
                        @click="submitLeave"
                    >
                        <PhPaperPlaneRight :size="14" weight="bold" aria-hidden="true" />
                        <span>{{ isEditMode && !isDraftEdit ? 'Ajukan Ulang' : 'Kirim Pengajuan' }}</span>
                    </Button>
                </div>
            </div>
        </template>
    </Dialog>
</template>
