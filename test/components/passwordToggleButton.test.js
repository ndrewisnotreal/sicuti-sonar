import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import PasswordToggleButton from '@/components/common/PasswordToggleButton.vue';

describe('PasswordToggleButton (D-F4)', () => {
    it('tombol sungguhan dengan nama dan aria-pressed, memancarkan toggle', async () => {
        const w = mount(PasswordToggleButton);
        const btn = w.find('button');
        expect(btn.attributes('type')).toBe('button');
        expect(btn.attributes('aria-label')).toBe('Tampilkan kata sandi');
        expect(btn.attributes('aria-pressed')).toBe('false');
        await btn.trigger('click');
        expect(w.emitted('toggle')).toHaveLength(1);

        await w.setProps({ revealed: true });
        expect(btn.attributes('aria-label')).toBe('Sembunyikan kata sandi');
        expect(btn.attributes('aria-pressed')).toBe('true');
    });
});
