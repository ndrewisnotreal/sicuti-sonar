<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { rbacService } from '@/service/rbacService';
import { authService } from '@/service/authService';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { PhShieldCheck, PhFloppyDisk, PhArrowsClockwise, PhLock, PhPlus, PhTrash } from '@phosphor-icons/vue';
import { roleDeleteBlock } from '@/utils/permissionRules';
import RoleFormDialog from '@/components/admin/RoleFormDialog.vue';

const toast = useToast();
const confirm = useConfirm();
const loading = ref(false);
const loadError = ref(false);
const saving = ref(false);

const catalog = ref([]);
const roles = ref([]);
const selectedRole = ref('');
const current = ref(new Set());
const savedSnapshot = ref('');

const ROLE_GROUPS = [
    { label: 'Super admin', match: (l) => l <= 0 },
    { label: 'Admin', level: 10, match: (l) => l > 0 && l <= 15 },
    { label: 'Kepala / atasan', level: 30, match: (l) => l > 15 && l <= 35 },
    { label: 'Approval', level: 40, match: (l) => l > 35 && l <= 50 },
    { label: 'Karyawan', level: 90, match: (l) => l > 50 }
];
const groupOf = (level) => ROLE_GROUPS.find((g) => g.match(Number(level ?? 90)));
const groupOptions = ROLE_GROUPS.filter((g) => g.level !== undefined).map((g) => ({ label: g.label, value: g.label }));

const roleGroups = computed(() =>
    ROLE_GROUPS.map((g) => ({ label: g.label, roles: roles.value.filter((r) => g.match(Number(r.level ?? 90))) })).filter(
        (g) => g.roles.length > 0
    )
);

// Nama peran yang muncul lebih dari sekali diberi kode role agar bisa dibedakan tanpa tooltip (audit-025 #9).
const duplicateNames = computed(() => {
    const seen = new Map();
    roles.value.forEach((r) => seen.set(r.nm_role, (seen.get(r.nm_role) || 0) + 1));
    return new Set([...seen].filter(([, n]) => n > 1).map(([name]) => name));
});

const selectedRoleObj = computed(() => roles.value.find((r) => r.kd_role === selectedRole.value));
const isSuper = computed(() => Boolean(selectedRoleObj.value?.is_super));
const allKeys = computed(() => catalog.value.flatMap((m) => m.actions.map((a) => `${m.key}.${a.key}`)));
const activeCount = computed(() => (isSuper.value ? allKeys.value.length : current.value.size));

const snapshotOf = (set) => JSON.stringify([...set].sort());
const isDirty = computed(() => !isSuper.value && snapshotOf(current.value) !== savedSnapshot.value);
// Jumlah izin yang berbeda dari yang tersimpan, untuk bilah simpan (audit-025 #7).
const changedCount = computed(() => {
    if (!isDirty.value) return 0;
    const saved = new Set(JSON.parse(savedSnapshot.value || '[]'));
    let n = 0;
    current.value.forEach((k) => !saved.has(k) && n++);
    saved.forEach((k) => !current.value.has(k) && n++);
    return n;
});

// Alasan peran tidak bisa dihapus, ditulis terlihat alih-alih toast setelah klik (audit-025 #4).
const deleteBlock = computed(() => (selectedRoleObj.value && !isSuper.value ? roleDeleteBlock(selectedRoleObj.value) : null));

function applyRole(kdRole) {
    selectedRole.value = kdRole;
    const role = roles.value.find((r) => r.kd_role === kdRole);
    current.value = new Set(role?.abilities || []);
    savedSnapshot.value = snapshotOf(current.value);
}

async function load(keepSelection = true) {
    loading.value = true;
    loadError.value = false;
    try {
        const res = await rbacService.getRoleAbilities();
        catalog.value = res.catalog || [];
        roles.value = res.roles || [];
        const target = keepSelection && roles.value.some((r) => r.kd_role === selectedRole.value) ? selectedRole.value : roles.value[0]?.kd_role;
        if (target) applyRole(target);
    } catch (err) {
        // Dikosongkan agar izin lama tidak diedit dan disimpan di atas data yang belum termuat (audit-025 #3).
        loadError.value = true;
        catalog.value = [];
        roles.value = [];
        selectedRole.value = '';
        current.value = new Set();
        savedSnapshot.value = snapshotOf(current.value);
        toast.add({ severity: 'error', summary: 'Hak akses gagal dimuat', detail: err.message, life: 4000 });
    } finally {
        loading.value = false;
    }
}

// Fokus awal di tombol aman untuk setiap konfirmasi destruktif (DESIGN.md, audit-025 #2).
const SAFE_CONFIRM = { defaultFocus: 'reject', rejectProps: { severity: 'secondary', outlined: true } };

function discardOptions() {
    return {
        ...SAFE_CONFIRM,
        header: 'Perubahan belum disimpan',
        message: `Perubahan hak akses ${selectedRoleObj.value?.nm_role || ''} akan hilang.`,
        acceptLabel: 'Buang perubahan',
        rejectLabel: 'Tetap di sini',
        acceptProps: { severity: 'danger' }
    };
}

function confirmDiscard(onAccept) {
    if (!isDirty.value) return onAccept();
    confirm.require({ ...discardOptions(), accept: onAccept });
}

// Pindah halaman atau muat ulang saat ada perubahan meminta konfirmasi (audit-025 #1).
onBeforeRouteLeave(() => {
    if (!isDirty.value) return true;
    return new Promise((resolve) => {
        confirm.require({ ...discardOptions(), accept: () => resolve(true), reject: () => resolve(false), onHide: () => resolve(false) });
    });
});

function warnBeforeUnload(event) {
    if (!isDirty.value) return;
    event.preventDefault();
    event.returnValue = '';
}

function selectRole(kdRole) {
    if (kdRole === selectedRole.value) return;
    confirmDiscard(() => applyRole(kdRole));
}

const deleting = ref(false);

function removeRole() {
    const role = selectedRoleObj.value;
    const block = roleDeleteBlock(role);
    if (block) {
        toast.add({ severity: 'warn', summary: 'Peran tidak bisa dihapus', detail: block, life: 4500 });
        return;
    }
    confirm.require({
        ...SAFE_CONFIRM,
        header: 'Hapus peran?',
        message: `Peran "${role.nm_role}" beserta seluruh hak aksesnya akan dihapus.`,
        acceptLabel: 'Hapus',
        rejectLabel: 'Batal',
        acceptProps: { severity: 'danger' },
        accept: async () => {
            deleting.value = true;
            try {
                await rbacService.deleteRole(role.kd_role);
                toast.add({ severity: 'success', summary: 'Peran dihapus', detail: `Peran "${role.nm_role}" berhasil dihapus`, life: 3000 });
                await load(false);
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal menghapus peran', detail: err.message || 'Coba lagi beberapa saat.', life: 4500 });
            } finally {
                deleting.value = false;
            }
        }
    });
}

function has(key) {
    return isSuper.value || current.value.has(key);
}

function toggle(key) {
    if (isSuper.value) return;
    const next = new Set(current.value);
    next.has(key) ? next.delete(key) : next.add(key);
    current.value = next;
}

function moduleKeys(mod) {
    return mod.actions.map((a) => `${mod.key}.${a.key}`);
}

function moduleState(mod) {
    const keys = moduleKeys(mod);
    const on = keys.filter(has).length;
    return on === 0 ? 'none' : on === keys.length ? 'all' : 'some';
}

function toggleModule(mod) {
    if (isSuper.value) return;
    const next = new Set(current.value);
    const turnOn = moduleState(mod) !== 'all';
    moduleKeys(mod).forEach((k) => (turnOn ? next.add(k) : next.delete(k)));
    current.value = next;
}

function discardChanges() {
    applyRole(selectedRole.value);
}

async function save() {
    saving.value = true;
    try {
        const updated = await rbacService.updateRole(selectedRole.value, { abilities: [...current.value] });
        const idx = roles.value.findIndex((r) => r.kd_role === updated.kd_role);
        if (idx >= 0) roles.value[idx] = updated;
        applyRole(updated.kd_role);
        await authService.getMenu({ force: true }).catch(() => {});
        toast.add({ severity: 'success', summary: 'Hak akses disimpan', detail: `Hak akses ${updated.nm_role} sudah diperbarui.`, life: 3000 });
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Hak akses gagal disimpan', detail: err.message, life: 4000 });
    } finally {
        saving.value = false;
    }
}

const selectedGroup = computed(() => groupOf(selectedRoleObj.value?.level)?.label);
const groupSaving = ref(false);

function changeGroup(label) {
    const role = selectedRoleObj.value;
    const group = ROLE_GROUPS.find((g) => g.label === label);
    if (!role || !group || label === selectedGroup.value) return;
    const run = async () => {
        groupSaving.value = true;
        try {
            const updated = await rbacService.updateRole(role.kd_role, { level: group.level });
            const idx = roles.value.findIndex((r) => r.kd_role === role.kd_role);
            if (idx >= 0) roles.value[idx] = { ...roles.value[idx], level: updated.level };
            toast.add({ severity: 'success', summary: 'Kelompok peran diubah', detail: `${role.nm_role} sekarang masuk kelompok ${label}.`, life: 3000 });
        } catch (err) {
            toast.add({ severity: 'error', summary: 'Kelompok peran gagal diubah', detail: err.message, life: 4000 });
        } finally {
            groupSaving.value = false;
        }
    };
    if (role.user_count > 0) {
        confirm.require({
            ...SAFE_CONFIRM,
            header: 'Ubah kelompok peran',
            message: `${role.nm_role} dipakai ${role.user_count} pengguna. Pindahkan ke kelompok ${label}?`,
            acceptLabel: 'Pindahkan',
            rejectLabel: 'Batal',
            accept: run
        });
    } else {
        run();
    }
}

const roleDialogVisible = ref(false);

function openCreate() {
    confirmDiscard(() => {
        roleDialogVisible.value = true;
    });
}

function handleRoleCreated(created) {
    roles.value.push(created);
    applyRole(created.kd_role);
}

onMounted(() => {
    window.addEventListener('beforeunload', warnBeforeUnload);
    load(false);
});
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload));
</script>

<template>
    <div class="space-y-6">
        <!-- Satu kartu: judul dan aksi, pemilih peran, lalu editor izin (acuan 00b §6.1, audit-025 #10). -->
        <div class="card !mb-0">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                        <PhShieldCheck :size="22" weight="regular" class="text-primary shrink-0" aria-hidden="true" />
                        <span>Manajemen Hak Akses</span>
                    </h1>
                    <p class="text-xs text-muted-color">Kelola peran dan izin fitur yang boleh dipakai setiap peran.</p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <Button severity="secondary" outlined size="small" class="font-semibold flex items-center gap-1.5 !min-h-11 sm:!min-h-9" :loading="loading" @click="confirmDiscard(() => load())">
                        <PhArrowsClockwise :size="14" weight="bold" aria-hidden="true" />
                        <span>Segarkan</span>
                    </Button>
                    <Button data-tour="perm-add-role" severity="secondary" outlined size="small" class="font-semibold flex items-center gap-1.5 !min-h-11 sm:!min-h-9" :disabled="loading || loadError" @click="openCreate">
                        <PhPlus :size="14" weight="bold" aria-hidden="true" />
                        <span>Tambah Peran</span>
                    </Button>
                    <Button data-tour="perm-save" severity="primary" size="small" class="font-semibold flex items-center gap-1.5 !min-h-11 sm:!min-h-9" :loading="saving" :disabled="isSuper || !isDirty" :title="isSuper ? 'Hak akses Super Admin tidak bisa diubah' : isDirty ? undefined : 'Belum ada perubahan untuk disimpan'" @click="save">
                        <PhFloppyDisk :size="14" weight="bold" aria-hidden="true" />
                        <span>Simpan Perubahan</span>
                    </Button>
                </div>
            </div>

            <div v-if="loadError" role="alert" class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                <span>Hak akses gagal dimuat. Peran dan izin belum bisa diubah.</span>
                <Button label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11" :loading="loading" @click="load(false)" />
            </div>

            <section data-tour="perm-roles" class="mt-6 border-t border-surface-200 dark:border-surface-700 pt-4">
                <div class="flex items-center justify-between mb-2">
                    <h2 class="text-sm font-bold text-surface-900 dark:text-surface-100">Pilih peran</h2>
                    <span class="text-xs text-muted-color">{{ loading || loadError ? '–' : roles.length }} peran</span>
                </div>
                <div class="divide-y divide-surface-200 dark:divide-surface-700">
                    <div v-for="group in roleGroups" :key="group.label" class="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-2 sm:gap-4 py-3">
                        <span class="text-xs font-semibold text-surface-600 dark:text-surface-400 sm:pt-2">{{ group.label }}</span>
                        <div class="flex flex-wrap gap-1.5">
                            <button
                                v-for="r in group.roles"
                                :key="r.kd_role"
                                type="button"
                                :title="`Kode role: ${r.kd_role}`"
                                :aria-pressed="selectedRole === r.kd_role"
                                :class="[
                                    'min-h-11 sm:min-h-9 px-3 rounded-border text-xs font-semibold transition-colors motion-reduce:transition-none cursor-pointer border inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                                    selectedRole === r.kd_role
                                        ? 'bg-primary text-primary-contrast border-primary'
                                        : 'bg-surface-0 dark:bg-surface-800 text-surface-700 dark:text-surface-200 border-surface-200 dark:border-surface-700 hover:border-primary hover:text-primary'
                                ]"
                                @click="selectRole(r.kd_role)"
                            >
                                <span>{{ r.nm_role }}</span>
                                <span v-if="duplicateNames.has(r.nm_role)" class="font-mono font-normal opacity-90">{{ r.kd_role }}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <section v-if="selectedRoleObj" class="mt-2 border-t border-surface-200 dark:border-surface-700 pt-4">
                <div data-tour="perm-role-header" class="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4">
                    <div class="min-w-0 space-y-2">
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h2 class="text-base font-bold text-surface-900 dark:text-surface-100">{{ selectedRoleObj.nm_role }}</h2>
                            <span class="text-xs text-muted-color">
                                {{ selectedRoleObj.user_count > 0 ? `Dipakai ${selectedRoleObj.user_count} pengguna` : 'Belum dipakai pengguna' }}
                            </span>
                            <span v-if="isDirty" class="text-xs font-semibold text-(--status-warn-fg)">Belum disimpan</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="h-1.5 w-40 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden" aria-hidden="true">
                                <div class="h-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" :style="{ width: `${allKeys.length ? (activeCount / allKeys.length) * 100 : 0}%` }" />
                            </div>
                            <span class="text-xs text-muted-color">{{ activeCount }} dari {{ allKeys.length }} izin aktif</span>
                        </div>
                        <div v-if="!isSuper" class="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <Button
                                size="small"
                                severity="danger"
                                text
                                class="text-xs font-semibold flex items-center gap-1.5 !min-h-11 sm:!min-h-9 -ml-3 !text-(--status-danger-fg)"
                                :loading="deleting"
                                :disabled="Boolean(deleteBlock)"
                                :aria-describedby="deleteBlock ? 'perm-delete-block' : undefined"
                                @click="removeRole"
                            >
                                <PhTrash :size="14" weight="bold" aria-hidden="true" />
                                <span>Hapus Peran</span>
                            </Button>
                            <p v-if="deleteBlock" id="perm-delete-block" class="text-xs text-surface-600 dark:text-surface-400">Tidak bisa dihapus: {{ deleteBlock }}</p>
                        </div>
                    </div>

                    <p v-if="isSuper" class="shrink-0 md:max-w-sm text-xs text-surface-700 dark:text-surface-300 flex items-start gap-2">
                        <PhLock :size="14" weight="bold" class="shrink-0 mt-0.5 text-primary" aria-hidden="true" />
                        <span>Admin Super App otomatis punya semua akses. Hak akses hanya untuk dilihat.</span>
                    </p>
                    <div v-else data-tour="perm-group" class="shrink-0">
                        <div class="flex items-center gap-2">
                            <label for="role-group" class="text-xs font-semibold text-surface-700 dark:text-surface-300">Kelompok peran</label>
                            <Select
                                :modelValue="selectedGroup"
                                inputId="role-group"
                                :options="groupOptions"
                                optionLabel="label"
                                optionValue="value"
                                size="small"
                                class="w-44 !min-h-11 sm:!min-h-9"
                                :loading="groupSaving"
                                :disabled="groupSaving"
                                aria-describedby="role-group-help"
                                @update:modelValue="changeGroup"
                            />
                        </div>
                        <p id="role-group-help" class="mt-1 text-xs text-surface-600 dark:text-surface-400 md:text-right">Tersimpan langsung saat dipilih.</p>
                    </div>
                </div>

                <div data-tour="perm-matrix" class="grid grid-cols-1 lg:grid-cols-2 gap-px bg-surface-200 dark:bg-surface-700 border-y border-surface-200 dark:border-surface-700">
                    <fieldset v-for="mod in catalog" :key="mod.key" class="bg-(--p-content-background) py-4 lg:odd:pr-5 lg:even:pl-5">
                        <legend class="sr-only">{{ mod.label }}</legend>
                        <div class="flex items-center justify-between gap-3 mb-2">
                            <h3 class="text-sm font-bold text-surface-900 dark:text-surface-100">{{ mod.label }}</h3>
                            <button
                                v-if="!isSuper"
                                type="button"
                                class="min-h-11 sm:min-h-9 px-2 -mr-2 rounded-border text-xs font-semibold text-surface-700 dark:text-surface-300 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                :aria-label="moduleState(mod) === 'all' ? `Kosongkan izin ${mod.label}` : `Pilih semua izin ${mod.label}`"
                                @click="toggleModule(mod)"
                            >
                                {{ moduleState(mod) === 'all' ? 'Kosongkan modul' : 'Pilih semua' }}
                            </button>
                        </div>
                        <ul class="space-y-0.5">
                            <li v-for="act in mod.actions" :key="act.key">
                                <label
                                    class="flex items-center gap-3 rounded-border px-2 py-1.5 -mx-2 text-sm text-surface-800 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800/50"
                                    :class="isSuper ? 'cursor-default' : 'cursor-pointer'"
                                >
                                    <input
                                        :id="`izin-${mod.key}-${act.key}`"
                                        :name="`${mod.key}.${act.key}`"
                                        type="checkbox"
                                        class="size-4 accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                                        :checked="has(`${mod.key}.${act.key}`)"
                                        :disabled="isSuper"
                                        @change="toggle(`${mod.key}.${act.key}`)"
                                    />
                                    {{ act.label }}
                                </label>
                            </li>
                        </ul>
                    </fieldset>
                </div>

                <!-- Bilah simpan lengket saat ada perubahan, agar tetap terlihat di modul bawah (audit-025 #7). -->
                <div
                    v-if="isDirty"
                    class="sticky bottom-0 z-10 -mx-4 sm:-mx-8 mt-4 px-4 sm:px-8 py-3 bg-(--p-content-background) border-t border-surface-200 dark:border-surface-700 flex flex-wrap items-center justify-between gap-3"
                >
                    <p class="text-sm text-surface-800 dark:text-surface-200" aria-live="polite">
                        <span class="font-semibold text-(--status-warn-fg)">{{ changedCount }} perubahan</span> belum disimpan untuk {{ selectedRoleObj.nm_role }}.
                    </p>
                    <div class="flex items-center gap-2">
                        <Button label="Batalkan" severity="secondary" text size="small" class="!min-h-11 sm:!min-h-9" :disabled="saving" @click="discardChanges" />
                        <Button severity="primary" size="small" class="font-semibold flex items-center gap-1.5 !min-h-11 sm:!min-h-9" :loading="saving" @click="save">
                            <PhFloppyDisk :size="14" weight="bold" aria-hidden="true" />
                            <span>Simpan Perubahan</span>
                        </Button>
                    </div>
                </div>
            </section>
        </div>

        <RoleFormDialog
            v-model:visible="roleDialogVisible"
            :roles="roles"
            @created="handleRoleCreated"
        />
    </div>
</template>
