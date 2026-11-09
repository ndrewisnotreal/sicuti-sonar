<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { adminService } from '@/service/adminService';
import { useToast } from 'primevue/usetoast';
import { approverChoices, defaultApprovers, flowFormProblem } from '@/utils/approvalFlowOptions';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    flowData: {
        type: Object,
        default: null
    },
    templateId: {
        type: String,
        default: ''
    },
    templateDept: {
        type: String,
        default: ''
    },
    flows: {
        type: Array,
        default: () => []
    },
    eligibleApprovers: {
        type: Array,
        default: () => []
    },
    approverRoles: {
        type: Array,
        default: () => []
    }
});

const emit = defineEmits(['update:visible', 'saved']);
const toast = useToast();

const flowForm = ref({ id_flow: '', assigned_role: '', users: [] });
const savingFlow = ref(false);
// Pesan flowFormProblem ditampilkan di bawah field yang bersangkutan (audit-015 #5).
const errors = ref({ role: '', users: '' });
watch(() => flowForm.value.assigned_role, () => (errors.value.role = ''));
watch(() => flowForm.value.users, () => (errors.value.users = ''));

const isEditing = computed(() => Boolean(flowForm.value.id_flow));

const usedRoles = computed(() =>
    new Set((props.flows || []).filter((f) => f.id_flow !== flowForm.value.id_flow).map((f) => f.assigned_role))
);

const roleOptions = computed(() =>
    (props.approverRoles || [])
        .filter((r) => !usedRoles.value.has(r.kd_role))
        .map((r) => ({ label: r.nm_role, value: r.kd_role }))
);

const approverOptions = computed(() =>
    approverChoices(props.eligibleApprovers || [], props.flows || [], flowForm.value.id_flow, props.templateDept)
);

watch(
    () => props.visible,
    (isOpen) => {
        if (!isOpen) return;
        errors.value = { role: '', users: '' };
        if (props.flowData) {
            flowForm.value = {
                id_flow: props.flowData.id_flow || '',
                assigned_role: props.flowData.assigned_role || '',
                users: (props.flowData.approvers || []).map((a) => a.uid_user_system)
            };
        } else {
            flowForm.value = {
                id_flow: '',
                assigned_role: '',
                users: []
            };
        }
    }
);

function onFlowRoleChange(kdRole) {
    if (flowForm.value.id_flow) return;
    flowForm.value.users = defaultApprovers(props.eligibleApprovers || [], props.flows || [], kdRole, props.templateDept);
}

async function saveFlow() {
    const problem = flowFormProblem(flowForm.value);
    if (problem) {
        const onRole = !flowForm.value.assigned_role;
        errors.value = { role: onRole ? problem + '.' : '', users: onRole ? '' : problem + '.' };
        await nextTick();
        // Select/MultiSelect PrimeVue: fokus ke elemen combobox di dalam wrapper.
        document.querySelector(onRole ? '[aria-labelledby="flow-role-label"]' : '#flow-approvers')?.focus();
        return;
    }
    savingFlow.value = true;
    try {
        await adminService.upsertApprovalFlow({
            id_flow: flowForm.value.id_flow || undefined,
            id_template: props.templateId,
            assigned_role: flowForm.value.assigned_role,
            users: flowForm.value.users
        });
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Tingkat approval disimpan', life: 3000 });
        emit('update:visible', false);
        emit('saved');
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: err.message || 'Gagal menyimpan tingkat approval', life: 3000 });
    } finally {
        savingFlow.value = false;
    }
}
</script>

<template>
    <Dialog
        :visible="visible"
        modal
        :header="isEditing ? 'Ubah Tingkat Approval' : 'Tambah Tingkat Approval'"
        :style="{ width: '480px' }"
        :breakpoints="{ '640px': '92vw' }"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="space-y-2 pt-2 text-xs">
            <label id="flow-role-label" class="block font-medium mb-1">Peran *</label>
            <Select
                v-model="flowForm.assigned_role"
                inputId="flow-role"
                ariaLabelledby="flow-role-label"
                :invalid="!!errors.role"
                :aria-describedby="errors.role ? 'flow-role-error' : undefined"
                :options="roleOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Pilih peran"
                emptyMessage="Semua peran approver sudah dipakai di templat ini"
                class="w-full text-xs"
                @change="onFlowRoleChange($event.value)"
            />
            <p v-if="errors.role" id="flow-role-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ errors.role }}</p>
            <p class="text-xs text-muted-color">
                Peran menjadi nama tingkat.{{ isEditing ? '' : ' Tingkat baru ditaruh paling akhir; geser untuk mengubah urutan.' }}
            </p>

            <label for="flow-approvers" class="block font-medium mb-1 pt-2">Approver{{ isEditing ? '' : ' *' }}</label>
            <MultiSelect
                v-model="flowForm.users"
                inputId="flow-approvers"
                :options="approverOptions"
                optionLabel="label"
                optionValue="value"
                optionDisabled="disabled"
                filter
                display="chip"
                :maxSelectedLabels="6"
                placeholder="Pilih akun approver"
                emptyMessage="Belum ada akun yang punya izin approve"
                emptyFilterMessage="Tidak ada akun yang cocok"
                class="w-full text-xs"
                :invalid="!!errors.users"
                :aria-describedby="errors.users ? 'flow-approvers-error' : undefined"
            />
            <p v-if="errors.users" id="flow-approvers-error" class="mt-1 text-xs text-(--status-danger-fg)">{{ errors.users }}</p>
            <p class="text-xs text-muted-color">
                Akun dari departemen templat yang perannya punya izin Approve/Reject atau Validasi; cukup salah satu yang menyetujui. Satu akun hanya di satu tingkat per templat.
            </p>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2 pt-2">
                <Button label="Batal" severity="secondary" size="small" text @click="emit('update:visible', false)" />
                <Button label="Simpan Tingkat" severity="primary" size="small" class="font-bold" :loading="savingFlow" @click="saveFlow" />
            </div>
        </template>
    </Dialog>
</template>
