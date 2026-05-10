export const ENABLE_MAP_LAYOUT_DEBUG = false;

const STORAGE_KEY = 'sshd-ap-tracker-map-layout-overrides-v1';

export type LayoutOverride = {
    x: number;
    y: number;
};

type LayoutOverrides = Record<string, LayoutOverride>;

const listeners = new Set<() => void>();

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
                'Copy these values into src/data/mapData.json or keep them in localStorage.',
            );
        },
    };
}
