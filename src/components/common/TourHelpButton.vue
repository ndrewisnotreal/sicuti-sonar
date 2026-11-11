<script setup>
import { computed } from 'vue';
import { PhQuestion } from '@phosphor-icons/vue';
import { currentUser } from '@/service/sicutiService';
import { getTourPersona } from '@/tour/persona';
import { tourById } from '@/tour/tours';
import { startTour } from '@/tour/useTour';

const props = defineProps({
    tourId: { type: [String, Array], required: true },
    label: { type: String, default: 'Panduan' }
});

const tour = computed(() => {
    const persona = getTourPersona(currentUser.value);
    const ids = Array.isArray(props.tourId) ? props.tourId : [props.tourId];
    return ids.map((id) => tourById(id, persona)).find(Boolean) || null;
});
</script>

<template>
    <Button
        v-if="tour"
        type="button"
        severity="secondary"
        text
        size="small"
        class="text-xs font-semibold flex items-center gap-1.5"
        :aria-label="tour.title"
        :title="tour.title"
        @click="startTour(tour)"
    >
        <PhQuestion :size="14" weight="bold" aria-hidden="true" />
        <span class="hidden sm:inline">{{ label }}</span>
    </Button>
</template>
