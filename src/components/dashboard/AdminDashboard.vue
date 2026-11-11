<script setup>
import { computed, ref } from 'vue';
import { useLayout } from '@/layout/composables/layout';
import { currentUser, sicutiState, getAdminDivision, getDivisionUsers, getDivisionRequests, syncFromBackend, CURRENT_YEAR } from '@/service/sicutiService';
import StatStrip from '@/components/common/StatStrip.vue';
import AdminDashboardCalendar from '@/components/dashboard/AdminDashboardCalendar.vue';
import { PhWarning } from '@phosphor-icons/vue';

const { isDarkTheme } = useLayout();

// Selama memuat atau gagal, angka 0 bukan fakta: tampilkan "–" (audit-034 #3).
const dataLoading = computed(() => ['idle', 'loading'].includes(sicutiState.syncStatus));
const dataFailed = computed(() => sicutiState.syncStatus === 'error');
const dataReady = computed(() => !dataLoading.value && !dataFailed.value);

const adminDivision = computed(() => getAdminDivision(currentUser.value));

const divisionUsers = computed(() => getDivisionUsers(adminDivision.value));

const divisionRequests = computed(() => getDivisionRequests(adminDivision.value));

const totalKaryawan = computed(() => {
    return divisionUsers.value.filter((u) => !u.role?.startsWith('admin_') && u.isActive !== false).length;
});

const pendingCount = computed(() => {
    return divisionRequests.value.filter((r) =>
        ['submitted', 'pending_validation'].includes(r.status)
    ).length;
});

const approvedCount = computed(() => {
    return divisionRequests.value.filter((r) => r.status === 'approved').length;
});

const holidaysThisYear = computed(() => {
    return sicutiState.holidays.filter((h) => h.year === CURRENT_YEAR).length;
});

const statItems = computed(() => {
    const show = (value, unit) => (dataReady.value ? { value, unit } : { value: '–', unit: '' });
    return [
        { label: 'Total karyawan', ...show(totalKaryawan.value, 'orang'), hint: adminDivision.value ? `Aktif, divisi ${adminDivision.value}` : 'Aktif, semua divisi' },
        { label: 'Pengajuan pending', ...show(pendingCount.value, 'pengajuan'), hint: 'Menunggu verifikasi', accent: dataReady.value && pendingCount.value > 0 },
        // Hitungan mencakup semua tahun yang dikirim backend, bukan hanya CURRENT_YEAR (audit-034 #1).
        { label: 'Cuti disetujui', ...show(approvedCount.value, 'pengajuan'), hint: 'Seluruh periode' },
        { label: 'Hari libur', ...show(holidaysThisYear.value, 'hari'), hint: `Tahun kalender ${CURRENT_YEAR}` }
    ];
});

// Grafik berlabel tahun berjalan: pengajuan tahun lain tidak ikut dihitung (audit-034 #1).
const yearRequests = computed(() => divisionRequests.value.filter((r) => r.createdAt && new Date(r.createdAt).getFullYear() === CURRENT_YEAR));

const totalTahunIni = computed(() => yearRequests.value.length);

const monthLabels = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

const fullMonthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// Token primitive tetap stabil saat toggle tema memperbarui DOM; semantic token bisa tertinggal satu render.
const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const monthlyCounts = computed(() => monthLabels.map((_, month) => yearRequests.value.filter((r) => new Date(r.createdAt).getMonth() === month).length));

// Teks pengganti canvas untuk pembaca layar (audit-034 #5).
const chartSummary = computed(() => {
    const parts = monthlyCounts.value.map((n, i) => (n ? `${fullMonthNames[i]} ${n}` : null)).filter(Boolean);
    return `Pengajuan cuti per bulan tahun ${CURRENT_YEAR}: ${parts.join(', ')}.`;
});

const monthlyChartData = computed(() => {
    const isDark = isDarkTheme.value;
    const primaryColor = token(isDark ? '--p-primary-400' : '--p-primary-500');
    const primaryHoverColor = token(isDark ? '--p-primary-300' : '--p-primary-600');
    const counts = monthlyCounts.value;

    return {
        labels: monthLabels,
        datasets: [
            {
                label: 'Pengajuan Cuti',
                backgroundColor: primaryColor,
                hoverBackgroundColor: primaryHoverColor,
                borderRadius: 6,
                borderSkipped: false,
                maxBarThickness: 32,
                data: counts
            }
        ]
    };
});

const monthlyChartOptions = computed(() => {
    const isDark = isDarkTheme.value;
    // Satu warna label untuk kedua sumbu: slate-400 lama di atas putih hanya 2,6:1 (audit-034 #3).
    const textColor = token(isDark ? '--p-zinc-400' : '--p-slate-500');
    const surfaceBorder = token(isDark ? '--p-zinc-800' : '--p-slate-200');

    return {
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: token(isDark ? '--p-zinc-900' : '--p-slate-800'),
                titleColor: token('--p-slate-50'),
                bodyColor: token('--p-slate-200'),
                borderColor: token(isDark ? '--p-zinc-700' : '--p-slate-600'),
                borderWidth: 1,
                padding: 10,
                cornerRadius: 8,
                displayColors: false,
                callbacks: {
                    title: (items) => `${fullMonthNames[items[0].dataIndex]} ${CURRENT_YEAR}`,
                    label: (item) => ` ${item.raw} Pengajuan Cuti`
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false,
                    drawBorder: false
                },
                ticks: {
                    color: textColor,
                    maxRotation: 0,
                    font: { size: 12, weight: '500' }
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: surfaceBorder,
                    drawBorder: false
                },
                ticks: {
                    color: textColor,
                    stepSize: 1,
                    precision: 0,
                    font: { size: 12 }
                }
            }
        }
    };
});

</script>

<template>
    <div class="space-y-6">
        <div>
            <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Dashboard Admin</h1>
            <p class="text-xs text-muted-color">Ringkasan cuti divisi {{ adminDivision || 'seluruh organisasi' }} tahun {{ CURRENT_YEAR }}</p>
        </div>

        <div
            v-if="dataFailed"
            role="alert"
            class="rounded-xl px-4 py-3.5 flex flex-wrap items-center gap-3 bg-(--status-warn-bg) text-(--status-warn-fg)"
        >
            <PhWarning :size="20" weight="regular" aria-hidden="true" class="shrink-0" />
            <p class="flex-1 min-w-48 text-sm">Data dashboard gagal dimuat, jadi angka belum bisa ditampilkan. Periksa koneksi lalu coba lagi.</p>
            <Button label="Coba lagi" severity="secondary" class="text-sm !min-h-11 sm:!min-h-9" @click="syncFromBackend()" />
        </div>
        <p v-else-if="dataLoading" role="status" class="sr-only">Memuat data dashboard…</p>

        <StatStrip data-tour="admin-stats" :items="statItems" :aria-busy="dataLoading" />

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            <div data-tour="admin-chart" class="card !mb-0 p-5">
                <div class="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-surface-200 dark:border-surface-800">
                    <div>
                        <h2 class="font-bold text-base text-surface-900 dark:text-surface-0 m-0">Pengajuan per Bulan</h2>
                        <p class="text-xs text-muted-color mt-0.5">Tanggal pengajuan dibuat, {{ adminDivision ? `divisi ${adminDivision}` : 'seluruh organisasi' }}, tahun {{ CURRENT_YEAR }}</p>
                    </div>
                    <Tag v-if="dataReady" :value="`${totalTahunIni} Pengajuan`" severity="info" class="font-semibold text-xs shrink-0" />
                </div>

                <div v-if="!dataReady || totalTahunIni === 0" class="h-64 sm:h-80 flex items-center justify-center text-center text-sm text-muted-color px-4">
                    <template v-if="dataLoading">Memuat data…</template>
                    <template v-else-if="dataFailed">Grafik belum bisa ditampilkan.</template>
                    <template v-else>Belum ada pengajuan cuti yang dibuat pada {{ CURRENT_YEAR }}.</template>
                </div>
                <div v-else class="h-64 sm:h-80 w-full pt-2">
                    <Chart type="bar" :data="monthlyChartData" :options="monthlyChartOptions" :pt="{ canvas: { role: 'img', 'aria-label': chartSummary } }" class="h-full w-full" />
                </div>
            </div>

            <AdminDashboardCalendar data-tour="admin-calendar"
                :division-requests="divisionRequests"
                :admin-division="adminDivision"
                :data-ready="dataReady"
            />
        </div>
    </div>
</template>
