<script setup>
import { publicPath } from '@/utils/publicPath';
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { API_BASE, APP_KEY } from '@/service/api';
import { formatDate } from '@/service/sicutiService';
import { PhSealCheck, PhShieldWarning, PhSpinner, PhWarning } from '@phosphor-icons/vue';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const route = useRoute();
const loading = ref(true);
const error = ref(null);
// Gagal jaringan/server bukan berarti dokumen tidak valid (audit-033 #1).
const checkFailed = ref(false);
const result = ref(null);

const secret = computed(() => {
    const s = route.params.secret;
    return Array.isArray(s) ? s.join('/') : s || '';
});

const isValid = computed(() => !error.value && result.value?.is_valid === true);
const message = computed(() => error.value || result.value?.keterangan || '');
const doc = computed(() => result.value?.document || null);

function formatWaktu(value) {
    if (!value || value === '-') return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    const t = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${t}`;
}

const pengesah = computed(() =>
    (result.value?.all_signers || [])
        .filter((s) => String(s.status || '').toLowerCase() === 'approved')
        .sort((a, b) => Number(a.level) - Number(b.level))
        .map((s, i) => ({ no: i + 1, nama: s.nama || '-', jabatan: s.jabatan || '-', waktu: formatWaktu(s.waktu) }))
);

const docRows = computed(() => {
    const d = doc.value;
    if (!d) return [];
    return [
        { label: 'Nomor Dokumen', value: d.nomor_surat || d.id_request },
        { label: 'Pemohon', value: d.requester_name },
        { label: 'NIK', value: d.requester_nik },
        { label: 'Jenis Cuti', value: d.nm_leave_type },
        { label: 'Periode Cuti', value: `${formatDate(d.start_date)} – ${formatDate(d.end_date)} (${d.total_days || 0} hari kerja)` }
    ];
});

async function validate() {
    loading.value = true;
    error.value = null;
    checkFailed.value = false;
    if (!secret.value) {
        error.value = 'Kode QR tidak berisi data dokumen.';
        loading.value = false;
        return;
    }
    try {
        let res;
        try {
            res = await fetch(`${API_BASE}/sicuti/leave-request/validation/${encodeURIComponent(secret.value)}`, {
                headers: { 'Content-Type': 'application/json', 'x-api-key': APP_KEY }
            });
        } catch {
            checkFailed.value = true;
            throw new Error('Server validasi tidak dapat dihubungi. Periksa koneksi lalu coba lagi.');
        }
        if (res.status >= 500) {
            checkFailed.value = true;
            throw new Error('Server validasi sedang bermasalah. Coba lagi beberapa saat.');
        }
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
            throw new Error(json.error || 'Dokumen tidak ditemukan di sistem.');
        }
        result.value = json.data;
    } catch (err) {
        error.value = err.message || 'Dokumen tidak dapat diverifikasi.';
    } finally {
        loading.value = false;
    }
}

onMounted(validate);
</script>

<template>
    <!-- Token surface/status, bukan hex: ikut tema terang/gelap (audit-033 #2). -->
    <div class="min-h-screen bg-surface-100 dark:bg-surface-950 text-surface-900 dark:text-surface-0 antialiased">
        <header class="bg-surface-0 dark:bg-surface-900">
            <div class="max-w-xl mx-auto px-4 h-14 flex items-center gap-2.5">
                <img :src="publicPath('logo-inalum.png')" alt="Logo PT INALUM" class="h-7 w-auto" />
                <div class="leading-tight">
                    <div class="font-bold text-primary">Lebur</div>
                    <div class="text-xs text-muted-color">Validasi dokumen cuti</div>
                </div>
            </div>
        </header>

        <main class="max-w-xl mx-auto px-4 py-5 space-y-4">
            <div v-if="loading" role="status" class="bg-surface-0 dark:bg-surface-900 rounded-xl p-10 text-center text-sm text-muted-color">
                <PhSpinner :size="22" weight="regular" aria-hidden="true" class="animate-spin motion-reduce:animate-none text-primary mx-auto mb-2" />
                Memeriksa keabsahan dokumen…
            </div>

            <template v-else>
                <div
                    v-if="checkFailed"
                    role="alert"
                    class="rounded-xl px-4 py-3.5 flex flex-wrap items-start gap-3 bg-(--status-warn-bg) text-(--status-warn-fg)"
                >
                    <PhWarning :size="22" weight="regular" aria-hidden="true" class="shrink-0" />
                    <div class="flex-1 min-w-48">
                        <div class="font-semibold">Dokumen belum bisa diperiksa</div>
                        <div class="text-sm">{{ message }}</div>
                    </div>
                    <Button label="Coba lagi" severity="secondary" size="small" class="text-sm !min-h-11" @click="validate" />
                </div>
                <div
                    v-else
                    role="status"
                    :class="['rounded-xl px-4 py-3.5 flex items-start gap-3', isValid ? 'bg-(--status-success-bg) text-(--status-success-fg)' : 'bg-(--status-danger-bg) text-(--status-danger-fg)']"
                >
                    <component :is="isValid ? PhSealCheck : PhShieldWarning" :size="22" weight="regular" aria-hidden="true" class="shrink-0" />
                    <div>
                        <div class="font-semibold">{{ isValid ? 'Dokumen Valid' : 'Dokumen Tidak Valid' }}</div>
                        <div class="text-sm">{{ message }}</div>
                    </div>
                </div>

                <section v-if="doc" class="bg-surface-0 dark:bg-surface-900 rounded-xl px-5 py-5">
                    <h1 class="text-lg font-bold text-surface-900 dark:text-surface-0">Formulir Permohonan Cuti</h1>
                    <div class="mt-1 text-sm text-muted-color">{{ doc.nm_dept }}</div>
                    <dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2.5 text-sm">
                        <template v-for="row in docRows" :key="row.label">
                            <dt class="text-muted-color">{{ row.label }}</dt>
                            <dd class="break-words">{{ row.value || '-' }}</dd>
                        </template>
                    </dl>
                </section>

                <section v-if="doc" class="bg-surface-0 dark:bg-surface-900 rounded-xl px-5 py-5">
                    <h2 class="font-semibold text-base mb-4">Pejabat Pengesah</h2>
                    <p v-if="pengesah.length === 0" class="text-sm text-muted-color">Belum ada pejabat yang mengesahkan dokumen ini.</p>
                    <ol v-else class="relative ml-1.5 border-l-2 border-surface-200 dark:border-surface-700">
                        <li v-for="p in pengesah" :key="p.no" class="relative pl-6 pb-6 last:pb-1">
                            <span class="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-primary" aria-hidden="true"></span>
                            <div class="font-semibold text-sm">Pengesah {{ p.no }}</div>
                            <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                                <dt class="text-muted-color">Nama</dt><dd>{{ p.nama }}</dd>
                                <dt class="text-muted-color">Jabatan</dt><dd>{{ p.jabatan }}</dd>
                                <dt class="text-muted-color">Disahkan</dt><dd class="tabular-nums">{{ p.waktu }}</dd>
                            </dl>
                        </li>
                    </ol>
                </section>
            </template>
        </main>

        <footer class="max-w-xl mx-auto px-4 pb-8 text-center text-xs text-muted-color">
            Diverifikasi oleh Lebur · PT Indonesia Asahan Aluminium (Persero)
        </footer>
    </div>
</template>
