<script setup>
import { ref, computed, watch } from 'vue';
import { adminService } from '@/service/adminService';
import { useToast } from 'primevue/usetoast';
import { passwordChecks, passwordProblem } from '@/utils/passwordRules';
import { PhCheck, PhX } from '@phosphor-icons/vue';

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

const newPassword = ref('');
const confirmPassword = ref('');
const saving = ref(false);
const errorMsg = ref('');

const checks = computed(() => passwordChecks(newPassword.value));
const isPasswordValid = computed(() => !passwordProblem(newPassword.value));
const isMatch = computed(() => newPassword.value && newPassword.value === confirmPassword.value);
const mismatch = computed(() => Boolean(confirmPassword.value) && !isMatch.value);

watch(
    () => props.visible,
    (val) => {
        if (val) {
            newPassword.value = '';
            confirmPassword.value = '';
            errorMsg.value = '';
        }
    }
);

function close() {
    emit('update:visible', false);
}

async function handleReset() {
    errorMsg.value = '';
    const problem = passwordProblem(newPassword.value);
    if (problem) {
        errorMsg.value = problem;
        return;
    }
    if (newPassword.value !== confirmPassword.value) {
        errorMsg.value = 'Konfirmasi kata sandi tidak cocok.';
        return;
    }
    if (!props.user?.uid_user_system) {
        errorMsg.value = 'Data pengguna tidak valid.';
        return;
    }

    saving.value = true;
    try {
        await adminService.updateUser({
            uid_user_system: props.user.uid_user_system,
            password: newPassword.value
        });
        toast.add({
            severity: 'success',
            summary: 'Kata Sandi Diperbarui',
            detail: `Kata sandi untuk ${props.user.nama || props.user.username} berhasil diatur ulang`,
            life: 3000
        });
        emit('saved');
        close();
    } catch (err) {
        errorMsg.value = err.message || 'Gagal mengatur ulang kata sandi';
        toast.add({
            severity: 'error',
            summary: 'Gagal',
            detail: errorMsg.value,
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
        header="Atur Ulang Kata Sandi"
        :style="{ width: '440px' }"
        :breakpoints="{ '640px': '92vw' }"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="space-y-4 pt-1 text-sm">
            <p class="text-surface-700 dark:text-surface-300">
                Atur kata sandi baru untuk
                <strong class="text-surface-900 dark:text-surface-100 font-semibold">{{ user?.nama || user?.username }}</strong>
                ({{ user?.namecode || user?.username }}).
            </p>

            <!-- Label terhubung; syarat dan kesalahan dibacakan lewat aria-describedby (audit-024 #3). -->
            <div>
                <label for="reset-new" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Kata sandi baru <span class="text-(--status-danger-fg)" aria-hidden="true">*</span></label>
                <InputText id="reset-new" v-model="newPassword" type="password" class="w-full" autocomplete="new-password" aria-required="true" aria-describedby="reset-rules" />
            </div>

            <div>
                <label for="reset-confirm" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Konfirmasi kata sandi baru <span class="text-(--status-danger-fg)" aria-hidden="true">*</span></label>
                <InputText
                    id="reset-confirm"
                    v-model="confirmPassword"
                    type="password"
                    class="w-full"
                    autocomplete="new-password"
                    aria-required="true"
                    :invalid="mismatch"
                    :aria-invalid="mismatch"
                    :aria-describedby="mismatch ? 'reset-mismatch' : undefined"
                />
                <p v-if="mismatch" id="reset-mismatch" class="mt-1 text-xs text-(--status-danger-fg)">Konfirmasi kata sandi tidak cocok.</p>
            </div>

            <!-- Daftar syarat tanpa kotak; warna netral dengan ikon, hijau hanya untuk syarat terpenuhi (audit-024 #4, #8). -->
            <div id="reset-rules" aria-live="polite">
                <p class="text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Syarat kata sandi</p>
                <ul class="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <li v-for="c in checks" :key="c.label" class="flex items-center gap-1.5" :class="c.ok ? 'text-(--status-success-fg)' : 'text-surface-600 dark:text-surface-400'">
                        <PhCheck v-if="c.ok" :size="14" weight="bold" aria-hidden="true" />
                        <PhX v-else :size="14" weight="bold" aria-hidden="true" />
                        <span>{{ c.label }}<span class="sr-only">{{ c.ok ? ': terpenuhi' : ': belum' }}</span></span>
                    </li>
                </ul>
            </div>

            <p v-if="errorMsg" role="alert" class="text-xs text-(--status-danger-fg)">{{ errorMsg }}</p>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2 pt-2">
                <Button label="Batal" severity="secondary" size="small" text @click="close" />
                <Button
                    label="Simpan Kata Sandi"
                    severity="primary"
                    size="small"
                    class="font-semibold"
                    :loading="saving"
                    :disabled="!isPasswordValid || !isMatch"
                    @click="handleReset"
                />
            </div>
        </template>
    </Dialog>
</template>
