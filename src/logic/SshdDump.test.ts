import { load } from 'js-yaml';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeLeastFixedPoint, mergeRequirements } from './bitlogic/BitLogic';
import type { LogicalExpression } from './bitlogic/LogicalExpression';
import { parseLogic } from './Logic';
import { mapInventory } from './Mappers';
import type { RawLogic } from './UpstreamTypes';

function formatExpr(
    logic: ReturnType<typeof parseLogic>,
    expr: LogicalExpression | undefined,
) {
    if (!expr || expr.isTriviallyFalse()) {
        return 'false';
    }
    if (expr.isTriviallyTrue()) {
        return 'true';
    }
    return expr.conjunctions
        .map((conj) =>
            [...conj.iter()]
                .map((bit) => logic.allItems[bit] ?? `<unknown:${bit}>`)
                .join(' & '),
        )
        .join(' | ');
}

describe('SSHD generated dump', () => {
    it('parses with the tracker logic engine', () => {
        const raw = load(
            fs.readFileSync('testData/sshd-dump.yaml', 'utf8'),
        ) as RawLogic;
        const logic = parseLogic(raw);

        expect(Object.keys(raw.checks)).toHaveLength(893);
        expect(
            logic.checks[
                "\\Skyloft\\Knight Academy\\Knight Academy - Fledge's Gift"
            ],
        ).toMatchObject({
            name: "Knight Academy - Fledge's Gift",
            area: 'Upper Skyloft',
        });
        expect(
            logic.checks[
                "\\Skyloft\\Knight Academy\\Knight Academy - Groose's Closet"
            ],
        ).toMatchObject({
            name: "Knight Academy - Groose's Closet",
            area: 'Upper Skyloft',
        });
        expect(
            logic.checks[
                "\\Skyloft\\Knight Academy\\Knight Academy - Owlan's Closet"
            ],
        ).toMatchObject({
            name: "Knight Academy - Owlan's Closet",
            area: 'Upper Skyloft',
        });
    });

    it('preserves key Skyloft helper requirements through simplification', () => {
        const raw = load(
            fs.readFileSync('testData/sshd-dump.yaml', 'utf8'),
        ) as RawLogic;
        const logic = parseLogic(raw);

        const inspect = (
            name: string,
        ): { bit: number; raw: string; simplified: string } => {
            const bit = logic.itemBits[name];
            if (bit === undefined) {
                throw new Error(`Missing bit for ${name}`);
            }
            return {
                bit,
                raw: formatExpr(logic, logic.rawStaticRequirements[bit]),
                simplified: formatExpr(logic, logic.staticRequirements[bit]),
            };
        };

        const ancientFlowerFarming = inspect('\\Ancient Flower Farming');
        expect(ancientFlowerFarming.bit).toBe(
            logic.itemBits['\\Ancient Flower Farming'],
        );
        expect(typeof ancientFlowerFarming.raw).toBe('string');
        expect(typeof ancientFlowerFarming.simplified).toBe('string');

        expect(inspect('\\Talk to Orielle').simplified).not.toBe('false');
        expect(inspect('\\Pouch').simplified).not.toBe('false');
        expect(inspect('\\Can Afford 300 Rupees').simplified).not.toBe('false');
        expect(inspect('\\Skyloft\\Bazaar').simplified).not.toBe('false');

        expect(
            inspect(
                "\\Skyloft\\Beedle's Airshop\\Beedle's Airshop - 300 Rupee Item",
            ).simplified,
        ).not.toBe('false');
        expect(
            inspect(
                "\\Skyloft\\Central Skyloft\\Central Skyloft - Parrow's Gift",
            ).simplified,
        ).not.toBe('false');
        expect(
            inspect(
                "\\Skyloft\\Peatrice's House\\Central Skyloft - Peatrice's Love",
            ).simplified,
        ).not.toBe('false');
    });

    it('preserves key SSHD progression bits used by UT parity checks', () => {
        const raw = load(
            fs.readFileSync('testData/sshd-dump.yaml', 'utf8'),
        ) as RawLogic;
        const logic = parseLogic(raw);

        const inspect = (name: string) => {
            const bit = logic.itemBits[name];
            if (bit === undefined) {
                throw new Error(`Missing bit for ${name}`);
            }
            return {
                raw: formatExpr(logic, logic.rawStaticRequirements[bit]),
                simplified: formatExpr(logic, logic.staticRequirements[bit]),
            };
        };

        const suspects = [
            "\\Faron\\Farore's Silent Realm",
            "\\Skyloft\\The Goddess's Silent Realm",
            '\\Pumpkin Carrying',
            '\\Complete Hot Soup Delivery',
            '\\Delivered Hot Soup',
            "\\Goddess's Harp",
            "Farore's Courage",
            'Deep Woods Goddess Cube near Goron',
            'Deep Woods Goddess Cube in front of Temple',
        ];
        for (const suspect of suspects) {
            expect(inspect(suspect).raw).toBeTypeOf('string');
            expect(inspect(suspect).simplified).toBeTypeOf('string');
        }

        expect(inspect("\\Faron\\Farore's Silent Realm").simplified).not.toBe(
            'false',
        );
        expect(
            inspect("\\Skyloft\\The Goddess's Silent Realm").simplified,
        ).not.toBe('false');
        expect(inspect('\\Pumpkin Carrying').simplified).not.toBe('false');
        expect(inspect('\\Complete Hot Soup Delivery').simplified).not.toBe(
            'false',
        );
        expect(inspect('\\Delivered Hot Soup').simplified).not.toBe('false');
        expect(inspect("\\Goddess's Harp").simplified).not.toBe('false');
        expect(inspect('\\Full Song of the Hero').simplified).not.toBe('false');
        expect(
            inspect('Deep Woods Goddess Cube near Goron').simplified,
        ).not.toBe('false');
        expect(
            inspect('Deep Woods Goddess Cube in front of Temple').simplified,
        ).not.toBe('false');
    });

    it('opens Goddess Silent Realm when harp, sword, and full song are owned', () => {
        const raw = load(
            fs.readFileSync('testData/sshd-dump.yaml', 'utf8'),
        ) as RawLogic;
        const logic = parseLogic(raw);
        const inventoryRequirements = mapInventory(logic, {
            "Goddess's Harp": 1,
            'Progressive Sword': 1,
            'Song of the Hero': 3,
        });
        const bits = mergeRequirements(
            logic.numRequirements,
            logic.staticRequirements,
            inventoryRequirements,
        );
        const reachable = computeLeastFixedPoint('test', bits);

        const fullSongBit = logic.itemBits['\\Full Song of the Hero'];
        expect(reachable.test(fullSongBit)).toBe(true);

        const withoutSong = mapInventory(logic, {
            "Goddess's Harp": 1,
            'Progressive Sword': 1,
            'Song of the Hero': 2,
        });
        const unreachable = computeLeastFixedPoint(
            'test',
            mergeRequirements(
                logic.numRequirements,
                logic.staticRequirements,
                withoutSong,
            ),
        );
        expect(unreachable.test(fullSongBit)).toBe(false);
    });
});
