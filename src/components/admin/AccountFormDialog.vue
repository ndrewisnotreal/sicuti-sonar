<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { adminService } from '@/service/adminService';
import { useToast } from 'primevue/usetoast';
import { STATUS_REASON_OPTIONS, statusFormProblem } from '@/service/statusReason';
import { passwordChecks, passwordProblem } from '@/utils/passwordRules';
import { PhCheck, PhX } from '@phosphor-icons/vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    isEditing: {
        type: Boolean,
        default: false
    },
    userData: {
        type: Object,
        default: null
    },
    roles: {
        type: Array,
        default: () => []
    },
    departments: {
        type: Array,
        default: () => []
    },
    users: {
        type: Array,
        default: () => []
    },
    adminDivision: {
        type: String,
        default: null
    },
    // Tambahan: daftar peran gagal dimuat di parent (audit-024 #2).
    rolesError: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:visible', 'saved']);
const toast = useToast();

const formErrors = ref({});
const saving = ref(false);

const form = ref({
    uid_user_system: '',
    username: '',
    email: '',
    nama: '',
    namecode: '',
    kd_dept: '',
    position: '',
    supervisor_id: null,
    kd_role: '',
    join_date: null,
    employment_status: '',
    password: '',
    status: 'A',
    original_status: 'A',
    status_reason: null,
    status_note: '',
    is_super: false
});

const EMPLOYMENT_OPTIONS = [
    { label: 'Belum diisi', value: '' },
    { label: 'Tetap', value: 'Tetap' },
    { label: 'Kontrak', value: 'Kontrak' },
    { label: 'Outsourcing', value: 'Outsourcing' }
];

function isAdminRole(kdRole) {
    const r = (props.roles || []).find((x) => x.kd_role === kdRole);
    return Boolean(r && (r.is_super || (Number(r.level) > 0 && Number(r.level) <= 15)));
}

const toIso = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : undefined);
const fromIso = (iso) => {
    const p = String(iso || '').slice(0, 10).split('-').map(Number);
    return p.length === 3 && p.every(Boolean) ? new Date(p[0], p[1] - 1, p[2]) : null;
};

const deptSelectOptions = computed(() => {
    if (props.adminDivision) {
        return (props.departments || []).filter((d) => d.kd_dept === props.adminDivision);
    }
    return props.departments || [];
});

const supervisorOptions = computed(() => {
    const list = (props.users || []).filter((u) => {
        if (props.isEditing && u.uid_user_system === form.value.uid_user_system) return false;
        return true;
    });
    return [
        { label: 'Tidak Ada Atasan', value: null },
        ...list.map((u) => ({
            label: `${u.nama || u.username} (${u.namecode || u.username} - ${u.position || u.kd_role || '-'})`,
            value: u.uid_user_system
        }))
    ];
});

const roleOptions = computed(() =>
    (props.roles || []).map((r) => ({
        label: r.nm_role || r.kd_role,
        value: r.kd_role
    }))
);

const deactivating = computed(() => props.isEditing && form.value.original_status !== 'N' && form.value.status === 'N');

watch(
    () => props.visible,
    (isOpen) => {
        if (!isOpen) return;
        formErrors.value = {};
        if (props.isEditing && props.userData) {
            const u = props.userData;
            form.value = {
                uid_user_system: u.uid_user_system,
                username: u.username || '',
                email: u.email || '',
                nama: u.nama || '',
                namecode: u.namecode || '',
                kd_dept: u.kd_dept || props.adminDivision || '',
                position: u.position || '',
                supervisor_id: u.supervisor_id || null,
                kd_role: u.kd_role || '',
                join_date: fromIso(u.join_date),
                employment_status: u.employment_status || '',
                password: '',
                status: u.status_user || u.status || 'A',
                original_status: u.status_user || u.status || 'A',
                status_reason: null,
                status_note: '',
                is_super: Boolean(u.is_super)
            };
        } else {
            const defaultDept = props.adminDivision || props.departments?.[0]?.kd_dept || '';
            form.value = {
                uid_user_system: '',
                username: '',
                email: '',
                nama: '',
                namecode: '',
                kd_dept: defaultDept,
                position: '',
                supervisor_id: null,
                kd_role: roleOptions.value.find((o) => o.value === 'staff_it')?.value || roleOptions.value[0]?.value || '',
                join_date: null,
                employment_status: '',
                password: '',
                status: 'A',
                original_status: 'A',
                status_reason: null,
                status_note: '',
                is_super: false
            };
        }
    }
);

function validateForm() {
    const errs = {};
    const nik = form.value.namecode?.trim() || '';
    if (!form.value.username?.trim() && nik) form.value.username = nik;
    if (!isAdminRole(form.value.kd_role)) {
        const nikPattern = form.value.kd_role === 'staff_it' ? /^OS\d{8}$/ : /^\d{8}$/;
        if (!nik) errs.namecode = 'NIK wajib diisi';
        else if (!nikPattern.test(nik)) {
            errs.namecode = form.value.kd_role === 'staff_it' ? 'NIK Staff IT: OS diikuti 8 angka' : 'NIK harus 8 angka';
        }
    }
    if (!form.value.username?.trim()) errs.username = 'Username wajib diisi';
    if (!form.value.nama?.trim()) errs.nama = 'Nama lengkap wajib diisi';
    if (!form.value.kd_role) errs.kd_role = 'Peran wajib dipilih';
    if (!form.value.kd_dept) errs.kd_dept = 'Divisi wajib dipilih';

    if (form.value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
        errs.email = 'Format email tidak valid';
    }

    // Aturan sama dengan backend (assertPasswordStrength) dan dialog atur ulang (audit-024 #1).
    if (!props.isEditing && !form.value.password) {
        errs.password = 'Kata sandi wajib diisi untuk akun baru';
    } else if (form.value.password) {
        const problem = passwordProblem(form.value.password);
        if (problem) errs.password = problem.replace('Password baru', 'Kata sandi');
    }

    if (deactivating.value) {
        const problem = statusFormProblem({ reason: form.value.status_reason, note: form.value.status_note });
        if (problem) errs.status_reason = problem;
    }

    formErrors.value = errs;
    return Object.keys(errs).length === 0;
}

// Fokus ke field salah pertama, urut sesuai tampilan (DESIGN.md bagian Form, audit-024 #3).
const FIELD_ORDER = [
    ['username', 'acc-username'],
    ['namecode', 'acc-nik'],
    ['nama', 'acc-name'],
    ['email', 'acc-email'],
    ['kd_dept', 'acc-dept'],
    ['kd_role', 'acc-role'],
    ['password', 'acc-password'],
    ['status_reason', 'acc-status-reason']
];

const passwordRules = computed(() => passwordChecks(form.value.password));
const fieldError = (key) => formErrors.value[key] || '';
const describedBy = (key, id) => (formErrors.value[key] ? `${id}-error` : undefined);

const statusActive = computed({
    get: () => form.value.status === 'A',
    set: (v) => {
        form.value.status = v ? 'A' : 'N';
    }
});

async function saveAccount() {
    if (!validateForm()) {
        const first = FIELD_ORDER.find(([key]) => formErrors.value[key]);
        await nextTick();
        if (first) document.getElementById(first[1])?.focus();
        return;
    }
    saving.value = true;
    try {
        const payload = {
            username: form.value.username.trim(),
            nama: form.value.nama.trim(),
            email: form.value.email?.trim() || undefined,
            namecode: form.value.namecode?.trim() || undefined,
            kd_dept: form.value.kd_dept,
            position: form.value.position?.trim() || undefined,
            supervisor_id: form.value.supervisor_id || undefined,
            kd_role: form.value.kd_role,
            join_date: toIso(form.value.join_date),
            employment_status: form.value.employment_status || '',
            status: form.value.status
        };

        if (form.value.password) {
            payload.password = form.value.password;
        }
        if (deactivating.value) {
            payload.status_reason = form.value.status_reason;
            payload.status_note = form.value.status_note?.trim() || undefined;
        }

        if (props.isEditing) {
            payload.uid_user_system = form.value.uid_user_system;
            await adminService.updateUser(payload);
            toast.add({
                severity: 'success',
                summary: 'Berhasil',
                detail: `Akun ${payload.nama} berhasil diperbarui`,
                life: 3000
            });
        } else {
            await adminService.createUser(payload);
            toast.add({
                severity: 'success',
                summary: 'Berhasil',
                detail: `Akun baru ${payload.nama} berhasil dibuat`,
                life: 3000
            });
        }

        emit('update:visible', false);
        emit('saved');
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Gagal Menyimpan',
            detail: err.message || 'Terjadi kesalahan saat menyimpan akun',
            life: 3000
        });
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <Dialog
        :visible="visible"
        modal
        :header="isEditing ? 'Ubah Akun & Peran' : 'Tambah Akun Pengguna Baru'"
        :breakpoints="{ '960px': '75vw', '640px': '92vw' }"
        :style="{ width: '560px' }"
        @update:visible="emit('update:visible', $event)"
    >
        <!-- Setiap field punya label terhubung; kesalahan di bawah field dengan aria-describedby (audit-024 #3). -->
        <div class="space-y-4 pt-1 text-sm">
            <p v-if="rolesError" role="alert" class="rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-amber-900 dark:text-amber-100">
                Daftar peran gagal dimuat, jadi akun belum bisa disimpan. Tutup dialog lalu tekan Segarkan.
            </p>
            <p class="text-xs text-surface-600 dark:text-surface-400"><span class="text-(--status-danger-fg)" aria-hidden="true">*</span> Wajib diisi</p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label for="acc-username" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Username <span class="text-(--status-danger-fg)" aria-hidden="true">*</span></label>
                    <InputText
                        id="acc-username"
                        v-model="form.username"
                        class="w-full"
                        placeholder="Kosongkan untuk memakai NIK"
                        :disabled="isEditing"
                        :invalid="Boolean(fieldError('username'))"
                        :aria-invalid="Boolean(fieldError('username'))"
                        :aria-describedby="describedBy('username', 'acc-username')"
                    />
                    <p v-if="fieldError('username')" id="acc-username-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ fieldError('username') }}</p>
                </div>
                <div>
                    <label for="acc-nik" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">NIK / ID pegawai</label>
                    <InputText
                        id="acc-nik"
                        v-model="form.namecode"
                        class="w-full"
                        placeholder="Contoh: 24011021 / OS24980032"
                        :invalid="Boolean(fieldError('namecode'))"
                        :aria-invalid="Boolean(fieldError('namecode'))"
                        :aria-describedby="describedBy('namecode', 'acc-nik')"
                    />
                    <p v-if="fieldError('namecode')" id="acc-nik-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ fieldError('namecode') }}</p>
                </div>

                <div>
                    <label for="acc-name" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Nama lengkap <span class="text-(--status-danger-fg)" aria-hidden="true">*</span></label>
                    <InputText
                        id="acc-name"
                        v-model="form.nama"
                        class="w-full"
                        aria-required="true"
                        :invalid="Boolean(fieldError('nama'))"
                        :aria-invalid="Boolean(fieldError('nama'))"
                        :aria-describedby="describedBy('nama', 'acc-name')"
                    />
                    <p v-if="fieldError('nama')" id="acc-name-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ fieldError('nama') }}</p>
                </div>
                <div>
                    <label for="acc-email" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Email</label>
                    <InputText
                        id="acc-email"
                        v-model="form.email"
                        type="email"
                        class="w-full"
                        placeholder="nama@inalum.co.id"
                        :invalid="Boolean(fieldError('email'))"
                        :aria-invalid="Boolean(fieldError('email'))"
                        :aria-describedby="describedBy('email', 'acc-email')"
                    />
                    <p v-if="fieldError('email')" id="acc-email-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ fieldError('email') }}</p>
                </div>

                <div>
                    <label for="acc-dept" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Divisi <span class="text-(--status-danger-fg)" aria-hidden="true">*</span></label>
                    <Select
                        v-model="form.kd_dept"
                        inputId="acc-dept"
                        :options="deptSelectOptions"
                        optionLabel="nm_dept"
                        optionValue="kd_dept"
                        :disabled="Boolean(adminDivision)"
                        placeholder="Pilih divisi"
                        class="w-full"
                        :invalid="Boolean(fieldError('kd_dept'))"
                        :aria-describedby="describedBy('kd_dept', 'acc-dept')"
                    />
                    <p v-if="fieldError('kd_dept')" id="acc-dept-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ fieldError('kd_dept') }}</p>
                </div>
                <div>
                    <label for="acc-position" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Jabatan / posisi</label>
                    <InputText id="acc-position" v-model="form.position" class="w-full" placeholder="Staff IT / Analis" />
                </div>

                <div>
                    <label for="account-join" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Tanggal masuk</label>
                    <DatePicker v-model="form.join_date" inputId="account-join" dateFormat="dd M yy" showIcon iconDisplay="input" placeholder="Pilih tanggal" fluid />
                </div>
                <div>
                    <label for="account-employment" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Status kepegawaian</label>
                    <Select
                        v-model="form.employment_status"
                        inputId="account-employment"
                        :options="EMPLOYMENT_OPTIONS"
                        optionLabel="label"
                        optionValue="value"
                        class="w-full"
                    />
                </div>

                <div>
                    <label for="acc-role" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Peran pengguna <span class="text-(--status-danger-fg)" aria-hidden="true">*</span></label>
                    <Select
                        v-model="form.kd_role"
                        inputId="acc-role"
                        :options="roleOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Pilih peran"
                        class="w-full"
                        :disabled="rolesError"
                        :invalid="Boolean(fieldError('kd_role'))"
                        :aria-describedby="describedBy('kd_role', 'acc-role')"
                    />
                    <p v-if="fieldError('kd_role')" id="acc-role-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ fieldError('kd_role') }}</p>
                </div>
                <div>
                    <label for="acc-supervisor" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Atasan langsung</label>
                    <Select
                        v-model="form.supervisor_id"
                        inputId="acc-supervisor"
                        :options="supervisorOptions"
                        optionLabel="label"
                        optionValue="value"
                        filter
                        placeholder="Pilih atasan"
                        class="w-full"
                        aria-describedby="acc-supervisor-help"
                    />
                    <p id="acc-supervisor-help" class="mt-1 text-xs text-surface-600 dark:text-surface-400">Informasi struktur saja; approver cuti diatur di menu Alur Approval.</p>
                </div>
            </div>

            <div>
                <label for="acc-password" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                    {{ isEditing ? 'Kata sandi baru' : 'Kata sandi' }}
                    <span v-if="!isEditing" class="text-(--status-danger-fg)" aria-hidden="true">*</span>
                </label>
                <InputText
                    id="acc-password"
                    v-model="form.password"
                    type="password"
                    class="w-full"
                    autocomplete="new-password"
                    :invalid="Boolean(fieldError('password'))"
                    :aria-invalid="Boolean(fieldError('password'))"
                    :aria-describedby="fieldError('password') ? 'acc-password-error acc-password-rules' : 'acc-password-rules'"
                />
                <p v-if="fieldError('password')" id="acc-password-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ fieldError('password') }}</p>
                <p v-if="isEditing" class="mt-1 text-xs text-surface-600 dark:text-surface-400">Kosongkan bila kata sandi tidak diubah.</p>
                <!-- Syarat sama dengan backend dan dialog atur ulang (audit-024 #1). -->
                <ul id="acc-password-rules" class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs" aria-live="polite">
                    <li v-for="c in passwordRules" :key="c.label" class="flex items-center gap-1.5" :class="c.ok ? 'text-(--status-success-fg)' : 'text-surface-600 dark:text-surface-400'">
                        <PhCheck v-if="c.ok" :size="14" weight="bold" aria-hidden="true" />
                        <PhX v-else :size="14" weight="bold" aria-hidden="true" />
                        <span>{{ c.label }}<span class="sr-only">{{ c.ok ? ': terpenuhi' : ': belum' }}</span></span>
                    </li>
                </ul>
            </div>

            <div v-if="!form.is_super" class="flex items-center gap-2 min-h-11 sm:min-h-9">
                <Checkbox v-model="statusActive" :binary="true" inputId="formStatus" />
                <label for="formStatus" class="font-medium text-surface-900 dark:text-surface-100 cursor-pointer">Status akun aktif</label>
            </div>

            <div v-if="deactivating" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label for="acc-status-reason" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Alasan nonaktif <span class="text-(--status-danger-fg)" aria-hidden="true">*</span></label>
                    <Select
                        inputId="acc-status-reason"
                        v-model="form.status_reason"
                        :options="STATUS_REASON_OPTIONS"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Pilih alasan"
                        class="w-full"
                        :invalid="Boolean(fieldError('status_reason'))"
                        :aria-describedby="describedBy('status_reason', 'acc-status-reason')"
                    />
                </div>
                <div>
                    <label for="acc-status-note" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Keterangan<span v-if="form.status_reason === 'LAINNYA'" class="text-(--status-danger-fg)" aria-hidden="true"> *</span></label>
                    <InputText id="acc-status-note" v-model="form.status_note" class="w-full" placeholder="Mis. kontrak berakhir 30 Sep 2026" />
                </div>
                <p v-if="fieldError('status_reason')" id="acc-status-reason-error" class="sm:col-span-2 text-xs text-(--status-danger-fg)">{{ fieldError('status_reason') }}</p>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2 pt-2">
                <Button
                    label="Batal"
                    severity="secondary"
                    size="small"
                    text
                    @click="emit('update:visible', false)"
                />
                <Button
                    :label="isEditing ? 'Simpan Perubahan' : 'Buat Akun'"
                    severity="primary"
                    size="small"
                    class="font-bold"
                    :loading="saving"
                    :disabled="rolesError"
                    @click="saveAccount"
                />
            </div>
        </template>
    </Dialog>
</template>
