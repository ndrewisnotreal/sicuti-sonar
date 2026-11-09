<template>
    <Dialog
        :visible="visible"
        modal
        header="Tambah Anggota Templat"
        :style="{ width: '520px' }"
        :breakpoints="{ '640px': '92vw' }"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="space-y-2 pt-2 text-xs">
            <label for="member-select" class="block font-medium mb-1">Karyawan *</label>
            <MultiSelect
                v-model="selectedCandidateUids"
                inputId="member-select"
                :options="candidateOptions"
                optionLabel="label"
                optionValue="value"
                optionDisabled="disabled"
                filter
                display="chip"
                :maxSelectedLabels="4"
                placeholder="Pilih karyawan"
                emptyMessage="Tidak ada karyawan yang bisa ditambahkan"
                emptyFilterMessage="Tidak ada karyawan yang cocok"
                class="w-full text-xs"
                :invalid="!!errors.members"
                :aria-describedby="errors.members ? 'member-select-error' : undefined"
                @update:modelValue="errors.members = ''"
            />
            <p v-if="errors.members" id="member-select-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ errors.members }}</p>
            <p class="text-xs text-muted-color">
                Hanya karyawan dari departemen templat yang bisa dipilih. Satu karyawan hanya di satu templat: yang sudah ada di templat lain tidak bisa dipilih, keluarkan dulu dari templat itu. Approver sebaiknya tidak dimasukkan.
            </p>
        </div>
        <template #footer>
            <div class="flex justify-end gap-2 pt-2">
                <Button label="Batal" severity="secondary" size="small" text :disabled="saving" @click="closeDialog" />
                <Button
                    label="Simpan Anggota"
                    severity="primary"
                    size="small"
                    class="font-bold"
                    :loading="saving"
                    :disabled="saving"
                    @click="handleSave"
                />
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
    template: {
        type: Object,
        default: null
    },
    candidateOptions: {
        type: Array,
        default: () => []
    }
});

const emit = defineEmits(['update:visible', 'saved']);
const toast = useToast();

const selectedCandidateUids = ref([]);
const saving = ref(false);
const errors = ref({ members: '' });

watch(
    () => props.visible,
    (isOpen) => {
        if (isOpen) {
            selectedCandidateUids.value = [];
            errors.value = { members: '' };
        }
    }
);

function closeDialog() {
    emit('update:visible', false);
}

async function handleSave() {
    if (!props.template?.id_template) return;
    if (!selectedCandidateUids.value.length) {
        errors.value.members = 'Pilih minimal satu karyawan.';
        await nextTick();
        document.getElementById('member-select')?.focus();
        return;
    }

    saving.value = true;
    try {
        const count = selectedCandidateUids.value.length;
        const data = await adminService.addTemplateMembers(props.template.id_template, selectedCandidateUids.value);
        toast.add({
            severity: 'success',
            summary: 'Anggota disimpan',
            detail: `${count} karyawan dimasukkan ke ${props.template.nm_template || 'templat'}`,
            life: 3000
        });
        emit('saved', data);
        closeDialog();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: err.message || 'Gagal menyimpan anggota', life: 3000 });
    } finally {
        saving.value = false;
    }
}
</script>
