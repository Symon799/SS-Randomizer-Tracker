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
        'Mogma Mitts': ['Progressive Mitts', 2],
        'Iron Bow': ['Progressive Bow', 2],
        'Sacred Bow': ['Progressive Bow', 3],
        'Song of the Hero': [sothItemReplacement, 3],
    };

export const apAbsoluteProgressiveInventoryItems = new Set(
    Object.values(apProgressiveItemMinimums).map(([item]) => item),
);

function isArchipelagoCrystalLogicItem(item: string): boolean {
    return item === 'Gratitude Crystal' || item === 'Gratitude Crystal Pack';
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

export type SwordDiagnostic = {
    startingSword: number;
    selfProgressiveSwordChecksForSelf: number;
    receivedProgressiveSwordsFromOthers: number;
    totalExpectedSwordLevel: number;
    trackerInventoryProgressiveSword: number;
    scoutedCheckedLocations: number;
    receivedProgressiveSwordDetails: Array<{
        itemId: number;
        fromPlayerSlot: number;
        locationId: number;
        flags: number;
    }>;
    selfProgressiveSwordLocationDetails: Array<{
        locationId: number;
        receiverSlot: number;
        game: string;
        item: string;
    }>;
};

function isSyntheticStartingItem(networkItem: NetworkItem): boolean {
    return networkItem.player === 0 && networkItem.location === -2;
}

type SlotData = Record<string, unknown>;

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
    requiredDungeons: string[] = [];
    requiredDungeonDiagnostic?: RequiredDungeonDiagnostic;
    swordDiagnostic?: SwordDiagnostic;
    totalLocationCount?: number;
    cubeDataKey?: string;
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
    resolveRequiredDungeons?: (dungeons: string[]) => void;
    resolveLocationStats?: (stats: { total?: number; checked: number }) => void;
    changeStage?: (stage: string) => void;
    resolveCubes?: (cubeflags: number) => void;
    onMessage?: (messages: ClientMessage[]) => void;

    status: ClientConnectionState = { state: 'loggedOut' };
    statusSubscriptions: Set<() => void> = new Set();

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
            if (
                !normalizedItem.includes('Pouch') ||
                !inventory['Progressive Pouch']
            ) {
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

        this.inventory = nextInventory;
        this.recomputeSwordDiagnostic();
        this.resolveItems?.(this.inventory);
    }

    private recomputeSwordDiagnostic() {
        if (this.connectedData === undefined) {
            this.swordDiagnostic = undefined;
            return;
        }

        const startingSword = Number(
            (
                this.connectedData.slot_data as
                    | Record<string, unknown>
                    | undefined
            )?.option_starting_sword ?? 0,
        );

        const selfProgressiveSwordChecksForSelf = [
            ...this.scoutedSelfItemsByLocation.values(),
        ].filter(
            (item) =>
                item.receiverSlot === this.connectedData!.slot &&
                item.game === GAME_NAME &&
                item.name === 'Progressive Sword',
        ).length;

        const receivedProgressiveSwordItems =
            this.idToItem === undefined
                ? []
                : this.receivedNetworkItems.filter(
                      (networkItem) =>
                          networkItem.player !== this.connectedData!.slot &&
                          !isSyntheticStartingItem(networkItem) &&
                          this.idToItem?.[networkItem.item] ===
                              'Progressive Sword',
                  );
        const receivedProgressiveSwordsFromOthers =
            receivedProgressiveSwordItems.length;
        const receivedProgressiveSwordDetails =
            receivedProgressiveSwordItems.map((networkItem) => ({
                itemId: networkItem.item,
                fromPlayerSlot: networkItem.player,
                locationId: networkItem.location,
                flags: networkItem.flags,
            }));
        const selfProgressiveSwordLocationDetails = [
            ...this.scoutedSelfItemsByLocation.entries(),
        ]
            .filter(
                ([, item]) =>
                    item.receiverSlot === this.connectedData!.slot &&
                    item.game === GAME_NAME &&
                    item.name === 'Progressive Sword',
            )
            .map(([locationId, item]) => ({
                locationId,
                receiverSlot: item.receiverSlot,
                game: item.game,
                item: item.name,
            }));

        this.swordDiagnostic = {
            startingSword,
            selfProgressiveSwordChecksForSelf,
            receivedProgressiveSwordsFromOthers,
            totalExpectedSwordLevel:
                startingSword +
                selfProgressiveSwordChecksForSelf +
                receivedProgressiveSwordsFromOthers,
            trackerInventoryProgressiveSword:
                this.inventory['Progressive Sword'] ?? 0,
            scoutedCheckedLocations: this.scoutedSelfItemsByLocation.size,
            receivedProgressiveSwordDetails,
            selfProgressiveSwordLocationDetails,
        };
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

    getSwordDiagnostic(): SwordDiagnostic | undefined {
        return this.swordDiagnostic;
    }

    setLocationCallback(func: (locs: string[]) => void) {
        this.resolveLocations = func;
        this.resolveLocations(this.checkedLocations);
    }

    setItemCallback(func: (items: TrackerState['inventory']) => void) {
        this.resolveItems = func;
        this.resolveItems(this.inventory);
    }

    setNewStageCallback(func: (stage: string) => void) {
        this.changeStage = func;
    }

    setRequiredDungeonsCallback(func: (dungeons: string[]) => void) {
        this.resolveRequiredDungeons = func;
        this.resolveRequiredDungeons(this.requiredDungeons);
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

    setOnMessage(func: (messages: ClientMessage[]) => void) {
        this.onMessage = func;
        this.onMessage(this.messages);
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
            this.scoutedCheckedLocationIds.clear();
            this.scoutedSelfItemsByLocation.clear();
            this.requiredDungeonDiagnostic = undefined;
            this.swordDiagnostic = undefined;
            this.totalLocationCount = undefined;
            this.resolveLocations = undefined;
            this.resolveItems = undefined;
            this.changeStage = undefined;
            this.resolveRequiredDungeons = undefined;
            this.resolveLocationStats = undefined;
            this.resolveCubes = undefined;

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

        const client = new Client();
        let connectSetupError: unknown;

        client.socket.on('connected', (content) => {
            try {
                this.connectedData = content;
                setStoredArchipelagoServer(server);
                setStoredArchipelagoSlot(slot);
                const slotData = content.slot_data as Record<string, unknown>;
                this.loadedSettings = optionIndicesToOptions(
                    optionDefs,
                    slotData as Record<string, number | string | string[]>,
                );
                const requiredDungeonsRaw = slotData['required_dungeons'];
                this.requiredDungeons =
                    Array.isArray(requiredDungeonsRaw) &&
                    requiredDungeonsRaw.every(
                        (entry) => typeof entry === 'string',
                    )
                        ? requiredDungeonsRaw
                        : [];
                this.requiredDungeonDiagnostic = {
                    slotDataKeys: Object.keys(slotData).sort((left, right) =>
                        left.localeCompare(right),
                    ),
                    keysContainingRequired: Object.keys(slotData)
                        .filter((key) => key.toLowerCase().includes('required'))
                        .sort((left, right) => left.localeCompare(right)),
                    requiredDungeonsRaw,
                    requiredDungeons: this.requiredDungeons,
                    verdict:
                        requiredDungeonsRaw === undefined
                            ? 'slot_data does not contain required_dungeons'
                            : this.requiredDungeons.length > 0
                              ? 'slot_data contains required_dungeons'
                              : 'slot_data contains required_dungeons but not as a string[]',
                };
                console.info('AP slot_data:', slotData);
                console.info(
                    'AP required dungeon diagnostic:',
                    this.requiredDungeonDiagnostic,
                );
                this.totalLocationCount = getSlotDataLocationCount(slotData);
                this.recomputeSwordDiagnostic();
                this.resolveRequiredDungeons?.(this.requiredDungeons);
                this.setCheckedLocationIds(
                    this.connectedData.checked_locations,
                );
                this.notifyStatusSubscribers();
                client.socket.send({
                    cmd: 'GetDataPackage',
                    games: [GAME_NAME],
                });
                this.cubeDataKey = `skyward_sword_cubes_${content.team}_${content.slot}`;
                client.socket.send({
                    cmd: 'SetNotify',
                    keys: [this.cubeDataKey],
                });
                client.socket.send({
                    cmd: 'Get',
                    keys: [this.cubeDataKey],
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
            if (this.cubeDataKey !== undefined) {
                const new_cubes = content.keys[this.cubeDataKey];
                if (new_cubes !== undefined) {
                    this.checkedCubes = new_cubes as number;
                    this.resolveCubes?.(new_cubes as number);
                }
            }
        });

        client.socket.on('setReply', (content) => {
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
