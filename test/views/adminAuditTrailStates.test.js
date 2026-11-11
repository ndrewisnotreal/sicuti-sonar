import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const getAuditLogs = vi.fn();
const saveBlob = vi.fn();
const toastAdd = vi.fn();
vi.mock('@/service/adminService', () => ({
    adminService: { getAuditLogs: (...a) => getAuditLogs(...a) },
    AUDIT_ACTION_LABEL: { LOGIN: 'Masuk aplikasi', ACCESS_DENIED: 'Akses ditolak' },
    AUDIT_ENTITY_LABEL: { AUTH: 'Autentikasi' }
}));
vi.mock('@/service/api', () => ({ saveBlob: (...a) => saveBlob(...a), default: {} }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));

import AdminAuditTrail from '@/views/admin/AdminAuditTrail.vue';
import AuditDetailDialog from '@/components/admin/AuditDetailDialog.vue';

const SelectStub = { name: 'Select', props: ['modelValue', 'ariaLabelledby'], emits: ['update:modelValue'], template: '<div class="select"></div>' };
const stubs = {
    DataTable: { props: ['value'], template: '<div class="dt"><slot v-if="!value.length" name="empty" /><span v-else class="rows">{{ value.length }}</span></div>' },
    Column: true,
    Tag: { props: ['value', 'severity'], template: '<span class="tag" :data-severity="severity">{{ value }}</span>' },
    Select: SelectStub,
    DatePicker: true,
    IconField: { template: '<div><slot /></div>' },
    InputIcon: true,
    InputText: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :id="$attrs.id" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    // Klik diteruskan lewat atribut fallthrough; emit tambahan akan memicu handler dua kali.
    Button: { props: ['label'], template: '<button>{{ label }}<slot /></button>' },
    AuditDetailDialog: true
};

const log = (over = {}) => ({ id: 1, timestamp: '2026-11-08 11:59:25', username: '24000000', user_name: 'Admin Super App', user_role: 'Admin', action: 'LOGIN', entity: 'AUTH', ip_address: '127.0.0.1', details: 'masuk', ...over });
const button = (w, text) => w.findAll('button').find((b) => b.text().includes(text));
const actionSelect = (w) => w.findAllComponents(SelectStub).find((s) => s.props('ariaLabelledby') === 'audit-action-label');

describe('Audit Trail (audit-023)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('#2 gagal ganti filter mengosongkan daftar lama, Coba lagi memuat ulang', async () => {
        getAuditLogs.mockResolvedValueOnce([log(), log({ id: 2 })]);
        const w = mount(AdminAuditTrail, { global: { stubs } });
        await flushPromises();
        expect(w.find('.dt .rows').text()).toBe('2');

        getAuditLogs.mockRejectedValueOnce(new Error('500'));
        actionSelect(w).vm.$emit('update:modelValue', 'LOGIN');
        await flushPromises();
        expect(w.find('[role="alert"]').text()).toContain('Log audit gagal dimuat');
        expect(w.find('.dt').text()).toBe('Log audit belum termuat.');
        expect(w.text()).toContain('Total: – entri log');

        getAuditLogs.mockResolvedValueOnce([log()]);
        await button(w, 'Coba lagi').trigger('click');
        await flushPromises();
        expect(w.find('[role="alert"]').exists()).toBe(false);
        expect(w.find('.dt .rows').text()).toBe('1');
    });

    it('#2 respons lama tidak menimpa hasil permintaan terbaru', async () => {
        let resolveOld;
        getAuditLogs.mockResolvedValueOnce([log()]);
        const w = mount(AdminAuditTrail, { global: { stubs } });
        await flushPromises();

        getAuditLogs.mockImplementationOnce(() => new Promise((r) => (resolveOld = r)));
        actionSelect(w).vm.$emit('update:modelValue', 'LOGIN');
        await flushPromises();
        getAuditLogs.mockResolvedValueOnce([log({ id: 7 }), log({ id: 8 }), log({ id: 9 })]);
        actionSelect(w).vm.$emit('update:modelValue', 'ACCESS_DENIED');
        await flushPromises();
        resolveOld([log()]);
        await flushPromises();
        expect(w.find('.dt .rows').text()).toBe('3');
    });

    it('#1 ekspor membuat CSV dari log yang dimuat dan menetralkan formula', async () => {
        getAuditLogs.mockResolvedValueOnce([log({ details: '=HYPERLINK("x")' })]);
        const w = mount(AdminAuditTrail, { global: { stubs } });
        await flushPromises();
        await button(w, 'Ekspor CSV').trigger('click');
        expect(saveBlob).toHaveBeenCalledTimes(1);
        const [blob, filename] = saveBlob.mock.calls[0];
        expect(filename).toMatch(/^audit_trail_\d{4}-\d{2}-\d{2}\.csv$/);
        const text = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsText(blob);
        });
        expect(text).toContain('Tanggal,Jam,Nama,NIK,Peran,Aksi,Kode Aksi,Entitas,Kode Entitas,Alamat IP,Keterangan');
        expect(text).toContain('Admin Super App,24000000,Admin,Masuk aplikasi,LOGIN,Autentikasi,AUTH,127.0.0.1');
        expect(text).toContain(`"'=HYPERLINK(""x"")"`);
    });

    it('#1 ekspor ditolak saat gagal dimuat atau kosong', async () => {
        getAuditLogs.mockResolvedValueOnce([]);
        const w = mount(AdminAuditTrail, { global: { stubs } });
        await flushPromises();
        await button(w, 'Ekspor CSV').trigger('click');
        expect(saveBlob).not.toHaveBeenCalled();
        expect(toastAdd).toHaveBeenLastCalledWith(expect.objectContaining({ summary: 'Tidak ada data' }));
    });

    it('#9 hanya kejadian yang perlu perhatian diberi Tag merah', async () => {
        getAuditLogs.mockResolvedValueOnce([log()]);
        const w = mount(AdminAuditTrail, { global: { stubs: { ...stubs, DataTable: { props: ['value'], template: '<div class="dt"><slot /></div>' }, Column: { template: '<div><slot name="body" :data="{ action: \'ACCESS_DENIED\' }" /></div>' } } } });
        await flushPromises();
        expect(w.find('.tag[data-severity="danger"]').text()).toBe('Akses ditolak');
    });

    it('#7 dialog memakai label yang sama dengan tabel dan tetap menulis kode', () => {
        const w = mount(AuditDetailDialog, {
            props: { visible: true, log: log() },
            global: { stubs: { Dialog: { template: '<div><slot /><slot name="footer" /></div>' }, Tag: stubs.Tag, Button: stubs.Button } }
        });
        expect(w.text()).toContain('Masuk aplikasi');
        expect(w.text()).toContain('LOGIN');
        expect(w.text()).toContain('Autentikasi');
        expect(w.text()).toContain('Admin Super App');
        expect(w.text()).not.toContain('WIB');
    });
});
