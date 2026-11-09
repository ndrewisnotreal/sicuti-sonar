<script setup>
import { computed, ref, onMounted } from 'vue';
import { leaveService } from '@/service/leaveService';
import { formatDate, YEAR_OPTIONS, can } from '@/service/sicutiService';
import StatStrip from '@/components/common/StatStrip.vue';
import { PhPlus, PhFolderOpen } from '@phosphor-icons/vue';

const loading = ref(false);
const balanceError = ref(false);
const historyError = ref(false);
const balances = ref([]);
const mutations = ref([]);
const mutationTypeFilter = ref('all');

const selectedYear = ref(new Date().getFullYear());
const yearOptions = YEAR_OPTIONS;

async function loadBalanceData() {
    loading.value = true;
    balanceError.value = false;
    historyError.value = false;
    // Pemanggilan sama; kegagalan saldo dan riwayat kini dicatat terpisah, bukan ditelan (audit-028 #1, #11).
    const balsPromise = leaveService.getBalances({ year: selectedYear.value });
    const [bals, muts] = await Promise.allSettled([balsPromise, leaveService.getBalanceMutations({ year: selectedYear.value, balances: balsPromise })]);

    if (bals.status === 'fulfilled') {
        balances.value = Array.isArray(bals.value) ? bals.value : bals.value ? [bals.value] : [];
    } else {
        console.error('Failed to load balance info:', bals.reason);
        balanceError.value = true;
        balances.value = [];
    }
    if (muts.status === 'fulfilled') {
        mutations.value = Array.isArray(muts.value) ? muts.value : [];
    } else {
        historyError.value = true;
        mutations.value = [];
    }
    loading.value = false;
}

onMounted(() => {
    loadBalanceData();
});

// Tanpa data saldo tidak ada angka bawaan: dulu tampil "0 hari" dan kuota 12 yang dikarang (audit-028 #1).
const userBalance = computed(() => {
    if (!balances.value.length) return null;
    const found = balances.value.find((b) => Number(b.year) === Number(selectedYear.value)) || balances.value[0];
    return {
        remaining: Number(found.remaining ?? (Number(found.annual_quota || 0) + Number(found.carry_over_days || 0) - Number(found.used_days || 0))),
        annual_quota: Number(found.annual_quota ?? 0),
        used_days: Number(found.used_days ?? 0),
        carry_over_days: Number(found.carry_over_days ?? 0),
        carry_over_expiry_date: found.carry_over_expiry_date || null,
        year: found.year || selectedYear.value,
        period_label: found.period_label || ''
    };
});

const totalQuota = computed(() => (userBalance.value ? userBalance.value.annual_quota + userBalance.value.carry_over_days : 0));

// Bilah menunjukkan bagian yang tersisa, sesuai judul kartunya (audit-028 #14).
const remainingPercentage = computed(() => {
    if (!userBalance.value || totalQuota.value <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((userBalance.value.remaining / totalQuota.value) * 100)));
});

const statItems = computed(() => {
    const b = userBalance.value;
    if (!b) {
        const hint = loading.value ? 'Memuat…' : balanceError.value ? 'Belum termuat' : `Saldo tahun ${selectedYear.value} belum tersedia`;
        return ['Saldo tersisa', 'Hak kuota tahunan', 'Cuti terpakai', 'Sisa tahun lalu'].map((label, i) => ({ label, value: '–', unit: 'hari', accent: i === 0, hint }));
    }
    return [
        {
            label: 'Saldo tersisa',
            value: b.remaining,
            unit: 'hari',
            accent: true,
            progress: remainingPercentage.value,
            hint: `Sisa ${b.remaining} dari ${totalQuota.value} hari`
        },
        { label: 'Hak kuota tahunan', value: b.annual_quota, unit: 'hari', hint: `Periode ${b.period_label || b.year}` },
        { label: 'Cuti terpakai', value: b.used_days, unit: 'hari', hint: 'Sudah disetujui' },
        {
            label: 'Sisa tahun lalu',
            value: b.carry_over_days,
            unit: 'hari',
            hint: b.carry_over_days > 0 && b.carry_over_expiry_date ? `Hangus ${formatDate(b.carry_over_expiry_date)}` : 'Tidak ada sisa tahun lalu'
        }
    ];
});

const totalCredit = computed(() => mutations.value.filter((m) => m.type === 'credit').reduce((sum, m) => sum + Number(m.amount || 0), 0));
const totalDebit = computed(() => mutations.value.filter((m) => m.type === 'debit').reduce((sum, m) => sum + Number(m.amount || 0), 0));

const mutationChips = computed(() => [
    { key: 'all', label: 'Semua', count: mutations.value.length },
    { key: 'credit', label: 'Bertambah', count: `+${totalCredit.value}` },
    { key: 'debit', label: 'Berkurang', count: `−${totalDebit.value}` }
]);

const filteredMutations = computed(() => {
    if (mutationTypeFilter.value === 'all') return mutations.value;
    return mutations.value.filter((m) => m.type === mutationTypeFilter.value);
});

// Angka netral bertanda; jenis perubahan dibaca dari tandanya (DESIGN.md tabel angka, audit-028 #8).
const signedAmount = (m) => `${m.type === 'credit' ? '+' : '−'}${m.amount} hari`;
const mutationNote = (m) => `${m.description}${m.expiry ? `, hangus ${formatDate(m.expiry)}` : ''}`;

const emptyText = computed(() => (balanceError.value || historyError.value ? 'Riwayat belum termuat.' : 'Belum ada perubahan saldo pada periode ini.'));
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Informasi Saldo Cuti</h1>
                <!-- Judul di atas latar surface-100: muted-color hanya 4,34:1, jadi pakai surface-600 (audit-028 #3). -->
                <p class="text-xs text-surface-600 dark:text-surface-400">Kuota, sisa tahun lalu, dan riwayat perubahan saldo cuti Anda</p>
            </div>
            <div class="flex flex-wrap items-end gap-2">
                <div>
                    <span id="balance-year-label" class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">Tahun</span>
                    <Select
                        v-model="selectedYear"
                        :options="yearOptions"
                        optionLabel="label"
                        optionValue="value"
                        @change="loadBalanceData"
                        class="text-xs w-36 !min-h-11 sm:!min-h-9"
                        size="small"
                        ariaLabelledby="balance-year-label"
                    />
                </div>
                <Button v-if="can('pengajuan_cuti.submit')" @click="$router.push({ path: '/leave/history', query: { action: 'new_leave' } })" size="small" class="font-semibold text-xs flex items-center gap-1.5 !min-h-11 sm:!min-h-9">
                    <PhPlus :size="14" weight="bold" aria-hidden="true" />
                    <span>Tambah Pengajuan</span>
                </Button>
            </div>
        </div>

        <div v-if="balanceError" role="alert" class="flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
            <span>Saldo tahun {{ selectedYear }} gagal dimuat. Angka tidak ditampilkan agar tidak keliru.</span>
            <Button label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11" :loading="loading" @click="loadBalanceData" />
        </div>

        <StatStrip data-tour="balance-stats" :items="statItems" :aria-busy="loading" />

        <div data-tour="balance-mutasi" class="card !mb-0">
            <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <h2 class="font-bold text-base text-surface-900 dark:text-surface-0 leading-tight">Riwayat Perubahan Saldo</h2>
                    <p class="text-xs text-muted-color mt-0.5">Penambahan dan pengurangan saldo cuti tahunan Anda</p>
                </div>
                <!-- Pilihan cepat pola Pemantauan, bukan tab (audit-028 #4). -->
                <div role="group" aria-labelledby="balance-type-label" class="flex flex-wrap items-center gap-2">
                    <span id="balance-type-label" class="text-xs font-medium text-surface-700 dark:text-surface-300 mr-1">Jenis</span>
                    <button
                        v-for="chip in mutationChips"
                        :key="chip.key"
                        type="button"
                        class="inline-flex items-center gap-1.5 min-h-11 sm:min-h-9 px-3 rounded-border border text-xs font-medium cursor-pointer transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        :class="mutationTypeFilter === chip.key
                            ? 'border-primary bg-primary-50 text-primary-700 dark:bg-primary/10 dark:text-primary'
                            : 'border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'"
                        :aria-pressed="mutationTypeFilter === chip.key"
                        @click="mutationTypeFilter = chip.key"
                    >
                        {{ chip.label }}
                        <span class="tabular-nums text-surface-600 dark:text-surface-400" :class="{ '!text-current': mutationTypeFilter === chip.key }">{{ historyError ? '–' : chip.count }}</span>
                    </button>
                </div>
            </div>

            <div v-if="historyError && !balanceError" role="alert" class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                <span>Riwayat perubahan saldo gagal dimuat.</span>
                <Button label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11" :loading="loading" @click="loadBalanceData" />
            </div>

            <div class="hidden md:block mt-4">
                <DataTable :value="filteredMutations" :loading="loading" class="p-datatable-sm text-xs">
                    <template #empty>
                        <div class="text-center py-10 text-muted-color text-xs">
                            <PhFolderOpen :size="40" weight="light" aria-hidden="true" class="text-muted-color mb-2 block mx-auto" />
                            {{ emptyText }}
                        </div>
                    </template>

                    <Column header="Tanggal" style="width: 11rem">
                        <template #body="{ data }">
                            <span class="text-xs text-surface-700 dark:text-surface-300 tabular-nums whitespace-nowrap">{{ formatDate(data.date) }}</span>
                        </template>
                    </Column>

                    <Column header="Keterangan">
                        <template #body="{ data }">
                            <span class="text-xs text-surface-900 dark:text-surface-0">{{ mutationNote(data) }}</span>
                        </template>
                    </Column>

                    <Column header="Perubahan" style="width: 8rem" :pt="{ headerCell: { class: 'text-right' }, bodyCell: { class: 'text-right' } }">
                        <template #body="{ data }">
                            <span class="text-xs font-semibold tabular-nums whitespace-nowrap text-surface-900 dark:text-surface-0">{{ signedAmount(data) }}</span>
                        </template>
                    </Column>
                </DataTable>
            </div>

            <!-- Daftar di HP: tabel lima kolom berdesakan di 390px (audit-028 #2). -->
            <div class="md:hidden mt-4" :aria-busy="loading">
                <p v-if="loading && !filteredMutations.length" class="py-8 text-center text-xs text-muted-color" role="status">Memuat riwayat…</p>
                <div v-else-if="!filteredMutations.length" class="py-8 text-center text-xs text-muted-color">
                    <PhFolderOpen :size="40" weight="light" aria-hidden="true" class="text-muted-color mb-2 block mx-auto" />
                    {{ emptyText }}
                </div>
                <ul v-else class="divide-y divide-surface-200 dark:divide-surface-700" :class="{ 'opacity-60': loading }">
                    <li v-for="m in filteredMutations" :key="m.id" class="py-3 flex items-start justify-between gap-3 text-xs">
                        <div class="min-w-0">
                            <div class="text-surface-900 dark:text-surface-0">{{ mutationNote(m) }}</div>
                            <div class="mt-0.5 text-muted-color tabular-nums">{{ formatDate(m.date) }}</div>
                        </div>
                        <span class="shrink-0 font-semibold tabular-nums text-surface-900 dark:text-surface-0">{{ signedAmount(m) }}</span>
                    </li>
                </ul>
            </div>
        </div>
    </div>
</template>
