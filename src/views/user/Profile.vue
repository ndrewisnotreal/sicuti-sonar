<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { currentUser, persistCurrentUser } from '@/service/sicutiService';
import { authService } from '@/service/authService';
import api, { assetUrl } from '@/service/api';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { PhFloppyDisk, PhX } from '@phosphor-icons/vue';
import { passwordChecks as checkPassword } from '@/utils/passwordRules';
import ProfileAvatarSection from '@/components/user/ProfileAvatarSection.vue';
import ProfilePasswordSection from '@/components/user/ProfilePasswordSection.vue';
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();
const profile = ref(null);
const saving = ref(false);
const loadError = ref(false);
const errors = ref({});
let confirming = false;

const form = ref({
    email: '',
    phone: '',
    newPassword: '',
    confirmPassword: '',
    currentPassword: ''
});

const pendingPhoto = ref(null);
const pendingPreview = ref('');
const removePhoto = ref(false);

const view = computed(() => {
    const p = profile.value || {};
    const u = currentUser.value || {};
    const savedPhoto = assetUrl(p.foto_profil ?? u.foto_profil);
    return {
        name: p.nama || u.name || '-',
        username: p.username || u.username || '-',
        nip: p.nip || p.namecode || u.namecode || '-',
        deptCode: p.kd_dept || u.department || '-',
        deptName: p.nm_dept || u.departmentName || '',
        position: p.position || u.position || '',
        roleName: p.nm_role || u.roleName || u.role || '-',
        email: p.email ?? u.email ?? '',
        phone: p.no_hp ?? u.phone ?? u.no_hp ?? '',
        photo: pendingPreview.value || (removePhoto.value ? null : savedPhoto),
        hasSavedPhoto: Boolean(savedPhoto)
    };
});

const userInitials = computed(() => {
    const name = view.value.name;
    if (!name || name === '-') return 'U';
    return name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
});

const contactChanged = computed(
    () => form.value.email.trim() !== (view.value.email || '') || form.value.phone.trim() !== (view.value.phone || '')
);
const photoChanged = computed(() => Boolean(pendingPhoto.value) || removePhoto.value);
const passwordStarted = computed(() => Boolean(form.value.newPassword || form.value.confirmPassword));
const isDirty = computed(() => contactChanged.value || photoChanged.value || passwordStarted.value);

const passwordChecks = computed(() => checkPassword(form.value.newPassword));

async function loadProfile() {
    loadError.value = false;
    try {
        const res = await api.get('/master/user/profile');
        profile.value = res?.data || null;
    } catch {
        // Gagal muat tidak diam-diam: isian berasal dari sesi login (audit-031 #2).
        loadError.value = true;
        profile.value = null;
    }
}

async function retryLoad() {
    await loadProfile();
    if (!loadError.value) {
        syncSessionUser();
        resetForm();
    }
}

function resetForm() {
    form.value = {
        email: view.value.email || '',
        phone: view.value.phone || '',
        newPassword: '',
        confirmPassword: '',
        currentPassword: ''
    };
}

function cancelChanges() {
    clearPendingPhoto();
    removePhoto.value = false;
    errors.value = {};
    resetForm();
}

function leave() {
    cancelChanges();
    if (window.history.state?.back) {
        router.back();
    } else {
        router.push('/');
    }
}

// Perubahan yang belum disimpan tidak hilang diam-diam lewat Esc, klik luar, atau Batal (audit-031 #4).
function handleClose() {
    if (confirming || saving.value) return;
    if (!isDirty.value) return leave();
    confirming = true;
    confirm.require({
        header: 'Buang perubahan?',
        message: 'Perubahan profil yang belum disimpan akan hilang.',
        acceptLabel: 'Buang perubahan',
        rejectLabel: 'Lanjut mengedit',
        acceptProps: { severity: 'danger' },
        rejectProps: { severity: 'secondary', outlined: true },
        defaultFocus: 'reject',
        accept: leave,
        onHide: () => {
            confirming = false;
        }
    });
}

function handleKeyDown(event) {
    if (event.key === 'Escape' && !confirming) {
        handleClose();
    }
}

function clearPendingPhoto() {
    if (pendingPreview.value) URL.revokeObjectURL(pendingPreview.value);
    pendingPhoto.value = null;
    pendingPreview.value = '';
}

function onPhotoSelected(file) {
    clearPendingPhoto();
    pendingPhoto.value = file;
    pendingPreview.value = URL.createObjectURL(file);
    removePhoto.value = false;
}

function onCancelPhoto() {
    clearPendingPhoto();
}

function onRemovePhoto() {
    clearPendingPhoto();
    removePhoto.value = true;
}

function syncSessionUser() {
    if (!currentUser.value || !profile.value) return;
    const p = profile.value;
    Object.assign(currentUser.value, { email: p.email || '', phone: p.no_hp || '', no_hp: p.no_hp || '', foto_profil: p.foto_profil || null });
    persistCurrentUser();
}

// Pesan field hilang begitu field itu diubah.
watch(
    () => ({ ...form.value }),
    (now, before) => {
        for (const k of Object.keys(errors.value)) if (now[k] !== before[k]) delete errors.value[k];
    }
);

const FIELD_IDS = { email: 'profile-email', newPassword: 'profile-new-password', confirmPassword: 'profile-confirm-password', currentPassword: 'profile-current-password' };

// Kesalahan ditulis di bawah field dan fokus pindah ke field pertama yang salah, bukan toast (audit-031 #3).
function validate() {
    const e = {};
    const email = form.value.email.trim();
    if (!email) e.email = 'Isi alamat email untuk menerima notifikasi cuti.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Format email belum benar, contoh nama@inalum.co.id.';
    if (passwordStarted.value) {
        const failed = passwordChecks.value.find((c) => !c.ok);
        if (failed) e.newPassword = `Belum memenuhi syarat: ${failed.label.toLowerCase()}.`;
        if (form.value.newPassword !== form.value.confirmPassword) e.confirmPassword = 'Belum sama dengan kata sandi baru.';
        if (!form.value.currentPassword) e.currentPassword = 'Isi kata sandi saat ini untuk mengganti kata sandi.';
    }
    return e;
}

async function saveChanges() {
    if (saving.value) return;
    errors.value = validate();
    const firstField = Object.keys(FIELD_IDS).find((k) => errors.value[k]);
    if (firstField) {
        nextTick(() => document.getElementById(FIELD_IDS[firstField])?.focus());
        return;
    }
    const saved = [];

    saving.value = true;
    try {
        if (contactChanged.value) {
            const res = await api.put('/master/user/profile', { email: form.value.email.trim(), no_hp: form.value.phone.trim() });
            profile.value = res?.data || profile.value;
            saved.push('kontak');
        }
        if (pendingPhoto.value) {
            const fd = new FormData();
            fd.append('file', pendingPhoto.value);
            const res = await api.upload('/master/user/profile/photo', fd);
            profile.value = res?.data || profile.value;
            clearPendingPhoto();
            saved.push('foto');
        } else if (removePhoto.value) {
            const res = await api.delete('/master/user/profile/photo', {});
            profile.value = res?.data || profile.value;
            removePhoto.value = false;
            saved.push('foto');
        }
        if (passwordStarted.value) {
            await authService.changePassword({
                current_password: form.value.currentPassword,
                new_password: form.value.newPassword,
                confirm_password: form.value.confirmPassword
            });
        }
        syncSessionUser();
        resetForm();
        toast.add({ severity: 'success', summary: 'Perubahan disimpan', detail: 'Profil Anda sudah diperbarui.', life: 3000 });
    } catch (err) {
        syncSessionUser();
        // Simpan bertahap: sebutkan bagian yang sudah tersimpan agar tidak dikira gagal semua (audit-031 #9).
        const done = saved.length ? ` Yang sudah tersimpan: ${saved.join(' dan ')}.` : '';
        toast.add({ severity: 'error', summary: 'Perubahan gagal disimpan', detail: `${err.message || 'Coba lagi beberapa saat.'}${done}`, life: 6000 });
    } finally {
        saving.value = false;
    }
}

onMounted(async () => {
    await loadProfile();
    syncSessionUser();
    resetForm();
    window.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
    clearPendingPhoto();
    window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
    <!-- Mask polos seperti Dialog PrimeVue, tanpa blur kaca (audit-031 #5). -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/40"
        @click.self="handleClose"
    >
        <div
            class="relative w-full max-w-[580px] max-h-[90vh] flex flex-col rounded-xl bg-surface-0 dark:bg-surface-900 shadow-xl overflow-hidden text-surface-900 dark:text-surface-0 my-auto profile-enter"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-dialog-title"
        >
            <div class="px-6 pt-5 pb-3 flex items-start justify-between gap-3 shrink-0">
                <div>
                    <h1 id="profile-dialog-title" class="text-lg font-bold text-surface-900 dark:text-surface-0">Profil &amp; Pengaturan Akun</h1>
                    <p class="text-xs text-muted-color mt-0.5">Data kepegawaian dan kontak notifikasi akun Lebur Anda.</p>
                </div>
                <button
                    type="button"
                    class="inline-flex items-center justify-center shrink-0 min-w-11 min-h-11 sm:min-w-9 sm:min-h-9 rounded-border text-muted-color hover:text-surface-900 dark:hover:text-surface-0 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Tutup (Esc)"
                    aria-label="Tutup dialog profil"
                    @click="handleClose"
                >
                    <PhX :size="16" weight="bold" aria-hidden="true" />
                </button>
            </div>

            <form id="profile-form" novalidate class="px-6 pb-6 pt-2 overflow-y-auto space-y-5 text-xs flex-1" @submit.prevent="saveChanges">
                <div v-if="loadError" role="alert" class="flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                    <span>Data profil terbaru gagal dimuat. Isian di bawah berasal dari sesi login; periksa sebelum menyimpan.</span>
                    <Button type="button" label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11 sm:!min-h-9" @click="retryLoad" />
                </div>

                <ProfileAvatarSection
                    :name="view.name"
                    :role-name="view.roleName || view.position"
                    :dept-name="view.deptName"
                    :dept-code="view.deptCode"
                    :nip="view.nip"
                    :photo-url="view.photo"
                    :has-saved-photo="view.hasSavedPhoto"
                    :is-pending-photo="Boolean(pendingPhoto)"
                    :user-initials="userInitials"
                    @photo-selected="onPhotoSelected"
                    @remove-photo="onRemovePhoto"
                    @cancel-photo="onCancelPhoto"
                />

                <div class="space-y-3 pt-4 border-t border-surface-200 dark:border-surface-700">
                    <h2 class="text-sm font-semibold text-surface-900 dark:text-surface-100">Kontak notifikasi</h2>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                            <label for="profile-email" class="block font-medium text-surface-700 dark:text-surface-300 mb-1">
                                Email kantor <span class="text-(--status-danger-fg)" aria-hidden="true">*</span>
                            </label>
                            <InputText
                                id="profile-email"
                                v-model="form.email"
                                type="email"
                                placeholder="nama@inalum.co.id"
                                class="w-full text-xs"
                                aria-required="true"
                                :invalid="Boolean(errors.email)"
                                :aria-invalid="errors.email ? 'true' : undefined"
                                :aria-describedby="errors.email ? 'profile-email-error' : undefined"
                            />
                            <p v-if="errors.email" id="profile-email-error" class="text-xs text-(--status-danger-fg) mt-1">{{ errors.email }}</p>
                        </div>
                        <div>
                            <label for="profile-phone" class="block font-medium text-surface-700 dark:text-surface-300 mb-1">
                                Nomor WhatsApp / HP
                            </label>
                            <InputText
                                id="profile-phone"
                                v-model="form.phone"
                                type="tel"
                                placeholder="Contoh: 081234567890"
                                class="w-full text-xs"
                            />
                        </div>
                    </div>
                </div>

                <ProfilePasswordSection v-model="form" :errors="errors" />
            </form>

            <div class="px-6 py-3 border-t border-surface-200 dark:border-surface-700 flex items-center justify-end gap-2 shrink-0">
                <Button
                    type="button"
                    severity="secondary"
                    outlined
                    size="small"
                    class="font-semibold text-xs !min-h-11 sm:!min-h-9"
                    @click="handleClose"
                >
                    Batal
                </Button>
                <Button
                    type="submit"
                    form="profile-form"
                    size="small"
                    class="font-semibold text-xs flex items-center gap-1.5 !min-h-11 sm:!min-h-9"
                    :loading="saving"
                    :disabled="!isDirty"
                    :title="isDirty ? undefined : 'Belum ada perubahan untuk disimpan'"
                >
                    <PhFloppyDisk :size="14" weight="bold" aria-hidden="true" />
                    <span>Simpan Perubahan</span>
                </Button>
            </div>
        </div>
    </div>
</template>

<style scoped>
@keyframes profileEnter {
    from {
        opacity: 0;
        transform: translateY(6px);
    }
    to {
        opacity: 1;
        transform: none;
    }
}

.profile-enter {
    animation: profileEnter 0.18s ease-out;
}

@media (prefers-reduced-motion: reduce) {
    .profile-enter {
        animation: none;
    }
}
</style>
