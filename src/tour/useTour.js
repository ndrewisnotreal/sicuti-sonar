import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { currentUser } from '@/service/sicutiService';
import { getTourPersona } from './persona';
import { hasSeenTour, markTourSeen, tourSeenTick } from './tourStore';
import { loadTourSteps, tourById, tourForRoute, welcomeTour } from './tours';

let activeDriver = null;

function isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

export function findAnchor(key, root = document) {
    return [...root.querySelectorAll(`[data-tour="${key}"]`)].find(isVisible) || null;
}

export function buildSteps(tour, persona, find = findAnchor) {
    return tour.steps
        .filter((s) => !s.personas || s.personas.includes(persona))
        .filter((s) => !s.ifHidden || !find(s.ifHidden))
        .map((s) => {
            const popover = { title: s.title, description: s.text };
            if (s.side) popover.side = s.side;
            if (s.align) popover.align = s.align;
            if (!s.element) return { popover };
            const element = find(s.element);
            return element ? { element, popover } : null;
        })
        .filter(Boolean);
}

function waitForAnchor(key, timeout = 3000) {
    if (!key) return Promise.resolve();
    return new Promise((resolve) => {
        const started = Date.now();
        const check = () => {
            if (findAnchor(key) || Date.now() - started > timeout) resolve();
            else setTimeout(check, 100);
        };
        check();
    });
}

export async function startTour(tour) {
    if (!tour || typeof document === 'undefined') return false;
    const user = currentUser.value;
    const [{ driver }, stepDefs] = await Promise.all([
        import('driver.js'),
        loadTourSteps(tour),
        import('driver.js/dist/driver.css'),
        import('./tour.css')
    ]);
    const steps = buildSteps({ ...tour, steps: stepDefs }, getTourPersona(user));
    if (!steps.length) return false;

    activeDriver?.destroy();
    const instance = driver({
        steps,
        showProgress: steps.length > 1,
        progressText: '{{current}} dari {{total}}',
        nextBtnText: 'Lanjut',
        prevBtnText: 'Kembali',
        doneBtnText: 'Selesai',
        // driver.js tidak melokalkan label tombol tutup (×); bawaannya "Close" (D-F10).
        closeBtnLabel: 'Tutup',
        popoverClass: 'lebur-tour',
        overlayOpacity: 0.55,
        stagePadding: 6,
        stageRadius: 10,
        smoothScroll: true,
        onDestroyed: () => {
            markTourSeen(user?.id, tour);
            if (activeDriver === instance) activeDriver = null;
        }
    });
    activeDriver = instance;
    instance.drive();
    return true;
}

export function useTour() {
    const route = useRoute();
    const router = useRouter();
    const persona = computed(() => getTourPersona(currentUser.value));
    const pageTour = computed(() => tourForRoute(route.path, persona.value));
    const introTour = computed(() => welcomeTour(persona.value));
    const hasUnseen = computed(() => {
        void tourSeenTick.value;
        const uid = currentUser.value?.id;
        return [pageTour.value, introTour.value].some((t) => t && !hasSeenTour(uid, t));
    });

    async function startIntro() {
        const tour = introTour.value;
        if (!tour) return false;
        if (tour.route && route.path !== tour.route) {
            await router.push(tour.route);
            await waitForAnchor(tour.readyAnchor);
        }
        return startTour(tour);
    }

    return {
        persona,
        pageTour,
        introTour,
        hasUnseen,
        startIntro,
        startPageTour: () => startTour(pageTour.value),
        startById: (id) => startTour(tourById(id, persona.value))
    };
}
