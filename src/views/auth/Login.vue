<script setup>
import { publicPath } from '@/utils/publicPath';
import { computed, ref, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import api, { LOGOUT_NOTICE_KEY } from '@/service/api';
import { login } from '@/service/sicutiService';
import { useLayout } from '@/layout/composables/layout';
import { useToast } from 'primevue/usetoast';
import { PhUser, PhSignIn, PhKey, PhSun, PhMoon, PhCheck, PhCircle } from '@phosphor-icons/vue';
import { passwordChecks, passwordProblem } from '@/utils/passwordRules';

const router = useRouter();
const toast = useToast();
const { isDarkTheme, toggleDarkMode } = useLayout();

const identifier = ref('');
const password = ref('');
const errorMessage = ref('');
try {
    errorMessage.value = sessionStorage.getItem(LOGOUT_NOTICE_KEY) || '';
    sessionStorage.removeItem(LOGOUT_NOTICE_KEY);
} catch {}
const submitting = ref(false);
// Kesalahan isian ditulis di bawah field; errorMessage untuk galat server/sesi (audit-032 #2).
const fieldErrors = ref({});

const expired = ref(null);
const newPassword = ref('');
const confirmPassword = ref('');

// Pesan field hilang begitu field itu diisi ulang.
const clearOn = (source, id) => watch(source, () => delete fieldErrors.value[id]);
clearOn(identifier, 'login-id');
clearOn(password, 'login-password');
clearOn(newPassword, 'expired-new');
clearOn(confirmPassword, 'expired-confirm');

function focusFirstError(order) {
    const first = order.find((id) => fieldErrors.value[id]);
    if (first) nextTick(() => document.getElementById(first)?.focus());
    return Boolean(first);
}

async function handleLogin() {
    errorMessage.value = '';
    const cleanId = identifier.value.trim();
    const cleanPass = password.value.trim();

    fieldErrors.value = {};
    if (!cleanId) fieldErrors.value['login-id'] = 'Isi NIK atau email Anda.';
    if (!cleanPass) fieldErrors.value['login-password'] = 'Isi kata sandi Anda.';
    if (focusFirstError(['login-id', 'login-password'])) return;

    submitting.value = true;
    const res = await login(cleanId, cleanPass);
    submitting.value = false;
    if (res.success) {
        sessionStorage.setItem('sct_just_logged_in', 'true');
        sessionStorage.setItem('sct_login_user', JSON.stringify({ name: res.user.name }));
        toast.add({
            severity: 'success',
            summary: 'Login Berhasil',
            detail: `Selamat datang, ${res.user.name}`,
            life: 3000
        });
        await router.push('/');
    } else if (res.code === 'PASSWORD_EXPIRED' && res.data?.Token_login_API) {
        expired.value = { id_user: res.data.id_user, token: res.data.Token_login_API, passwordLama: cleanPass };
        newPassword.value = '';
        confirmPassword.value = '';
    } else {
        errorMessage.value = res.message || 'Login gagal. Periksa NIK/email dan kata sandi.';
    }
}

const expiredChecks = computed(() => passwordChecks(newPassword.value));
const invalidAttrs = (id) => (fieldErrors.value[id] ? { 'aria-invalid': 'true', 'aria-describedby': `${id}-error` } : {});

async function handleExpiredChange() {
    errorMessage.value = '';
    fieldErrors.value = {};
    if (!newPassword.value) fieldErrors.value['expired-new'] = 'Isi kata sandi baru.';
    else if (passwordProblem(newPassword.value)) fieldErrors.value['expired-new'] = passwordProblem(newPassword.value);
    if (!confirmPassword.value) fieldErrors.value['expired-confirm'] = 'Ulangi kata sandi baru.';
    else if (newPassword.value !== confirmPassword.value) fieldErrors.value['expired-confirm'] = 'Belum sama dengan kata sandi baru.';
    if (focusFirstError(['expired-new', 'expired-confirm'])) return;
    submitting.value = true;
    try {
        await api.post('/auth/expired', {
            id_user: expired.value.id_user,
            password_lama: expired.value.passwordLama,
            password_baru: newPassword.value,
            Token_login_API: expired.value.token
        });
        toast.add({ severity: 'success', summary: 'Kata sandi diperbarui', detail: 'Kata sandi baru sudah aktif.', life: 3000 });
        const res = await login(identifier.value.trim(), newPassword.value);
        expired.value = null;
        password.value = '';
        if (res.success) {
            sessionStorage.setItem('sct_just_logged_in', 'true');
            sessionStorage.setItem('sct_login_user', JSON.stringify({ name: res.user.name }));
            await router.push('/');
        } else {
            errorMessage.value = 'Kata sandi sudah diganti. Silakan masuk dengan kata sandi baru.';
        }
    } catch (err) {
        const msg = err.data?.error || err.message || 'Kata sandi baru belum bisa disimpan.';
        if (/token|login ulang/i.test(msg)) cancelExpired(`${msg.replace(/Token_login_API/g, 'sesi')}`);
        else errorMessage.value = msg;
    } finally {
        submitting.value = false;
    }
}

function cancelExpired(message = '') {
    expired.value = null;
    fieldErrors.value = {};
    password.value = '';
    errorMessage.value = message;
}
</script>

<template>
    <div class="min-h-screen flex flex-col items-center justify-center p-4 relative bg-surface-50 dark:bg-surface-950 overflow-hidden">
        <!-- Foto pabrik = identitas INALUM; cukup digelapkan, tanpa blur berlapis (audit-032 #5). -->
        <div class="absolute inset-0 bg-cover bg-center" :style="{ backgroundImage: `url('${publicPath('assets/Pabrik-INALUM.jpg')}')` }"></div>
        <div :class="['absolute inset-0', isDarkTheme ? 'bg-black/60' : 'bg-slate-900/40']"></div>

        <div class="absolute top-4 right-4 z-20">
            <button
                type="button"
                @click="toggleDarkMode($event)"
                class="min-w-11 min-h-11 sm:min-w-9 sm:min-h-9 rounded-border flex items-center justify-center bg-surface-0 dark:bg-surface-900 hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-200 shadow-sm transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                :aria-label="isDarkTheme ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'"
                :title="isDarkTheme ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'"
            >
                <PhSun v-if="isDarkTheme" :size="16" weight="bold" aria-hidden="true" />
                <PhMoon v-else :size="16" weight="bold" aria-hidden="true" />
            </button>
        </div>

        <div class="relative z-10 w-full max-w-md bg-surface-0 dark:bg-surface-900 rounded-xl p-6 sm:p-8 shadow-xl">
            <div class="text-center mb-6">
                <img :src="publicPath('logo-inalum.png')" alt="Logo PT INALUM" class="h-16 w-auto object-contain mx-auto mb-3" />
                <h1 class="text-2xl font-bold text-primary leading-tight">Lebur</h1>
                <p class="text-xs text-muted-color mt-1">Sistem Manajemen Cuti Digital · PT INALUM</p>
            </div>

            <div v-if="errorMessage" role="alert" class="mb-4 px-3 py-2 rounded-border text-sm leading-relaxed bg-(--status-danger-bg) text-(--status-danger-fg)">
                {{ errorMessage }}
            </div>

            <form v-if="expired" novalidate @submit.prevent="handleExpiredChange" class="space-y-4 text-sm">
                <div class="px-3 py-2 rounded-border text-sm leading-relaxed bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                    <p class="font-semibold mb-0.5">Kata sandi sudah kedaluwarsa</p>
                    <p>Kata sandi akun {{ identifier.trim() }} sudah dipakai lebih dari 90 hari. Buat kata sandi baru untuk melanjutkan.</p>
                </div>
                <div>
                    <label for="expired-new" class="block font-semibold text-surface-700 dark:text-surface-300 mb-1 text-sm">Kata sandi baru</label>
                    <Password
                        v-model="newPassword"
                        inputId="expired-new"
                        :feedback="false"
                        toggleMask
                        fluid
                        autocomplete="new-password"
                        :invalid="Boolean(fieldErrors['expired-new'])"
                        :pt="{ pcInputText: { root: { class: '!min-h-11', ...invalidAttrs('expired-new') } } }"
                    />
                    <p v-if="fieldErrors['expired-new']" id="expired-new-error" class="text-xs text-(--status-danger-fg) mt-1">{{ fieldErrors['expired-new'] }}</p>
                    <ul class="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs" aria-label="Syarat kata sandi">
                        <li v-for="c in expiredChecks" :key="c.label" class="flex items-center gap-1.5" :class="c.ok ? 'text-(--status-success-fg)' : 'text-muted-color'">
                            <PhCheck v-if="c.ok" :size="14" weight="bold" aria-hidden="true" />
                            <PhCircle v-else :size="14" weight="bold" aria-hidden="true" />
                            {{ c.label }}<span class="sr-only">{{ c.ok ? ': terpenuhi' : ': belum' }}</span>
                        </li>
                    </ul>
                    <p class="text-xs text-muted-color mt-1">Tidak boleh sama dengan 3 kata sandi terakhir.</p>
                </div>
                <div>
                    <label for="expired-confirm" class="block font-semibold text-surface-700 dark:text-surface-300 mb-1 text-sm">Ulangi kata sandi baru</label>
                    <Password
                        v-model="confirmPassword"
                        inputId="expired-confirm"
                        :feedback="false"
                        toggleMask
                        fluid
                        autocomplete="new-password"
                        :invalid="Boolean(fieldErrors['expired-confirm'])"
                        :pt="{ pcInputText: { root: { class: '!min-h-11', ...invalidAttrs('expired-confirm') } } }"
                    />
                    <p v-if="fieldErrors['expired-confirm']" id="expired-confirm-error" class="text-xs text-(--status-danger-fg) mt-1">{{ fieldErrors['expired-confirm'] }}</p>
                </div>
                <div class="flex gap-2">
                    <Button type="button" label="Batal" severity="secondary" outlined class="text-sm !min-h-11" @click="cancelExpired()" />
                    <Button type="submit" class="flex-1 justify-center text-sm font-semibold gap-2 !min-h-11" :loading="submitting">
                        <PhKey :size="16" weight="bold" aria-hidden="true" />
                        <span>Simpan &amp; Masuk</span>
                    </Button>
                </div>
            </form>

            <form v-else novalidate @submit.prevent="handleLogin" class="space-y-4 text-sm">
                <div>
                    <label for="login-id" class="block font-semibold text-surface-700 dark:text-surface-300 mb-1 text-sm">NIK atau email</label>
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon>
                            <PhUser :size="16" weight="bold" aria-hidden="true" class="text-muted-color" />
                        </InputIcon>
                        <InputText
                            id="login-id"
                            v-model="identifier"
                            type="text"
                            autocomplete="username"
                            class="w-full !min-h-11"
                            :invalid="Boolean(fieldErrors['login-id'])"
                            v-bind="invalidAttrs('login-id')"
                        />
                    </IconField>
                    <p v-if="fieldErrors['login-id']" id="login-id-error" class="text-xs text-(--status-danger-fg) mt-1">{{ fieldErrors['login-id'] }}</p>
                </div>

                <div>
                    <label for="login-password" class="block font-semibold text-surface-700 dark:text-surface-300 mb-1 text-sm">Kata sandi</label>
                    <Password
                        v-model="password"
                        inputId="login-password"
                        :feedback="false"
                        toggleMask
                        fluid
                        autocomplete="current-password"
                        :invalid="Boolean(fieldErrors['login-password'])"
                        :pt="{ pcInputText: { root: { class: '!min-h-11', ...invalidAttrs('login-password') } } }"
                    />
                    <p v-if="fieldErrors['login-password']" id="login-password-error" class="text-xs text-(--status-danger-fg) mt-1">{{ fieldErrors['login-password'] }}</p>
                    <!-- Tautan setinggi target sentuh, di bawah field agar urutan Tab: NIK → kata sandi → lupa → Masuk (audit-032 #1). -->
                    <router-link to="/auth/forgot-password" class="inline-flex items-center min-h-11 sm:min-h-9 text-sm text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-border">Lupa kata sandi?</router-link>
                </div>

                <Button type="submit" class="w-full justify-center text-sm font-semibold gap-2 !min-h-11" :loading="submitting">
                    <PhSignIn :size="16" weight="bold" aria-hidden="true" />
                    <span>Masuk</span>
                </Button>
            </form>
        </div>
    </div>
</template>
