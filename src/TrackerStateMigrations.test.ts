import { describe, expect, it } from 'vitest';
import { migrateTrackerState } from './TrackerStateMigrations';
import type { TrackerState } from './tracker/Slice';

function makeTrackerState(
    overrides: Partial<TrackerState>,
): TrackerState {
    return {
        checkedChecks: [],
        apCheckedChecks: [],
        manualCheckedOverrides: {},
        inventory: {},
        apInventory: {},
        manualInventoryOverrides: {},
        hasBeenModified: true,
        mappedExits: {},
        requiredDungeons: [],
        apRequiredDungeons: [],
        manualRequiredDungeonOverrides: {},
        hints: {},
        checkHints: {},
        settings: {},
        userHintsText: '',
        ...overrides,
    };
}

describe('migrateTrackerState', () => {
    it('preserves saved required dungeons when continuing a session', () => {
        const migrated = migrateTrackerState(
            makeTrackerState({
                requiredDungeons: ['Skyview', 'Sandship'],
                manualRequiredDungeonOverrides: {
                    'Earth Temple': false,
                },
            }),
            { preserveRequiredDungeonSelection: true },
        );

        expect(migrated.requiredDungeons).toEqual(['Skyview', 'Sandship']);
        expect([...migrated.apRequiredDungeons].sort()).toEqual(
            ['Earth Temple', 'Sandship', 'Skyview'].sort(),
        );
    });
});
