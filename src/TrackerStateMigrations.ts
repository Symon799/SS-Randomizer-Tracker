import { produce } from 'immer';
import { defaultRequiredDungeons } from './logic/Locations';
import type { TrackerState } from './tracker/Slice';
import {
    bootstrapManualCheckOverrides,
    mergeWithManualOverrides,
    reconstructApRequiredDungeons,
} from './tracker/TrackerSync';

export function migrateTrackerState(
    old: TrackerState,
    options?: {
        shouldDefaultRequiredDungeons?: boolean;
        preserveRequiredDungeonSelection?: boolean;
    },
): TrackerState {
    return produce(old, (draft) => {
        for (const key of Object.keys(old.hints)) {
            if (old.hints[key] && !Array.isArray(old.hints[key])) {
                draft.hints[key] = [old.hints[key]];
            }
        }

        draft.apCheckedChecks ??= [];
        draft.manualCheckedOverrides ??= {};
        draft.apRequiredDungeons ??= [];
        draft.manualRequiredDungeonOverrides ??= {};

        draft.manualCheckedOverrides = bootstrapManualCheckOverrides(
            draft.checkedChecks,
            draft.apCheckedChecks,
            draft.manualCheckedOverrides,
        );
        draft.checkedChecks = mergeWithManualOverrides(
            new Set(draft.apCheckedChecks),
            draft.manualCheckedOverrides,
        );

        if (options?.preserveRequiredDungeonSelection) {
            if (draft.apRequiredDungeons.length === 0) {
                draft.apRequiredDungeons = reconstructApRequiredDungeons(
                    draft.requiredDungeons,
                    draft.manualRequiredDungeonOverrides,
                );
            }
        } else {
            if (draft.apRequiredDungeons.length === 0) {
                draft.apRequiredDungeons = reconstructApRequiredDungeons(
                    draft.requiredDungeons,
                    draft.manualRequiredDungeonOverrides,
                );
            }
            draft.requiredDungeons = mergeWithManualOverrides(
                new Set(draft.apRequiredDungeons),
                draft.manualRequiredDungeonOverrides,
            );

            if (
                options?.shouldDefaultRequiredDungeons &&
                draft.requiredDungeons.length === 0
            ) {
                draft.requiredDungeons = defaultRequiredDungeons();
                draft.apRequiredDungeons = defaultRequiredDungeons();
            }
        }
    });
}
