import { describe, expect, it } from 'vitest';
import { safeRedirect } from '@/utils/safeRedirect';

describe('safeRedirect', () => {
    it.each([
        ['/admin/accounts', '/admin/accounts'],
        ['/leave/history?editId=3#top', '/leave/history?editId=3#top'],
        [['/approval/pending', '/x'], '/approval/pending']
    ])('menerima path internal %j', (input, expected) => {
        expect(safeRedirect(input)).toBe(expected);
    });

    it.each([undefined, null, '', 'admin/accounts', '//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/auth/login', '/auth/login?redirect=/x', 42])(
        'menolak %j dan memakai fallback',
        (input) => {
            expect(safeRedirect(input)).toBe('/');
            expect(safeRedirect(input, '')).toBe('');
        }
    );
});
