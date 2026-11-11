import { ref } from 'vue';
import { getEncryptedItem, setEncryptedItem } from '@/utils/encryption';
import api, { clearAuth } from './api.js';

const AUTH_STORAGE_KEY = 'sicuti_auth';
const MENUS_STORAGE_KEY = 'sicuti_user_menus';

function loadStoredList(key) {
    const list = getEncryptedItem(key);
    return Array.isArray(list) ? list : [];
}

export const userMenus = ref(loadStoredList(MENUS_STORAGE_KEY));

const ABILITIES_STORAGE_KEY = 'sicuti_abilities';

export const userAbilities = ref(loadStoredList(ABILITIES_STORAGE_KEY));

function setAbilities(list) {
    userAbilities.value = Array.isArray(list) ? list : [];
    setEncryptedItem(ABILITIES_STORAGE_KEY, userAbilities.value);
}

export function can(...keys) {
    const owned = userAbilities.value || [];
    return keys.flat().some((k) => owned.includes(k));
}

const MENU_FRESH_MS = 3000;
let menuPromise = null;
let menuLoadedAt = 0;
let lastMenuData = null;

function rememberMenu(data) {
    lastMenuData = data;
    menuLoadedAt = Date.now();
}

export const authService = {
    async login(username, password) {
        // Password tidak di-trim: backend menyimpan hash password apa adanya, termasuk spasi.
        const payload = {
            username: username.trim(),
            password
        };
        const res = await api.post('/auth/authorize', payload);
        const data = res?.data || res;
        setAbilities(data?.abilities);
        if (data?.user) {
            setEncryptedItem(AUTH_STORAGE_KEY, data.user);
        }

        const hasMenu = Array.isArray(data?.menu) || Array.isArray(data?.build_menu);
        if (hasMenu) {
            const payloadMenu = Array.isArray(data.menu) ? data.menu : data.build_menu;
            userMenus.value = payloadMenu;
            setEncryptedItem(MENUS_STORAGE_KEY, payloadMenu);
            rememberMenu({ menu: payloadMenu, build_menu: data.build_menu || [], abilities: userAbilities.value });
        } else {
            await this.getMenu({ force: true }).catch(() => {});
        }

        return data;
    },

    async logout() {
        try {
            await api.post('/auth/logout');
        } catch {
        } finally {
            clearAuth();
            userMenus.value = [];
            userAbilities.value = [];
            lastMenuData = null;
            menuLoadedAt = 0;
        }
    },

    getProfile() {
        const user = getEncryptedItem(AUTH_STORAGE_KEY);
        if (user && userMenus.value.length === 0) {
            this.getMenu().catch(() => {});
        }
        return user;
    },

    async getMenu({ force = false } = {}) {
        if (!this.isAuthenticated()) {
            userMenus.value = [];
            return { build_menu: [], menu: [] };
        }
        if (!force && lastMenuData && Date.now() - menuLoadedAt < MENU_FRESH_MS) return lastMenuData;
        if (menuPromise) return menuPromise;
        menuPromise = (async () => {
            try {
                const res = await api.get('/auth/menu');
                const data = res?.data || res;
                if (Array.isArray(data?.abilities)) setAbilities(data.abilities);
                const list = Array.isArray(data?.menu)
                    ? data.menu
                    : Array.isArray(data?.build_menu)
                    ? data.build_menu
                    : Array.isArray(data)
                    ? data
                    : [];
                userMenus.value = list;
                setEncryptedItem(MENUS_STORAGE_KEY, list);
                rememberMenu(data);
                return data;
            } finally {
                menuPromise = null;
            }
        })();
        return menuPromise;
    },

    isAuthenticated() {
        return Boolean(getEncryptedItem(AUTH_STORAGE_KEY));
    },

    async changePassword(payload) {
        const res = await api.put('/auth/password', payload);
        return res?.data || res;
    }
};

export default authService;
