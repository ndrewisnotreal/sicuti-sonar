<script setup>
import { publicPath } from '@/utils/publicPath';
import { computed, ref, watch } from 'vue';
import { leaveService } from '@/service/leaveService';
import {
    getStatusSeverity,
    getStatusLabel,
    formatDate,
    can,
    attachmentInfo,
    documentPending,
    stepApproverName
} from '@/service/sicutiService';
import LeaveAttachment from '@/components/leave/LeaveAttachment.vue';
import LeaveApprovalTimeline from '@/components/leave/LeaveApprovalTimeline.vue';
import TourHelpButton from '@/components/common/TourHelpButton.vue';
import { useToast } from 'primevue/usetoast';
import { localIsoDate } from '@/utils/onLeaveToday';
import { buildLeaveFormHtml, validationUrl, isQrReachableFromPhone } from '@/utils/leaveFormPrint';
import {
    PhPrinter,
    PhCopy,
    PhArrowUUpLeft,
    PhSealCheck
} from '@phosphor-icons/vue';

const props = defineProps({
    visible: Boolean,
    request: Object,
    showApproveAction: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:visible', 'refresh', 'edit', 'process']);
const toast = useToast();

const loading = ref(false);
const loadError = ref(false);
const detailData = ref(null);

watch(
    () => [props.visible, props.request],
    async ([visible, req]) => {
        if (visible && req) {
            detailData.value = { ...req };
            loadError.value = false;
            const reqId = req.id_request || req.id;
            if (reqId) {
                loading.value = true;
                try {
                    const res = await leaveService.getLeaveDetail(reqId);
                    if (res) {
                        detailData.value = res;
                    }
                } catch (err) {
                    console.error('Failed to fetch full leave detail:', err);
                    loadError.value = true;
                } finally {
                    loading.value = false;
                }
            }
        }
    },
    { immediate: true }
);

const fullRequest = computed(() => detailData.value || props.request || {});

const ticketId = computed(() => fullRequest.value.id_request || fullRequest.value.id || '');
const requesterName = computed(() => fullRequest.value.requester_name || fullRequest.value.userName || 'Karyawan');
const requesterNik = computed(() => fullRequest.value.namecode || fullRequest.value.userNik || '-');
const requesterDept = computed(() => fullRequest.value.nm_dept || fullRequest.value.department || '-');
const leaveTypeName = computed(() => fullRequest.value.nm_leave_type || fullRequest.value.leaveTypeName || fullRequest.value.kd_leave_type || '-');
const startDate = computed(() => fullRequest.value.start_date || fullRequest.value.startDate);
const endDate = computed(() => fullRequest.value.end_date || fullRequest.value.endDate);
const totalDays = computed(() => fullRequest.value.total_days ?? fullRequest.value.totalDays ?? 0);
const reason = computed(() => fullRequest.value.reason || '-');
const attachment = computed(() => attachmentInfo(fullRequest.value));
const status = computed(() => fullRequest.value.status || 'submitted');

const stepsList = computed(() => {
    const rawSteps = fullRequest.value.steps;
    const records = Array.isArray(fullRequest.value.approval_records) ? fullRequest.value.approval_records : [];

    if (Array.isArray(rawSteps) && rawSteps.length > 0) {
        return rawSteps.map((s) => {
            const matchingRecord = records
                .filter((r) => Number(r.level) === Number(s.level))
                .slice(-1)[0];

            let st = (s.status || '').toLowerCase().trim();
            const act = (s.action || matchingRecord?.action || '').toLowerCase().trim();

            if (!st || st === 'pending') {
                if (act === 'approve') st = 'approved';
                else if (act === 'reject') st = 'rejected';
                else if (act === 'return') st = 'returned';
                else st = 'pending';
            }

            return {
                id: s.id_step,
                level: s.level,
                approverId: s.uid_approver || matchingRecord?.approver_id || s.approver_id || '',
                approverName: stepApproverName(s, matchingRecord),
                status: st,
                action: act,
                notes: s.notes || matchingRecord?.notes || null,
                actedAt: s.acted_at || matchingRecord?.created_at || null,
                isCurrent: Boolean(s.is_current)
            };
        });
    }

    if (records.length > 0) {
        return records.map((r) => ({
            id: r.approver_id,
            approverId: r.approver_id || '',
            level: r.level,
            approverName: r.approver_name || 'Approver',
            status: r.action === 'approve' ? 'approved' : (r.action === 'reject' ? 'rejected' : (r.action === 'return' ? 'returned' : 'pending')),
            action: r.action,
            notes: r.notes,
            actedAt: r.created_at,
            isCurrent: false
        }));
    }

    return [];
});

// Pengajuan yang sudah final tidak lagi menunggu dokumen; tenggat yang lewat ditandai, bukan diam-diam ditampilkan.
const FINAL_STATUSES = ['rejected', 'cancelled'];
const isFinal = computed(() => FINAL_STATUSES.includes(status.value));
const docPending = computed(() => documentPending(fullRequest.value));
const docOverdue = computed(() => docPending.value && String(fullRequest.value.document_due_date).slice(0, 10) < localIsoDate());

function copyTicketId(id) {
    if (!id) return;
    navigator.clipboard?.writeText(id).then(() => {
        toast.add({
            severity: 'info',
            summary: 'Tersalin',
            detail: `Nomor pengajuan ${id} disalin ke papan klip`,
            life: 2500
        });
    }).catch(() => {
        toast.add({
            severity: 'info',
            summary: 'Nomor pengajuan',
            detail: id,
            life: 2000
        });
    });
}


async function printDocument() {
    if (!['approved', 'completed'].includes(status.value)) {
        toast.add({
            severity: 'warn',
            summary: 'Belum Disetujui Penuh',
            detail: 'Dokumen cuti hanya dapat dicetak setelah seluruh tahapan persetujuan selesai (Disetujui).',
            life: 4000
        });
        return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const req = fullRequest.value;
    const requesterUid = req.uid_user_system;
    const approvers = stepsList.value.filter((s) => s.status === 'approved' && s.approverId && s.approverId !== requesterUid);
    const atasan = approvers[0];
    const mengetahui = approvers[approvers.length - 1];

    const year = Number(String(startDate.value || '').slice(0, 4)) || new Date().getFullYear();
    const balances = await leaveService.getBalances({ uid: requesterUid, year }).catch(() => []);
    const balance = balances.find((b) => Number(b.year) === year) || balances[0] || null;

    const signerOf = (step) =>
        step
            ? {
                  name: step.approverName,
                  date: step.actedAt,
                  qrUrl: req.validation_tokens?.[step.approverId] ? validationUrl(req.validation_tokens[step.approverId]) : ''
              }
            : null;
    const html = await buildLeaveFormHtml({
        ticketId: ticketId.value,
        employeeName: requesterName.value,
        nik: requesterNik.value,
        department: requesterDept.value,
        usedDays: balance ? Number(balance.used_days ?? 0) : '',
        remainingDays: balance ? Number(balance.remaining ?? 0) : '',
        leaveTypeName: leaveTypeName.value,
        totalDays: totalDays.value,
        startDate: startDate.value,
        endDate: endDate.value,
        phone: req.requester_no_hp || '',
        reason: req.reason || '',
        substituteName: req.substitute_name || '',
        location: '',
        submittedAt: req.created_at,
        status: status.value,
        komentar: atasan?.notes || '',
        atasan: signerOf(atasan),
        mengetahui: signerOf(mengetahui),
        logoUrl: `${window.location.origin}${publicPath('logo-sinergi.png')}`
    });

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    if (!isQrReachableFromPhone()) {
        toast.add({
            severity: 'warn',
            summary: 'QR hanya bisa dibuka dari komputer ini',
            detail: 'Surat dicetak dari alamat localhost. Agar QR bisa dipindai HP, buka aplikasi lewat alamat jaringan (Network) atau isi VITE_PUBLIC_APP_URL.',
            life: 8000
        });
    }
}
</script>

<template>
    <Drawer
        :visible="visible"
        @update:visible="emit('update:visible', $event)"
        position="right"
        class="leave-detail-panel !w-full sm:!w-[38rem] !max-w-full"
        :pt="{
            root: { 'aria-labelledby': 'leave-detail-title' },
            header: { class: '!px-5 sm:!px-7 !py-4 [@media(max-height:500px)]:!py-2 !gap-3 border-b border-surface-200 dark:border-surface-800' },
            content: { class: '!p-0' },
            pcCloseButton: { root: { class: '!w-11 !h-11 !rounded-border shrink-0', 'aria-label': 'Tutup detail' } },
            footer: { class: '!px-5 sm:!px-7 !py-4 [@media(max-height:500px)]:!py-2 border-t border-surface-200 dark:border-surface-800 bg-surface-0 dark:bg-surface-900' }
        }"
    >
        <template #header>
            <div class="min-w-0 flex-1">
                <h2 id="leave-detail-title" class="text-base font-semibold leading-snug text-surface-900 dark:text-surface-100">
                    Detail pengajuan cuti
                </h2>
                <button
                    v-if="ticketId"
                    type="button"
                    class="mt-0.5 -ml-1 inline-flex max-w-full min-h-8 items-center gap-2 rounded px-1 text-xs text-surface-600 dark:text-surface-400 hover:text-primary dark:hover:text-primary-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors cursor-pointer"
                    @click="copyTicketId(ticketId)"
                    title="Salin nomor pengajuan"
                    :aria-label="`Salin nomor pengajuan ${ticketId}`"
                >
                    <span class="break-all text-left tabular-nums">{{ ticketId }}</span>
                    <PhCopy :size="14" weight="bold" class="shrink-0" aria-hidden="true" />
                </button>
                <span v-if="loading" role="status" class="ml-2 text-xs text-surface-600 dark:text-surface-400">Memuat detail terbaru…</span>
            </div>
        </template>

        <div v-if="fullRequest" class="px-5 py-6 sm:px-7" :aria-busy="loading">
            <p v-if="!loading && loadError" role="alert" class="mb-5 rounded-border bg-amber-100 dark:bg-amber-950/40 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                Detail terbaru gagal dimuat. Data yang tampil berasal dari daftar dan mungkin belum lengkap. Tutup lalu buka lagi untuk mencoba ulang.
            </p>
            <section data-tour="detail-summary">
                <div class="flex items-start justify-between gap-4">
                    <h3 class="min-w-0 text-2xl font-semibold leading-tight tracking-tight text-surface-900 dark:text-surface-0 break-words">
                        {{ leaveTypeName }}
                    </h3>
                    <Tag :value="getStatusLabel(status)" :severity="getStatusSeverity(status)" class="mt-1 shrink-0 !text-xs !font-medium" />
                </div>

                <div class="mt-5 grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-4 gap-y-3 rounded-border bg-surface-100 dark:bg-surface-950/50 p-4">
                    <div class="min-w-0">
                        <p class="text-sm text-surface-600 dark:text-surface-400">Mulai cuti</p>
                        <p class="mt-1.5 text-sm font-semibold leading-relaxed text-surface-900 dark:text-surface-100">{{ formatDate(startDate) }}</p>
                    </div>
                    <div class="min-w-0">
                        <p class="text-sm text-surface-600 dark:text-surface-400">Selesai cuti</p>
                        <p class="mt-1.5 text-sm font-semibold leading-relaxed text-surface-900 dark:text-surface-100">{{ formatDate(endDate) }}</p>
                    </div>
                    <div class="col-span-2 flex items-baseline justify-between gap-3 border-t border-surface-300 pt-3 dark:border-surface-700 sm:col-span-1 sm:block sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
                        <p class="text-sm text-surface-600 dark:text-surface-400">Durasi</p>
                        <p class="sm:mt-1 flex items-baseline gap-1.5 whitespace-nowrap">
                            <span class="text-xl font-semibold tabular-nums text-surface-900 dark:text-surface-100">{{ totalDays }}</span>
                            <span class="text-xs text-surface-600 dark:text-surface-400">hari kerja</span>
                        </p>
                    </div>
                </div>

            </section>

            <!-- Satu pola label/nilai di seluruh panel: label kiri 9rem mulai layar sm, label di atas nilai di mobile. -->
            <section class="mt-6 border-t border-surface-200 pt-6 dark:border-surface-800">
                <h3 class="text-sm font-semibold text-surface-900 dark:text-surface-100">Pemohon</h3>
                <dl class="mt-3 grid grid-cols-1 sm:grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-1 sm:gap-y-3 text-sm leading-relaxed [&>dt:not(:first-child)]:mt-2 sm:[&>dt:not(:first-child)]:mt-0">
                    <dt class="text-surface-600 dark:text-surface-400">Nama</dt>
                    <dd class="min-w-0 break-words font-semibold text-surface-900 dark:text-surface-100">{{ requesterName }}</dd>
                    <dt class="text-surface-600 dark:text-surface-400">NIK</dt>
                    <dd class="min-w-0 break-words text-surface-800 dark:text-surface-200 tabular-nums">{{ requesterNik }}</dd>
                    <dt class="text-surface-600 dark:text-surface-400">Divisi</dt>
                    <dd class="min-w-0 break-words text-surface-800 dark:text-surface-200">{{ requesterDept }}</dd>
                    <template v-if="fullRequest.created_at">
                        <dt class="text-surface-600 dark:text-surface-400">Tanggal pengajuan</dt>
                        <dd class="min-w-0 break-words text-surface-800 dark:text-surface-200">{{ formatDate(fullRequest.created_at) }}</dd>
                    </template>
                </dl>
            </section>

            <section class="mt-6 border-t border-surface-200 pt-6 dark:border-surface-800">
                <h3 class="text-sm font-semibold text-surface-900 dark:text-surface-100">Rincian</h3>
                <dl class="mt-3 grid grid-cols-1 sm:grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-1 sm:gap-y-3 text-sm leading-relaxed [&>dt:not(:first-child)]:mt-2 sm:[&>dt:not(:first-child)]:mt-0">
                    <dt class="text-surface-600 dark:text-surface-400">Alasan cuti</dt>
                    <dd class="min-w-0 break-words text-surface-800 dark:text-surface-200 whitespace-pre-line">{{ reason }}</dd>
                    <template v-if="fullRequest.substitute_name">
                        <dt class="text-surface-600 dark:text-surface-400">Pengganti tugas</dt>
                        <dd class="min-w-0 break-words text-surface-800 dark:text-surface-200">{{ fullRequest.substitute_name }}</dd>
                    </template>
                    <template v-if="attachment || docPending">
                        <dt class="text-surface-600 dark:text-surface-400">Dokumen pendukung</dt>
                        <dd data-tour="detail-attachment" class="min-w-0">
                            <p v-if="docPending && isFinal" class="text-surface-800 dark:text-surface-200">
                                Tidak diunggah sebelum pengajuan {{ getStatusLabel(status).toLowerCase() }}.
                            </p>
                            <template v-else>
                                <LeaveAttachment :request="fullRequest" />
                                <p v-if="docOverdue" class="mt-2 text-xs font-medium text-(--p-tag-danger-color)">Tenggat unggah dokumen sudah lewat.</p>
                            </template>
                        </dd>
                    </template>
                </dl>
            </section>

            <section class="mt-6 border-t border-surface-200 pt-6 dark:border-surface-800">
                <LeaveApprovalTimeline data-tour="detail-timeline" :steps="stepsList" />
            </section>
        </div>

        <template #footer>
            <div class="flex flex-wrap items-center justify-between gap-3 w-full">
                <div class="flex items-center">
                    <TourHelpButton class="!min-h-11" :tour-id="['karyawan.detail', 'approval.detail']" />
                </div>

                <div class="flex min-w-0 items-center gap-2 ml-auto">
                    <Button
                        label="Tutup"
                        severity="secondary"
                        text
                        class="!min-h-11 !px-3 !text-sm !font-medium"
                        @click="emit('update:visible', false)"
                    />
                    <div data-tour="detail-actions" class="flex min-w-0 items-center gap-2">
                        <Button
                            v-if="['approved', 'completed'].includes(status)"
                            label="Cetak Surat Cuti"
                            severity="secondary"
                            outlined
                            class="!min-h-11 !text-sm !font-medium"
                            @click="printDocument"
                        >
                            <template #icon>
                                <PhPrinter :size="16" weight="bold" aria-hidden="true" />
                            </template>
                        </Button>
                        <Button
                            v-else-if="status === 'returned' && can('pengajuan_cuti.edit_returned')"
                            label="Ajukan Ulang / Ubah"
                            severity="warn"
                            class="!min-h-11 !text-sm !font-medium"
                            @click="emit('edit', fullRequest); emit('update:visible', false)"
                        >
                            <template #icon>
                                <PhArrowUUpLeft :size="16" weight="bold" aria-hidden="true" />
                            </template>
                        </Button>
                        <Button
                            v-else-if="showApproveAction && (status === 'submitted' || status === 'pending_validation')"
                            label="Proses"
                            severity="primary"
                            class="!min-h-11 !text-sm !font-medium"
                            @click="emit('process', fullRequest); emit('update:visible', false)"
                        >
                            <template #icon>
                                <PhSealCheck :size="16" weight="bold" aria-hidden="true" />
                            </template>
                        </Button>
                    </div>
                </div>
            </div>
        </template>
    </Drawer>
</template>
