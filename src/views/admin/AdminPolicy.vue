<script setup>
import { ref, computed, onMounted } from 'vue';
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
                <div>
                    <label for="policy-quota" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Kuota tahunan</label>
                    <InputGroup>
                        <InputNumber v-model="form.annual_quota" inputId="policy-quota" :min="1" :max="365" :disabled="!canManage || loading || loadError" fluid />
                        <InputGroupAddon class="!text-surface-600 dark:!text-surface-400">hari</InputGroupAddon>
                    </InputGroup>
                </div>
                <div>
                    <label for="policy-carry" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Maks carry over</label>
                    <InputGroup>
                        <InputNumber v-model="form.max_carry_over" inputId="policy-carry" :min="0" :max="365" :disabled="!canManage || loading || loadError" fluid />
                        <InputGroupAddon class="!text-surface-600 dark:!text-surface-400">hari</InputGroupAddon>
                    </InputGroup>
                </div>
                <div>
                    <label for="policy-expiry" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Masa berlaku carry over</label>
                    <InputGroup>
                        <InputNumber v-model="form.carry_over_expiry_months" inputId="policy-expiry" :min="0" :max="24" :disabled="!canManage || loading || loadError" fluid />
                        <InputGroupAddon class="!text-surface-600 dark:!text-surface-400">bulan</InputGroupAddon>
                    </InputGroup>
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
