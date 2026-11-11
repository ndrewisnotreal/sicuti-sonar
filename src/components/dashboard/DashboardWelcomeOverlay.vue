<script setup>
// Sapaan setelah login sebagai toast: tidak mengunci layar dan tanpa langkah/progres yang tidak benar-benar terjadi (audit-009 #1–6).
import { nextTick, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { currentUser } from '@/service/sicutiService';

const emit = defineEmits(['complete']);

const route = useRoute();
const toast = useToast();

onMounted(async () => {
    const justLoggedIn = sessionStorage.getItem('sct_just_logged_in');
    const isPreview = route?.query?.preview_blur === '1';
    if (justLoggedIn !== 'true' && !isPreview) return;

    sessionStorage.removeItem('sct_just_logged_in');
    let loggedInUser = null;
    try {
        const rawUser = sessionStorage.getItem('sct_login_user');
        if (rawUser) {
            loggedInUser = JSON.parse(rawUser);
            sessionStorage.removeItem('sct_login_user');
        }
    } catch {}
    const name = (loggedInUser || currentUser.value)?.name;

    // <Toast> di AppLayout berada sesudah <router-view>, jadi baru mendengarkan setelah dashboard terpasang.
    await nextTick();
    toast.add({ severity: 'info', summary: name ? `Selamat datang, ${name}` : 'Selamat datang', life: 3000 });
    emit('complete');
});
</script>

<template></template>
