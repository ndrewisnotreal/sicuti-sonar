import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import DateRangeFilter from '@/components/common/DateRangeFilter.vue';

const DatePickerStub = defineComponent({
    name: 'DatePicker',
    props: ['modelValue', 'minDate', 'maxDate'],
    emits: ['update:modelValue'],
    setup: (p, { attrs }) => () => h('div', { class: 'picker', 'aria-label': attrs['aria-label'] })
});

const mountFilter = (modelValue) =>
    mount(DateRangeFilter, {
        props: { modelValue, label: 'Rentang tanggal cuti' },
        global: { stubs: { DatePicker: DatePickerStub } }
    });

describe('DateRangeFilter', () => {
    it('mengubah tanggal akhir tidak menghapus tanggal awal', () => {
        const start = new Date(2026, 0, 5);
        const end = new Date(2026, 0, 10);
        const wrapper = mountFilter([start, end]);
        const [, endPicker] = wrapper.findAllComponents(DatePickerStub);
        const newEnd = new Date(2026, 0, 20);
        endPicker.vm.$emit('update:modelValue', newEnd);
        expect(wrapper.emitted('update:modelValue').at(-1)[0]).toEqual([start, newEnd]);
    });

    it('menetapkan batas tanggal dan label aksesibel pada kedua pemilih', () => {
        const start = new Date(2026, 0, 5);
        const end = new Date(2026, 0, 10);
        const wrapper = mountFilter([start, end]);
        const [startPicker, endPicker] = wrapper.findAllComponents(DatePickerStub);
        expect(startPicker.props('maxDate')).toEqual(end);
        expect(endPicker.props('minDate')).toEqual(start);
        expect(startPicker.attributes('aria-label')).toBe('Rentang tanggal cuti dari');
        expect(endPicker.attributes('aria-label')).toBe('Rentang tanggal cuti sampai');
    });

    it('mengosongkan kedua tanggal memancarkan null', () => {
        const start = new Date(2026, 0, 5);
        const wrapper = mountFilter([start, null]);
        const [startPicker] = wrapper.findAllComponents(DatePickerStub);
        startPicker.vm.$emit('update:modelValue', null);
        expect(wrapper.emitted('update:modelValue').at(-1)[0]).toBeNull();
    });

    it('hanya tanggal akhir tetap menghasilkan [null, akhir]', () => {
        const wrapper = mountFilter(null);
        const [, endPicker] = wrapper.findAllComponents(DatePickerStub);
        const end = new Date(2026, 0, 10);
        endPicker.vm.$emit('update:modelValue', end);
        expect(wrapper.emitted('update:modelValue').at(-1)[0]).toEqual([null, end]);
    });
});
