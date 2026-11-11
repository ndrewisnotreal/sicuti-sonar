<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
    items: {
        type: Array,
        default: () => []
    },
    loading: {
        type: Boolean,
        default: false
    },
    // Pesan kosong dari parent: gagal dimuat, tidak cocok filter, atau memang kosong (audit-022 #1).
    emptyText: {
        type: String,
        default: 'Tidak ada data saldo cuti pada periode ini.'
    }
});

function remaining(b) {
    if (b.remaining !== undefined) return b.remaining;
    return Number(b.annual_quota || 0) + Number(b.carry_over_days || 0) - Number(b.used_days || 0);
}

const mobileLimit = ref(10);
watch(
    () => props.items,
    () => {
        mobileLimit.value = 10;
    }
);
const mobileRows = computed(() => props.items.slice(0, mobileLimit.value));
</script>

<template>
    <div>
        <!-- Angka netral, sisa sebagai fokus, warna hanya bila habis (audit-022 #9, pola item 13). -->
        <div class="hidden sm:block">
            <DataTable :value="items" :loading="loading" paginator :rows="10" class="p-datatable-sm text-xs" responsiveLayout="scroll">
                <template #empty>
                    <div class="text-center py-8 text-muted-color">{{ emptyText }}</div>
                </template>
                <Column header="Karyawan" style="width: 34%">
                    <template #body="{ data }">
                        <div class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ data.nama }}</div>
                        <div class="text-xs text-muted-color">NIK {{ data.namecode || '-' }} · {{ data.kd_dept || '-' }}</div>
                        <div v-if="data.period_label" class="text-xs text-muted-color">Periode {{ data.period_label }}</div>
                    </template>
                </Column>
                <Column header="Kuota (hari)" style="width: 15%">
                    <template #body="{ data }">
                        <span class="tabular-nums text-surface-900 dark:text-surface-100">{{ data.annual_quota }}</span>
                    </template>
                </Column>
                <Column header="Carry over (hari)" style="width: 17%">
                    <template #body="{ data }">
                        <span class="tabular-nums text-surface-900 dark:text-surface-100">{{ data.carry_over_days || 0 }}</span>
                    </template>
                </Column>
                <Column header="Terpakai (hari)" style="width: 17%">
                    <template #body="{ data }">
                        <span class="tabular-nums text-surface-900 dark:text-surface-100">{{ data.used_days || 0 }}</span>
                    </template>
                </Column>
                <Column header="Sisa (hari)" style="width: 17%">
                    <template #body="{ data }">
                        <div class="flex items-center gap-2">
                            <span class="tabular-nums text-sm font-bold text-surface-900 dark:text-surface-100">{{ remaining(data) }}</span>
                            <Tag v-if="remaining(data) <= 0" value="Habis" severity="warn" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <div class="sm:hidden" :aria-busy="loading">
            <p v-if="!items.length" class="py-8 text-center text-xs text-muted-color">{{ loading ? 'Memuat data...' : emptyText }}</p>
            <ul v-else class="divide-y divide-surface-200 dark:divide-surface-700" :class="{ 'opacity-60': loading }">
                <li v-for="b in mobileRows" :key="b.uid_user_system || b.id_balance" class="py-3 space-y-2 text-xs">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <div class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ b.nama }}</div>
                            <div class="text-muted-color">NIK {{ b.namecode || '-' }} · {{ b.kd_dept || '-' }}</div>
                        </div>
                        <div class="text-right shrink-0">
                            <div class="tabular-nums text-base font-bold text-surface-900 dark:text-surface-100">{{ remaining(b) }} hari</div>
                            <Tag v-if="remaining(b) <= 0" value="Habis" severity="warn" />
                            <div v-else class="text-muted-color">sisa</div>
                        </div>
                    </div>
                    <div v-if="b.period_label" class="text-muted-color">Periode {{ b.period_label }}</div>
                    <dl class="grid grid-cols-3 gap-2">
                        <div>
                            <dt class="text-muted-color">Kuota</dt>
                            <dd class="tabular-nums text-surface-900 dark:text-surface-100">{{ b.annual_quota }} hari</dd>
                        </div>
                        <div>
                            <dt class="text-muted-color">Carry over</dt>
                            <dd class="tabular-nums text-surface-900 dark:text-surface-100">{{ b.carry_over_days || 0 }} hari</dd>
                        </div>
                        <div>
                            <dt class="text-muted-color">Terpakai</dt>
                            <dd class="tabular-nums text-surface-900 dark:text-surface-100">{{ b.used_days || 0 }} hari</dd>
                        </div>
                    </dl>
                </li>
            </ul>
            <Button
                v-if="items.length > mobileLimit"
                :label="`Tampilkan ${Math.min(10, items.length - mobileLimit)} lagi`"
                severity="secondary"
                text
                size="small"
                class="w-full mt-2 text-xs !min-h-11"
                @click="mobileLimit += 10"
            />
        </div>
    </div>
</template>
