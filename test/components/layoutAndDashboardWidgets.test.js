import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import AppNotificationItem from '@/layout/AppNotificationItem.vue';
import AdminDashboardMonitoringTable from '@/components/dashboard/AdminDashboardMonitoringTable.vue';
import AdminDashboardCalendar from '@/components/dashboard/AdminDashboardCalendar.vue';

const DataTableStub = defineComponent({
    name: 'DataTable',
    inheritAttrs: false,
    props: ['value'],
    setup: (p, { slots }) => () => {
        const columns = slots.default ? slots.default() : [];
        if (!p.value || !p.value.length) {
            return h('div', { class: 'empty-table' }, slots.empty?.());
        }
        return h('div', { class: 'datatable' }, [
            p.value.map((row) =>
                h('div', { key: row.id || row.id_request, class: 'datatable-row' },
                    columns.map((col) => {
                        const body = col.children?.body;
                        return h('div', body ? body({ data: row }) : null);
                    })
                )
            )
        ]);
    }
});

const ColumnStub = defineComponent({
    name: 'Column',
    props: ['header'],
    setup: () => () => null
});

const DatePickerStub = defineComponent({
    name: 'DatePicker',
    props: ['modelValue'],
    setup: (p, { slots }) => () => h('div', { class: 'datepicker' }, [slots.date ? slots.date({ date: { day: 15 } }) : null])
});

const TagStub = defineComponent({
    name: 'Tag',
    props: ['value', 'severity'],
    setup: (p) => () => h('span', { class: `tag tag-${p.severity}` }, p.value)
});

const ButtonStub = defineComponent({
    name: 'Button',
    props: ['label'],
    emits: ['click'],
    setup: (p, { slots, emit }) => () => h('button', { onClick: () => emit('click') }, [p.label, slots.default?.()])
});

const SelectStub = defineComponent({
    name: 'Select',
    props: ['modelValue', 'options'],
    setup: () => () => h('select')
});

const IconFieldStub = defineComponent({
    name: 'IconField',
    setup: (p, { slots }) => () => h('div', slots.default?.())
});

const InputIconStub = defineComponent({
    name: 'InputIcon',
    setup: (p, { slots }) => () => h('span', slots.default?.())
});

const InputTextStub = defineComponent({
    name: 'InputText',
    inheritAttrs: false,
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup: (p, { emit }) => () => h('input', { value: p.modelValue, onInput: (e) => emit('update:modelValue', e.target.value) })
});

const globalStubs = {
    DataTable: DataTableStub,
    Column: ColumnStub,
    DatePicker: DatePickerStub,
    Tag: TagStub,
    Button: ButtonStub,
    Select: SelectStub,
    IconField: IconFieldStub,
    InputIcon: InputIconStub,
    InputText: InputTextStub
};

describe('AppNotificationItem', () => {
    const sampleItem = {
        id: 'NOTIF-1',
        title: 'Pengajuan Disetujui',
        message: 'Pengajuan cuti Anda telah disetujui oleh atasan.',
        timeAgo: '5 menit lalu',
        requestId: 'REQ-001',
        group: 'approved',
        isRead: false
    };

    it('renders notification information and unread dot', () => {
        const w = mount(AppNotificationItem, {
            props: { item: sampleItem }
        });
        expect(w.text()).toContain('Pengajuan Disetujui');
        expect(w.text()).toContain('Pengajuan cuti Anda telah disetujui');
        expect(w.text()).toContain('5 menit lalu');
        expect(w.text()).toContain('REQ-001');

        const unreadDot = w.find('span[title="Belum dibaca"]');
        expect(unreadDot.exists()).toBe(true);
    });

    it('emits click event with item when clicked', async () => {
        const w = mount(AppNotificationItem, {
            props: { item: sampleItem }
        });
        await w.trigger('click');
        expect(w.emitted('click')).toHaveLength(1);
        expect(w.emitted('click')[0][0]).toEqual(sampleItem);
    });
});

describe('AdminDashboardMonitoringTable', () => {
    const sampleRequests = [
        {
            id_request: 'REQ-101',
            requester_name: 'Dewi Lestari',
            namecode: 'EMP001',
            kd_dept: 'SIT',
            nm_leave_type: 'Cuti Tahunan',
            start_date: '2025-06-01',
            end_date: '2025-06-03',
            total_days: 3,
            status: 'submitted',
            created_at: '2025-05-20'
        },
        {
            id_request: 'REQ-102',
            requester_name: 'Eko Prasetyo',
            namecode: 'EMP002',
            kd_dept: 'SIS',
            nm_leave_type: 'Cuti Sakit',
            start_date: '2025-06-05',
            end_date: '2025-06-06',
            total_days: 2,
            status: 'approved',
            created_at: '2025-05-22'
        }
    ];

    it('renders monitoring rows', () => {
        const w = mount(AdminDashboardMonitoringTable, {
            props: {
                requests: sampleRequests,
                loading: false,
                adminDivision: ''
            },
            global: { stubs: globalStubs }
        });
        expect(w.text()).toContain('Dewi Lestari');
        expect(w.text()).toContain('Eko Prasetyo');
        expect(w.text()).toContain('Menampilkan 2 pengajuan');
    });

    it('filters requests by search query', async () => {
        const w = mount(AdminDashboardMonitoringTable, {
            props: {
                requests: sampleRequests,
                loading: false,
                adminDivision: ''
            },
            global: { stubs: globalStubs }
        });
        w.vm.searchQuery = 'Dewi';
        await w.vm.$nextTick();
        expect(w.text()).toContain('Dewi Lestari');
        expect(w.text()).toContain('Menampilkan 1 pengajuan');
    });

    it('emits view-detail when detail button is clicked', async () => {
        const w = mount(AdminDashboardMonitoringTable, {
            props: {
                requests: sampleRequests,
                loading: false,
                adminDivision: ''
            },
            global: { stubs: globalStubs }
        });
        w.vm.$emit('view-detail', sampleRequests[0]);
        expect(w.emitted('view-detail')).toBeTruthy();
        expect(w.emitted('view-detail')[0][0]).toEqual(sampleRequests[0]);
    });

    it('membedakan gagal dimuat dari tidak cocok filter, dan Atur ulang filter mengembalikan data (audit-018 #2)', async () => {
        const failed = mount(AdminDashboardMonitoringTable, {
            props: { requests: [], loading: false, adminDivision: '', loadError: true },
            global: { stubs: globalStubs }
        });
        expect(failed.text()).toContain('Data pengajuan belum termuat.');
        expect(failed.text()).toContain('Menampilkan – pengajuan');

        const w = mount(AdminDashboardMonitoringTable, {
            props: { requests: sampleRequests, loading: false, adminDivision: '' },
            global: { stubs: globalStubs }
        });
        w.vm.searchQuery = 'tidak-ada';
        await w.vm.$nextTick();
        expect(w.text()).toContain('Tidak ada pengajuan yang cocok dengan filter.');
        w.vm.resetFilters();
        await w.vm.$nextTick();
        expect(w.text()).toContain('Menampilkan 2 pengajuan');
    });

    it('baris status menghitung per status mengikuti filter lain, dan memilih status menyaring tabel (audit-019 #2)', async () => {
        const w = mount(AdminDashboardMonitoringTable, {
            props: { requests: sampleRequests, loading: false, adminDivision: '' },
            global: { stubs: globalStubs }
        });
        const chips = () => w.findAll('[role="group"] button').map((b) => b.text().replace(/\s+/g, ' '));
        expect(chips()).toEqual(['Semua 2', 'Diajukan 1', 'Disetujui 1']);
        await w.findAll('[role="group"] button')[2].trigger('click');
        expect(w.text()).toContain('Menampilkan 1 pengajuan');
        expect(w.findAll('[role="group"] button')[2].attributes('aria-pressed')).toBe('true');
        w.vm.searchQuery = 'Dewi';
        await w.vm.$nextTick();
        // Status terpilih tetap tampil walau jumlahnya 0 setelah filter lain berubah.
        expect(chips()).toEqual(['Semua 1', 'Diajukan 1', 'Disetujui 0']);
    });

    it('data terakhir tetap dihitung dan tanggal pengajuan tersedia pada daftar HP', async () => {
        const w = mount(AdminDashboardMonitoringTable, {
            props: { requests: sampleRequests, loadError: true, staleData: true },
            global: { stubs: globalStubs }
        });
        expect(w.get('[role="status"]').text()).toContain('Menampilkan 2 pengajuan · data terakhir');
        expect(w.findAll('li')[0].text()).toContain('Diajukan');
        expect(w.findAll('li')[0].text()).toContain('20 Mei 2025');
        w.vm.searchQuery = 'tidak-ada';
        await w.vm.$nextTick();
        expect(w.text()).toContain('Tidak ada pengajuan yang cocok dengan filter.');
        expect(w.get('[role="status"]').text()).toContain('Menampilkan 0 pengajuan · data terakhir');
    });

    it('kegagalan sumber filter ditunjukkan per field, retry mengirim refresh', async () => {
        const w = mount(AdminDashboardMonitoringTable, {
            props: { isSuper: true, leaveTypesError: true, departmentsError: true },
            global: { stubs: globalStubs }
        });
        expect(w.get('#mon-dept-error').text()).toContain('divisi gagal dimuat');
        expect(w.get('#mon-type-error').text()).toContain('jenis cuti gagal dimuat');
        expect(w.get('[role="alert"]').text()).toContain('filter lain masih dapat digunakan');
        const selects = w.findAllComponents(SelectStub);
        expect(selects.every((s) => s.attributes('disabled') !== undefined)).toBe(true);
        await w.findAll('button').find((b) => b.text() === 'Coba lagi filter').trigger('click');
        expect(w.emitted('refresh')).toHaveLength(1);
    });
});

describe('AdminDashboardCalendar', () => {
    it('mounts and renders legend and calendar tags', () => {
        const w = mount(AdminDashboardCalendar, {
            props: {
                divisionRequests: [],
                adminDivision: 'SIT'
            },
            global: {
                stubs: globalStubs,
                directives: {
                    tooltip: () => {}
                }
            }
        });
        expect(w.text()).toContain('Kalender Cuti');
        expect(w.text()).toContain('Cuti karyawan');
        expect(w.text()).toContain('Hari libur');
    });
});
