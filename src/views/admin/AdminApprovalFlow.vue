<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { adminService } from '@/service/adminService';
import { getAdminDivision, currentUser, isSuperAdmin, can } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { PhTreeStructure, PhPlus, PhPencilSimple, PhTrash, PhUsers, PhArrowsClockwise, PhX, PhCaretUp, PhCaretDown } from '@phosphor-icons/vue';
import ReadOnlyNotice from '@/components/common/ReadOnlyNotice.vue';
import ApprovalFlowStepDialog from '@/components/admin/ApprovalFlowStepDialog.vue';
import ApprovalFlowMembersDialog from '@/components/admin/ApprovalFlowMembersDialog.vue';
import ApprovalTemplateDialog from '@/components/admin/ApprovalTemplateDialog.vue';

const toast = useToast();
const confirm = useConfirm();
const loading = ref(false);
const flowsLoading = ref(false);
const reordering = ref(false);
// State gagal per sumber data: angka/daftar yang gagal dimuat ditulis "–", bukan 0 (audit-015 #4).
const loadError = ref(false);
const flowsError = ref(false);
const membersError = ref(false);
const anyLoadError = computed(() => loadError.value || flowsError.value || membersError.value);

const adminDivision = computed(() => getAdminDivision(currentUser.value));
const isSuper = computed(() => isSuperAdmin(currentUser.value));
const canManage = computed(() => isSuper.value || can('master_data.manage_approval'));

const templates = ref([]);
const departments = ref([]);
const approverRoles = ref([]);
const eligibleApprovers = ref([]);

const selectedTemplateId = ref('');
const flows = ref([]);
const members = ref([]);

const templateDialogVisible = ref(false);
const isEditingTemplate = ref(false);
const templateForm = ref({ id_template: '', kd_dept: '', nm_template: '', is_active: true });

const flowDialogVisible = ref(false);
const selectedFlow = ref(null);
const removingApprover = ref('');

const membersDialogVisible = ref(false);

async function loadInitialData() {
    loading.value = true;
    loadError.value = false;
    try {
        const [tplData, deptsData, rolesData, eligibleData] = await Promise.all([
            adminService.getApprovalTemplates(),
            adminService.getDepartments().catch(() => []),
            adminService.getApproverRoles().catch(() => []),
            adminService.getEligibleApprovers().catch(() => [])
        ]);
        departments.value = Array.isArray(deptsData) ? deptsData : [];
        approverRoles.value = Array.isArray(rolesData) ? rolesData : [];
        eligibleApprovers.value = Array.isArray(eligibleData) ? eligibleData : [];

        const rawTemplates = Array.isArray(tplData) ? tplData : [];
        templates.value = rawTemplates.filter((t) => !(adminDivision.value && t.kd_dept && t.kd_dept !== adminDivision.value));

        if (!templates.value.some((t) => t.id_template === selectedTemplateId.value)) {
            selectedTemplateId.value = templates.value[0]?.id_template || '';
        } else {
            await loadTemplateDetail(selectedTemplateId.value);
        }
    } catch (err) {
        loadError.value = true;
        toast.add({ severity: 'error', summary: 'Gagal Memuat Data', detail: err.message || 'Gagal mengambil data templat alur approval', life: 3000 });
    } finally {
        loading.value = false;
    }
}

async function loadFlows(templateId) {
    if (!templateId) {
        flows.value = [];
        return;
    }
    flowsLoading.value = true;
    flowsError.value = false;
    try {
        const data = await adminService.getApprovalFlows(templateId);
        flows.value = Array.isArray(data) ? data : [];
    } catch (err) {
        flowsError.value = true;
        toast.add({ severity: 'error', summary: 'Gagal Memuat Alur', detail: err.message || 'Gagal memuat tingkat approval', life: 3000 });
    } finally {
        flowsLoading.value = false;
    }
}

async function loadMembers(templateId) {
    if (!templateId) {
        members.value = [];
        return;
    }
    membersError.value = false;
    try {
        const data = await adminService.getTemplateMembers(templateId);
        members.value = Array.isArray(data) ? data : [];
    } catch (err) {
        membersError.value = true;
        console.error('Failed to load members count:', err);
    }
}

function loadTemplateDetail(templateId) {
    return Promise.all([loadFlows(templateId), loadMembers(templateId)]);
}

watch(selectedTemplateId, (newId) => {
    if (newId) loadTemplateDetail(newId);
    else {
        flows.value = [];
        members.value = [];
    }
});

const currentTemplate = computed(() => templates.value.find((t) => t.id_template === selectedTemplateId.value));
const noTemplates = computed(() => !loading.value && !loadError.value && templates.value.length === 0);
// Pesan daftar tingkat sesuai keadaan, tidak menyuruh menambah tingkat saat memuat atau gagal (audit-016 #4).
const levelsEmptyText = computed(() => {
    if (loading.value || flowsLoading.value) return 'Memuat tingkat approval…';
    if (loadError.value || flowsError.value) return 'Tingkat approval belum termuat.';
    return canManage.value
        ? 'Belum ada tingkat approval untuk templat ini. Klik "Tambah Tingkat" lalu pilih peran.'
        : 'Belum ada tingkat approval untuk templat ini.';
});

function approverLabel(a) {
    return `${a.nama}${a.is_locked ? ' (terkunci)' : a.can_approve === false ? ' (tanpa izin)' : ''}`;
}

// Kembalikan fokus keyboard setelah daftar berubah; tombol yang terlihat saja (tabel desktop atau daftar HP) (audit-016 #1).
async function focusFlowControl(selectors) {
    await nextTick();
    for (const sel of selectors) {
        const el = [...document.querySelectorAll(sel)].find((e) => e.offsetParent && !e.disabled);
        if (el) return el.focus();
    }
}

function deptName(kd) {
    return departments.value.find((d) => d.kd_dept === kd)?.nm_dept || kd;
}

async function onRowReorder(event) {
    const previous = flows.value;
    flows.value = event.value.map((f, i) => ({ ...f, level: i + 1 }));
    reordering.value = true;
    try {
        const data = await adminService.reorderApprovalFlows(
            selectedTemplateId.value,
            flows.value.map((f) => f.id_flow)
        );
        if (Array.isArray(data) && data.length) flows.value = data;
        toast.add({ severity: 'success', summary: 'Urutan disimpan', detail: flows.value.map((f) => f.nm_flow).join(' → '), life: 3000 });
    } catch (err) {
        flows.value = previous;
        toast.add({ severity: 'error', summary: 'Urutan gagal disimpan', detail: err.message || 'Muat ulang halaman lalu coba lagi', life: 4000 });
    } finally {
        reordering.value = false;
    }
}

// Alternatif tanpa seret: susun urutan baru lalu pakai jalur simpan yang sama dengan drag (audit-015 #1).
// Tombol tidak di-disable selama menyimpan agar fokus tidak hilang; penjaganya di sini.
async function moveFlow(index, delta) {
    const target = index + delta;
    if (reordering.value || target < 0 || target >= flows.value.length) return;
    const moved = flows.value[index].id_flow;
    const next = [...flows.value];
    [next[index], next[target]] = [next[target], next[index]];
    await onRowReorder({ value: next });
    const same = delta < 0 ? 'up' : 'down';
    const other = delta < 0 ? 'down' : 'up';
    await focusFlowControl([`[data-flow-action="${moved}:${same}"]`, `[data-flow-action="${moved}:${other}"]`]);
}

function openCreateTemplate() {
    isEditingTemplate.value = false;
    templateForm.value = {
        id_template: '',
        kd_dept: adminDivision.value || departments.value[0]?.kd_dept || 'SIT',
        nm_template: '',
        is_active: true
    };
    templateDialogVisible.value = true;
}

function openEditTemplate() {
    if (!currentTemplate.value) return;
    isEditingTemplate.value = true;
    const { id_template, kd_dept, nm_template, is_active } = currentTemplate.value;
    templateForm.value = { id_template, kd_dept, nm_template, is_active };
    templateDialogVisible.value = true;
}

async function handleTemplateSaved(savedResult) {
    if (savedResult?.id_template) {
        selectedTemplateId.value = savedResult.id_template;
    }
    await loadInitialData();
}

function deleteTemplate(template) {
    if (!template) return;
    confirm.require({
        header: 'Hapus Templat Approval?',
        message: `Templat "${template.nm_template}" akan dihapus. Anggotanya tidak bisa mengajukan cuti sampai dimasukkan ke templat lain. Lanjutkan?`,
        acceptLabel: 'Hapus',
        rejectLabel: 'Batal',
        acceptProps: { severity: 'danger' },
        rejectProps: { severity: 'secondary', outlined: true },
        // Fokus awal di Batal: Enter tidak langsung menjalankan aksi yang tidak bisa diurungkan (audit-016 #3).
        defaultFocus: 'reject',
        accept: async () => {
            try {
                await adminService.deleteApprovalTemplate(template.id_template);
                toast.add({ severity: 'success', summary: 'Berhasil Dihapus', detail: `Templat "${template.nm_template}" berhasil dihapus`, life: 3000 });
                selectedTemplateId.value = '';
                await loadInitialData();
                await focusFlowControl(['[aria-labelledby="flow-template-label"]']);
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal Hapus', detail: err.message || 'Gagal menghapus templat', life: 3000 });
            }
        }
    });
}

function openAddFlow() {
    selectedFlow.value = null;
    flowDialogVisible.value = true;
}

function openEditFlow(flow) {
    selectedFlow.value = flow;
    flowDialogVisible.value = true;
}

async function removeApprover(flow, approver) {
    removingApprover.value = `${flow.id_flow}:${approver.uid_user_system}`;
    try {
        await adminService.assignFlowUsers({
            id_flow: flow.id_flow,
            users: (flow.approvers || []).map((a) => a.uid_user_system).filter((uid) => uid !== approver.uid_user_system)
        });
        toast.add({ severity: 'info', summary: 'Approver dikeluarkan', detail: `${approver.nama} tidak lagi menjadi approver tingkat ${flow.nm_flow}`, life: 3000 });
        await loadFlows(selectedTemplateId.value);
        await focusFlowControl([`[data-flow-action="${flow.id_flow}:edit"]`, '#flow-levels-heading']);
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: err.message || 'Gagal mengeluarkan approver', life: 3000 });
    } finally {
        removingApprover.value = '';
    }
}

// Keluarkan approver kini dikonfirmasi seperti aksi hapus lain (audit-015 #2).
function confirmRemoveApprover(flow, approver) {
    confirm.require({
        header: 'Keluarkan approver?',
        message: `${approver.nama} tidak lagi menjadi approver tingkat ${flow.nm_flow} di templat ini.`,
        acceptLabel: 'Keluarkan',
        rejectLabel: 'Batal',
        acceptProps: { severity: 'danger' },
        rejectProps: { severity: 'secondary', outlined: true },
        // Fokus awal di Batal: Enter tidak langsung menjalankan aksi yang tidak bisa diurungkan (audit-016 #3).
        defaultFocus: 'reject',
        accept: () => removeApprover(flow, approver)
    });
}

function deleteFlow(flow) {
    confirm.require({
        header: 'Hapus tingkat approval?',
        message: `Tingkat ${flow.level} (${flow.nm_flow}) akan dihapus dan tingkat di bawahnya naik satu urutan. Pengajuan yang sudah berjalan tidak terpengaruh.`,
        acceptLabel: 'Hapus',
        rejectLabel: 'Batal',
        acceptProps: { severity: 'danger' },
        rejectProps: { severity: 'secondary', outlined: true },
        // Fokus awal di Batal: Enter tidak langsung menjalankan aksi yang tidak bisa diurungkan (audit-016 #3).
        defaultFocus: 'reject',
        accept: async () => {
            try {
                await adminService.deleteApprovalFlow(flow.id_flow);
                toast.add({ severity: 'info', summary: 'Dihapus', detail: `Tingkat ${flow.nm_flow} telah dihapus`, life: 3000 });
                await loadFlows(selectedTemplateId.value);
                await focusFlowControl(['#flow-levels-heading']);
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal Hapus', detail: err.message || 'Gagal menghapus tingkat approval', life: 3000 });
            }
        }
    });
}

onMounted(() => {
    loadInitialData();
});
</script>

<template>
    <div class="space-y-6">
        <ReadOnlyNotice data-tour="readonly-notice" v-if="!canManage" module="alur approval" />

        <!-- Satu kartu halaman dengan bagian berpemisah: templat, tingkat, anggota (acuan 00b §6.1, audit-015 #6). -->
        <div class="card !mb-0">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                        <PhTreeStructure :size="22" weight="regular" class="text-primary shrink-0" aria-hidden="true" />
                        <span>Konfigurasi Alur Approval</span>
                    </h1>
                    <p class="text-xs text-muted-color">Atur templat, anggota, dan urutan tingkat approval cuti. Setiap tingkat diisi satu peran.</p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <Button
                        severity="secondary"
                        outlined
                        size="small"
                        class="text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                        :loading="loading || flowsLoading"
                        @click="loadInitialData"
                    >
                        <PhArrowsClockwise :size="14" weight="bold" aria-hidden="true" />
                        <span>Segarkan</span>
                    </Button>
                    <Button data-tour="flow-new-template"
                        v-if="canManage"
                        severity="primary"
                        outlined
                        size="small"
                        class="text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                        @click="openCreateTemplate"
                    >
                        <PhPlus :size="14" weight="bold" aria-hidden="true" />
                        <span>Templat Baru</span>
                    </Button>
                </div>
            </div>

            <div v-if="anyLoadError" role="alert" class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                <span>Sebagian data alur approval gagal dimuat. Angka dan daftar di bawah belum lengkap.</span>
                <Button label="Coba lagi" severity="secondary" size="small" class="text-xs !min-h-11" :loading="loading || flowsLoading" @click="loadInitialData" />
            </div>

            <section data-tour="flow-template" class="mt-6 space-y-3">
                <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                    <div class="w-full sm:w-80">
                        <label id="flow-template-label" class="block text-xs font-semibold text-surface-800 dark:text-surface-200 mb-1">Templat approval</label>
                        <Select
                            v-model="selectedTemplateId"
                            :options="templates"
                            optionLabel="nm_template"
                            optionValue="id_template"
                            placeholder="Pilih Templat"
                            ariaLabelledby="flow-template-label"
                            class="w-full text-xs"
                            size="small"
                        />
                    </div>

                    <div v-if="currentTemplate && canManage" class="flex items-center gap-2">
                        <Button size="small" severity="secondary" text class="text-xs font-semibold flex items-center gap-1.5" @click="openEditTemplate">
                            <PhPencilSimple :size="14" weight="bold" aria-hidden="true" />
                            <span>Ubah Templat</span>
                        </Button>
                        <Button
                            size="small"
                            severity="danger"
                            text
                            class="text-xs font-semibold flex items-center gap-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                            @click="deleteTemplate(currentTemplate)"
                        >
                            <PhTrash :size="14" weight="bold" aria-hidden="true" />
                            <span>Hapus Templat</span>
                        </Button>
                    </div>
                </div>

                <p v-if="currentTemplate" class="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-color">
                    <span>Departemen: <strong class="text-surface-900 dark:text-surface-100">{{ currentTemplate.kd_dept ? deptName(currentTemplate.kd_dept) : 'Semua Departemen' }}</strong></span>
                    <span>Total: <strong class="text-surface-900 dark:text-surface-100 tabular-nums">{{ flowsError ? '–' : flows.length }}</strong> tingkat approval</span>
                </p>
            </section>

            <section data-tour="flow-levels" class="mt-6 pt-6 border-t border-surface-200 dark:border-surface-700">
                <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
                    <div>
                        <h2 id="flow-levels-heading" tabindex="-1" class="text-sm font-bold text-surface-900 dark:text-surface-100 focus:outline-none">Tingkat approval</h2>
                        <p v-if="canManage && flows.length > 1" class="text-xs text-muted-color">
                            <span class="hidden sm:inline">Geser ikon ≡ atau pakai tombol naik/turun untuk mengubah urutan.</span>
                            <span class="sm:hidden">Pakai tombol naik/turun untuk mengubah urutan.</span>
                        </p>
                    </div>
                    <Button data-tour="flow-add-level"
                        v-if="canManage && !noTemplates"
                        severity="primary"
                        size="small"
                        class="text-xs font-bold flex items-center gap-1.5"
                        :disabled="!selectedTemplateId"
                        @click="openAddFlow"
                    >
                        <PhPlus :size="14" weight="bold" aria-hidden="true" />
                        <span>Tambah Tingkat</span>
                    </Button>
                </div>

                <!-- Pesan sesuai keadaan: memuat, belum ada templat, gagal, atau templat tanpa tingkat (audit-016 #4). -->
                <p v-if="noTemplates" class="py-8 text-center text-sm text-muted-color">
                    Belum ada templat approval.<template v-if="canManage"> Buat dengan <strong>Templat Baru</strong>.</template>
                </p>
                <template v-else>
                    <!-- Tabel dengan drag mulai sm; di HP daftar bertumpuk agar aksi tidak tersembunyi di geser horizontal (audit-016 #5). -->
                    <div class="hidden sm:block">
                        <DataTable
                            :value="flows"
                            :loading="loading || flowsLoading || reordering"
                            dataKey="id_flow"
                            :reorderableRows="canManage"
                            class="p-datatable-sm text-xs"
                            responsiveLayout="scroll"
                            @rowReorder="onRowReorder"
                        >
                            <template #empty>
                                <div class="text-center py-8 text-muted-color">{{ levelsEmptyText }}</div>
                            </template>

                            <Column v-if="canManage" rowReorder style="width: 3rem" />

                            <Column field="level" header="Urutan" style="width: 14%">
                                <template #body="{ data, index }">
                                    <div class="flex items-center gap-1">
                                        <span class="w-7 h-7 rounded-full bg-primary-50 text-primary-700 dark:bg-primary/10 dark:text-primary font-bold inline-flex items-center justify-center text-xs tabular-nums">
                                            {{ data.level }}
                                        </span>
                                        <template v-if="canManage && flows.length > 1">
                                            <button
                                                type="button"
                                                class="w-8 h-8 flex items-center justify-center rounded-border text-surface-500 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                                :data-flow-action="`${data.id_flow}:up`"
                                                :disabled="index === 0"
                                                :aria-label="`Naikkan ${data.nm_flow}`"
                                                title="Naikkan"
                                                @click="moveFlow(index, -1)"
                                            >
                                                <PhCaretUp :size="14" weight="bold" aria-hidden="true" />
                                            </button>
                                            <button
                                                type="button"
                                                class="w-8 h-8 flex items-center justify-center rounded-border text-surface-500 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                                :data-flow-action="`${data.id_flow}:down`"
                                                :disabled="index === flows.length - 1"
                                                :aria-label="`Turunkan ${data.nm_flow}`"
                                                title="Turunkan"
                                                @click="moveFlow(index, 1)"
                                            >
                                                <PhCaretDown :size="14" weight="bold" aria-hidden="true" />
                                            </button>
                                        </template>
                                    </div>
                                </template>
                            </Column>

                            <Column field="nm_flow" header="Peran" style="width: 22%">
                                <template #body="{ data }">
                                    <div class="font-bold text-surface-900 dark:text-surface-100">{{ data.nm_flow }}</div>
                                </template>
                            </Column>

                            <Column header="Approver" style="width: 42%">
                                <template #body="{ data }">
                                    <div v-if="data.approvers && data.approvers.length > 0" class="flex flex-wrap gap-1">
                                        <span
                                            v-for="a in data.approvers"
                                            :key="a.uid_user_system"
                                            class="inline-flex items-center gap-1 py-0.5 whitespace-nowrap rounded bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-xs text-surface-800 dark:text-surface-200"
                                            :class="[canManage ? 'pl-2 pr-0.5' : 'px-2', a.is_locked || a.can_approve === false ? 'opacity-70' : '']"
                                            :title="a.nm_role ? `Peran: ${a.nm_role}` : undefined"
                                        >
                                            {{ approverLabel(a) }}
                                            <button
                                                v-if="canManage"
                                                type="button"
                                                class="w-6 h-6 inline-flex items-center justify-center rounded text-surface-500 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                                :aria-label="`Keluarkan ${a.nama} dari tingkat ${data.nm_flow}`"
                                                :title="`Keluarkan ${a.nama} dari tingkat ini`"
                                                @click="confirmRemoveApprover(data, a)"
                                            >
                                                <PhX :size="14" weight="bold" aria-hidden="true" />
                                            </button>
                                        </span>
                                    </div>
                                </template>
                            </Column>

                            <Column v-if="canManage" header="Aksi" style="width: 12%">
                                <template #body="{ data }">
                                    <div class="flex items-center gap-1">
                                        <button
                                            type="button"
                                            class="w-9 h-9 flex items-center justify-center text-surface-500 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 rounded-border transition-colors cursor-pointer"
                                            :data-flow-action="`${data.id_flow}:edit`"
                                            :aria-label="`Ubah tingkat ${data.nm_flow}`"
                                            title="Ubah Tingkat"
                                            @click="openEditFlow(data)"
                                        >
                                            <PhPencilSimple :size="14" weight="bold" aria-hidden="true" />
                                        </button>
                                        <button
                                            type="button"
                                            class="w-9 h-9 flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-border transition-colors cursor-pointer"
                                            :aria-label="`Hapus tingkat ${data.nm_flow}`"
                                            title="Hapus Tingkat"
                                            @click="deleteFlow(data)"
                                        >
                                            <PhTrash :size="14" weight="bold" aria-hidden="true" />
                                        </button>
                                    </div>
                                </template>
                            </Column>
                        </DataTable>
                    </div>

                    <div class="sm:hidden" :aria-busy="loading || flowsLoading || reordering">
                        <p v-if="!flows.length" class="py-8 text-center text-xs text-muted-color">{{ levelsEmptyText }}</p>
                        <ol v-else class="divide-y divide-surface-200 dark:divide-surface-700" :class="{ 'opacity-60': flowsLoading || reordering }">
                            <li v-for="(f, index) in flows" :key="f.id_flow" class="py-3 space-y-2">
                                <div class="flex items-center gap-2">
                                    <span class="w-7 h-7 shrink-0 rounded-full bg-primary-50 text-primary-700 dark:bg-primary/10 dark:text-primary font-bold inline-flex items-center justify-center text-xs tabular-nums">{{ f.level }}</span>
                                    <span class="flex-1 min-w-0 text-sm font-bold text-surface-900 dark:text-surface-100">{{ f.nm_flow }}</span>
                                    <template v-if="canManage && flows.length > 1">
                                        <button
                                            type="button"
                                            class="w-9 h-9 flex items-center justify-center rounded-border text-surface-500 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                            :data-flow-action="`${f.id_flow}:up`"
                                            :disabled="index === 0"
                                            :aria-label="`Naikkan ${f.nm_flow}`"
                                            @click="moveFlow(index, -1)"
                                        >
                                            <PhCaretUp :size="16" weight="bold" aria-hidden="true" />
                                        </button>
                                        <button
                                            type="button"
                                            class="w-9 h-9 flex items-center justify-center rounded-border text-surface-500 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                            :data-flow-action="`${f.id_flow}:down`"
                                            :disabled="index === flows.length - 1"
                                            :aria-label="`Turunkan ${f.nm_flow}`"
                                            @click="moveFlow(index, 1)"
                                        >
                                            <PhCaretDown :size="16" weight="bold" aria-hidden="true" />
                                        </button>
                                    </template>
                                </div>
                                <div v-if="f.approvers && f.approvers.length" class="flex flex-wrap gap-1 pl-9">
                                    <span
                                        v-for="a in f.approvers"
                                        :key="a.uid_user_system"
                                        class="inline-flex items-center gap-1 py-0.5 whitespace-nowrap rounded bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-xs text-surface-800 dark:text-surface-200"
                                        :class="[canManage ? 'pl-2 pr-0.5' : 'px-2', a.is_locked || a.can_approve === false ? 'opacity-70' : '']"
                                    >
                                        {{ approverLabel(a) }}
                                        <button
                                            v-if="canManage"
                                            type="button"
                                            class="w-6 h-6 inline-flex items-center justify-center rounded text-surface-500 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40 cursor-pointer"
                                            :aria-label="`Keluarkan ${a.nama} dari tingkat ${f.nm_flow}`"
                                            @click="confirmRemoveApprover(f, a)"
                                        >
                                            <PhX :size="14" weight="bold" aria-hidden="true" />
                                        </button>
                                    </span>
                                </div>
                                <div v-if="canManage" class="flex items-center gap-2 pl-9">
                                    <Button
                                        severity="secondary"
                                        outlined
                                        size="small"
                                        class="text-xs !min-h-9"
                                        :data-flow-action="`${f.id_flow}:edit`"
                                        :aria-label="`Ubah tingkat ${f.nm_flow}`"
                                        @click="openEditFlow(f)"
                                    >
                                        <PhPencilSimple :size="14" weight="bold" aria-hidden="true" />
                                        <span>Ubah</span>
                                    </Button>
                                    <Button
                                        severity="danger"
                                        text
                                        size="small"
                                        class="text-xs !min-h-9"
                                        :aria-label="`Hapus tingkat ${f.nm_flow}`"
                                        @click="deleteFlow(f)"
                                    >
                                        <PhTrash :size="14" weight="bold" aria-hidden="true" />
                                        <span>Hapus</span>
                                    </Button>
                                </div>
                            </li>
                        </ol>
                    </div>
                </template>
            </section>

            <section v-if="currentTemplate" data-tour="flow-members" class="mt-6 pt-6 border-t border-surface-200 dark:border-surface-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 class="text-sm font-bold text-surface-900 dark:text-surface-100">
                        Anggota templat · <span class="tabular-nums">{{ membersError ? '–' : members.length }}</span> karyawan
                    </h2>
                    <p class="text-xs text-muted-color">
                        <template v-if="membersError">Jumlah anggota belum termuat.</template>
                        <template v-else>Karyawan yang alur persetujuan cutinya mengikuti templat {{ currentTemplate.nm_template }}.</template>
                    </p>
                </div>
                <Button
                    severity="primary"
                    outlined
                    size="small"
                    class="text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
                    @click="membersDialogVisible = true"
                >
                    <PhUsers :size="14" weight="bold" aria-hidden="true" />
                    <span>{{ canManage ? 'Kelola Anggota Templat' : 'Lihat Anggota Templat' }}</span>
                </Button>
            </section>
        </div>

        <ApprovalFlowStepDialog
            v-model:visible="flowDialogVisible"
            :flow-data="selectedFlow"
            :template-id="selectedTemplateId"
            :template-dept="currentTemplate?.kd_dept"
            :flows="flows"
            :eligible-approvers="eligibleApprovers"
            :approver-roles="approverRoles"
            @saved="loadFlows(selectedTemplateId)"
        />

        <ApprovalFlowMembersDialog
            v-model:visible="membersDialogVisible"
            :template="currentTemplate"
            :departments="departments"
            :can-manage="canManage"
            @changed="loadMembers(selectedTemplateId)"
        />

        <ApprovalTemplateDialog
            v-model:visible="templateDialogVisible"
            :is-editing="isEditingTemplate"
            :template-data="templateForm"
            :departments="departments"
            :admin-division="adminDivision"
            :templates="templates"
            @saved="handleTemplateSaved"
        />
    </div>
</template>
