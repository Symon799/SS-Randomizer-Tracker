import { isItem, itemMaxes } from '../logic/Inventory';

export function reconstructApRequiredDungeons(
    requiredDungeons: string[],
    manualOverrides: Record<string, boolean>,
): string[] {
    const ap = new Set(requiredDungeons);

    for (const [dungeon, required] of Object.entries(manualOverrides)) {
        if (!required) {
            ap.add(dungeon);
        }
    }

    return [...ap];
}

export function reconcileManualOverrides(
    previousAp: ReadonlySet<string>,
    nextAp: ReadonlySet<string>,
    manualOverrides: Record<string, boolean>,
): Record<string, boolean> {
    if (previousAp.size === 0) {
        return { ...manualOverrides };
    }

    const overrides = { ...manualOverrides };
    const ids = new Set([
        ...previousAp,
        ...nextAp,
        ...Object.keys(manualOverrides),
    ]);

    for (const id of ids) {
        if (previousAp.has(id) !== nextAp.has(id)) {
            delete overrides[id];
        }
    }

    return overrides;
}

export function mergeWithManualOverrides(
    apValues: ReadonlySet<string>,
    manualOverrides: Record<string, boolean>,
): string[] {
    const ids = new Set([...apValues, ...Object.keys(manualOverrides)]);
    const result: string[] = [];

    for (const id of ids) {
        const enabled = Object.hasOwn(manualOverrides, id)
            ? manualOverrides[id]
            : apValues.has(id);
        if (enabled) {
            result.push(id);
        }
    }

    return result;
}

/**
 * Adjust manual inventory deltas when AP syncs.
 * Positive deltas from AP=0 (early manual mark) are cleared once AP catches up.
 * Other deltas persist through AP updates.
 */
export function reconcileInventoryOverrides(
    previousAp: Readonly<Partial<Record<string, number>>>,
    nextAp: Readonly<Partial<Record<string, number>>>,
    manualDeltas: Partial<Record<string, number>>,
): Partial<Record<string, number>> {
    if (Object.keys(previousAp).length === 0) {
        return { ...manualDeltas };
    }

    const deltas = { ...manualDeltas };
    const items = new Set([
        ...Object.keys(previousAp),
        ...Object.keys(nextAp),
        ...Object.keys(manualDeltas),
    ]);

    for (const item of items) {
        const delta = deltas[item];
        if (delta === undefined || delta <= 0) {
            continue;
        }
        const prevAp = previousAp[item] ?? 0;
        const nextApCount = nextAp[item] ?? 0;
        if (prevAp === 0 && nextApCount > 0) {
            delete deltas[item];
        }
    }

    return deltas;
}

export function mergeInventoryWithManualOverrides(
    apInventory: Partial<Record<string, number>>,
    manualDeltas: Partial<Record<string, number>>,
): Partial<Record<string, number>> {
    const itemIds = new Set([
        ...Object.keys(apInventory),
        ...Object.keys(manualDeltas),
    ]);
    const merged: Partial<Record<string, number>> = {};

    for (const item of itemIds) {
        const apCount = apInventory[item] ?? 0;
        const delta = manualDeltas[item] ?? 0;
        const raw = apCount + delta;
        const max = isItem(item) ? itemMaxes[item] : undefined;
        merged[item] =
            max !== undefined
                ? Math.max(0, Math.min(max, raw))
                : Math.max(0, raw);
    }

    return merged;
}

/** Convert legacy absolute overrides to deltas (one-time migration). */
export function migrateAbsoluteInventoryOverridesToDeltas(
    apInventory: Readonly<Partial<Record<string, number>>>,
    manualOverrides: Partial<Record<string, number>>,
): Partial<Record<string, number>> {
    const deltas: Partial<Record<string, number>> = {};

    for (const [item, value] of Object.entries(manualOverrides)) {
        if (value === undefined) {
            continue;
        }
        const apCount = apInventory[item] ?? 0;
        const delta = value - apCount;
        if (delta !== 0) {
            deltas[item] = delta;
        }
    }

    return deltas;
}

export function bootstrapManualCheckOverrides(
    checkedChecks: string[],
    apCheckedChecks: string[],
    manualCheckedOverrides: Record<string, boolean>,
): Record<string, boolean> {
    if (
        apCheckedChecks.length > 0 ||
        Object.keys(manualCheckedOverrides).length > 0
    ) {
        return manualCheckedOverrides;
    }

    return Object.fromEntries(
        checkedChecks.map((checkId) => [checkId, true] as const),
    );
}
