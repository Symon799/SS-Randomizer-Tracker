import { useCallback } from 'react';
import type { RemoteReference } from './loader/LogicLoader';
import { logicSelector } from './logic/Selectors';
import { type ThunkResult, useAppDispatch } from './store/Store';
import {
    apCountedCheckIdsSelector,
    areasSelector,
    checkSelector,
    getRequirementLogicalStateSelector,
    totalCountersSelector,
    totalGratitudeCrystalsSelector,
} from './tracker/Selectors';
import type { TrackerState } from './tracker/Slice';

const snapshotFocusChecks = [
    "Farore's Silent Realm - Collect all Tears Reward",
    "Farore's Silent Realm - Stamina Fruit on Vine Wall 1",
    "Farore's Silent Realm - Stamina Fruit on Vine Wall 2",
    'Island Closest to Faron Pillar - Goddess Chest',
    'Lumpy Pumpkin - Goddess Chest near Gossip Stone',
    'Lumpy Pumpkin - Harp Duet with Kina',
] as const;

const version = 'SSRANDO-TRACKER-NG-V2';

export interface ExportState {
    version: string;
    state: TrackerState;
    logicBranch: RemoteReference | undefined;
}

function doExport(): ThunkResult {
    return (_dispatch, getState) => {
        const state = getState().tracker;
        const logicBranch = getState().logic.loaded?.remote;

        const filename = `SS-Rando-Tracker${new Date().toISOString()}`;
        const exportVal: ExportState = { state, version, logicBranch };
        const exportstring = JSON.stringify(exportVal, undefined, '\t');
        const blob = new Blob([exportstring], { type: 'json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.download = `${filename}.json`;
        a.href = url;
        a.dataset.downloadurl = ['json', a.download, a.href].join(':');
        a.click();
        window.URL.revokeObjectURL(url);
    };
}

type TrackerSnapshot = {
    generatedAt: string;
    counters: {
        checked: number;
        accessible: number;
        remaining: number;
        exitsAccessible: number;
    };
    requiredDungeons: string[];
    availableLocations: string[];
    checkedLocations: string[];
    remainingLocations: string[];
    totalsByType: Record<string, number>;
    gratitudeCrystals: {
        totalForLogic: number;
        looseCrystalChecksChecked: number;
        startingCrystalPacks: number;
        inventoryCrystalPacks: number;
    };
    checkedVirtualLocations: string[];
    focusDebug: Array<{
        name: string;
        checkId: string | null;
        logicalState: string;
        checked: boolean;
        area: string | undefined;
        type: string | undefined;
        rawStaticRequirements: string[];
        staticRequirements: string[];
        staticRequirementStates: string[];
        checkedRequirementBits: string[];
    }>;
};

function summarizeRequirements(
    logic: ReturnType<typeof logicSelector>,
    bit: number | undefined,
    useRaw = false,
) {
    if (bit === undefined) {
        return ['check bit missing'];
    }

    const expr = useRaw
        ? logic.rawStaticRequirements[bit]
        : logic.staticRequirements[bit];
    if (!expr || expr.conjunctions.length === 0) {
        return ['static requirements = false'];
    }

    const summaries = expr.conjunctions.slice(0, 4).map((conjunction) => {
        const parts = [...conjunction.iter()]
            .slice(0, 12)
            .map((reqBit) => logic.allItems[reqBit] ?? `bit:${reqBit}`);
        const suffix =
            conjunction.numSetBits > 12
                ? ` +${conjunction.numSetBits - 12} more`
                : '';
        return parts.length > 0 ? `${parts.join(' & ')}${suffix}` : 'true';
    });

    if (expr.conjunctions.length > 4) {
        summaries.push(`... ${expr.conjunctions.length - 4} other branches`);
    }
    return summaries;
}

function summarizeRequirementStates(
    logic: ReturnType<typeof logicSelector>,
    bit: number | undefined,
    getRequirementLogicalState: (requirement: string) => string,
) {
    if (bit === undefined) {
        return ['check bit missing'];
    }

    const expr = logic.staticRequirements[bit];
    if (!expr || expr.conjunctions.length === 0) {
        return ['static requirements = false'];
    }

    return expr.conjunctions.slice(0, 4).map((conjunction, index) => {
        const parts = [...conjunction.iter()].slice(0, 12).map((reqBit) => {
            const requirement = logic.allItems[reqBit] ?? `bit:${reqBit}`;
            return `${requirement} [${getRequirementLogicalState(requirement)}]`;
        });
        const suffix =
            conjunction.numSetBits > 12
                ? ` +${conjunction.numSetBits - 12} more`
                : '';
        return `branch ${index + 1}: ${parts.join(' & ')}${suffix}`;
    });
}

function downloadJson(filename: string, value: unknown) {
    const exportstring = JSON.stringify(value, undefined, '\t');
    const blob = new Blob([exportstring], { type: 'json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = filename;
    a.href = url;
    a.dataset.downloadurl = ['json', a.download, a.href].join(':');
    a.click();
    window.URL.revokeObjectURL(url);
}

function doExportUtSnapshot(): ThunkResult {
    return (_dispatch, getState) => {
        const state = getState();
        const logic = logicSelector(state);
        const areas = areasSelector(state);
        const counters = totalCountersSelector(state);
        const apCountedCheckIds = apCountedCheckIdsSelector(state);
        const totalGratitudeCrystals = totalGratitudeCrystalsSelector(state);
        const getRequirementLogicalState =
            getRequirementLogicalStateSelector(state);

        const allCheckIds = areas.flatMap((area) => [
            ...area.checks.list,
            ...(area.extraLocations.loose_crystal?.list ?? []),
        ]);

        const snapshotChecks = allCheckIds
            .map((checkId) => checkSelector.selector(state, checkId))
            .filter((check) => check.type !== 'exit')
            .map((check) => ({
                id: check.checkId,
                name: logic.checks[check.checkId]?.name ?? check.checkName,
                checked: check.checked,
                logicalState: check.logicalState,
                type: check.type,
            }));

        const countedChecks = apCountedCheckIds.map((checkId) => ({
            id: checkId,
            name: logic.checks[checkId]?.name ?? checkId,
            checked: state.tracker.checkedChecks.includes(checkId),
            type: logic.checks[checkId]?.type ?? 'regular',
        }));

        const availableLocations = snapshotChecks
            .filter(
                (check) => !check.checked && check.logicalState === 'inLogic',
            )
            .map((check) => check.name)
            .sort((a, b) => a.localeCompare(b));
        const checkedLocations = countedChecks
            .filter((check) => check.checked)
            .map((check) => check.name)
            .sort((a, b) => a.localeCompare(b));
        const remainingLocations = countedChecks
            .filter((check) => !check.checked)
            .map((check) => check.name)
            .sort((a, b) => a.localeCompare(b));
        const totalsByType = countedChecks.reduce<Record<string, number>>(
            (acc, check) => {
                acc[check.type] = (acc[check.type] ?? 0) + 1;
                return acc;
            },
            {},
        );
        const looseCrystalChecksChecked = countedChecks.filter(
            (check) => check.checked && check.type === 'loose_crystal',
        ).length;
        const startingCrystalPacks = Number(
            state.tracker.settings['starting-crystal-packs'] ?? 0,
        );
        const inventoryCrystalPacks =
            state.tracker.inventory['Gratitude Crystal Pack'] ?? 0;
        const checkedVirtualLocations = state.tracker.checkedChecks
            .filter(
                (checkId) =>
                    !(checkId in logic.checks) &&
                    logic.itemBits[checkId] !== undefined,
            )
            .sort((a, b) => a.localeCompare(b));
        const checkedVirtualLocationSet = new Set(checkedVirtualLocations);
        const focusDebug = snapshotFocusChecks.map((name) => {
            const checkId =
                Object.entries(logic.checks).find(
                    ([, check]) => check.name === name,
                )?.[0] ?? null;
            const checkBit =
                checkId !== null ? logic.itemBits[checkId] : undefined;
            const expr =
                checkBit !== undefined
                    ? logic.staticRequirements[checkBit]
                    : undefined;
            const checkedRequirementBits =
                expr?.conjunctions.flatMap((conjunction) =>
                    [...conjunction.iter()]
                        .map(
                            (reqBit) =>
                                logic.allItems[reqBit] ?? `bit:${reqBit}`,
                        )
                        .filter((req) => checkedVirtualLocationSet.has(req)),
                ) ?? [];
            const uniqueCheckedRequirementBits = [
                ...new Set(checkedRequirementBits),
            ];
            const checkData =
                checkId !== null
                    ? checkSelector.selector(state, checkId)
                    : undefined;

            return {
                name,
                checkId,
                logicalState: checkData?.logicalState ?? 'missing',
                checked: checkData?.checked ?? false,
                area:
                    checkId !== null ? logic.checks[checkId]?.area : undefined,
                type:
                    checkId !== null ? logic.checks[checkId]?.type : undefined,
                rawStaticRequirements: summarizeRequirements(
                    logic,
                    checkBit,
                    true,
                ),
                staticRequirements: summarizeRequirements(logic, checkBit),
                staticRequirementStates: summarizeRequirementStates(
                    logic,
                    checkBit,
                    getRequirementLogicalState,
                ),
                checkedRequirementBits: uniqueCheckedRequirementBits,
            };
        });

        const snapshot: TrackerSnapshot = {
            generatedAt: new Date().toISOString(),
            counters: {
                checked: counters.numChecked,
                accessible: counters.numAccessible,
                remaining: counters.numRemaining,
                exitsAccessible: counters.numExitsAccessible,
            },
            requiredDungeons: state.tracker.requiredDungeons,
            availableLocations,
            checkedLocations,
            remainingLocations,
            totalsByType,
            gratitudeCrystals: {
                totalForLogic: totalGratitudeCrystals,
                looseCrystalChecksChecked,
                startingCrystalPacks,
                inventoryCrystalPacks,
            },
            checkedVirtualLocations,
            focusDebug,
        };

        downloadJson(
            `SSHD-UT-Snapshot-${new Date().toISOString().replaceAll(':', '-')}.json`,
            snapshot,
        );
    };
}

export function ExportButton() {
    const dispatch = useAppDispatch();
    const onClick = useCallback(() => {
        dispatch(doExport());
    }, [dispatch]);

    return (
        <button type="button" className="tracker-button" onClick={onClick}>
            Export
        </button>
    );
}

export function ExportUtSnapshotButton() {
    const dispatch = useAppDispatch();
    const onClick = useCallback(() => {
        dispatch(doExportUtSnapshot());
    }, [dispatch]);

    return (
        <button type="button" className="tracker-button" onClick={onClick}>
            UT Snapshot
        </button>
    );
}
