import { describe, expect, it } from 'vitest';
import {
    AP_ITEM_ID_GRATITUDE_CRYSTAL,
    AP_ITEM_ID_GRATITUDE_CRYSTAL_PACK,
    mergeApInventoryWithSeedItems,
    parseGratitudeCrystalCountsFromReceivedItems,
    parseGratitudeCrystalDataStorage,
    parseProgressiveSwordDataStorage,
} from './Archipelago';

describe('parseGratitudeCrystalDataStorage', () => {
    it('reads flat gratitude crystal keys', () => {
        expect(
            parseGratitudeCrystalDataStorage({
                'Gratitude Crystal': 12,
                'Gratitude Crystal Pack': 2,
            }),
        ).toEqual({ singles: 12, packs: 2 });
    });

    it('reads team and slot scoped keys', () => {
        expect(
            parseGratitudeCrystalDataStorage({
                'Gratitude Crystal_0_2': 4,
                'Gratitude Crystal Pack_0_2': 1,
            }),
        ).toEqual({ singles: 4, packs: 1 });
    });

    it('sums nested gratitude crystal entries', () => {
        expect(
            parseGratitudeCrystalDataStorage({
                'Gratitude Crystal': {
                    '2773020': 1,
                    '2773021': 1,
                    '2773051': 1,
                },
                'Gratitude Crystal Pack': {
                    '2773061': 1,
                    '2773070': 1,
                },
            }),
        ).toEqual({ singles: 3, packs: 2 });
    });

    it('reads nested count objects', () => {
        expect(
            parseGratitudeCrystalDataStorage({
                gratitude_crystal_0_2: { count: 7 },
                gratitude_crystal_pack_0_2: { amount: 3 },
            }),
        ).toEqual({ singles: 7, packs: 3 });
    });

    it('ignores unrelated slot_data options', () => {
        expect(
            parseGratitudeCrystalDataStorage({
                option_gratitude_crystal_shuffle: 1,
            }),
        ).toBeUndefined();
    });
});

describe('parseGratitudeCrystalCountsFromReceivedItems', () => {
    it('counts all gratitude items in receivedNetworkItems', () => {
        expect(
            parseGratitudeCrystalCountsFromReceivedItems([
                {
                    item: AP_ITEM_ID_GRATITUDE_CRYSTAL,
                    location: 2773020,
                    player: 2,
                    flags: 0,
                },
                {
                    item: AP_ITEM_ID_GRATITUDE_CRYSTAL_PACK,
                    location: 2773068,
                    player: 2,
                    flags: 1,
                },
                {
                    item: AP_ITEM_ID_GRATITUDE_CRYSTAL,
                    location: 14041140,
                    player: 1,
                    flags: 0,
                },
            ]),
        ).toEqual({ singles: 2, packs: 1 });
    });
});

describe('mergeApInventoryWithSeedItems', () => {
    it('does not double-count starting empty bottles on AP resync', () => {
        expect(
            mergeApInventoryWithSeedItems(
                { 'Empty Bottle': 2 },
                { 'Empty Bottle': 2 },
            )['Empty Bottle'],
        ).toBe(2);
    });

    it('keeps progressive items at the highest reconstructed level', () => {
        expect(
            mergeApInventoryWithSeedItems(
                { 'Progressive Mitts': 1 },
                { 'Progressive Mitts': 2 },
            )['Progressive Mitts'],
        ).toBe(2);
    });

    it('adds non-progressive stackables on top of seed items once', () => {
        expect(
            mergeApInventoryWithSeedItems(
                { Whip: 0 },
                { Whip: 1 },
            ).Whip,
        ).toBe(1);
    });
});

describe('parseProgressiveSwordDataStorage', () => {
    it('reads flat progressive sword keys', () => {
        expect(
            parseProgressiveSwordDataStorage({
                'Progressive Sword': 4,
            }),
        ).toBe(4);
    });

    it('reads team and slot scoped keys', () => {
        expect(
            parseProgressiveSwordDataStorage({
                progressive_sword_0_2: 5,
            }),
        ).toBe(5);
    });

    it('ignores unrelated slot_data options', () => {
        expect(
            parseProgressiveSwordDataStorage({
                option_starting_sword: 2,
            }),
        ).toBeUndefined();
    });
});
