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
