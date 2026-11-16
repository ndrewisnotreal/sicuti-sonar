<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { leaveService } from '@/service/leaveService';
import {
    sicutiState,
    getDivisionUsers,
    getUserBalance,
    calculateWorkingDays,
    holidayDateSet,
    syncFromBackend,
    isSubstituteRequired,
    ROLE_LABELS
} from '@/service/sicutiService';
import { latestEndDate } from '@/utils/workingDays';
import { PhFilePlus, PhPaperPlaneRight } from '@phosphor-icons/vue';

const toast = useToast();
const confirm = useConfirm();
const router = useRouter();
const saving = ref(false);

const form = ref({ userId: null, leaveTypeId: null, startDate: null, endDate: null, substituteId: null, reason: '' });

const applicantIds = computed(() => new Set(sicutiState.leaveBalances.map((b) => b.userId)));
const employees = computed(() =>
    getDivisionUsers()
        .filter((u) => u.isActive && applicantIds.value.has(u.id))
        .map((u) => ({ ...u, label: `${u.name} (${u.namecode})`, roleLabel: ROLE_LABELS[u.role] || u.roleName || u.role }))
        .sort((a, b) => a.name.localeCompare(b.name))
);
const substitutes = computed(() => employees.value.filter((u) => u.id !== form.value.userId));
const substituteRequired = computed(() => isSubstituteRequired(employees.value.find((u) => u.id === form.value.userId)));
const leaveTypes = computed(() => sicutiState.leaveTypes.filter((t) => t.isActive));
const selectedType = computed(() => leaveTypes.value.find((t) => t.id === form.value.leaveTypeId));

const toIso = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null);
const workingDays = computed(() => calculateWorkingDays(toIso(form.value.startDate), toIso(form.value.endDate)));
const balance = computed(() => (form.value.userId ? getUserBalance(form.value.userId) : null));
const maxEndDate = computed(() => latestEndDate(form.value.startDate, selectedType.value?.maxDays, holidayDateSet()));

watch(maxEndDate, (max) => {
    if (max && form.value.endDate && form.value.endDate > max) form.value.endDate = max;
});

const problem = computed(() => {
    const f = form.value;
    if (!f.userId || !f.leaveTypeId || !f.startDate || !f.endDate || (substituteRequired.value && !f.substituteId) || !f.reason.trim()) {
        return 'Lengkapi semua kolom bertanda *.';
    }
    if (f.endDate < f.startDate) return 'Tanggal selesai harus setelah tanggal mulai.';
    if (workingDays.value === 0) return 'Rentang tanggal tidak berisi hari kerja.';
    if (selectedType.value?.usesQuota && balance.value && workingDays.value > balance.value.remaining) {
        return 'Saldo cuti karyawan tidak mencukupi.';
    }
    return null;
});

// Pesan per field untuk syarat yang sama dengan `problem`; ditampilkan di bawah field (audit-017 #1).
const EMPTY_ERRORS = { userId: '', leaveTypeId: '', startDate: '', endDate: '', substituteId: '', reason: '', balance: '' };
const errors = ref({ ...EMPTY_ERRORS });
for (const key of ['userId', 'leaveTypeId', 'startDate', 'endDate', 'substituteId', 'reason']) {
    watch(() => form.value[key], () => {
        errors.value[key] = '';
        // Ganti karyawan mengubah apakah pengganti wajib, jadi pesan pengganti ikut dihapus.
        if (key === 'userId') errors.value.substituteId = '';
        if (key !== 'reason' && key !== 'substituteId') errors.value.balance = '';
    });
}

function fieldErrors() {
    const f = form.value;
    const e = { ...EMPTY_ERRORS };
    if (!f.userId) e.userId = 'Pilih karyawan.';
    if (!f.leaveTypeId) e.leaveTypeId = 'Pilih jenis cuti.';
    if (!f.startDate) e.startDate = 'Pilih tanggal mulai.';
    if (!f.endDate) e.endDate = 'Pilih tanggal selesai.';
    // Field pengganti nonaktif sampai karyawan dipilih; pesannya baru berarti setelah itu.
    if (f.userId && substituteRequired.value && !f.substituteId) e.substituteId = 'Pilih pengganti tugas.';
    if (!f.reason.trim()) e.reason = 'Isi alasan pengajuan.';
    if (Object.values(e).some(Boolean)) return e;
    if (f.endDate < f.startDate) e.endDate = 'Tanggal selesai harus setelah tanggal mulai.';
    else if (workingDays.value === 0) e.endDate = 'Rentang tanggal tidak berisi hari kerja.';
    else if (problem.value) e.balance = problem.value;
    return e;
}

const FOCUS_TARGET = {
    userId: '[aria-labelledby="acl-user-label"]',
    leaveTypeId: '[aria-labelledby="acl-type-label"]',
    startDate: '#acl-start',
    endDate: '#acl-end',
    substituteId: '[aria-labelledby="acl-sub-label"]',
    reason: '#acl-reason',
    balance: '#acl-end'
};

// Select: atribut aria di elemen combobox (section `label`); DatePicker: di input teksnya (audit-017 #4).
function requiredPt(id, key) {
    return { label: { 'aria-required': 'true', 'aria-describedby': errors.value[key] ? `${id}-error` : undefined } };
}
function dateRequiredPt(id, key) {
    const help = id === 'acl-end' ? 'acl-end-help' : undefined;
    return { pcInputText: { root: { 'aria-required': 'true', 'aria-invalid': !!errors.value[key], 'aria-describedby': errors.value[key] ? `${id}-error` : help } } };
}

const datesChosen = computed(() => Boolean(form.value.startDate && form.value.endDate));
const overBalance = computed(
    () => Boolean(selectedType.value?.usesQuota && balance.value && datesChosen.value && workingDays.value > balance.value.remaining)
);
const balanceNote = computed(() => {
    if (errors.value.balance) return errors.value.balance;
    if (overBalance.value) return `Melebihi sisa saldo (${balance.value.remaining} hari).`;
    if (selectedType.value && !selectedType.value.usesQuota) return `${selectedType.value.name} tidak mengurangi saldo cuti tahunan.`;
    return '';
});
const endDateHelp = computed(() => {
    if (!selectedType.value || !form.value.startDate) return 'Pilih jenis cuti dan tanggal mulai dulu.';
    if (selectedType.value.maxDays) return `Maks. ${selectedType.value.maxDays} hari kerja untuk ${selectedType.value.name}.`;
    return '';
});

const isDirty = computed(() => {
    const f = form.value;
    return Boolean(f.userId || f.leaveTypeId || f.startDate || f.endDate || f.substituteId || f.reason.trim());
});

// Batal tidak membuang isian tanpa konfirmasi (audit-017 #7).
function cancel() {
    if (!isDirty.value) return router.push('/');
    confirm.require({
        header: 'Buang isian pengajuan?',
        message: 'Isian yang sudah diketik tidak disimpan.',
        acceptLabel: 'Buang',
        rejectLabel: 'Lanjut mengisi',
        acceptProps: { severity: 'danger' },
        rejectProps: { severity: 'secondary', outlined: true },
        defaultFocus: 'reject',
        accept: () => router.push('/')
    });
}

async function submit() {
    if (problem.value) {
        errors.value = fieldErrors();
        const first = Object.keys(FOCUS_TARGET).find((k) => errors.value[k]);
        await nextTick();
        if (first) document.querySelector(FOCUS_TARGET[first])?.focus();
        return;
    }
    saving.value = true;
    try {
        const f = form.value;
        const res = await leaveService.createLeave({
            uid_user_system: f.userId,
            kd_leave_type: f.leaveTypeId,
            start_date: toIso(f.startDate),
            end_date: toIso(f.endDate),
            substitute_id: f.substituteId || undefined,
            reason: f.reason.trim()
        });
        await syncFromBackend({ fresh: true });
        const employee = employees.value.find((u) => u.id === f.userId);
        toast.add({
            severity: 'success',
            summary: 'Pengajuan dibuat',
            detail: `Pengajuan ${res?.id_request || ''} untuk ${employee?.name || 'karyawan'} masuk ke alur approval.`,
            life: 4000
        });
        router.push('/admin/monitoring');
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Pengajuan gagal dibuat', detail: err.message, life: 4500 });
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <div class="w-full max-w-6xl">
        <!-- Satu kartu: judul, field, ringkasan berpemisah, aksi (acuan 00b §6.1, audit-017 #3). -->
        <form class="card create-leave-form !mb-0" novalidate @submit.prevent="submit">
            <header class="border-b border-surface-200 pb-6 dark:border-surface-800">
            <h1 class="text-xl font-semibold leading-snug text-surface-900 dark:text-surface-100 flex items-start gap-2.5">
                <PhFilePlus :size="22" weight="regular" class="text-primary shrink-0 mt-1" aria-hidden="true" />
                <span>Buat Pengajuan Cuti Karyawan</span>
            </h1>
            <p class="mt-2 max-w-2xl text-sm leading-relaxed text-surface-600 dark:text-surface-400">Ajukan cuti atas nama karyawan di divisi Anda. Pengajuan tetap melewati alur approval.</p>
            </header>

            <div class="mt-6 grid min-w-0 grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_16rem]">
            <section class="min-w-0" aria-labelledby="acl-details-heading">
                <div class="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="acl-details-heading" class="text-sm font-semibold text-surface-900 dark:text-surface-100">Rincian cuti</h2>
                    <p class="text-xs text-surface-600 dark:text-surface-400"><span class="text-(--status-danger-fg)" aria-hidden="true">*</span> Wajib diisi</p>
                </div>
            <div class="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-6 text-sm">
                <div data-tour="create-employee" class="min-w-0">
                    <span id="acl-user-label" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Nama karyawan <span class="text-(--status-danger-fg)" aria-hidden="true">*</span></span>
                    <Select
                        v-model="form.userId"
                        inputId="acl-user"
                        ariaLabelledby="acl-user-label"
                        :options="employees"
                        optionLabel="label"
                        optionValue="id"
                        filter
                        placeholder="Pilih karyawan"
                        emptyMessage="Tidak ada karyawan di divisi ini"
                        :invalid="!!errors.userId"
                        :pt="requiredPt('acl-user', 'userId')"
                        class="w-full min-w-0 !min-h-11"
                        fluid
                    >
                        <template #option="{ option }">
                            <div class="flex flex-col">
                                <span class="font-medium">{{ option.name }}</span>
                                <span class="text-xs text-muted-color">{{ option.namecode }} · {{ option.roleLabel }}</span>
                            </div>
                        </template>
                    </Select>
                    <p v-if="errors.userId" id="acl-user-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ errors.userId }}</p>
                </div>
                <div data-tour="create-type" class="min-w-0">
                    <span id="acl-type-label" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Jenis cuti <span class="text-(--status-danger-fg)" aria-hidden="true">*</span></span>
                    <Select
                        v-model="form.leaveTypeId"
                        inputId="acl-type"
                        ariaLabelledby="acl-type-label"
                        :options="leaveTypes"
                        optionLabel="name"
                        optionValue="id"
                        placeholder="Pilih jenis cuti"
                        :invalid="!!errors.leaveTypeId"
                        :pt="requiredPt('acl-type', 'leaveTypeId')"
                        class="w-full min-w-0 !min-h-11"
                        fluid
                    />
                    <p v-if="errors.leaveTypeId" id="acl-type-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ errors.leaveTypeId }}</p>
                </div>
                <div class="min-w-0">
                    <label for="acl-start" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Tanggal mulai <span class="text-(--status-danger-fg)" aria-hidden="true">*</span></label>
                    <DatePicker
                        v-model="form.startDate"
                        inputId="acl-start"
                        dateFormat="dd MM yy"
                        showIcon
                        iconDisplay="input"
                        placeholder="Pilih tanggal"
                        :invalid="!!errors.startDate"
                        :pt="dateRequiredPt('acl-start', 'startDate')"
                        class="w-full min-w-0"
                        inputClass="!min-h-11"
                        fluid
                    />
                    <p v-if="errors.startDate" id="acl-start-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ errors.startDate }}</p>
                </div>
                <div class="min-w-0">
                    <label for="acl-end" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Tanggal selesai <span class="text-(--status-danger-fg)" aria-hidden="true">*</span></label>
                    <DatePicker
                        v-model="form.endDate"
                        inputId="acl-end"
                        dateFormat="dd MM yy"
                        showIcon
                        iconDisplay="input"
                        placeholder="Pilih tanggal"
                        :minDate="form.startDate || undefined"
                        :maxDate="maxEndDate || undefined"
                        :disabled="!selectedType || !form.startDate"
                        :invalid="!!errors.endDate"
                        :pt="dateRequiredPt('acl-end', 'endDate')"
                        class="w-full min-w-0"
                        inputClass="!min-h-11"
                        fluid
                    />
                    <p v-if="errors.endDate" id="acl-end-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ errors.endDate }}</p>
                    <!-- Alasan field nonaktif dan batas hari jenis cuti ditulis terlihat (audit-017 #5). -->
                    <p v-else id="acl-end-help" class="mt-1 text-xs text-muted-color">{{ endDateHelp }}</p>
                </div>
                <div class="min-w-0 sm:col-span-2">
                    <span id="acl-sub-label" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                        Pengganti tugas
                        <span v-if="!form.userId" class="text-xs font-normal text-muted-color">(pilih karyawan dulu)</span>
                        <span v-else-if="substituteRequired" class="text-(--status-danger-fg)" aria-hidden="true">*</span>
                        <span v-else class="text-xs font-normal text-muted-color">(opsional)</span>
                    </span>
                    <Select
                        v-model="form.substituteId"
                        inputId="acl-sub"
                        ariaLabelledby="acl-sub-label"
                        :options="substitutes"
                        optionLabel="label"
                        optionValue="id"
                        filter
                        placeholder="Pilih pengganti"
                        :disabled="!form.userId"
                        :showClear="!substituteRequired"
                        :invalid="!!errors.substituteId"
                        :pt="form.userId && substituteRequired ? requiredPt('acl-sub', 'substituteId') : undefined"
                        class="w-full min-w-0 !min-h-11"
                        fluid
                    />
                    <p v-if="errors.substituteId" id="acl-sub-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ errors.substituteId }}</p>
                </div>
                <div class="min-w-0 sm:col-span-2">
                    <label for="acl-reason" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Alasan <span class="text-(--status-danger-fg)" aria-hidden="true">*</span></label>
                    <Textarea
                        id="acl-reason"
                        v-model="form.reason"
                        rows="4"
                        autoResize
                        placeholder="Masukkan alasan pengajuan"
                        class="w-full"
                        aria-required="true"
                        :invalid="!!errors.reason"
                        :aria-invalid="!!errors.reason"
                        :aria-describedby="errors.reason ? 'acl-reason-error' : undefined"
                    />
                    <p v-if="errors.reason" id="acl-reason-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ errors.reason }}</p>
                </div>
            </div>
            </section>

            <!-- Ringkasan tanpa kotak; status saldo langsung terlihat sebelum dikirim (audit-017 #2). -->
            <div data-tour="create-summary" class="min-w-0 self-start border-t border-surface-200 pt-6 text-sm dark:border-surface-800 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6" aria-labelledby="acl-summary-heading">
                <h2 id="acl-summary-heading" class="text-sm font-semibold text-surface-900 dark:text-surface-100">Ringkasan pengajuan</h2>
                <p class="mt-2 text-xs leading-relaxed text-surface-600 dark:text-surface-400">Periksa durasi dan saldo cuti sebelum membuat pengajuan.</p>
                <dl class="mt-5 grid grid-cols-2 gap-5 xl:grid-cols-1 xl:gap-6">
                <div class="min-w-0">
                    <dt class="text-xs text-surface-600 dark:text-surface-400">Jumlah hari kerja</dt>
                    <dd class="mt-1.5 text-2xl font-semibold tabular-nums leading-tight text-surface-900 dark:text-surface-0">{{ datesChosen ? `${workingDays} hari` : '–' }}</dd>
                </div>
                <div class="min-w-0">
                    <dt class="text-xs text-surface-600 dark:text-surface-400">Sisa saldo karyawan</dt>
                    <dd class="mt-1.5 text-2xl font-semibold tabular-nums leading-tight text-surface-900 dark:text-surface-0">{{ balance ? `${balance.remaining} hari` : '–' }}</dd>
                </div>
                </dl>
                <p aria-live="polite" class="mt-4 text-xs leading-relaxed empty:hidden" :class="overBalance || errors.balance ? 'font-semibold text-(--status-danger-fg)' : 'text-surface-600 dark:text-surface-400'">{{ balanceNote }}</p>
            </div>
            </div>

            <div class="mt-8 pt-5 flex flex-wrap items-center justify-end gap-3 border-t border-surface-200 dark:border-surface-800">
                <Button type="button" label="Batal" severity="secondary" text class="!min-h-11 !px-4" @click="cancel" />
                <Button data-tour="create-submit" type="submit" class="!min-h-11 !px-5 font-semibold flex items-center gap-2" :loading="saving">
                    <PhPaperPlaneRight :size="16" weight="bold" aria-hidden="true" />
                    <span>Buat Pengajuan</span>
                </Button>
            </div>
        </form>
    </div>
</template>

<style scoped>
.create-leave-form label[for] {
    cursor: pointer;
}

.create-leave-form :deep(.p-disabled),
.create-leave-form :deep(:disabled),
.create-leave-form label:has(+ .p-datepicker input:disabled) {
    cursor: not-allowed;
}

.create-leave-form :deep(.p-select-label),
.create-leave-form :deep(.p-inputtext),
.create-leave-form :deep(.p-textarea) {
    font-size: 1rem;
}

@media (min-width: 576px) {
    .create-leave-form :deep(.p-select-label),
    .create-leave-form :deep(.p-inputtext),
    .create-leave-form :deep(.p-textarea) {
        font-size: 0.875rem;
    }
}
</style>
