<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { adminService } from '@/service/adminService';
import { isSuperAdmin, can, syncFromBackend } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { PhScroll, PhFloppyDisk } from '@phosphor-icons/vue';
import ReadOnlyNotice from '@/components/common/ReadOnlyNotice.vue';

const toast = useToast();
const loading = ref(false);
const saving = ref(false);
const loadError = ref(false);
const saved = ref(null);
const form = ref({ annual_quota: null, max_carry_over: null, carry_over_expiry_months: null, description: '' });

const canManage = computed(() => isSuperAdmin() || can('master_data.manage_policy'));
const isDirty = computed(() => saved.value !== null && JSON.stringify(form.value) !== JSON.stringify(saved.value));

const NUMERIC_FIELDS = [
    { key: 'annual_quota', id: 'policy-quota', label: 'Kuota tahunan', unit: 'hari', min: 1, max: 365 },
    { key: 'max_carry_over', id: 'policy-carry', label: 'Maks carry over', unit: 'hari', min: 0, max: 365 },
    { key: 'carry_over_expiry_months', id: 'policy-expiry', label: 'Masa berlaku carry over', unit: 'bulan', min: 0, max: 24 }
];
// Pesan tampil di bawah field setelah Simpan ditekan; hilang begitu field diubah.
const errors = ref({});
NUMERIC_FIELDS.forEach((f) => watch(() => form.value[f.key], () => delete errors.value[f.key]));

function validate() {
    errors.value = {};
    for (const f of NUMERIC_FIELDS) {
        const v = form.value[f.key];
        if (v === null || v === undefined || v === '') errors.value[f.key] = `${f.label} wajib diisi.`;
        else if (v < f.min || v > f.max) errors.value[f.key] = `${f.label} harus antara ${f.min} dan ${f.max} ${f.unit}.`;
    }
    return !Object.keys(errors.value).length;
}

function fromPolicy(p) {
    return {
        annual_quota: p?.annual_quota == null ? null : Number(p.annual_quota),
        max_carry_over: p?.max_carry_over == null ? null : Number(p.max_carry_over),
        carry_over_expiry_months: p?.carry_over_expiry_months == null ? null : Number(p.carry_over_expiry_months),
        description: p?.description || ''
    };
}

async function load() {
    loading.value = true;
    loadError.value = false;
    try {
        const res = await adminService.getPolicy();
        form.value = fromPolicy(res?.data ?? res);
        saved.value = { ...form.value };
    } catch (err) {
        loadError.value = true;
        toast.add({ severity: 'error', summary: 'Kebijakan gagal dimuat', detail: err.message, life: 4000 });
    } finally {
        loading.value = false;
    }
}

async function save() {
    if (!validate()) {
        await nextTick();
        document.getElementById(NUMERIC_FIELDS.find((f) => errors.value[f.key]).id)?.focus();
        return;
    }
    saving.value = true;
    try {
        const res = await adminService.updatePolicy({ ...form.value });
        form.value = fromPolicy(res?.data ?? res);
        saved.value = { ...form.value };
        await syncFromBackend({ fresh: true });
        toast.add({ severity: 'success', summary: 'Kebijakan disimpan', detail: 'Kebijakan cuti sudah diperbarui.', life: 3000 });
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Kebijakan gagal disimpan', detail: err.message, life: 4000 });
    } finally {
        saving.value = false;
    }
}

onMounted(load);
</script>

<template>
    <div class="space-y-6 max-w-3xl">
        <ReadOnlyNotice data-tour="readonly-notice" v-if="!canManage" module="kebijakan cuti" />

        <!-- Satu kartu: judul, field, lalu aksi dengan pemisah garis (acuan 00b §6.1, audit-013 #3). -->
        <form class="card !mb-0" @submit.prevent="save">
            <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                <PhScroll :size="22" weight="regular" class="text-primary shrink-0" aria-hidden="true" />
                <span>Master Kebijakan Cuti</span>
            </h1>
            <p class="text-xs text-muted-color">Kuota tahunan dan aturan carry over yang berlaku untuk semua karyawan.</p>

            <div v-if="loadError" role="alert" class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                <span>Kebijakan gagal dimuat. Field dikunci sampai data termuat.</span>
                <Button type="button" label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11" :loading="loading" @click="load" />
            </div>

            <div data-tour="policy-fields" class="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div v-for="f in NUMERIC_FIELDS" :key="f.key">
                    <label :for="f.id" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">{{ f.label }} <span v-if="canManage" class="text-(--status-danger-fg)" aria-hidden="true">*</span></label>
                    <InputGroup>
                        <InputNumber
                            v-model="form[f.key]"
                            :inputId="f.id"
                            :min="f.min"
                            :max="f.max"
                            :invalid="!!errors[f.key]"
                            :aria-describedby="errors[f.key] ? `${f.id}-error` : undefined"
                            :disabled="!canManage || loading || loadError"
                            fluid
                        />
                        <InputGroupAddon class="!text-surface-600 dark:!text-surface-400">{{ f.unit }}</InputGroupAddon>
                    </InputGroup>
                    <p v-if="errors[f.key]" :id="`${f.id}-error`" class="mt-1 text-xs text-(--status-danger-fg)">{{ errors[f.key] }}</p>
                </div>
                <div class="sm:col-span-3">
                    <label for="policy-desc" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Deskripsi</label>
                    <Textarea id="policy-desc" v-model="form.description" rows="3" autoResize class="w-full" :disabled="!canManage || loading || loadError" />
                </div>
            </div>

            <div v-if="canManage" class="mt-6 pt-4 flex items-center justify-end gap-3 border-t border-surface-200 dark:border-surface-700">
                <!-- Alasan tombol nonaktif ditulis terlihat; title tidak tampil pada tombol disabled (audit-013 #4). -->
                <span v-if="!loadError" aria-live="polite" class="text-xs text-muted-color">{{ isDirty ? 'Ada perubahan yang belum disimpan' : 'Belum ada perubahan' }}</span>
                <Button data-tour="policy-save" type="submit" size="small" class="font-semibold flex items-center gap-1.5" :loading="saving" :disabled="!isDirty">
                    <PhFloppyDisk :size="14" weight="bold" aria-hidden="true" />
                    <span>Simpan Perubahan</span>
                </Button>
            </div>
        </form>
    </div>
</template>
