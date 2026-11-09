<template>
    <div v-if="returnNote || validationAlert" class="space-y-4">
        <div
            v-if="returnNote"
            class="p-3.5 rounded-xl border text-xs bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100 flex items-start gap-2.5"
        >
            <PhWarning :size="16" weight="bold" aria-hidden="true" class="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
                <strong class="font-bold block mb-0.5">Dikembalikan{{ returnNote.approverName ? ` oleh ${returnNote.approverName}` : '' }}</strong>
                <p class="leading-relaxed">{{ returnNote.notes || 'Tidak ada catatan. Periksa kembali data pengajuan sebelum mengajukan ulang.' }}</p>
            </div>
        </div>

        <div
            v-if="validationAlert"
            :class="[
                'p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs transition-all shadow-xs',
                validationAlert.severity === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200'
            ]"
        >
            <div class="flex items-start gap-2.5">
                <PhWarning
                    :size="16"
                    weight="bold"
                    aria-hidden="true"
                    :class="validationAlert.severity === 'error' ? 'text-rose-600 dark:text-rose-400 mt-0.5 shrink-0' : 'text-amber-600 dark:text-amber-400 mt-0.5 shrink-0'"
                />
                <div>
                    <strong class="font-bold block mb-0.5">{{ validationAlert.title }}</strong>
                    <p class="leading-relaxed opacity-95">{{ validationAlert.message }}</p>
                </div>
            </div>
            <button
                type="button"
                class="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 p-0.5 cursor-pointer transition-colors"
                @click="emit('dismiss')"
                title="Tutup pesan"
            >
                <PhX :size="14" weight="bold" aria-hidden="true" />
            </button>
        </div>
    </div>
</template>

<script setup>
import { PhWarning, PhX } from '@phosphor-icons/vue';

defineProps({
    returnNote: {
        type: Object,
        default: null
    },
    validationAlert: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['dismiss']);
</script>
