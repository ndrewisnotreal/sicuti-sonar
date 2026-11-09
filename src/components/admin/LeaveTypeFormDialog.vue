<template>
    <Dialog
        :visible="visible"
        modal
        :header="isEditing ? 'Ubah Jenis Cuti' : 'Tambah Jenis Cuti'"
        :breakpoints="{ '960px': '75vw', '640px': '92vw' }"
        :style="{ width: '560px' }"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="space-y-4 pt-2 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label for="lt-code" class="block font-medium mb-1">Kode Unik *</label>
                    <InputText
                        id="lt-code"
                        v-model="form.code"
                        class="w-full text-xs"
                        placeholder="Misal: CT"
                        :invalid="!!errors.code"
                        :aria-invalid="!!errors.code"
                        :aria-describedby="errors.code ? 'lt-code-error' : undefined"
                    />
                    <p v-if="errors.code" id="lt-code-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ errors.code }}</p>
                </div>
                <div>
                    <label id="lt-status-label" class="block font-medium mb-1">Status</label>
                    <Select
                        v-model="form.isActive"
                        ariaLabelledby="lt-status-label"
                        :options="[{ label: 'Aktif', value: true }, { label: 'Nonaktif', value: false }]"
                        optionLabel="label"
                        optionValue="value"
                        class="w-full text-xs"
                    />
                </div>
            </div>
            <div>
                <label for="lt-name" class="block font-medium mb-1">Nama Jenis Cuti *</label>
                <InputText
                    id="lt-name"
                    v-model="form.name"
                    class="w-full text-xs"
                    placeholder="Nama Jenis Cuti"
                    :invalid="!!errors.name"
                    :aria-invalid="!!errors.name"
                    :aria-describedby="errors.name ? 'lt-name-error' : undefined"
                />
                <p v-if="errors.name" id="lt-name-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ errors.name }}</p>
            </div>
            <div>
                <label for="lt-desc" class="block font-medium mb-1">Deskripsi / Keterangan</label>
                <Textarea id="lt-desc" v-model="form.description" rows="2" class="w-full text-xs" placeholder="Keterangan aturan cuti..." />
            </div>
            <div class="space-y-2 pt-2 border-t border-surface-200 dark:border-surface-700">
                <div class="flex items-center gap-2">
                    <Checkbox v-model="form.usesQuota" :binary="true" inputId="usesQuota" />
                    <label for="usesQuota" class="cursor-pointer font-medium">Mengurangi Saldo Cuti Tahunan Karyawan</label>
                </div>
                <div class="flex items-center gap-2">
                    <Checkbox v-model="form.requiresDocument" :binary="true" inputId="requiresDoc" />
                    <label for="requiresDoc" class="cursor-pointer font-medium">Wajib Unggah Dokumen Pendukung (Surat / Bukti)</label>
                </div>
                <div v-if="form.requiresDocument" class="flex items-center gap-2 pl-6">
                    <Checkbox v-model="form.allowLateDocument" :binary="true" inputId="lateDoc" />
                    <label for="lateDoc" class="cursor-pointer">Dokumen boleh menyusul, paling lambat</label>
                    <InputNumber
                        v-model="form.lateDocumentDays"
                        inputId="lateDocDays"
                        :min="1"
                        :max="90"
                        :disabled="!form.allowLateDocument"
                        class="w-16 text-xs"
                        inputClass="w-16 text-xs"
                        aria-label="Batas hari dokumen menyusul"
                    />
                    <span>hari</span>
                </div>
                <div class="flex items-center gap-2">
                    <Checkbox v-model="form.allowBackdate" :binary="true" inputId="allowBackdate" />
                    <label for="allowBackdate" class="cursor-pointer font-medium">Boleh diajukan untuk tanggal yang sudah lewat</label>
                </div>
            </div>
            <div>
                <label for="maxDays" class="block font-medium mb-1">Durasi maksimal per pengajuan (hari kerja)</label>
                <InputNumber v-model="form.maxDays" inputId="maxDays" :min="1" :max="365" placeholder="Kosongkan bila tanpa batas" class="w-full text-xs" fluid />
                <p class="text-xs text-muted-color mt-1">Contoh: Cuti Haid 2 hari, Cuti Menikah 3 hari.</p>
            </div>
        </div>
        <template #footer>
            <div class="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 w-full pt-2">
                <Button label="Batal" severity="secondary" size="small" text :disabled="saving" @click="closeDialog" />
                <Button label="Simpan" severity="primary" size="small" class="font-bold" :loading="saving" :disabled="saving" @click="handleSave" />
            </div>
        </template>
    </Dialog>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { adminService } from '@/service/adminService';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    isEditing: {
        type: Boolean,
        default: false
    },
    typeData: {
        type: Object,
        default: () => ({})
    }
});

const emit = defineEmits(['update:visible', 'saved']);
const toast = useToast();

const form = ref({
    id: '',
    code: '',
    name: '',
    description: '',
    usesQuota: false,
    requiresDocument: false,
    isActive: true,
    maxDays: null,
    allowBackdate: false,
    allowLateDocument: false,
    lateDocumentDays: 3
});

const saving = ref(false);
// Kesalahan validasi ditampilkan di bawah field, bukan hanya toast (audit-012 #2). Syaratnya tetap: kode dan nama wajib.
const errors = ref({ code: '', name: '' });
watch(() => form.value.code, () => (errors.value.code = ''));
watch(() => form.value.name, () => (errors.value.name = ''));

watch(
    () => props.typeData,
    (newVal) => {
        if (newVal) {
            form.value = {
                id: newVal.id || '',
                code: newVal.code || '',
                name: newVal.name || '',
                description: newVal.description || '',
                usesQuota: Boolean(newVal.usesQuota),
                requiresDocument: Boolean(newVal.requiresDocument),
                isActive: newVal.isActive ?? true,
                maxDays: newVal.maxDays !== undefined && newVal.maxDays !== null ? Number(newVal.maxDays) : null,
                allowBackdate: Boolean(newVal.allowBackdate),
                allowLateDocument: Boolean(newVal.allowLateDocument),
                lateDocumentDays: Number(newVal.lateDocumentDays) || 3
            };
            errors.value = { code: '', name: '' };
        }
    },
    { immediate: true, deep: true }
);

function closeDialog() {
    emit('update:visible', false);
}

function toApi(t) {
    return {
        kd_leave_type: t.id || undefined,
        code: (t.code || '').trim(),
        nm_leave_type: (t.name || '').trim(),
        description: t.description?.trim() || undefined,
        uses_quota: t.usesQuota,
        requires_document: t.requiresDocument,
        is_active: t.isActive,
        max_days: t.maxDays ? Number(t.maxDays) : null,
        allow_backdate: t.allowBackdate,
        allow_late_document: t.requiresDocument && t.allowLateDocument,
        late_document_days: Number(t.lateDocumentDays) || 3
    };
}

async function handleSave() {
    errors.value = {
        code: form.value.code?.trim() ? '' : 'Kode jenis cuti wajib diisi.',
        name: form.value.name?.trim() ? '' : 'Nama jenis cuti wajib diisi.'
    };
    if (errors.value.code || errors.value.name) {
        const first = errors.value.code ? 'lt-code' : 'lt-name';
        await nextTick();
        document.getElementById(first)?.focus();
        return;
    }

    saving.value = true;
    try {
        await adminService.upsertLeaveType(toApi(form.value));
        toast.add({
            severity: 'success',
            summary: props.isEditing ? 'Diperbarui' : 'Ditambahkan',
            detail: `Jenis cuti ${form.value.name} berhasil ${props.isEditing ? 'diperbarui' : 'ditambahkan'}`,
            life: 3000
        });
        emit('saved');
        closeDialog();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Jenis cuti gagal disimpan', detail: err.message, life: 4000 });
    } finally {
        saving.value = false;
    }
}
</script>
