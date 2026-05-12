import { type PayloadAction, createSlice } from '@reduxjs/toolkit';
import { getStoredTrackerState } from '../LocalStorage';
import { migrateTrackerState } from '../TrackerStateMigrations';
import type { Hint } from '../hints/Hints';
import { type InventoryItem, isItem, itemMaxes } from '../logic/Inventory';
import type { RegularDungeon } from '../logic/Locations';
import { defaultRequiredDungeons } from '../logic/Locations';
import { getInitialItems } from '../logic/TrackerModifications';
import type { AllTypedOptions } from '../permalink/SettingsTypes';
import {
    mergeWithManualOverrides,
    reconcileManualOverrides,
} from './TrackerSync';

export interface TrackerState {
    /**
     * Checks we've acquired.
     * Includes regular checks and fake checks for cubes/crystals.
     */
    checkedChecks: string[];
    /**
     * Checks last reported as checked by Archipelago.
     */
    apCheckedChecks: string[];
    /**
     * Manual check overrides that remain active until AP changes that check.
     */
    manualCheckedOverrides: Record<string, boolean>;
    /**
     * Items we've marked as acquired.
     */
    inventory: Partial<Record<string, number>>;
    /**
     * Whether this state has been modified.
     */
    hasBeenModified: boolean;
    /**
     * Exits we've has mapped. Later merged with the vanilla connections depending on settings.
     */
    mappedExits: Record<string, string | undefined>;
    /**
     * Dungeons we've marked as required.
     */
    requiredDungeons: string[];
    /**
     * Dungeons last reported as required by Archipelago.
     */
    apRequiredDungeons: string[];
    /**
     * Manual required-dungeon overrides that remain active until AP changes that dungeon.
     */
    manualRequiredDungeonOverrides: Record<string, boolean>;
    /**
     * Hints by area
     */
    hints: Record<string, Hint[] | undefined>;
    /**
     * Hints by check name. The referenced item might be an InventoryItem
     * or a dummy item (for various junk items), use `isItem` to check.
     */
    checkHints: Record<string, string | undefined>;
    /**
     * Fully decoded settings.
     */
    settings: Partial<AllTypedOptions>;
    /**
     * A plaintext text area for the user to track hints.
     */
    userHintsText: string;
    /**
     * Total number of AP locations for the currently connected slot, when known.
     */
    apLocationTotal?: number;
    /**
     * Number of AP locations already checked for the currently connected slot, when known.
     */
    apCheckedLocationCount?: number;
    /**
     * Gratitude crystal counts mirrored from Archipelago data storage.
     */
    apGratitudeCrystals?: {
        singles: number;
        packs: number;
    };
}

const initialState: TrackerState = {
    checkedChecks: [],
    apCheckedChecks: [],
    manualCheckedOverrides: {},
    inventory: {},
    hasBeenModified: false,
    mappedExits: {},
    requiredDungeons: defaultRequiredDungeons(),
    apRequiredDungeons: [],
    manualRequiredDungeonOverrides: {},
    hints: {},
    checkHints: {},
    settings: {},
    userHintsText: '',
    apLocationTotal: undefined,
    apCheckedLocationCount: undefined,
};

export function createResetTrackerState(
    settings: AllTypedOptions,
): TrackerState {
    return migrateTrackerState(
        {
            ...initialState,
            settings,
            inventory: getInitialItems(settings),
        },
        { shouldDefaultRequiredDungeons: true },
    );
}

export function preloadedTrackerState(): TrackerState {
    const stored = getStoredTrackerState();

    return migrateTrackerState(
        { ...initialState, ...stored },
        {
            shouldDefaultRequiredDungeons:
                stored?.requiredDungeons === undefined,
            preserveRequiredDungeonSelection: stored !== undefined,
        },
    );
}

const trackerSlice = createSlice({
    name: 'tracker',
    initialState,
    reducers: {
        clickItem: (
            state,
            action: PayloadAction<{ item: InventoryItem; take: boolean }>,
        ) => {
            const { item, take } = action.payload;
            if (!isItem(item)) {
                throw new Error(`bad item ${item as string}`);
            }
            if (item === 'Sailcloth') {
                return;
            }

            const max = itemMaxes[item];
            const count = state.inventory[item] ?? 0;
            let newCount = take ? count - 1 : count + 1;
            if (newCount < 0) {
                newCount += max + 1;
            } else if (newCount > max) {
                newCount -= max + 1;
            }
            state.hasBeenModified = true;
            state.inventory[item] = newCount;
        },
        clickCheckInternal: (
            state,
            action: PayloadAction<{
                checkId: string;
                markChecked?: boolean;
            }>,
        ) => {
            const { checkId } = action.payload;
            const add =
                action.payload.markChecked ??
                !state.checkedChecks.includes(checkId);
            state.manualCheckedOverrides = {
                ...state.manualCheckedOverrides,
                [checkId]: add,
            };
            state.checkedChecks = mergeWithManualOverrides(
                new Set(state.apCheckedChecks),
                state.manualCheckedOverrides,
            );
            state.hasBeenModified = true;
        },
        setItemCounts: (
            state,
            action: PayloadAction<{ item: string; count: number }[]>,
        ) => {
            for (const { item, count } of action.payload) {
                state.inventory[item] = count;
            }
            state.hasBeenModified = true;
        },
        replaceItemCounts: (
            state,
            action: PayloadAction<{ item: string; count: number }[]>,
        ) => {
            state.inventory = {};
            for (const { item, count } of action.payload) {
                state.inventory[item] = count;
            }
            state.hasBeenModified = true;
        },
        syncApCheckedChecks: (state, action: PayloadAction<string[]>) => {
            const previousAp = new Set(state.apCheckedChecks);
            const nextAp = new Set(action.payload);
            state.manualCheckedOverrides = reconcileManualOverrides(
                previousAp,
                nextAp,
                state.manualCheckedOverrides,
            );
            state.apCheckedChecks = [...nextAp];
            state.checkedChecks = mergeWithManualOverrides(
                nextAp,
                state.manualCheckedOverrides,
            );
            state.hasBeenModified = true;
        },
        setApLocationCounts: (
            state,
            action: PayloadAction<{
                total?: number;
                checked?: number;
            }>,
        ) => {
            state.apLocationTotal = action.payload.total;
            state.apCheckedLocationCount = action.payload.checked;
        },
        setApGratitudeCrystalCounts: (
            state,
            action: PayloadAction<
                | {
                      singles: number;
                      packs: number;
                  }
                | undefined
            >,
        ) => {
            state.apGratitudeCrystals = action.payload;
        },
        syncApRequiredDungeons: (
            state,
            action: PayloadAction<{ dungeons: string[] }>,
        ) => {
            const previousAp = new Set(state.apRequiredDungeons);
            const nextAp = new Set(action.payload.dungeons);
            state.manualRequiredDungeonOverrides = reconcileManualOverrides(
                previousAp,
                nextAp,
                state.manualRequiredDungeonOverrides,
            );
            state.apRequiredDungeons = [...nextAp];
            state.requiredDungeons = mergeWithManualOverrides(
                nextAp,
                state.manualRequiredDungeonOverrides,
            );
            state.hasBeenModified = true;
        },
        clickDungeonName: (
            state,
            action: PayloadAction<{ dungeonName: RegularDungeon }>,
        ) => {
            const { dungeonName } = action.payload;
            const required = state.requiredDungeons.includes(dungeonName);
            state.manualRequiredDungeonOverrides = {
                ...state.manualRequiredDungeonOverrides,
                [dungeonName]: !required,
            };
            state.requiredDungeons = mergeWithManualOverrides(
                new Set(state.apRequiredDungeons),
                state.manualRequiredDungeonOverrides,
            );
            state.hasBeenModified = true;
        },
        bulkEditChecks: (
            state,
            action: PayloadAction<{ checks: string[]; markChecked: boolean }>,
        ) => {
            const { checks, markChecked } = action.payload;
            const overrides = { ...state.manualCheckedOverrides };
            for (const check of checks) {
                overrides[check] = markChecked;
            }
            state.manualCheckedOverrides = overrides;
            state.checkedChecks = mergeWithManualOverrides(
                new Set(state.apCheckedChecks),
                state.manualCheckedOverrides,
            );
            state.hasBeenModified = true;
        },
        mapEntrance: (
            state,
            action: PayloadAction<{ from: string; to: string | undefined }>,
        ) => {
            const { from, to } = action.payload;
            state.mappedExits[from] = to;
            state.hasBeenModified = true;
        },
        setHint: (
            state,
            action: PayloadAction<{ areaId: string; hint: Hint | undefined }>,
        ) => {
            const { areaId, hint } = action.payload;
            if (hint === undefined) {
                delete state.hints[areaId];
            } else {
                (state.hints[areaId] ??= []).push(hint);
            }
            state.hasBeenModified = true;
        },
        setCheckHint: (
            state,
            action: PayloadAction<{
                checkId: string;
                hint: string | undefined;
            }>,
        ) => {
            const { checkId, hint } = action.payload;
            state.checkHints[checkId] = hint;
            state.hasBeenModified = true;
        },
        setHintsText: (state, action: PayloadAction<string>) => {
            state.userHintsText = action.payload;
            state.hasBeenModified ||= action.payload !== '';
        },
        acceptSettings: (
            state,
            action: PayloadAction<{ settings: AllTypedOptions }>,
        ) => {
            const { settings } = action.payload;
            state.settings = settings;
        },
        reset: (
            _state,
            action: PayloadAction<{ settings: AllTypedOptions }>,
        ) => {
            return createResetTrackerState(action.payload.settings);
        },
        loadTracker: (_state, action: PayloadAction<Partial<TrackerState>>) => {
            return migrateTrackerState(
                { ...initialState, ...action.payload },
                {
                    shouldDefaultRequiredDungeons:
                        action.payload.requiredDungeons === undefined,
                    preserveRequiredDungeonSelection: true,
                },
            );
        },
    },
});

export const {
    clickItem,
    clickCheckInternal,
    setItemCounts,
    replaceItemCounts,
    syncApCheckedChecks,
    setApLocationCounts,
    setApGratitudeCrystalCounts,
    syncApRequiredDungeons,
    clickDungeonName,
    bulkEditChecks,
    mapEntrance,
    acceptSettings,
    setCheckHint,
    reset,
    setHint,
    setHintsText,
    loadTracker,
} = trackerSlice.actions;

export default trackerSlice.reducer;
