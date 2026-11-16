<script setup>
import { ref, computed } from 'vue';
import { sicutiState, syncFromBackend, isSuperAdmin, can, formatDate, CURRENT_YEAR } from '@/service/sicutiService';
import { useConfirm } from 'primevue/useconfirm';
import { adminService } from '@/service/adminService';
import { useToast } from 'primevue/usetoast';
import { PhPlus, PhPencilSimple, PhTrash, PhUploadSimple } from '@phosphor-icons/vue';
import ReadOnlyNotice from '@/components/common/ReadOnlyNotice.vue';
import HolidayFormDialog from '@/components/admin/HolidayFormDialog.vue';
import HolidayBatchUploadDialog from '@/components/admin/HolidayBatchUploadDialog.vue';

const toast = useToast();
const confirm = useConfirm();

const canManage = computed(() => isSuperAdmin() || can('master_data.manage_holidays'));

const dialogVisible = ref(false);
const isEditing = ref(false);
const selectedHoliday = ref(null);

const importDialogVisible = ref(false);

function dateLabel(h) {
    if (!h.endDate || h.endDate === h.date) return formatDate(h.date);
    return `${formatDate(h.date)} – ${formatDate(h.endDate)}`;
}

const holidayCounts = computed(() => {
    const list = sicutiState.holidays || [];
    const national = list.filter((h) => h.type === 'national').length;
    return { national, collective: list.length - national };
});

function openAdd() {
    isEditing.value = false;
    selectedHoliday.value = null;
    dialogVisible.value = true;
}

function openEdit(item) {
    isEditing.value = true;
    selectedHoliday.value = { ...item };
    dialogVisible.value = true;
}

function openImportHolidays() {
    importDialogVisible.value = true;
}

function deleteHoliday(item) {
    confirm.require({
        header: 'Hapus hari libur?',
        message: `${item.name} akan dihapus dari kalender libur.`,
        acceptLabel: 'Hapus',
        rejectLabel: 'Batal',
        acceptProps: { severity: 'danger' },
        rejectProps: { severity: 'secondary', outlined: true },
        accept: async () => {
            try {
                await adminService.deleteHoliday(item.id);
                await syncFromBackend({ fresh: true });
                toast.add({ severity: 'info', summary: 'Dihapus', detail: `Hari libur ${item.name} telah dihapus`, life: 3000 });
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Hari libur gagal dihapus', detail: err.message, life: 4000 });
            }
        }
    });
}
</script>

<template>
    <div class="space-y-6">
        <ReadOnlyNotice data-tour="readonly-notice" v-if="!canManage" module="hari libur" />

        <!-- Satu kartu halaman: judul dan aksi, ringkasan, lalu tabel (acuan 00b §6.1, audit-014 #4). -->
        <div class="card !mb-0">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Master Hari Libur & Cuti Bersama {{ CURRENT_YEAR }}</h1>
                    <p class="text-xs text-muted-color">Tanggal libur resmi yang dikecualikan dari pemotongan kuota cuti tahunan</p>
                </div>
                <div class="flex items-center gap-2">
                    <Button data-tour="hol-import"
                        v-if="canManage"
                        severity="secondary"
                        outlined
                        size="small"
                        class="font-semibold flex items-center gap-1.5"
                        @click="openImportHolidays"
                    >
                        <PhUploadSimple :size="14" weight="bold" aria-hidden="true" />
                        <span>Impor CSV</span>
                    </Button>
                    <Button data-tour="hol-add"
                        v-if="canManage"
                        severity="primary"
                        size="small"
                        class="font-semibold flex items-center gap-1.5"
                        @click="openAdd"
                    >
                        <PhPlus :size="14" weight="bold" aria-hidden="true" />
                        <span>Tambah Hari Libur</span>
                    </Button>
                </div>
            </div>

            <div data-tour="hol-table" class="mt-6">
                <p class="flex flex-wrap items-center gap-x-5 gap-y-2 pb-3 text-sm text-surface-700 dark:text-surface-300">
                    <span>Libur Nasional <strong class="text-surface-900 dark:text-surface-0 tabular-nums">{{ holidayCounts.national }}</strong></span>
                    <span>Cuti Bersama <strong class="text-surface-900 dark:text-surface-0 tabular-nums">{{ holidayCounts.collective }}</strong></span>
                </p>
                <DataTable :value="sicutiState.holidays" paginator :rows="10" class="p-datatable-sm text-sm" responsiveLayout="scroll">
                    <template #empty>
                        <div class="text-center py-8 text-muted-color">Belum ada hari libur tahun {{ CURRENT_YEAR }}.</div>
                    </template>
                    <Column field="date" header="Tanggal" style="width: 24%">
                        <template #body="{ data }">
                            <span v-if="data.date" class="font-semibold text-surface-900 dark:text-surface-100">{{ dateLabel(data) }}</span>
                            <span v-else class="text-muted-color">-</span>
                        </template>
                    </Column>
                    <Column field="name" header="Nama hari libur" style="width: 38%">
                        <template #body="{ data }">
                            <span class="font-semibold text-surface-800 dark:text-surface-200">{{ data.name }}</span>
                        </template>
                    </Column>
                    <!-- Kategori memakai Tag yang sama dengan pratinjau impor; merah selaras dengan hari libur di Kalender Cuti (audit-014 #3). -->
                    <Column field="type" header="Kategori" style="width: 23%" :pt="{ headerCell: { 'data-tour': 'hol-col-type' } }">
                        <template #body="{ data }">
                            <Tag :value="data.type === 'national' ? 'Libur Nasional' : 'Cuti Bersama'" :severity="data.type === 'national' ? 'danger' : 'warn'" />
                        </template>
                    </Column>
                    <Column v-if="canManage" header="Aksi" style="width: 15%">
                        <template #body="{ data }">
                            <div class="flex items-center gap-1">
                                <button
                                    type="button"
                                    class="w-9 h-9 flex items-center justify-center text-surface-500 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 rounded-border transition-colors cursor-pointer"
                                    :aria-label="`Ubah ${data.name}`"
                                    title="Ubah"
                                    @click="openEdit(data)"
                                >
                                    <PhPencilSimple :size="14" weight="bold" aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    class="w-9 h-9 flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-border transition-colors cursor-pointer"
                                    :aria-label="`Hapus ${data.name}`"
                                    title="Hapus"
                                    @click="deleteHoliday(data)"
                                >
                                    <PhTrash :size="14" weight="bold" aria-hidden="true" />
                                </button>
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <HolidayFormDialog
            v-model:visible="dialogVisible"
            :is-editing="isEditing"
            :holiday-data="selectedHoliday"
            @saved="syncFromBackend"
        />

        <HolidayBatchUploadDialog
            v-model:visible="importDialogVisible"
            :year="CURRENT_YEAR"
            @uploaded="syncFromBackend"
        />
    </div>
</template>
