import {
    Client,
    type ConnectedPacket,
    type MessageNode,
    type NetworkItem,
} from 'archipelago.js';
import { invert } from 'es-toolkit';
import type { ReactNode } from 'react';
import React from 'react';
import type { ColorScheme } from '../customization/ColorScheme';
import {
    setStoredArchipelagoServer,
    setStoredArchipelagoSlot,
} from '../LocalStorage';
import {
    parseRequiredDungeonsFromSlotData,
    type RegularDungeon,
} from '../logic/Locations';
import {
    sothItemReplacement,
    triforceItemReplacement,
} from '../logic/TrackerModifications';
import { defaultSettings } from '../permalink/Settings';
import type {
    AllTypedOptions,
    OptionDefs,
    OptionsCommand,
    OptionValue,
} from '../permalink/SettingsTypes';
import type { TrackerState } from '../tracker/Slice';
import { convertError } from '../utils/Errors';

function kebabToSnake(input: string): string {
    return input.replace(/-/g, '_');
}

const apItemAliases: Record<string, string> = {
    Rattle: 'Baby Rattle',
    'Skyview Temple Boss Key': 'Skyview Boss Key',
    'Skyview Temple Small Key': 'Skyview Small Key',
};

const apProgressiveItemMinimums: Record<string, [item: string, count: number]> =
    {
        'Goddess Sword': ['Progressive Sword', 2],
        'Goddess Longsword': ['Progressive Sword', 3],
        'Goddess White Sword': ['Progressive Sword', 4],
        'Master Sword': ['Progressive Sword', 5],
        'True Master Sword': ['Progressive Sword', 6],
        'Hook Beetle': ['Progressive Beetle', 2],
        'Quick Beetle': ['Progressive Beetle', 3],
        'Tough Beetle': ['Progressive Beetle', 4],
        Scattershot: ['Progressive Slingshot', 2],
        'Big Bug Net': ['Progressive Bug Net', 2],
        'Digging Mitts': ['Progressive Mitts', 1],
        'Mogma Mitts': ['Progressive Mitts', 2],
        'Iron Bow': ['Progressive Bow', 2],
        'Sacred Bow': ['Progressive Bow', 3],
        'Song of the Hero': [sothItemReplacement, 3],
    };

export const apAbsoluteProgressiveInventoryItems = new Set(
    Object.values(apProgressiveItemMinimums).map(([item]) => item),
);

export const apAbsoluteInventoryMaximumItems = new Set<string>([
    ...apAbsoluteProgressiveInventoryItems,
    'Empty Bottle',
    'Progressive Pouch',
    'Progressive Wallet',
]);

export function mergeApInventoryWithSeedItems(
    startingInventory: TrackerState['inventory'],
    apInventory: TrackerState['inventory'],
): TrackerState['inventory'] {
    const merged: TrackerState['inventory'] = { ...startingInventory };

    for (const [item, count] of Object.entries(apInventory)) {
        if (isArchipelagoCrystalLogicItem(item)) {
            continue;
        }

        const apCount = count ?? 0;
        if (apAbsoluteInventoryMaximumItems.has(item)) {
            merged[item] = Math.max(merged[item] ?? 0, apCount);
            continue;
        }

        merged[item] = (startingInventory[item] ?? 0) + apCount;
    }

    return merged;
}

function isArchipelagoCrystalLogicItem(item: string): boolean {
    return item === 'Gratitude Crystal' || item === 'Gratitude Crystal Pack';
}

const GRATITUDE_CRYSTAL_DATA_STORAGE_KEY = 'Gratitude Crystal';
const GRATITUDE_CRYSTAL_PACK_DATA_STORAGE_KEY = 'Gratitude Crystal Pack';
const PROGRESSIVE_SWORD_DATA_STORAGE_KEY = 'Progressive Sword';

function gratitudeCrystalDataStorageKeys(team: number, slot: number) {
    return [
        GRATITUDE_CRYSTAL_DATA_STORAGE_KEY,
        GRATITUDE_CRYSTAL_PACK_DATA_STORAGE_KEY,
        `${GRATITUDE_CRYSTAL_DATA_STORAGE_KEY}_${team}_${slot}`,
        `${GRATITUDE_CRYSTAL_PACK_DATA_STORAGE_KEY}_${team}_${slot}`,
        `gratitude_crystal_${team}_${slot}`,
        `gratitude_crystal_pack_${team}_${slot}`,
        `gratitude_crystals_${team}_${slot}`,
        `gratitude_crystal_packs_${team}_${slot}`,
    ];
}

function progressiveSwordDataStorageKeys(team: number, slot: number) {
    return [
        PROGRESSIVE_SWORD_DATA_STORAGE_KEY,
        `${PROGRESSIVE_SWORD_DATA_STORAGE_KEY}_${team}_${slot}`,
        `progressive_sword_${team}_${slot}`,
    ];
}

function readDataStorageCount(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const record = value as Record<string, unknown>;
        return (
            readDataStorageCount(record.count) ??
            readDataStorageCount(record.amount) ??
            readDataStorageCount(record.value)
        );
    }
    return undefined;
}

function isGratitudeCrystalPackStorageKey(key: string): boolean {
    const normalized = key.toLowerCase();
    return (
        !normalized.startsWith('option_') &&
        normalized.includes('gratitude') &&
        normalized.includes('pack')
    );
}

function isGratitudeCrystalSinglesStorageKey(key: string): boolean {
    const normalized = key.toLowerCase();
    return (
        !normalized.startsWith('option_') &&
        normalized.includes('gratitude') &&
        normalized.includes('crystal') &&
        !normalized.includes('pack')
    );
}

function isProgressiveSwordStorageKey(key: string): boolean {
    const normalized = key.toLowerCase();
    return (
        !normalized.startsWith('option_') &&
        normalized.includes('progressive') &&
        normalized.includes('sword')
    );
}

function sumNumericLeaves(value: unknown): number {
    const direct = readDataStorageCount(value);
    if (direct !== undefined) {
        return direct;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.values(value as Record<string, unknown>).reduce<number>(
            (total, child) => total + sumNumericLeaves(child),
            0,
        );
    }

    return 0;
}

function addGratitudeCrystalCount(
    singles: { value?: number },
    packs: { value?: number },
    nextSingles: number,
    nextPacks: number,
) {
    if (nextSingles > 0) {
        singles.value = (singles.value ?? 0) + nextSingles;
    }
    if (nextPacks > 0) {
        packs.value = (packs.value ?? 0) + nextPacks;
    }
}

function visitGratitudeCrystalDataStorage(
    key: string,
    value: unknown,
    singles: { value?: number },
    packs: { value?: number },
) {
    if (isGratitudeCrystalPackStorageKey(key)) {
        addGratitudeCrystalCount(singles, packs, 0, sumNumericLeaves(value));
        return;
    }

    if (isGratitudeCrystalSinglesStorageKey(key)) {
        addGratitudeCrystalCount(singles, packs, sumNumericLeaves(value), 0);
        return;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [nestedKey, nestedValue] of Object.entries(
            value as Record<string, unknown>,
        )) {
            visitGratitudeCrystalDataStorage(
                nestedKey,
                nestedValue,
                singles,
                packs,
            );
        }
    }
}

export type ApGratitudeCrystalCounts = {
    singles: number;
    packs: number;
};

export function parseGratitudeCrystalDataStorage(
    ...sources: Record<string, unknown>[]
): ApGratitudeCrystalCounts | undefined {
    const singles = { value: undefined as number | undefined };
    const packs = { value: undefined as number | undefined };

    for (const source of sources) {
        for (const [key, value] of Object.entries(source)) {
            visitGratitudeCrystalDataStorage(key, value, singles, packs);
        }
    }

    if (singles.value === undefined && packs.value === undefined) {
        return undefined;
    }

    return {
        singles: singles.value ?? 0,
        packs: packs.value ?? 0,
    };
}

export function parseProgressiveSwordDataStorage(
    ...sources: Record<string, unknown>[]
): number | undefined {
    for (const source of sources) {
        for (const [key, value] of Object.entries(source)) {
            if (!isProgressiveSwordStorageKey(key)) {
                continue;
            }
            const count = readDataStorageCount(value);
            if (count !== undefined) {
                return count;
            }
        }
    }
    return undefined;
}

export const AP_ITEM_ID_GRATITUDE_CRYSTAL = 2773048;
export const AP_ITEM_ID_GRATITUDE_CRYSTAL_PACK = 2773035;

export function parseGratitudeCrystalCountsFromReceivedItems(
    receivedNetworkItems: readonly NetworkItem[],
): ApGratitudeCrystalCounts | undefined {
    let singles = 0;
    let packs = 0;

    for (const networkItem of receivedNetworkItems) {
        if (networkItem.item === AP_ITEM_ID_GRATITUDE_CRYSTAL) {
            singles++;
        } else if (networkItem.item === AP_ITEM_ID_GRATITUDE_CRYSTAL_PACK) {
            packs++;
        }
    }

    if (singles === 0 && packs === 0) {
        return undefined;
    }

    return { singles, packs };
}

function resolveApGratitudeCrystalCounts(
    dataStorage: Record<string, unknown>,
    receivedNetworkItems: readonly NetworkItem[],
): ApGratitudeCrystalCounts | undefined {
    const fromDataStorage = parseGratitudeCrystalDataStorage(dataStorage);
    if (fromDataStorage !== undefined) {
        return fromDataStorage;
    }

    return parseGratitudeCrystalCountsFromReceivedItems(receivedNetworkItems);
}

function optionIndicesToOptions(
    optionDefs: OptionDefs,
    loadedOptions: Record<string, number | string | string[]>,
): AllTypedOptions {
    const settings: Partial<Record<OptionsCommand, OptionValue>> =
        defaultSettings(optionDefs);
    // Excluded locations are handled differently.
    settings['excluded-locations'] = [];
    for (const option of optionDefs) {
        const optionKey = kebabToSnake(option.command);
        const loadedVal =
            loadedOptions[optionKey] ?? loadedOptions[`option_${optionKey}`];
        if (option.permalink !== false && loadedVal !== undefined) {
            if (option.command === 'excluded-locations') {
                settings[option.command] = loadedVal;
            } else if (option.type === 'boolean') {
                settings[option.command] = loadedVal === 1;
            } else if (option.type === 'int') {
                settings[option.command] = loadedVal;
            } else if (option.type === 'multichoice') {
                if (Array.isArray(loadedVal)) {
                    settings[option.command] = loadedVal;
                }
            } else if (option.type === 'singlechoice') {
                settings[option.command] =
                    typeof loadedVal === 'string'
                        ? loadedVal
                        : option.choices[loadedVal as number];
            }
        }
    }
    // console.log(settings);
    return settings as AllTypedOptions;
}

export type ClientConnectionState =
    | {
          state: 'loggedOut';
          error?: string;
      }
    | {
          state: 'loggingIn';
      }
    | {
          state: 'loggedIn';
          serverName: string;
          slotName: string;
      };

export class ColoredText {
    constructor(
        public text: string,
        public color?: keyof ColorScheme,
        public customColor?: string, // for color nodes
        public tooltip?: ReactNode,
    ) {}
}

export type ClientMessage = ColoredText[];

export type RequiredDungeonDiagnostic = {
    slotDataKeys: string[];
    keysContainingRequired: string[];
    requiredDungeonsRaw: unknown;
    requiredDungeons: string[];
    verdict: string;
};

type SlotData = Record<string, unknown>;

function cloneForExport<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export type ApSnapshotArchipelagoData = {
    dataStorage: Record<string, unknown>;
    slot_data?: unknown;
    checked_locations?: number[];
    slot?: number;
    team?: number;
    gratitudeCrystals?: ApGratitudeCrystalCounts;
};

export type ApServerDataExport = {
    generatedAt: string;
    connection?: {
        server: string;
        slot: string;
    };
    connectedPacket?: ConnectedPacket;
    dataStorage: Record<string, unknown>;
    syncDiagnostic?: ApSyncDiagnostic;
    dataPackage?: unknown;
    requiredDungeonDiagnostic?: RequiredDungeonDiagnostic;
    checkedLocationIds: number[];
    checkedLocations: string[];
    receivedNetworkItems: NetworkItem[];
    scoutedSelfItemsByLocation: Array<{
        locationId: number;
        name: string;
        game: string;
        receiverSlot: number;
    }>;
};

export type ApSyncDiagnostic = {
    subscribedDataStorageKeys: string[];
    subscribedDataStorageValues: Record<string, unknown>;
    gratitudeCrystalSource: 'dataStorage' | 'receivedNetworkItems' | 'none';
    progressiveSwordSource: 'dataStorage' | 'inventoryReconstruction' | 'none';
    trackerCounts: {
        gratitudeCrystals?: ApGratitudeCrystalCounts;
        progressiveSword?: number;
        progressiveMitts?: number;
    };
};

function getSlotDataLocationCount(slotData: SlotData): number | undefined {
    const locationToItemMap = slotData['location_to_item_map'];
    if (
        locationToItemMap &&
        typeof locationToItemMap === 'object' &&
        !Array.isArray(locationToItemMap)
    ) {
        return Object.keys(locationToItemMap as Record<string, unknown>).length;
    }
    return undefined;
}

const MAX_MESSAGES = 1000;
const GAME_NAME = 'Skyward Sword HD';

export class APClientManager {
    client?: Client;
    loadedSettings?: AllTypedOptions;
    idToLocation?: Record<number, string>;
    idToItem?: Record<number, string>;
    connectedData?: ConnectedPacket;
    inventory: TrackerState['inventory'] = {};
    pendingReceivedItems: NetworkItem[] = [];
    receivedNetworkItems: NetworkItem[] = [];
    checkedLocationIds: number[] = [];
    checkedLocations: string[] = [];
    checkedCubes: number = 0;
    messages: ClientMessage[] = [];
    requiredDungeons: RegularDungeon[] = [];
    private hasDeliveredRequiredDungeonsToTracker = false;
    private requiredDungeonsAuthoritative = false;
    requiredDungeonDiagnostic?: RequiredDungeonDiagnostic;
    totalLocationCount?: number;
    cubeDataKey?: string;
    gratitudeDataStorageKeys: string[] = [];
    progressiveSwordDataStorageKeys: string[] = [];
    scoutedCheckedLocationIds = new Set<number>();
    scoutedSelfItemsByLocation = new Map<
        number,
        {
            name: string;
            game: string;
            receiverSlot: number;
        }
    >();
    resolveLocations?: (locs: string[]) => void;
    resolveItems?: (items: TrackerState['inventory']) => void;
    resolveRequiredDungeons?: (dungeons: RegularDungeon[]) => void;
    resolveLocationStats?: (stats: { total?: number; checked: number }) => void;
    changeStage?: (stage: string) => void;
    resolveCubes?: (cubeflags: number) => void;
    resolveGratitudeCrystalCounts?: (
        counts: ApGratitudeCrystalCounts | undefined,
    ) => void;
    onMessage?: (messages: ClientMessage[]) => void;
    apDataPackage?: unknown;
    apDataStorage: Record<string, unknown> = {};
    private hasDeliveredCheckedLocationsToTracker = false;

    status: ClientConnectionState = { state: 'loggedOut' };
    statusSubscriptions: Set<() => void> = new Set();

    private deliverRequiredDungeons() {
        if (
            !this.resolveRequiredDungeons ||
            !this.requiredDungeonsAuthoritative
        ) {
            return;
        }

        this.resolveRequiredDungeons(this.requiredDungeons);
        this.hasDeliveredRequiredDungeonsToTracker = true;
    }

    private markRequiredDungeonsDeliveryHandled() {
        this.hasDeliveredRequiredDungeonsToTracker = true;
    }

    private syncCheckedLocations() {
        if (this.idToLocation === undefined) {
            return;
        }

        const unresolvedLocationIds: number[] = [];
        this.checkedLocations = this.checkedLocationIds.flatMap(
            (locationId) => {
                const location = this.idToLocation![locationId];
                if (location === undefined) {
                    unresolvedLocationIds.push(locationId);
                    return [];
                }
                return [location];
            },
        );

        if (unresolvedLocationIds.length > 0) {
            console.warn(
                'AP checked location IDs missing from DataPackage:',
                unresolvedLocationIds,
            );
        }

        this.resolveLocations?.(this.checkedLocations);
        if (this.resolveLocations) {
            this.hasDeliveredCheckedLocationsToTracker = true;
        }
    }

    private setCheckedLocationIds(locationIds: number[]) {
        this.checkedLocationIds = [...new Set(locationIds)];
        this.syncCheckedLocations();
        this.resolveLocationStats?.({
            total: this.totalLocationCount,
            checked: this.checkedLocationIds.length,
        });
        if (this.idToItem !== undefined) {
            void this.scoutCheckedSelfItems(this.checkedLocationIds);
        }
    }

    private addCheckedLocationIds(locationIds: number[]) {
        this.setCheckedLocationIds([
            ...this.checkedLocationIds,
            ...locationIds,
        ]);
    }

    private addToInventory(
        inventory: TrackerState['inventory'],
        item: string,
        count: number = 1,
    ) {
        inventory[item] ??= 0;
        inventory[item] += count;
    }

    private setInventoryAtLeast(
        inventory: TrackerState['inventory'],
        item: string,
        count: number,
    ) {
        inventory[item] = Math.max(inventory[item] ?? 0, count);
    }

    private applyApItemToInventory(
        inventory: TrackerState['inventory'],
        item: string,
    ) {
        // SSHD tracker logic follows actual crystal checks (plus starting packs),
        // not shuffled AP crystal items. Counting AP crystal items here makes
        // Batreaux thresholds drift away from the in-game / UT behavior.
        if (isArchipelagoCrystalLogicItem(item)) {
            return;
        }
        const progressiveMinimum = apProgressiveItemMinimums[item];
        if (progressiveMinimum) {
            this.setInventoryAtLeast(
                inventory,
                progressiveMinimum[0],
                progressiveMinimum[1],
            );
        } else if (item.includes(sothItemReplacement)) {
            this.addToInventory(inventory, sothItemReplacement);
        } else if (item.includes(triforceItemReplacement)) {
            this.addToInventory(inventory, triforceItemReplacement);
        } else {
            const normalizedItem = apItemAliases[item] ?? item;
            const canAddDirectly =
                normalizedItem === 'Progressive Pouch' ||
                !normalizedItem.includes('Pouch') ||
                !inventory['Progressive Pouch'];
            if (canAddDirectly) {
                this.addToInventory(inventory, normalizedItem);
            }
        }
    }

    private rebuildInventory() {
        if (this.connectedData === undefined || this.idToItem === undefined) {
            return;
        }

        const nextInventory: TrackerState['inventory'] = {};

        for (const networkItem of this.receivedNetworkItems) {
            if (networkItem.player === this.connectedData.slot) {
                continue;
            }

            const item = this.idToItem[networkItem.item];
            if (item === undefined) {
                console.warn(
                    'AP received item ID missing from DataPackage:',
                    networkItem.item,
                );
                continue;
            }

            this.applyApItemToInventory(nextInventory, item);
        }

        const slotDataLocationToItemMap = this.getSlotDataLocationToItemMap();
        const reconstructedSelfLocations = new Set<number>();
        for (const locationId of this.checkedLocationIds) {
            const itemId = slotDataLocationToItemMap[locationId];
            if (itemId === undefined) {
                continue;
            }

            const item = this.idToItem[itemId];
            if (item === undefined) {
                continue;
            }

            reconstructedSelfLocations.add(locationId);
            this.applyApItemToInventory(nextInventory, item);
        }

        for (const [locationId, scoutedItem] of this
            .scoutedSelfItemsByLocation) {
            if (reconstructedSelfLocations.has(locationId)) {
                continue;
            }
            if (
                scoutedItem.receiverSlot !== this.connectedData.slot ||
                scoutedItem.game !== GAME_NAME
            ) {
                continue;
            }

            this.applyApItemToInventory(nextInventory, scoutedItem.name);
        }

        this.applyProgressiveSwordDataStorage(nextInventory);
        this.applyGratitudeCrystalDataStorage(nextInventory);

        this.inventory = nextInventory;
        this.syncGratitudeCrystalCounts();
        this.resolveItems?.(this.inventory);
    }

    private applyProgressiveSwordDataStorage(
        inventory: TrackerState['inventory'],
    ) {
        const parsed = parseProgressiveSwordDataStorage(this.apDataStorage);
        if (parsed === undefined) {
            return;
        }

        this.setInventoryAtLeast(inventory, 'Progressive Sword', parsed);
    }

    private syncGratitudeCrystalCounts() {
        if (this.connectedData === undefined) {
            this.resolveGratitudeCrystalCounts?.(undefined);
            return;
        }

        const parsed = resolveApGratitudeCrystalCounts(
            this.apDataStorage,
            this.receivedNetworkItems,
        );
        if (parsed === undefined) {
            return;
        }

        this.resolveGratitudeCrystalCounts?.(parsed);
    }

    private applyGratitudeCrystalDataStorage(
        inventory: TrackerState['inventory'],
    ) {
        if (this.connectedData === undefined) {
            return;
        }

        const parsed = resolveApGratitudeCrystalCounts(
            this.apDataStorage,
            this.receivedNetworkItems,
        );
        if (parsed === undefined) {
            return;
        }

        inventory[GRATITUDE_CRYSTAL_DATA_STORAGE_KEY] = parsed.singles;
        inventory[GRATITUDE_CRYSTAL_PACK_DATA_STORAGE_KEY] = parsed.packs;
    }

    private getSlotDataLocationToItemMap(): Record<number, number> {
        const slotData = this.connectedData?.slot_data as SlotData | undefined;
        const rawLocationToItemMap = slotData?.location_to_item_map;
        if (
            rawLocationToItemMap === undefined ||
            typeof rawLocationToItemMap !== 'object' ||
            rawLocationToItemMap === null
        ) {
            return {};
        }

        const locationToItemMap: Record<number, number> = {};
        for (const [locationId, itemId] of Object.entries(
            rawLocationToItemMap,
        )) {
            const parsedLocationId = Number(locationId);
            if (
                !Number.isFinite(parsedLocationId) ||
                typeof itemId !== 'number'
            ) {
                continue;
            }
            locationToItemMap[parsedLocationId] = itemId;
        }
        return locationToItemMap;
    }

    private processReceivedItems(items: NetworkItem[]) {
        if (this.idToItem === undefined) {
            this.pendingReceivedItems.push(...items);
            return;
        }

        this.receivedNetworkItems.push(...items);
        this.rebuildInventory();
    }

    private async scoutCheckedSelfItems(locationIds: number[]) {
        if (
            this.client === undefined ||
            !this.client.authenticated ||
            this.connectedData === undefined
        ) {
            return;
        }

        const toScout = [...new Set(locationIds)].filter(
            (locationId) => !this.scoutedCheckedLocationIds.has(locationId),
        );
        if (toScout.length === 0) {
            return;
        }

        try {
            const scoutedItems = await this.client.scout(toScout, 0);
            for (const scoutedItem of scoutedItems) {
                this.scoutedCheckedLocationIds.add(scoutedItem.locationId);
                this.scoutedSelfItemsByLocation.set(scoutedItem.locationId, {
                    name: scoutedItem.name,
                    game: scoutedItem.game,
                    receiverSlot: scoutedItem.receiver.slot,
                });
            }
            this.rebuildInventory();
        } catch (error) {
            console.warn('AP location scouting failed:', error);
        }
    }

    isHooked(): boolean {
        return this.client !== undefined && this.client.socket.connected;
    }

    getLoadedSettings(): AllTypedOptions | undefined {
        return this.loadedSettings;
    }

    getRequiredDungeonDiagnostic(): RequiredDungeonDiagnostic | undefined {
        return this.requiredDungeonDiagnostic;
    }

    getApSnapshotArchipelagoData(): ApSnapshotArchipelagoData | undefined {
        if (this.connectedData === undefined) {
            return undefined;
        }

        const gratitudeCrystals = resolveApGratitudeCrystalCounts(
            this.apDataStorage,
            this.receivedNetworkItems,
        );

        return {
            dataStorage: cloneForExport(this.apDataStorage),
            slot_data: cloneForExport(this.connectedData.slot_data),
            checked_locations: cloneForExport(
                this.connectedData.checked_locations,
            ),
            slot: this.connectedData.slot,
            team: this.connectedData.team,
            gratitudeCrystals,
        };
    }

    getApServerDataExport(): ApServerDataExport {
        const connection =
            this.status.state === 'loggedIn'
                ? {
                      server: this.status.serverName,
                      slot: this.status.slotName,
                  }
                : undefined;

        return {
            generatedAt: new Date().toISOString(),
            connection,
            connectedPacket:
                this.connectedData === undefined
                    ? undefined
                    : cloneForExport(this.connectedData),
            dataStorage: cloneForExport(this.apDataStorage),
            syncDiagnostic: this.getApSyncDiagnostic(),
            dataPackage:
                this.apDataPackage === undefined
                    ? undefined
                    : cloneForExport(this.apDataPackage),
            requiredDungeonDiagnostic: this.requiredDungeonDiagnostic
                ? cloneForExport(this.requiredDungeonDiagnostic)
                : undefined,
            checkedLocationIds: [...this.checkedLocationIds],
            checkedLocations: [...this.checkedLocations],
            receivedNetworkItems: cloneForExport(this.receivedNetworkItems),
            scoutedSelfItemsByLocation: [
                ...this.scoutedSelfItemsByLocation.entries(),
            ].map(([locationId, item]) => ({
                locationId,
                ...item,
            })),
        };
    }

    private getApSyncDiagnostic(): ApSyncDiagnostic | undefined {
        if (this.connectedData === undefined) {
            return undefined;
        }

        const subscribedDataStorageKeys = [
            ...(this.cubeDataKey === undefined ? [] : [this.cubeDataKey]),
            ...this.gratitudeDataStorageKeys,
            ...this.progressiveSwordDataStorageKeys,
        ];
        const subscribedDataStorageValues = Object.fromEntries(
            subscribedDataStorageKeys.map((key) => [
                key,
                this.apDataStorage[key] ?? null,
            ]),
        );

        const gratitudeFromDataStorage = parseGratitudeCrystalDataStorage(
            this.apDataStorage,
        );
        const gratitudeFromReceivedItems =
            parseGratitudeCrystalCountsFromReceivedItems(
                this.receivedNetworkItems,
            );
        const gratitudeCrystalSource =
            gratitudeFromDataStorage !== undefined
                ? 'dataStorage'
                : gratitudeFromReceivedItems !== undefined
                  ? 'receivedNetworkItems'
                  : 'none';

        const progressiveSwordFromDataStorage =
            parseProgressiveSwordDataStorage(this.apDataStorage);
        const progressiveSwordSource =
            progressiveSwordFromDataStorage !== undefined
                ? 'dataStorage'
                : (this.inventory['Progressive Sword'] ?? 0) > 0
                  ? 'inventoryReconstruction'
                  : 'none';

        return {
            subscribedDataStorageKeys,
            subscribedDataStorageValues,
            gratitudeCrystalSource,
            progressiveSwordSource,
            trackerCounts: {
                gratitudeCrystals: resolveApGratitudeCrystalCounts(
                    this.apDataStorage,
                    this.receivedNetworkItems,
                ),
                progressiveSword: this.inventory['Progressive Sword'],
                progressiveMitts: this.inventory['Progressive Mitts'],
            },
        };
    }

    private clearApServerExportData() {
        this.apDataPackage = undefined;
        this.apDataStorage = {};
        this.gratitudeDataStorageKeys = [];
        this.progressiveSwordDataStorageKeys = [];
    }

    private recordApDataStorage(key: string, value: unknown) {
        this.apDataStorage[key] = value;
        this.notifyStatusSubscribers();
        this.rebuildInventory();
    }

    private recordApDataStorageKeys(keys: Record<string, unknown>) {
        for (const [key, value] of Object.entries(keys)) {
            this.apDataStorage[key] = value;
        }
        this.notifyStatusSubscribers();
        this.rebuildInventory();
    }

    setLocationCallback(func: (locs: string[]) => void) {
        this.resolveLocations = func;
        if (
            !this.hasDeliveredCheckedLocationsToTracker &&
            this.checkedLocations.length > 0
        ) {
            this.syncCheckedLocations();
        }
    }

    setItemCallback(func: (items: TrackerState['inventory']) => void) {
        this.resolveItems = func;
        this.resolveItems(this.inventory);
    }

    setNewStageCallback(func: (stage: string) => void) {
        this.changeStage = func;
    }

    setRequiredDungeonsCallback(func: (dungeons: RegularDungeon[]) => void) {
        this.resolveRequiredDungeons = func;
        if (!this.hasDeliveredRequiredDungeonsToTracker) {
            if (this.requiredDungeonsAuthoritative) {
                this.deliverRequiredDungeons();
            } else {
                this.markRequiredDungeonsDeliveryHandled();
            }
        }
    }

    setLocationStatsCallback(
        func: (stats: { total?: number; checked: number }) => void,
    ) {
        this.resolveLocationStats = func;
        this.resolveLocationStats({
            total: this.totalLocationCount,
            checked: this.checkedLocationIds.length,
        });
    }

    setCubeCallback(func: (cubeflags: number) => void) {
        this.resolveCubes = func;
        this.resolveCubes(this.checkedCubes);
    }

    setGratitudeCrystalCountsCallback(
        func: (counts: ApGratitudeCrystalCounts | undefined) => void,
    ) {
        this.resolveGratitudeCrystalCounts = func;
        this.syncGratitudeCrystalCounts();
    }

    setOnMessage(func: (messages: ClientMessage[]) => void) {
        this.onMessage = func;
        this.onMessage(this.messages);
    }

    redeliverTrackerState() {
        this.hasDeliveredRequiredDungeonsToTracker = false;
        this.hasDeliveredCheckedLocationsToTracker = false;
        if (this.requiredDungeonsAuthoritative) {
            this.deliverRequiredDungeons();
        } else {
            this.markRequiredDungeonsDeliveryHandled();
        }
        this.syncCheckedLocations();
    }

    sendMessage(message: string) {
        if (this.isHooked()) {
            this.client!.messages.say(message);
        }
    }

    resetClient() {
        if (this.isHooked()) {
            this.client!.socket.disconnect();
            this.client = undefined;
            this.loadedSettings = undefined;
            this.connectedData = undefined;
            this.inventory = {};
            this.pendingReceivedItems = [];
            this.receivedNetworkItems = [];
            this.checkedLocationIds = [];
            this.checkedLocations = [];
            this.checkedCubes = 0;
            this.messages = [];
            this.cubeDataKey = undefined;
            this.gratitudeDataStorageKeys = [];
            this.progressiveSwordDataStorageKeys = [];
            this.scoutedCheckedLocationIds.clear();
            this.scoutedSelfItemsByLocation.clear();
            this.requiredDungeonDiagnostic = undefined;
            this.totalLocationCount = undefined;
            this.resolveLocations = undefined;
            this.hasDeliveredCheckedLocationsToTracker = false;
            this.resolveItems = undefined;
            this.changeStage = undefined;
            this.resolveRequiredDungeons = undefined;
            this.hasDeliveredRequiredDungeonsToTracker = false;
            this.requiredDungeonsAuthoritative = false;
            this.resolveLocationStats = undefined;
            this.resolveCubes = undefined;
            this.resolveGratitudeCrystalCounts?.(undefined);
            this.resolveGratitudeCrystalCounts = undefined;
            this.clearApServerExportData();

            this.status = { state: 'loggedOut' };
            this.notifyStatusSubscribers();
        }
    }

    getStatusString(): string {
        switch (this.status.state) {
            case 'loggedOut':
                if (this.status.error) {
                    return `Error: ${this.status.error}`;
                } else {
                    return 'Disconnected, please connect.';
                }
            case 'loggingIn':
                return 'Connecting...';
            case 'loggedIn':
                return `Connected to ${this.status.serverName} as ${this.status.slotName}`;
        }
    }

    getStatus(): ClientConnectionState {
        return this.status;
    }

    subscribeToStatus(callback: () => void): () => void {
        this.statusSubscriptions.add(callback);
        return () => {
            this.statusSubscriptions.delete(callback);
        };
    }

    private notifyStatusSubscribers() {
        for (const subscriber of this.statusSubscriptions) {
            subscriber();
        }
    }

    async login(
        server: string,
        slot: string,
        password: string,
        optionDefs: OptionDefs,
    ): Promise<boolean> {
        if (this.status.state === 'loggingIn') {
            return false;
        } else if (this.status.state === 'loggedIn') {
            this.resetClient();
        }

        this.clearApServerExportData();

        const client = new Client();
        let connectSetupError: unknown;

        client.socket.on('connected', (content) => {
            try {
                this.connectedData = content;
                this.hasDeliveredRequiredDungeonsToTracker = false;
                this.hasDeliveredCheckedLocationsToTracker = false;
                setStoredArchipelagoServer(server);
                setStoredArchipelagoSlot(slot);
                const slotData = content.slot_data as Record<string, unknown>;
                this.loadedSettings = optionIndicesToOptions(
                    optionDefs,
                    slotData as Record<string, number | string | string[]>,
                );
                const requiredDungeonsRaw = slotData['required_dungeons'];
                this.requiredDungeons =
                    parseRequiredDungeonsFromSlotData(requiredDungeonsRaw);
                const usedSlotDataRequiredDungeons =
                    Array.isArray(requiredDungeonsRaw) &&
                    requiredDungeonsRaw.length > 0 &&
                    requiredDungeonsRaw.every(
                        (entry) => typeof entry === 'string',
                    );
                this.requiredDungeonsAuthoritative =
                    usedSlotDataRequiredDungeons;
                this.requiredDungeonDiagnostic = {
                    slotDataKeys: Object.keys(slotData).sort((left, right) =>
                        left.localeCompare(right),
                    ),
                    keysContainingRequired: Object.keys(slotData)
                        .filter((key) => key.toLowerCase().includes('required'))
                        .sort((left, right) => left.localeCompare(right)),
                    requiredDungeonsRaw,
                    requiredDungeons: this.requiredDungeons,
                    verdict: usedSlotDataRequiredDungeons
                        ? 'slot_data.required_dungeons applied'
                        : requiredDungeonsRaw === undefined
                          ? 'slot_data missing required_dungeons; defaulted to all surface dungeons'
                          : 'slot_data.required_dungeons missing or invalid; defaulted to all surface dungeons',
                };
                console.info('AP slot_data:', slotData);
                console.info(
                    'AP required dungeon diagnostic:',
                    this.requiredDungeonDiagnostic,
                );
                this.totalLocationCount = getSlotDataLocationCount(slotData);
                if (this.requiredDungeonsAuthoritative) {
                    this.deliverRequiredDungeons();
                } else {
                    this.markRequiredDungeonsDeliveryHandled();
                }
                this.setCheckedLocationIds(
                    this.connectedData.checked_locations,
                );
                this.notifyStatusSubscribers();
                client.socket.send({
                    cmd: 'GetDataPackage',
                    games: [GAME_NAME],
                });
                this.cubeDataKey = `skyward_sword_cubes_${content.team}_${content.slot}`;
                this.gratitudeDataStorageKeys = gratitudeCrystalDataStorageKeys(
                    content.team,
                    content.slot,
                );
                this.progressiveSwordDataStorageKeys =
                    progressiveSwordDataStorageKeys(content.team, content.slot);
                const dataStorageKeys = [
                    this.cubeDataKey,
                    ...this.gratitudeDataStorageKeys,
                    ...this.progressiveSwordDataStorageKeys,
                ];
                client.socket.send({
                    cmd: 'SetNotify',
                    keys: dataStorageKeys,
                });
                client.socket.send({
                    cmd: 'Get',
                    keys: dataStorageKeys,
                });
            } catch (error) {
                connectSetupError = error;
                this.status = {
                    state: 'loggedOut',
                    error: convertError(error),
                };
                this.notifyStatusSubscribers();
            }
        });

        client.socket.on('dataPackage', (content) => {
            this.apDataPackage = content;
            this.notifyStatusSubscribers();
            const ssData = content.data.games[GAME_NAME];
            console.log(
                'AP DataPackage games:',
                Object.keys(content.data.games),
            );
            console.log(`${GAME_NAME} DataPackage:`, ssData);
            if (ssData) {
                console.log(
                    `${GAME_NAME} locations:`,
                    Object.keys(ssData.location_name_to_id ?? {}).length,
                );
                console.log(
                    `${GAME_NAME} items:`,
                    Object.keys(ssData.item_name_to_id ?? {}).length,
                );
            }
            if (ssData !== undefined) {
                this.idToLocation = invert<string, number>(
                    ssData.location_name_to_id,
                );
                this.idToItem = invert<string, number>(ssData.item_name_to_id);
                this.totalLocationCount ??= Object.keys(
                    ssData.location_name_to_id ?? {},
                ).length;
                this.resolveLocationStats?.({
                    total: this.totalLocationCount,
                    checked: this.checkedLocationIds.length,
                });
                if (this.pendingReceivedItems.length > 0) {
                    this.processReceivedItems(this.pendingReceivedItems);
                    this.pendingReceivedItems = [];
                }
                this.syncCheckedLocations();
                void this.scoutCheckedSelfItems(this.checkedLocationIds);
            }
        });

        client.messages.on('message', (_, messageData) => {
            const convertNode = (node: MessageNode): ColoredText => {
                switch (node.type) {
                    case 'item': {
                        let item_color: keyof ColorScheme = 'apFiller';
                        let item_class = 'normal';
                        if (node.item.progression) {
                            item_color = 'apProgression';
                            item_class = 'progression';
                        } else if (node.item.trap) {
                            item_color = 'apTrap';
                            item_class = 'trap';
                        } else if (node.item.useful) {
                            item_color = 'apUseful';
                            item_class = 'useful';
                        } else if (node.item.filler) {
                            item_class = 'filler';
                        }
                        return {
                            text: node.text,
                            color: item_color,
                            tooltip: `Item Class: ${item_class}`,
                        };
                    }
                    case 'location':
                        return {
                            text: node.text,
                            color: 'apLocation',
                        };
                    case 'color':
                        return {
                            text: node.text,
                            customColor: node.color,
                        };
                    case 'text':
                        return {
                            text: node.text,
                        };
                    case 'entrance':
                        return {
                            text: node.text,
                            color: 'apEntrance',
                        };
                    case 'player': {
                        const player_color =
                            this.connectedData?.slot === node.player.slot
                                ? 'apThisPlayer'
                                : 'apOtherPlayer';
                        let player_type = 'player';
                        switch (node.player.type) {
                            case 0:
                                player_type = 'spectator';
                                break;
                            case 2:
                                player_type = 'group';
                                break;
                            default:
                                break;
                        }
                        const player_tooltip: React.ReactNode = [
                            `Game: ${node.player.game}`,
                            React.createElement('br', { key: 'break' }),
                            `Type: ${player_type}`,
                        ];
                        return {
                            text: node.text,
                            color: player_color,
                            tooltip: player_tooltip,
                        };
                    }
                }
            };
            const msg = messageData.map((node) => convertNode(node));
            this.messages.push(msg);
            // Don't keep track of too many messages at a time
            if (this.messages.length > MAX_MESSAGES) {
                this.messages.shift();
            }
            this.onMessage?.(this.messages);
        });

        client.socket.on('receivedItems', (content) => {
            this.processReceivedItems(content.items);
        });

        client.socket.on('roomUpdate', (content) => {
            if (content.checked_locations) {
                this.addCheckedLocationIds(content.checked_locations);
            }
        });

        client.socket.on('bounced', (content) => {
            const stage = content.data?.ss_stage_name;
            if (stage !== undefined) {
                this.changeStage?.(stage as string);
            }
        });

        client.socket.on('retrieved', (content) => {
            this.recordApDataStorageKeys(
                content.keys as Record<string, unknown>,
            );
            if (this.cubeDataKey !== undefined) {
                const new_cubes = content.keys[this.cubeDataKey];
                if (new_cubes !== undefined) {
                    this.checkedCubes = new_cubes as number;
                    this.resolveCubes?.(new_cubes as number);
                }
            }
        });

        client.socket.on('setReply', (content) => {
            this.recordApDataStorage(content.key, content.value);
            if (this.cubeDataKey === content.key) {
                const new_cubes = content.value;
                if (new_cubes !== undefined) {
                    this.checkedCubes = new_cubes as number;
                    this.resolveCubes?.(new_cubes as number);
                }
            }
        });

        try {
            this.status = { state: 'loggingIn' };
            this.notifyStatusSubscribers();
            await client.login(server, slot, GAME_NAME, {
                tags: ['Tracker'],
                password: password,
            });
            if (connectSetupError) {
                throw new Error(convertError(connectSetupError));
            }
            this.client = client;
            this.status = {
                state: 'loggedIn',
                serverName: server,
                slotName: slot,
            };
            this.notifyStatusSubscribers();
            return true;
        } catch (error: unknown) {
            this.status = { state: 'loggedOut', error: convertError(error) };
            this.notifyStatusSubscribers();
            return false;
        }
    }
}
