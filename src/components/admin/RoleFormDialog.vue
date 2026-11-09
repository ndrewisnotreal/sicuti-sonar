<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useToast } from 'primevue/usetoast';
import { rbacService } from '@/service/rbacService';

const ROLE_GROUPS = [
    { label: 'Super admin', match: (l) => l <= 0 },
    { label: 'Admin', level: 10, match: (l) => l > 0 && l <= 15 },
    { label: 'Kepala / atasan', level: 30, match: (l) => l > 15 && l <= 35 },
    { label: 'Approval', level: 40, match: (l) => l > 35 && l <= 50 },
    { label: 'Karyawan', level: 90, match: (l) => l > 50 }
];
const groupOf = (level) => ROLE_GROUPS.find((g) => g.match(Number(level ?? 90)));

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    roles: {
        type: Array,
        default: () => []
    }
});

const emit = defineEmits(['update:visible', 'created']);
const toast = useToast();

const roleName = ref('');
const copyFrom = ref(null);
const saving = ref(false);
// Kesalahan validasi di bawah field, bukan toast (DESIGN.md bagian Form, audit-025 #5).
const nameError = ref('');

const copyOptions = computed(() =>
    (props.roles || [])
        .filter((r) => !r.is_super)
        .map((r) => ({ label: r.nm_role, value: r.kd_role }))
);
const copySource = computed(() => (props.roles || []).find((r) => r.kd_role === copyFrom.value));

watch(
    () => props.visible,
    (val) => {
        if (val) {
            roleName.value = '';
            copyFrom.value = null;
            saving.value = false;
            nameError.value = '';
        }
    }
);

async function submitRoleDialog() {
    const name = roleName.value.trim();
    if (!name) {
        nameError.value = 'Nama peran wajib diisi';
        await nextTick();
        document.getElementById('role-name')?.focus();
        return;
    }
    nameError.value = '';
    saving.value = true;
    try {
        const source = copySource.value;
        const created = await rbacService.createRole({
            nm_role: name,
            abilities: source?.abilities || [],
            level: source?.level
        });
        toast.add({
            severity: 'success',
            summary: 'Peran ditambahkan',
            detail: `Peran ${created.nm_role} siap diatur hak aksesnya.`,
            life: 3000
        });
        emit('update:visible', false);
        emit('created', created);
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Peran gagal disimpan', detail: err.message, life: 4000 });
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <Dialog
        :visible="visible"
        modal
        header="Tambah Peran"
        :style="{ width: '420px' }"
        :breakpoints="{ '640px': '92vw' }"
        @update:visible="emit('update:visible', $event)"
    >
        <form class="space-y-4 pt-1 text-sm" @submit.prevent="submitRoleDialog">
            <div>
                <label for="role-name" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                    Nama peran <span class="text-(--status-danger-fg)" aria-hidden="true">*</span>
                </label>
                <InputText
                    id="role-name"
                    v-model="roleName"
                    class="w-full"
                    placeholder="Contoh: Staff HRD"
                    autofocus
                    aria-required="true"
                    :invalid="Boolean(nameError)"
                    :aria-invalid="Boolean(nameError)"
                    :aria-describedby="nameError ? 'role-name-error' : undefined"
                    @input="nameError = ''"
                />
                <p v-if="nameError" id="role-name-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ nameError }}</p>
            </div>
            <div>
                <label for="role-copy" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Salin hak akses dari</label>
                <Select
                    v-model="copyFrom"
                    inputId="role-copy"
                    :options="copyOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Mulai dari kosong"
                    showClear
                    fluid
                    aria-describedby="role-copy-help"
                />
                <p id="role-copy-help" class="text-xs text-surface-600 dark:text-surface-400 mt-1">
                    {{
                        copySource
                            ? `Kelompok peran ikut ${copySource.nm_role} (${groupOf(copySource.level)?.label}).`
                            : 'Tanpa salinan, peran masuk kelompok Karyawan. Kelompok bisa diubah setelah peran dibuat.'
                    }}
                </p>
            </div>
            <div class="flex justify-end gap-2 pt-2">
                <Button type="button" label="Batal" severity="secondary" text size="small" @click="emit('update:visible', false)" />
                <Button type="submit" label="Tambah Peran" size="small" class="font-semibold" :loading="saving" />
            </div>
        </form>
    </Dialog>
</template>
