<template>
    <Dialog
        :visible="visible"
        modal
        header="Nonaktifkan akun?"
        :style="{ width: '440px' }"
        :breakpoints="{ '640px': '92vw' }"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="space-y-4 pt-1 text-sm">
            <p class="text-surface-700 dark:text-surface-300">
                {{ user?.nama || user?.username }} tidak bisa login sampai akunnya diaktifkan lagi. Alasannya tercatat di riwayat status dan Audit Trail.
            </p>
            <!-- Label terhubung, kesalahan di bawah field dan fokus ke field (audit-024 #3, #4). -->
            <div>
                <label for="deact-reason" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                    Alasan nonaktif <span class="text-(--status-danger-fg)" aria-hidden="true">*</span>
                </label>
                <Select
                    inputId="deact-reason"
                    v-model="reason"
                    :options="STATUS_REASON_OPTIONS"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Pilih alasan"
                    class="w-full"
                    :invalid="Boolean(error)"
                    :aria-describedby="error ? 'deact-error' : undefined"
                />
            </div>
            <div>
                <label for="deact-note" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                    Keterangan<span v-if="reason === 'LAINNYA'" class="text-(--status-danger-fg)" aria-hidden="true"> *</span>
                </label>
                <InputText id="deact-note" v-model="note" class="w-full" placeholder="Mis. kontrak berakhir 30 Sep 2026" :aria-describedby="error ? 'deact-error' : undefined" />
            </div>
            <p v-if="error" id="deact-error" role="alert" class="text-xs text-(--status-danger-fg)">{{ error }}</p>
        </div>
        <template #footer>
            <div class="flex justify-end gap-2 pt-2">
                <Button label="Batal" severity="secondary" size="small" text :disabled="saving" @click="closeDialog" />
                <Button
                    label="Nonaktifkan"
                    severity="danger"
                    size="small"
                    :loading="saving"
                    :disabled="saving"
                    @click="handleConfirm"
                />
            </div>
        </template>
    </Dialog>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { adminService } from '@/service/adminService';
import { STATUS_REASON_OPTIONS, statusFormProblem } from '@/service/statusReason';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    user: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['update:visible', 'saved']);
const toast = useToast();

const reason = ref(null);
const note = ref('');
const error = ref('');
const saving = ref(false);

watch(
    () => props.visible,
    (isOpen) => {
        if (isOpen) {
            reason.value = null;
            note.value = '';
            error.value = '';
            saving.value = false;
        }
    }
);

watch(
    [reason, note],
    () => {
        error.value = '';
    }
);

function closeDialog() {
    emit('update:visible', false);
}

async function handleConfirm() {
    if (!props.user?.uid_user_system) return;

    error.value = statusFormProblem({ reason: reason.value, note: note.value }) || '';
    if (error.value) {
        await nextTick();
        document.getElementById(reason.value ? 'deact-note' : 'deact-reason')?.focus();
        return;
    }

    saving.value = true;
    try {
        await adminService.updateUser({
            uid_user_system: props.user.uid_user_system,
            status: 'N',
            status_reason: reason.value,
            status_note: note.value.trim() || undefined
        });
        toast.add({
            severity: 'info',
            summary: 'Status Diubah',
            detail: `Akun ${props.user.nama || props.user.username} dinonaktifkan`,
            life: 3000
        });
        emit('saved');
        closeDialog();
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Gagal',
            detail: err.message || 'Gagal mengubah status akun',
            life: 4000
        });
    } finally {
        saving.value = false;
    }
}
</script>
