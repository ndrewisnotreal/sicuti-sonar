<script setup>
import { ref, computed, onMounted } from 'vue';
import { isSuperAdmin, can, setActiveLeaveTypes } from '@/service/sicutiService';
import { adminService } from '@/service/adminService';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { PhPlus, PhPencilSimple, PhProhibit, PhCheck } from '@phosphor-icons/vue';
import ReadOnlyNotice from '@/components/common/ReadOnlyNotice.vue';
import LeaveTypeFormDialog from '@/components/admin/LeaveTypeFormDialog.vue';

const toast = useToast();
const confirm = useConfirm();
const dialogVisible = ref(false);
const isEditing = ref(false);
const leaveTypes = ref([]);
const loading = ref(false);
const loadError = ref(false);

const canManage = computed(() => isSuperAdmin() || can('master_data.manage_leave_types'));

const currentType = ref({
    id: '',
    code: '',
    name: '',
    description: '',
    usesQuota: true,
    requiresDocument: false,
    isActive: true,
    maxDays: null,
    allowBackdate: false,
    allowLateDocument: false,
    lateDocumentDays: 3
});

function fromApi(t) {
    return {
        id: t.kd_leave_type,
        code: t.code,
        name: t.nm_leave_type,
        description: t.description || '',
        usesQuota: Boolean(t.uses_quota),
        requiresDocument: Boolean(t.requires_document),
        isActive: Boolean(t.is_active),
        maxDays: t.max_days ? Number(t.max_days) : null,
        allowBackdate: Boolean(t.allow_backdate),
        allowLateDocument: Boolean(t.allow_late_document),
        lateDocumentDays: Number(t.late_document_days) || 3
    };
}


async function load() {
    loading.value = true;
    loadError.value = false;
    try {
        const list = await adminService.getLeaveTypes(true);
        leaveTypes.value = (Array.isArray(list) ? list : []).map(fromApi);
        setActiveLeaveTypes(list);
    } catch (err) {
        loadError.value = true;
        toast.add({ severity: 'error', summary: 'Jenis cuti gagal dimuat', detail: err.message, life: 4000 });
    } finally {
        loading.value = false;
    }
}

// Atribut konfigurasi ditulis sebagai teks; warna hanya untuk status (audit-012 #4).
function documentRule(t) {
    if (!t.requiresDocument) return 'Tidak wajib';
    return t.allowLateDocument ? `Wajib, boleh menyusul ${t.lateDocumentDays} hari` : 'Wajib';
}

function openAdd() {
    isEditing.value = false;
    const existingNums = leaveTypes.value
        .map((t) => {
            const m = String(t.id || '').match(/\d+/);
            return m ? parseInt(m[0], 10) : 0;
        })
        .filter((n) => !isNaN(n));
    const nextNum = (existingNums.length ? Math.max(...existingNums) : 0) + 1;
    currentType.value = {
        id: 'LT' + String(nextNum).padStart(3, '0'),
        code: '',
        name: '',
        description: '',
        usesQuota: false,
        requiresDocument: false,
        isActive: true,
        maxDays: null,
        allowBackdate: false,
        allowLateDocument: false,
        lateDocumentDays: 3
    };
    dialogVisible.value = true;
}

function openEdit(item) {
    isEditing.value = true;
    currentType.value = { ...item };
    dialogVisible.value = true;
}


function toggleStatus(item) {
    if (!item.isActive) return applyStatus(item);
    confirm.require({
        header: 'Nonaktifkan jenis cuti?',
        message: `${item.name} tidak bisa dipilih lagi di pengajuan baru. Pengajuan yang sudah ada tidak berubah.`,
        acceptLabel: 'Nonaktifkan',
        rejectLabel: 'Batal',
        acceptProps: { severity: 'danger' },
        rejectProps: { severity: 'secondary', outlined: true },
        accept: () => applyStatus(item)
    });
}

function toApi(t) {
    return {
        kd_leave_type: t.id || undefined,
        code: (t.code || '').trim(),
        nm_leave_type: (t.name || '').trim(),
        description: t.description?.trim() || undefined,
        uses_quota: t.usesQuota,
        requires_document: t.requiresDocument,
        is_active: t.isActive,
        max_days: t.maxDays ? Number(t.maxDays) : null,
        allow_backdate: t.allowBackdate,
        allow_late_document: t.requiresDocument && t.allowLateDocument,
        late_document_days: Number(t.lateDocumentDays) || 3
    };
}

async function applyStatus(item) {
    try {
        await adminService.upsertLeaveType(toApi({ ...item, isActive: !item.isActive }));
        await load();
        toast.add({
            severity: 'info',
            summary: 'Status',
            detail: `Status jenis cuti ${item.name} diubah menjadi ${!item.isActive ? 'Aktif' : 'Nonaktif'}`,
            life: 3000
        });
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Status gagal diubah', detail: err.message, life: 4000 });
    }
}

onMounted(load);
</script>

<template>
    <div class="space-y-6">
        <ReadOnlyNotice data-tour="readonly-notice" v-if="!canManage" module="jenis cuti" />

        <!-- Satu kartu halaman: judul dan aksi, lalu tabel (acuan 00b §6.1, audit-012 #5). -->
        <div class="card !mb-0">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Master Jenis Cuti</h1>
                    <p class="text-xs text-muted-color">Konfigurasi jenis cuti, aturan pengurangan kuota tahunan, dan syarat dokumen</p>
                </div>
                <Button data-tour="lt-add"
                    v-if="canManage"
                    severity="primary"
                    size="small"
                    class="text-xs font-bold flex items-center gap-1.5"
                    @click="openAdd"
                >
                    <PhPlus :size="14" weight="bold" aria-hidden="true" />
                    <span>Tambah Jenis Cuti</span>
                </Button>
            </div>

            <div v-if="loadError" role="alert" class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                <span>Jenis cuti gagal dimuat. Daftar di bawah belum lengkap.</span>
                <Button label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11" :loading="loading" @click="load" />
            </div>

            <div data-tour="lt-table" class="mt-6">
                <DataTable :value="leaveTypes" :loading="loading" class="p-datatable-sm text-xs" responsiveLayout="scroll">
                    <template #empty>
                        <div class="text-center py-8 text-muted-color">{{ loadError ? 'Jenis cuti belum termuat.' : 'Belum ada jenis cuti.' }}</div>
                    </template>
                    <Column field="code" header="Kode" style="width: 10%">
                        <template #body="{ data }">
                            <span class="font-bold text-surface-900 dark:text-surface-100">{{ data.code }}</span>
                        </template>
                    </Column>
                    <Column field="name" header="Nama Jenis Cuti" style="width: 25%">
                        <template #body="{ data }">
                            <div class="font-bold text-surface-900 dark:text-surface-100">{{ data.name }}</div>
                            <div class="text-xs text-muted-color">{{ data.description }}</div>
                        </template>
                    </Column>
                    <Column header="Mengurangi Kuota" style="width: 18%" :pt="{ headerCell: { 'data-tour': 'lt-col-quota' } }">
                        <template #body="{ data }">
                            <span class="text-surface-800 dark:text-surface-200">{{ data.usesQuota ? 'Ya, mengurangi kuota' : 'Tidak, cuti khusus' }}</span>
                        </template>
                    </Column>
                    <Column header="Wajib Dokumen" style="width: 18%">
                        <template #body="{ data }">
                            <span class="text-surface-800 dark:text-surface-200">{{ documentRule(data) }}</span>
                        </template>
                    </Column>
                    <Column header="Aturan" style="width: 16%" :pt="{ headerCell: { 'data-tour': 'lt-col-rules' } }">
                        <template #body="{ data }">
                            <div class="text-surface-800 dark:text-surface-200 space-y-0.5">
                                <div>{{ data.maxDays ? `Maks. ${data.maxDays} hari kerja` : 'Tanpa batas hari' }}</div>
                                <div>{{ data.allowBackdate ? 'Boleh tanggal lampau' : 'Tidak boleh tanggal lampau' }}</div>
                            </div>
                        </template>
                    </Column>
                    <Column header="Status" style="width: 12%">
                        <template #body="{ data }">
                            <Tag :value="data.isActive ? 'Aktif' : 'Nonaktif'" :severity="data.isActive ? 'success' : 'secondary'" />
                        </template>
                    </Column>
                    <Column v-if="canManage" header="Aksi" style="width: 17%">
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
                                    :class="[
                                        'w-9 h-9 flex items-center justify-center rounded-border transition-colors cursor-pointer',
                                        data.isActive
                                            ? 'text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20'
                                            : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                                    ]"
                                    :aria-label="`${data.isActive ? 'Nonaktifkan' : 'Aktifkan'} ${data.name}`"
                                    :title="data.isActive ? 'Nonaktifkan' : 'Aktifkan'"
                                    @click="toggleStatus(data)"
                                >
                                    <PhProhibit v-if="data.isActive" :size="14" weight="bold" aria-hidden="true" />
                                    <PhCheck v-else :size="14" weight="bold" aria-hidden="true" />
                                </button>
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <LeaveTypeFormDialog
            v-model:visible="dialogVisible"
            :is-editing="isEditing"
            :type-data="currentType"
            @saved="load"
        />
    </div>
</template>
