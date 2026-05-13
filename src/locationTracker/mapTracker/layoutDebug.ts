export const ENABLE_MAP_LAYOUT_DEBUG = false;
export const MAP_LAYOUT_ROOT_ATTR = 'data-map-layout-root';

const STORAGE_KEY = 'sshd-ap-tracker-map-layout-overrides-v1';
const EXPORT_FILENAME = 'sshd-map-layout-overrides.json';

export type LayoutOverride = {
    x: number;
    y: number;
};

type LayoutOverrides = Record<string, LayoutOverride>;

const listeners = new Set<() => void>();
const activeLayoutMoveListeners = new Set<() => void>();

let activeLayoutMovePath: string | null = null;

function clampPercent(value: number) {
    return Math.max(0, Math.min(100, value));
}

function loadOverrides(): LayoutOverrides {
    if (typeof window === 'undefined') {
        return {};
    }
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw) as LayoutOverrides;
        return Object.fromEntries(
            Object.entries(parsed).filter(
                ([, value]) =>
                    value &&
                    typeof value.x === 'number' &&
                    typeof value.y === 'number',
            ),
        );
    } catch {
        return {};
    }
}

function saveOverrides(overrides: LayoutOverrides) {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(overrides, null, 2),
    );
}

export function downloadLayoutOverrides() {
    if (typeof window === 'undefined') {
        return;
    }
    const overrides = loadOverrides();
    const blob = new Blob([JSON.stringify(overrides, null, 2)], {
        type: 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = EXPORT_FILENAME;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

export function getLayoutOverride(
    debugPath: string,
    fallback: LayoutOverride,
): LayoutOverride {
    const override = loadOverrides()[debugPath];
    return override
        ? { x: clampPercent(override.x), y: clampPercent(override.y) }
        : fallback;
}

export function setLayoutOverride(debugPath: string, override: LayoutOverride) {
    const overrides = loadOverrides();
    overrides[debugPath] = {
        x: clampPercent(override.x),
        y: clampPercent(override.y),
    };
    saveOverrides(overrides);
    listeners.forEach((listener) => listener());
}

export function subscribeLayoutOverrides(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getActiveLayoutMovePath() {
    return activeLayoutMovePath;
}

export function setActiveLayoutMovePath(path: string | null) {
    if (activeLayoutMovePath === path) {
        return;
    }
    activeLayoutMovePath = path;
    activeLayoutMoveListeners.forEach((listener) => listener());
}

export function toggleActiveLayoutMovePath(path: string) {
    setActiveLayoutMovePath(activeLayoutMovePath === path ? null : path);
}

export function subscribeActiveLayoutMove(listener: () => void) {
    activeLayoutMoveListeners.add(listener);
    return () => {
        activeLayoutMoveListeners.delete(listener);
    };
}

export function getLayoutRootRect(element: HTMLElement): DOMRect | undefined {
    const root = element.closest(`[${MAP_LAYOUT_ROOT_ATTR}]`);
    if (root instanceof HTMLElement) {
        return root.getBoundingClientRect();
    }
    return undefined;
}

export function registerLayoutDebugHelpers() {
    if (typeof window === 'undefined') {
        return;
    }
    const w = window as Window &
        typeof globalThis & {
            __sshdMapLayoutDebug?: {
                enabled: boolean;
                getOverrides: () => LayoutOverrides;
                clearOverrides: () => void;
                printOverrides: () => void;
                downloadOverrides: () => void;
            };
        };
    w.__sshdMapLayoutDebug = {
        enabled: ENABLE_MAP_LAYOUT_DEBUG,
        getOverrides: () => loadOverrides(),
        clearOverrides: () => {
            window.localStorage.removeItem(STORAGE_KEY);
            listeners.forEach((listener) => listener());
        },
        printOverrides: () => {
            const overrides = loadOverrides();
            console.log('Map layout overrides:', overrides);
            console.log(
                'Run `window.__sshdMapLayoutDebug?.downloadOverrides()` to save them as a JSON file, then apply them with `npm run apply:mapLayout -- <file>`.',
            );
        },
        downloadOverrides: () => downloadLayoutOverrides(),
    };
}
