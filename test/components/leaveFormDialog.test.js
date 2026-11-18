import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';

const toastAdd = vi.fn();
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));

vi.mock('@/service/leaveService', () => ({
    leaveService: {
        getLeaveTypes: vi.fn().mockResolvedValue([{ kd_leave_type: 'CT', code: 'CT', nm_leave_type: 'Cuti Tahunan', uses_quota: true }]),
        getBalances: vi.fn().mockResolvedValue([{ year: new Date().getFullYear(), remaining: 12 }]),
        getHolidays: vi.fn().mockResolvedValue([]),
        getColleagues: vi.fn().mockResolvedValue([]),
        getLeaveDetail: vi.fn().mockResolvedValue(null),
        createLeave: vi.fn(),
        resubmitLeave: vi.fn(),
        uploadDocument: vi.fn()
    }
}));

vi.mock('@/service/sicutiService', async () => {
    const { ref, reactive } = await import('vue');
    return {
        currentUser: ref({ uid_user_system: 'U1' }),
        isSubstituteRequired: () => false,
        lastReturnNote: () => null,
        syncFromBackend: vi.fn(),
        sicutiState: reactive({ leaveRequests: [] })
    };
});

import LeaveFormDialog from '@/components/leave/LeaveFormDialog.vue';

const DialogStub = defineComponent({
    name: 'Dialog',
    props: ['visible', 'header'],
    setup: (p, { slots }) => () => (p.visible ? h('div', [slots.default?.(), slots.footer?.()]) : null)
});

const ButtonStub = defineComponent({
    name: 'Button',
    props: ['label', 'disabled', 'loading'],
    emits: ['click'],
    setup: (p, { slots, emit }) => () => h('button', { disabled: p.disabled || undefined, onClick: () => emit('click') }, [p.label, slots.default?.()])
});

const pass = (name, tag) =>
    defineComponent({
        name,
        inheritAttrs: false,
        props: ['modelValue', 'inputId', 'invalid'],
        setup: (p, { attrs }) => () => h(tag, { id: p.inputId || attrs.id, 'aria-describedby': attrs['aria-describedby'] })
    });

const stubs = {
    Dialog: DialogStub,
    Button: ButtonStub,
    Select: pass('Select', 'input'),
    DatePicker: pass('DatePicker', 'input'),
    Textarea: pass('Textarea', 'textarea'),
    LeaveAttachmentUpload: true,
    TourHelpButton: true
};

describe('LeaveFormDialog validasi inline', () => {
    beforeEach(() => {
        toastAdd.mockClear();
    });

    it('form kosong menampilkan error tanggal mulai dan alasan sekaligus tanpa toast', async () => {
        const scrollSpy = vi.fn();
        Element.prototype.scrollIntoView = scrollSpy;
        const w = mount(LeaveFormDialog, { props: { visible: true }, global: { stubs }, attachTo: document.body });
        await flushPromises();

        await w.findAll('button').find((b) => b.text().includes('Kirim Pengajuan')).trigger('click');
        await flushPromises();

        expect(w.find('#leave-start-date-error').exists()).toBe(true);
        expect(w.find('#leave-reason-error').text()).toContain('Alasan pengajuan cuti wajib diisi');
        expect(toastAdd).not.toHaveBeenCalled();
        expect(w.find('label[for="leave-reason"]').exists()).toBe(true);
        expect(w.find('#leave-end-date-error').exists()).toBe(false);
        expect(scrollSpy).toHaveBeenCalledWith({ block: 'center' });
        expect(scrollSpy.mock.contexts[0].id).toBe('leave-start-date');
        expect(document.activeElement?.id).not.toBe('leave-start-date');
        w.unmount();
    });

    it('saldo diambil untuk tanggal mulai, hari libur untuk tahunnya', async () => {
        const { leaveService } = await import('@/service/leaveService');
        const nextYear = new Date().getFullYear() + 1;
        leaveService.getBalances.mockClear();
        const w = mount(LeaveFormDialog, { props: { visible: true }, global: { stubs } });
        await flushPromises();
        // Belum ada tanggal mulai: periode yang sedang berjalan
        expect(leaveService.getBalances).toHaveBeenCalledWith({});
        leaveService.getBalances.mockClear();
        leaveService.getHolidays.mockClear();

        w.findAllComponents({ name: 'DatePicker' })[0].vm.$emit('update:modelValue', new Date(nextYear, 0, 11));
        await flushPromises();

        expect(leaveService.getBalances).toHaveBeenCalledWith({ date: `${nextYear}-01-11` });
        expect(leaveService.getHolidays).toHaveBeenCalledWith(nextYear);

        // Tanggal lain di tahun yang sama: saldo diambil ulang (periode/carry over bisa berbeda), hari libur tidak
        leaveService.getBalances.mockClear();
        leaveService.getHolidays.mockClear();
        w.findAllComponents({ name: 'DatePicker' })[0].vm.$emit('update:modelValue', new Date(nextYear, 7, 2));
        await flushPromises();
        expect(leaveService.getBalances).toHaveBeenCalledWith({ date: `${nextYear}-08-02` });
        expect(leaveService.getHolidays).not.toHaveBeenCalled();
        w.unmount();
    });

    it('sisa saldo di form memakai baris yang dikirim backend untuk tanggal itu', async () => {
        const { leaveService } = await import('@/service/leaveService');
        const nextYear = new Date().getFullYear() + 1;
        const w = mount(LeaveFormDialog, { props: { visible: true }, global: { stubs } });
        await flushPromises();
        // Baris tahun pilihan berbeda dari tahun tanggal mulai (periode sejak tanggal masuk)
        leaveService.getBalances.mockResolvedValueOnce([{ year: nextYear - 1, remaining: 3 }]);
        w.findAllComponents({ name: 'DatePicker' })[0].vm.$emit('update:modelValue', new Date(nextYear, 0, 11));
        await flushPromises();
        expect(w.text()).toContain('Saldo Tersedia: 3 hari');
        w.unmount();
    });
});
