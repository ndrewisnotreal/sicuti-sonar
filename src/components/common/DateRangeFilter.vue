<script setup>
import { computed } from 'vue';

// Dua DatePicker tunggal (Dari/Sampai) agar mengubah tanggal akhir tidak menghapus tanggal awal.
// Nilai tetap berbentuk [mulai|null, akhir|null], atau null bila keduanya kosong.
const model = defineModel({ type: Array, default: null });
defineProps({
    label: { type: String, required: true },
    inputClass: { type: String, default: 'text-xs !min-h-11 sm:!min-h-9' }
});

const start = computed(() => model.value?.[0] ?? null);
const end = computed(() => model.value?.[1] ?? null);

function update(nextStart, nextEnd) {
    model.value = nextStart || nextEnd ? [nextStart || null, nextEnd || null] : null;
}
</script>

<template>
    <div class="grid grid-cols-2 gap-2">
        <DatePicker
            :modelValue="start"
            :maxDate="end || undefined"
            :manualInput="false"
            dateFormat="dd M yy"
            placeholder="Dari"
            showButtonBar
            size="small"
            fluid
            :inputClass="inputClass"
            :aria-label="`${label} dari`"
            @update:modelValue="update($event, end)"
        />
        <DatePicker
            :modelValue="end"
            :minDate="start || undefined"
            :manualInput="false"
            dateFormat="dd M yy"
            placeholder="Sampai"
            showButtonBar
            size="small"
            fluid
            :inputClass="inputClass"
            :aria-label="`${label} sampai`"
            @update:modelValue="update(start, $event)"
        />
    </div>
</template>
