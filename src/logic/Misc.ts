import type { Logic } from './Logic';
import {
    cubeCheckToCubeCollected,
    dungeonCompletionItems,
} from './TrackerModifications';

export function getNumLooseGratitudeCrystals(
    logic: Logic,
    checkedChecks: Set<string>,
) {
    return [...checkedChecks].filter(
        (check) => logic.checks[check]?.type === 'loose_crystal',
    ).length;
}

export function getAdditionalItems(
    logic: Logic,
    inventory: Record<string, number>,
    checkedChecks: Set<string>,
) {
    const result: Record<string, number> = {};
    // Completed dungeons
    for (const [dungeon, completionCheck] of Object.entries(
        logic.dungeonCompletionRequirements,
    )) {
        if (checkedChecks.has(completionCheck)) {
            result[dungeonCompletionItems[dungeon]] = 1;
        }
    }

    if (inventory['Triforce'] === 3) {
        result[dungeonCompletionItems['Sky Keep']] = 1;
    }

    // AP exposes some SSHD progression events as checked locations even though
    // they are virtual logic nodes rather than real tracker checks.
    for (const check of checkedChecks) {
        if (!(check in logic.checks) && logic.itemBits[check] !== undefined) {
            result[check] = 1;
        }
    }

    // If this is a goddess cube check, mark the requirement as checked
    // since this is the requirement used by the goddess chests.
    for (const check of checkedChecks) {
        const cubeCollectedItem = cubeCheckToCubeCollected[check];
        if (cubeCollectedItem) {
            result[cubeCollectedItem] = 1;
        }
    }

    const looseCrystals = getNumLooseGratitudeCrystals(logic, checkedChecks);
    const packCrystals = (inventory['Gratitude Crystal Pack'] ?? 0) * 5;
    result['Gratitude Crystal'] = looseCrystals + packCrystals;
    return result;
}
