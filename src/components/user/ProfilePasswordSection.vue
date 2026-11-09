<script setup>
import { computed } from 'vue';
import { PhCheck, PhCircle } from '@phosphor-icons/vue';
import { passwordChecks as checkPassword } from '@/utils/passwordRules';

const props = defineProps({
    modelValue: {
        type: Object,
        required: true,
        default: () => ({
            newPassword: '',
            confirmPassword: '',
            currentPassword: ''
        })
    },
    // Pesan kesalahan per field dari Profile saat simpan (audit-031 #3).
    errors: {
        type: Object,
        default: () => ({})
    }
});

const emit = defineEmits(['update:modelValue']);

const newPassword = computed({
    get: () => props.modelValue.newPassword || '',
    set: (val) => emit('update:modelValue', { ...props.modelValue, newPassword: val })
});

const confirmPassword = computed({
    get: () => props.modelValue.confirmPassword || '',
    set: (val) => emit('update:modelValue', { ...props.modelValue, confirmPassword: val })
});

const currentPassword = computed({
    get: () => props.modelValue.currentPassword || '',
    set: (val) => emit('update:modelValue', { ...props.modelValue, currentPassword: val })
});

const passwordChecks = computed(() => checkPassword(newPassword.value));
const passwordStarted = computed(() => Boolean(newPassword.value || confirmPassword.value));
const passwordMismatch = computed(() => Boolean(confirmPassword.value) && confirmPassword.value !== newPassword.value);
const confirmError = computed(() => (passwordMismatch.value ? 'Belum sama dengan kata sandi baru.' : props.errors.confirmPassword || ''));
const pt = (field, error) => ({ pcInputText: { root: { 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': error ? `${field}-error` : undefined } } });
</script>

<template>
    <div class="space-y-3 pt-4 border-t border-surface-200 dark:border-surface-700">
        <h2 class="text-sm font-semibold text-surface-900 dark:text-surface-100">Ubah kata sandi <span class="font-normal text-muted-color">(opsional)</span></h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
                <label for="profile-new-password" class="block font-medium text-surface-700 dark:text-surface-300 mb-1">
                    Kata sandi baru
                </label>
                <Password
                    v-model="newPassword"
                    inputId="profile-new-password"
                    :feedback="false"
                    toggleMask
                    fluid
                    autocomplete="new-password"
                    placeholder="Kata sandi baru"
                    :invalid="Boolean(errors.newPassword)"
                    :pt="pt('profile-new-password', errors.newPassword)"
                    class="text-xs"
                />
                <p v-if="errors.newPassword" id="profile-new-password-error" class="text-xs text-(--status-danger-fg) mt-1">{{ errors.newPassword }}</p>
            </div>
            <div>
                <label for="profile-confirm-password" class="block font-medium text-surface-700 dark:text-surface-300 mb-1">
                    Konfirmasi kata sandi baru
                </label>
                <Password
                    v-model="confirmPassword"
                    inputId="profile-confirm-password"
                    :feedback="false"
                    toggleMask
                    fluid
                    autocomplete="new-password"
                    placeholder="Ulangi kata sandi baru"
                    :invalid="Boolean(confirmError)"
                    :pt="pt('profile-confirm-password', confirmError)"
                    class="text-xs"
                />
                <p v-if="confirmError" id="profile-confirm-password-error" class="text-xs text-(--status-danger-fg) mt-1">{{ confirmError }}</p>
            </div>
        </div>

        <template v-if="passwordStarted">
            <ul class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs" aria-label="Syarat kata sandi">
                <li
                    v-for="c in passwordChecks"
                    :key="c.label"
                    class="flex items-center gap-1.5"
                    :class="c.ok ? 'text-(--status-success-fg)' : 'text-muted-color'"
                >
                    <PhCheck v-if="c.ok" :size="14" weight="bold" aria-hidden="true" />
                    <PhCircle v-else :size="14" weight="bold" aria-hidden="true" />
                    {{ c.label }}<span class="sr-only">{{ c.ok ? ': terpenuhi' : ': belum' }}</span>
                </li>
            </ul>
            <div class="sm:max-w-[calc(50%-0.375rem)] pt-1">
                <label for="profile-current-password" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">
                    Kata sandi saat ini <span class="text-(--status-danger-fg)" aria-hidden="true">*</span>
                </label>
                <Password
                    v-model="currentPassword"
                    inputId="profile-current-password"
                    :feedback="false"
                    toggleMask
                    fluid
                    autocomplete="current-password"
                    placeholder="Untuk konfirmasi"
                    :invalid="Boolean(errors.currentPassword)"
                    :pt="pt('profile-current-password', errors.currentPassword)"
                    class="text-xs"
                />
                <p v-if="errors.currentPassword" id="profile-current-password-error" class="text-xs text-(--status-danger-fg) mt-1">{{ errors.currentPassword }}</p>
                <p v-else class="text-xs text-muted-color mt-1">Diperlukan untuk mengganti kata sandi.</p>
            </div>
        </template>
        <p v-else class="text-xs text-muted-color">
            Minimal 8 karakter dengan kombinasi huruf besar, angka, dan simbol.
        </p>
    </div>
</template>
