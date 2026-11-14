<script setup>
import { PhFunnel } from '@phosphor-icons/vue';

// Tombol buka/tutup filter sekunder di bawah lg; di lg ke atas semua filter selalu tampil (audit-013 #4).
const open = defineModel({ type: Boolean, default: false });
defineProps({
    count: { type: Number, default: 0 },
    controls: { type: String, default: undefined }
});
</script>

<template>
    <Button
        type="button"
        severity="secondary"
        outlined
        size="small"
        class="lg:!hidden w-full !min-h-11 justify-center gap-2 text-xs"
        :aria-expanded="open"
        :aria-controls="controls"
        @click="open = !open"
    >
        <PhFunnel :size="14" weight="bold" aria-hidden="true" />
        <span>{{ open ? 'Sembunyikan filter' : 'Filter lainnya' }}</span>
        <span v-if="count" class="tabular-nums">({{ count }} aktif)</span>
    </Button>
</template>
