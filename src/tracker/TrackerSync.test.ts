import { describe, expect, it } from 'vitest';
import {
    bootstrapManualCheckOverrides,
    mergeInventoryWithManualOverrides,
    mergeWithManualOverrides,
    reconcileInventoryOverrides,
    reconcileManualOverrides,
    reconstructApRequiredDungeons,
} from './TrackerSync';

describe('reconcileManualOverrides', () => {
    it('keeps manual overrides on the first AP delivery', () => {
        expect(
            reconcileManualOverrides(
                new Set(),
                new Set(['a', 'b']),
                { c: true },
            ),
        ).toEqual({ c: true });
    });

    it('drops overrides for checks the server changed', () => {
        expect(
            reconcileManualOverrides(
                new Set(['a', 'b']),
                new Set(['a']),
                { a: true, b: false, c: true },
            ),
        ).toEqual({ a: true, c: true });
    });
});

describe('mergeWithManualOverrides', () => {
    it('prefers manual overrides over AP values', () => {
        expect(
            mergeWithManualOverrides(new Set(['a', 'b']), {
                b: false,
                c: true,
            }).sort(),
        ).toEqual(['a', 'c']);
    });
});

describe('bootstrapManualCheckOverrides', () => {
    it('preserves existing checked locations before AP sync', () => {
        expect(
            bootstrapManualCheckOverrides(
                ['manual-check'],
                [],
                {},
            ),
        ).toEqual({ 'manual-check': true });
    });
});

describe('reconcileInventoryOverrides', () => {
    it('keeps manual overrides on the first AP delivery', () => {
        expect(
            reconcileInventoryOverrides(
                {},
                { 'Skyview Small Key': 1 },
                { 'Skyview Boss Key': 1 },
            ),
        ).toEqual({ 'Skyview Boss Key': 1 });
    });

    it('drops overrides for items the server changed', () => {
        expect(
            reconcileInventoryOverrides(
                { 'Skyview Small Key': 0 },
                { 'Skyview Small Key': 1 },
                { 'Skyview Small Key': 2, 'Skyview Boss Key': 1 },
            ),
        ).toEqual({ 'Skyview Boss Key': 1 });
    });
});

describe('mergeInventoryWithManualOverrides', () => {
    it('prefers manual overrides over AP values', () => {
        expect(
            mergeInventoryWithManualOverrides(
                { 'Skyview Small Key': 0, 'Skyview Boss Key': 0 },
                { 'Skyview Small Key': 2 },
            ),
        ).toEqual({ 'Skyview Small Key': 2, 'Skyview Boss Key': 0 });
    });
});

describe('reconstructApRequiredDungeons', () => {
    it('rebuilds AP required dungeons from saved selection and overrides', () => {
        expect(
            reconstructApRequiredDungeons(
                ['Skyview', 'Sandship'],
                { 'Earth Temple': false },
            ).sort(),
        ).toEqual(['Earth Temple', 'Sandship', 'Skyview']);
    });
});
