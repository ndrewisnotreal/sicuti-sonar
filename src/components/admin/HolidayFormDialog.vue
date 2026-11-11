<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { adminService } from '@/service/adminService';
import { syncFromBackend, CURRENT_YEAR } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    isEditing: {
        type: Boolean,
        default: false
    },
    holidayData: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['update:visible', 'saved']);
const toast = useToast();
const saving = ref(false);
// Kesalahan validasi tampil di bawah field (audit-014 #2). Syaratnya tetap: tanggal dan nama wajib, akhir tidak sebelum mulai.
const errors = ref({ date: '', endDate: '', name: '' });

const currentHoliday = ref({
    id: '',
    date: '',
    endDate: '',
    name: '',
    year: CURRENT_YEAR,
    type: 'national'
});

const HOLIDAY_TYPES = [
    { value: 'national', label: 'Libur Nasional', hint: 'Tanggal merah resmi yang ditetapkan pemerintah.' },
    { value: 'collective', label: 'Cuti Bersama', hint: 'Hari cuti bersama yang ditetapkan pemerintah atau perusahaan.' }
];

const toIso = (value) => {
    if (!value) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

const fromIso = (iso) => {
    const p = String(iso || '').split('-').map(Number);
    return p.length === 3 && p.every(Boolean) ? new Date(p[0], p[1] - 1, p[2]) : null;
};

const holidayDate = computed({
    get: () => fromIso(currentHoliday.value.date),
    set(value) {
        currentHoliday.value.date = toIso(value);
        if (value) currentHoliday.value.year = value.getFullYear();
    }
});

const holidayEndDate = computed({
    get: () => fromIso(currentHoliday.value.endDate),
    set: (value) => (currentHoliday.value.endDate = toIso(value))
});

watch(
    () => props.visible,
    (isOpen) => {
        if (!isOpen) return;
        errors.value = { date: '', endDate: '', name: '' };
        if (props.isEditing && props.holidayData) {
            currentHoliday.value = { ...props.holidayData };
        } else {
            currentHoliday.value = {
                id: '',
                date: '',
                endDate: '',
                name: '',
                year: CURRENT_YEAR,
                type: 'national'
            };
        }
    }
);

async function saveHoliday() {
    const h = currentHoliday.value;
    errors.value = {
        date: h.date ? '' : 'Tanggal mulai wajib diisi.',
        endDate: h.date && h.endDate && h.endDate < h.date ? 'Tanggal akhir tidak boleh sebelum tanggal mulai.' : '',
        name: h.name?.trim() ? '' : 'Nama hari libur wajib diisi.'
    };
    const first = errors.value.date ? 'holiday-start' : errors.value.endDate ? 'holiday-end' : errors.value.name ? 'holiday-name' : '';
    if (first) {
        await nextTick();
        document.getElementById(first)?.focus();
        return;
    }

    saving.value = true;
    try {
        await adminService.createHoliday({
            id_holiday: props.isEditing ? h.id : undefined,
            holiday_date: h.date,
            end_date: h.endDate || undefined,
            nm_holiday: h.name.trim(),
            type: h.type
        });
        await syncFromBackend();
        toast.add({
            severity: 'success',
            summary: props.isEditing ? 'Diperbarui' : 'Ditambahkan',
            detail: `Hari libur ${h.name} berhasil ${props.isEditing ? 'diperbarui' : 'ditambahkan'}`,
            life: 3000
        });
        emit('update:visible', false);
        emit('saved');
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Hari libur gagal disimpan', detail: err.message, life: 4000 });
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <Dialog
        :visible="visible"
        modal
        :header="isEditing ? 'Ubah Hari Libur' : 'Tambah Hari Libur Baru'"
        :style="{ width: '500px' }"
        :breakpoints="{ '640px': '92vw' }"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="space-y-5 pt-1 text-sm">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label for="holiday-start" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Mulai tanggal <span class="text-(--status-danger-fg)" aria-hidden="true">*</span></label>
                    <DatePicker
                        v-model="holidayDate"
                        inputId="holiday-start"
                        dateFormat="dd M yy"
                        showIcon
                        iconDisplay="input"
                        placeholder="Pilih tanggal"
                        fluid
                        :invalid="!!errors.date"
                        :aria-invalid="!!errors.date"
                        :aria-describedby="errors.date ? 'holiday-start-error' : undefined"
                        @update:modelValue="errors.date = ''"
                    />
                    <p v-if="errors.date" id="holiday-start-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ errors.date }}</p>
                </div>
                <div>
                    <label for="holiday-end" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Sampai tanggal</label>
                    <DatePicker
                        v-model="holidayEndDate"
                        inputId="holiday-end"
                        dateFormat="dd M yy"
                        showIcon
                        showClear
                        iconDisplay="input"
                        placeholder="Satu hari"
                        :minDate="holidayDate || undefined"
                        fluid
                        :invalid="!!errors.endDate"
                        :aria-invalid="!!errors.endDate"
                        :aria-describedby="errors.endDate ? 'holiday-end-error' : undefined"
                        @update:modelValue="errors.endDate = ''"
                    />
                    <p v-if="errors.endDate" id="holiday-end-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ errors.endDate }}</p>
                </div>
            </div>
            <div>
                <label for="holiday-name" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Nama hari libur <span class="text-(--status-danger-fg)" aria-hidden="true">*</span></label>
                <InputText
                    id="holiday-name"
                    v-model="currentHoliday.name"
                    class="w-full"
                    placeholder="Contoh: Tahun Baru Masehi"
                    :invalid="!!errors.name"
                    :aria-invalid="!!errors.name"
                    :aria-describedby="errors.name ? 'holiday-name-error' : undefined"
                    @update:modelValue="errors.name = ''"
                />
                <p v-if="errors.name" id="holiday-name-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ errors.name }}</p>
            </div>
            <fieldset>
                <legend class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Kategori</legend>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label
                        v-for="t in HOLIDAY_TYPES"
                        :key="t.value"
                        class="relative flex cursor-pointer gap-2.5 rounded-border border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary"
                        :class="
                            currentHoliday.type === t.value
                                ? 'border-primary bg-primary-50 dark:bg-primary-950/40 ring-1 ring-inset ring-primary'
                                : 'border-surface-200 hover:border-surface-300 dark:border-surface-700 dark:hover:border-surface-600'
                        "
                    >
                        <input v-model="currentHoliday.type" type="radio" name="holiday-type" :value="t.value" class="sr-only" />
                        <span>
                            <span class="block font-semibold text-surface-900 dark:text-surface-100">{{ t.label }}</span>
                            <span class="block text-xs text-muted-color mt-0.5">{{ t.hint }}</span>
                        </span>
                    </label>
                </div>
            </fieldset>
        </div>
        <template #footer>
            <div class="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 w-full pt-2">
                <Button label="Batal" severity="secondary" size="small" text @click="emit('update:visible', false)" />
                <Button
                    :label="isEditing ? 'Simpan Perubahan' : 'Tambah Hari Libur'"
                    severity="primary"
                    size="small"
                    class="font-semibold"
                    :loading="saving"
                    @click="saveHoliday"
                />
            </div>
        </template>
    </Dialog>
</template>
