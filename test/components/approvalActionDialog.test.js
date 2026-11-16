import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';

const toastAdd = vi.fn();
let lastConfirm = null;
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: (opts) => (lastConfirm = opts) }) }));
vi.mock('@/service/approvalService', () => ({ approvalService: { processApproval: vi.fn() } }));
vi.mock('@/service/sicutiService', async (orig) => ({ ...(await orig()), syncFromBackend: vi.fn() }));

import ApprovalActionDialog from '@/components/approval/ApprovalActionDialog.vue';
import { approvalService } from '@/service/approvalService';
import { syncFromBackend } from '@/service/sicutiService';

const DialogStub = defineComponent({
    name: 'Dialog',
    props: ['visible', 'header'],
    emits: ['update:visible'],
    setup: (p, { slots }) => () => (p.visible ? h('div', { class: 'dialog', 'data-header': p.header }, [slots.default?.(), slots.footer?.()]) : null)
});
const ButtonStub = defineComponent({
    name: 'Button',
    props: ['label', 'disabled', 'loading'],
    emits: ['click'],
    setup: (p, { slots, emit }) => () => h('button', { disabled: p.disabled || undefined, onClick: () => emit('click') }, [p.label, slots.default?.()])
});
const TextareaStub = defineComponent({
    name: 'Textarea',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup: (p, { emit }) => () => h('textarea', { value: p.modelValue, onInput: (e) => emit('update:modelValue', e.target.value) })
});

const REQ = {
    id_request: 'REQ-SIT-0001/2026',
    requester_name: 'Ikhsan Nugraha',
    namecode: 'OS24980032',
    nm_dept: 'Smelter Information Technology',
    nm_leave_type: 'Cuti Tahunan',
    total_days: 2,
    start_date: '2026-12-01',
    end_date: '2026-12-02',
    reason: 'Keperluan keluarga'
};

function mountDialog(props = {}) {
    const reload = vi.fn().mockResolvedValue(undefined);
    const w = mount(ApprovalActionDialog, {
        props: { visible: true, request: REQ, reload, ...props },
        global: { stubs: { Dialog: DialogStub, Button: ButtonStub, Textarea: TextareaStub, LeaveAttachment: true }, directives: { tooltip: {} } }
    });
    return { w, reload };
}
const button = (w, text) => w.findAll('button').find((b) => b.text().includes(text));

describe('ApprovalActionDialog', () => {
    beforeEach(() => {
        toastAdd.mockClear();
        approvalService.processApproval.mockReset();
        syncFromBackend.mockClear();
        lastConfirm = null;
    });

    it('menampilkan judul bernomor pengajuan dan rincian pengajuan', () => {
        const { w } = mountDialog();
        expect(w.find('.dialog').attributes('data-header')).toBe('Proses Persetujuan Cuti #REQ-SIT-0001/2026');
        for (const t of ['Ikhsan Nugraha', 'NIK: OS24980032', 'Smelter Information Technology', 'Cuti Tahunan', '2 Hari Kerja', 'Keperluan keluarga', 'Catatan Persetujuan']) expect(w.text()).toContain(t);
    });

    it.each([
        ['Tolak', 'menolak'],
        ['Kembalikan', 'mengembalikan']
    ])('%s tanpa catatan → pesan di field (bukan toast), tanpa konfirmasi (audit-029 #14)', async (tombol, kata) => {
        const { w } = mountDialog();
        await button(w, tombol).trigger('click');
        expect(w.find('#approval-notes-error').text()).toBe(`Catatan wajib diisi saat ${kata} pengajuan cuti.`);
        expect(toastAdd).not.toHaveBeenCalled();
        expect(lastConfirm).toBeNull();
    });

    it('konfirmasi keputusan berfokus awal di Batal (audit-029 #13)', async () => {
        const { w } = mountDialog();
        await button(w, 'Setujui Permohonan').trigger('click');
        expect(lastConfirm.defaultFocus).toBe('reject');
    });

    it('Setujui: konfirmasi dulu; sesudah diterima → diproses sekali, toast sukses, dialog ditutup, antrean dimuat ulang', async () => {
        approvalService.processApproval.mockResolvedValue({});
        const { w, reload } = mountDialog();
        await button(w, 'Setujui Permohonan').trigger('click');
        expect(lastConfirm).toMatchObject({ header: 'Setujui pengajuan?', acceptLabel: 'Ya, setujui' });
        lastConfirm.accept();
        await flushPromises();
        expect(approvalService.processApproval).toHaveBeenCalledWith({ idRequest: 'REQ-SIT-0001/2026', action: 'approve', notes: '' });
        expect(toastAdd).toHaveBeenCalledWith({ severity: 'success', summary: 'Aksi Berhasil', detail: 'Pengajuan cuti #REQ-SIT-0001/2026 berhasil disetujui.', life: 4000 });
        expect(w.emitted('update:visible')).toEqual([[false]]);
        expect(reload).toHaveBeenCalledTimes(1);
        // State global (badge, notifikasi) ikut diperbarui setelah keputusan (qa-browser Q1).
        expect(syncFromBackend).toHaveBeenCalledWith({ fresh: true });
    });

    it('Tolak dengan catatan → catatan dikirim tanpa spasi tepi', async () => {
        approvalService.processApproval.mockResolvedValue({});
        const { w } = mountDialog();
        await w.find('textarea').setValue('  Kuota habis  ');
        await button(w, 'Tolak').trigger('click');
        expect(lastConfirm).toMatchObject({ header: 'Tolak pengajuan?' });
        lastConfirm.accept();
        await flushPromises();
        expect(approvalService.processApproval).toHaveBeenCalledWith({ idRequest: 'REQ-SIT-0001/2026', action: 'reject', notes: 'Kuota habis' });
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Pengajuan cuti #REQ-SIT-0001/2026 berhasil ditolak.' }));
    });

    it('klik ganda pada konfirmasi hanya memproses sekali', async () => {
        let selesai;
        approvalService.processApproval.mockReturnValue(new Promise((r) => (selesai = r)));
        const { w } = mountDialog();
        await button(w, 'Setujui Permohonan').trigger('click');
        lastConfirm.accept();
        lastConfirm.accept();
        selesai({});
        await flushPromises();
        expect(approvalService.processApproval).toHaveBeenCalledTimes(1);
    });

    it('409 (sudah diproses approver lain) → toast "Sudah Diproses", dialog ditutup, antrean dimuat ulang', async () => {
        approvalService.processApproval.mockRejectedValue(Object.assign(new Error('x'), { status: 409, data: { message: 'Anda sudah memproses pengajuan ini' } }));
        const { w, reload } = mountDialog();
        await button(w, 'Setujui Permohonan').trigger('click');
        lastConfirm.accept();
        await flushPromises();
        expect(toastAdd).toHaveBeenCalledWith({ severity: 'warn', summary: 'Sudah Diproses', detail: 'Anda sudah memproses pengajuan ini', life: 5000 });
        expect(w.emitted('update:visible')).toEqual([[false]]);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('galat lain → toast "Gagal", dialog tetap terbuka, antrean tidak dimuat ulang', async () => {
        approvalService.processApproval.mockRejectedValue(Object.assign(new Error('Server sibuk'), { status: 500 }));
        const { w, reload } = mountDialog();
        await button(w, 'Setujui Permohonan').trigger('click');
        lastConfirm.accept();
        await flushPromises();
        expect(toastAdd).toHaveBeenCalledWith({ severity: 'error', summary: 'Gagal', detail: 'Server sibuk', life: 5000 });
        expect(w.emitted('update:visible')).toBeUndefined();
        expect(reload).not.toHaveBeenCalled();
        expect(syncFromBackend).not.toHaveBeenCalled();
    });

    it('catatan dikosongkan setiap kali dialog dibuka lagi', async () => {
        const { w } = mountDialog();
        await w.find('textarea').setValue('catatan lama');
        await w.setProps({ visible: false });
        await w.setProps({ visible: true });
        await nextTick();
        expect(w.find('textarea').element.value).toBe('');
    });

    it('Setujui nonaktif selama dokumen wajib belum diunggah pemohon', () => {
        const { w } = mountDialog({ request: { ...REQ, document_due_date: '2026-12-05' } });
        expect(button(w, 'Setujui Permohonan').attributes('disabled')).toBeDefined();
        expect(button(w, 'Tolak').attributes('disabled')).toBeUndefined();
    });
});
