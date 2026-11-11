<script setup>
import { ref, computed, watch } from 'vue';
import { adminService } from '@/service/adminService';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { memberChoices } from '@/utils/approvalFlowOptions';
import ApprovalFlowAddMemberDialog from '@/components/admin/ApprovalFlowAddMemberDialog.vue';
import { PhPlus, PhUserMinus, PhUsers } from '@phosphor-icons/vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    template: {
        type: Object,
        default: null
    },
    departments: {
        type: Array,
        default: () => []
    },
    canManage: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:visible', 'changed']);
const toast = useToast();
const confirm = useConfirm();

const members = ref([]);
const loading = ref(false);

const memberDialogVisible = ref(false);
const memberCandidates = ref([]);

function deptName(kd) {
    return (props.departments || []).find((d) => d.kd_dept === kd)?.nm_dept || kd;
}

const candidateOptions = computed(() =>
    memberChoices(memberCandidates.value, props.template?.kd_dept)
);

watch(
    () => props.visible,
    (isOpen) => {
        if (isOpen && props.template?.id_template) {
            loadMembers();
        } else {
            members.value = [];
        }
    }
);

async function loadMembers() {
    if (!props.template?.id_template) return;
    loading.value = true;
    try {
        const data = await adminService.getTemplateMembers(props.template.id_template);
        members.value = Array.isArray(data) ? data : [];
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal Memuat Anggota', detail: err.message || 'Gagal memuat anggota templat', life: 3000 });
    } finally {
        loading.value = false;
    }
}

async function openAddMembers() {
    if (!props.template?.id_template) return;
    memberCandidates.value = [];
    memberDialogVisible.value = true;
    try {
        const data = await adminService.getMemberCandidates(props.template.id_template);
        memberCandidates.value = Array.isArray(data) ? data : [];
    } catch (err) {
        memberDialogVisible.value = false;
        toast.add({ severity: 'error', summary: 'Gagal', detail: err.message || 'Gagal memuat daftar karyawan', life: 3000 });
    }
}

function handleMembersAdded(data) {
    if (Array.isArray(data)) members.value = data;
    else loadMembers();
    emit('changed');
}

function removeMember(member) {
    confirm.require({
        header: 'Keluarkan dari templat?',
        message: `${member.nama} dikeluarkan dari ${props.template?.nm_template || 'templat ini'}. Ia tidak bisa mengajukan cuti sampai dimasukkan ke templat lain.`,
        acceptLabel: 'Keluarkan',
        rejectLabel: 'Batal',
        acceptProps: { severity: 'danger' },
        rejectProps: { severity: 'secondary', outlined: true },
        // Fokus awal di Batal: Enter tidak langsung menjalankan aksi yang tidak bisa diurungkan (audit-016 #3).
        defaultFocus: 'reject',
        accept: async () => {
            try {
                await adminService.removeTemplateMember(member.uid_user_system);
                toast.add({ severity: 'info', summary: 'Dikeluarkan', detail: `${member.nama} dikeluarkan dari templat`, life: 3000 });
                await loadMembers();
                emit('changed');
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal Hapus', detail: err.message || 'Gagal mengeluarkan anggota', life: 3000 });
            }
        }
    });
}
</script>

<template>
    <Dialog
        :visible="visible"
        modal
        :header="`Anggota Templat: ${template?.nm_template || '-'}`"
        :style="{ width: '680px' }"
        :breakpoints="{ '960px': '85vw', '640px': '94vw' }"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="space-y-4 pt-1 text-xs">
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                    <PhUsers :size="16" weight="bold" class="text-primary" aria-hidden="true" />
                    <span class="text-xs font-bold text-surface-800 dark:text-surface-200">
                        Total Anggota: {{ members.length }}
                    </span>
                </div>
                <Button
                    v-if="canManage"
                    severity="primary"
                    size="small"
                    class="text-xs font-semibold flex items-center gap-1.5"
                    @click="openAddMembers"
                >
                    <PhPlus :size="14" weight="bold" aria-hidden="true" />
                    <span>Tambah Anggota</span>
                </Button>
            </div>

            <DataTable
                :value="members"
                :loading="loading"
                dataKey="uid_user_system"
                paginator
                :rows="8"
                class="p-datatable-sm text-xs"
                responsiveLayout="scroll"
            >
                <template #empty>
                    <div class="text-center py-6 text-muted-color">
                        Belum ada anggota. Karyawan yang belum masuk templat tidak bisa mengajukan cuti.
                    </div>
                </template>
                <Column field="nama" header="Nama" style="width: 32%">
                    <template #body="{ data }">
                        <span class="font-semibold text-surface-900 dark:text-surface-100">{{ data.nama }}</span>
                    </template>
                </Column>
                <Column field="username" header="NIK / Username" style="width: 22%" />
                <Column header="Departemen" style="width: 20%">
                    <template #body="{ data }">{{ data.kd_dept ? deptName(data.kd_dept) : '-' }}</template>
                </Column>
                <Column header="Peran" style="width: 16%">
                    <template #body="{ data }">{{ data.nm_role || data.kd_role }}</template>
                </Column>
                <Column v-if="canManage" header="Aksi" style="width: 10%" class="text-center">
                    <template #body="{ data }">
                        <button
                            type="button"
                            class="w-9 h-9 inline-flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-border transition-colors cursor-pointer"
                            :aria-label="`Keluarkan ${data.nama} dari templat`"
                            title="Keluarkan dari templat"
                            @click="removeMember(data)"
                        >
                            <PhUserMinus :size="14" weight="bold" aria-hidden="true" />
                        </button>
                    </template>
                </Column>
            </DataTable>
        </div>

        <template #footer>
            <div class="flex justify-end pt-2">
                <Button label="Tutup" severity="secondary" size="small" text @click="emit('update:visible', false)" />
            </div>
        </template>
    </Dialog>

    <ApprovalFlowAddMemberDialog
        v-model:visible="memberDialogVisible"
        :template="template"
        :candidate-options="candidateOptions"
        @saved="handleMembersAdded"
    />
</template>
