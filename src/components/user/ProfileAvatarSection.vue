<script setup>
import { ref, computed } from 'vue';
import { PhCamera, PhTrash } from '@phosphor-icons/vue';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

const props = defineProps({
    name: {
        type: String,
        default: '-'
    },
    roleName: {
        type: String,
        default: '-'
    },
    deptName: {
        type: String,
        default: ''
    },
    deptCode: {
        type: String,
        default: '-'
    },
    nip: {
        type: String,
        default: '-'
    },
    photoUrl: {
        type: String,
        default: ''
    },
    hasSavedPhoto: {
        type: Boolean,
        default: false
    },
    isPendingPhoto: {
        type: Boolean,
        default: false
    },
    userInitials: {
        type: String,
        default: 'U'
    }
});

const emit = defineEmits(['photo-selected', 'remove-photo', 'cancel-photo']);
const photoInput = ref(null);
const photoError = ref('');

// Tanpa nilai karangan ("Staff IT", "SIT") bila data kosong (audit-031 #1).
const known = (v) => (v && v !== '-' ? v : '');
const deptLine = computed(() => [known(props.deptName), known(props.deptCode) && `Seksi ${props.deptCode}`].filter(Boolean).join(' · '));

function pickPhoto() {
    photoInput.value?.click();
}

function onPhotoSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    // Kesalahan foto ditulis di dekat tombolnya, bukan toast (audit-031 #3).
    if (!PHOTO_TYPES.includes(file.type)) {
        photoError.value = 'Format foto tidak didukung. Pilih foto JPG, PNG, atau WEBP.';
        return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
        photoError.value = 'Foto terlalu besar. Ukuran maksimal 2 MB.';
        return;
    }
    photoError.value = '';
    emit('photo-selected', file);
}
</script>

<template>
    <div class="flex items-start gap-4">
        <input
            id="unggah-foto-profil"
            ref="photoInput"
            name="foto_profil"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            @change="onPhotoSelected"
        />

        <div class="size-16 shrink-0 rounded-full overflow-hidden bg-primary-50 dark:bg-primary-950 flex items-center justify-center">
            <img v-if="photoUrl" :src="photoUrl" :alt="`Foto profil ${name}`" class="size-full object-cover" />
            <span v-else class="text-xl font-bold text-primary-700 dark:text-primary-300 select-none" aria-hidden="true">{{ userInitials }}</span>
        </div>

        <div class="min-w-0 flex-1 space-y-0.5">
            <div class="text-base font-bold text-surface-900 dark:text-surface-0 leading-snug break-words">{{ name }}</div>
            <div v-if="known(roleName)" class="text-xs text-surface-700 dark:text-surface-300">{{ roleName }}</div>
            <div v-if="deptLine" class="text-xs text-muted-color">{{ deptLine }}</div>
            <div class="text-xs text-muted-color">NIK <span class="font-mono text-surface-800 dark:text-surface-200">{{ nip }}</span></div>

            <div class="flex flex-wrap gap-2 pt-2">
                <Button
                    type="button"
                    severity="secondary"
                    outlined
                    size="small"
                    class="text-xs flex items-center gap-1.5 !min-h-11 sm:!min-h-9"
                    aria-label="Ganti foto profil"
                    @click="pickPhoto"
                >
                    <PhCamera :size="14" weight="bold" aria-hidden="true" />
                    <span>Ganti foto</span>
                </Button>
                <Button
                    v-if="photoUrl"
                    type="button"
                    severity="danger"
                    text
                    size="small"
                    class="text-xs flex items-center gap-1.5 !min-h-11 sm:!min-h-9 !text-(--status-danger-fg)"
                    @click="isPendingPhoto ? emit('cancel-photo') : emit('remove-photo')"
                >
                    <PhTrash :size="14" weight="bold" aria-hidden="true" />
                    <span>{{ isPendingPhoto ? 'Batalkan foto baru' : 'Hapus foto profil' }}</span>
                </Button>
            </div>
            <p class="text-xs text-muted-color">JPG, PNG, atau WEBP, maksimal 2 MB.</p>
            <p v-if="photoError" role="alert" class="text-xs text-(--status-danger-fg)">{{ photoError }}</p>
        </div>
    </div>
</template>
