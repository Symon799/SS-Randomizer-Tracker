import { describe, expect, it } from 'vitest';
import reducer, {
    clickItem,
    createResetTrackerState,
    replaceItemCounts,
} from './Slice';

describe('tracker inventory overrides', () => {
    it('manual clicks override AP counts until the server changes that item', () => {
        let state = createResetTrackerState({} as never);

        state = reducer(
            state,
            replaceItemCounts([
                { item: 'Skyview Small Key', count: 0 },
                { item: 'Skyview Boss Key', count: 0 },
            ]),
        );

        state = reducer(
            state,
            clickItem({ item: 'Skyview Boss Key', take: false }),
        );
        expect(state.inventory['Skyview Boss Key']).toBe(1);
        expect(state.manualInventoryOverrides['Skyview Boss Key']).toBe(1);

        state = reducer(
            state,
            replaceItemCounts([
                { item: 'Skyview Small Key', count: 1 },
                { item: 'Skyview Boss Key', count: 1 },
            ]),
        );
        expect(state.inventory['Skyview Small Key']).toBe(1);
        expect(state.inventory['Skyview Boss Key']).toBe(1);

        state = reducer(
            state,
            replaceItemCounts([
                { item: 'Skyview Small Key', count: 1 },
                { item: 'Skyview Boss Key', count: 0 },
            ]),
        );
        expect(state.inventory['Skyview Boss Key']).toBe(0);
        expect(state.manualInventoryOverrides['Skyview Boss Key']).toBeUndefined();
    });

    it('clamps manual counts between zero and the item maximum', () => {
        let state = createResetTrackerState({} as never);

        state = reducer(
            state,
            clickItem({ item: 'Skyview Boss Key', take: false }),
        );
        expect(state.inventory['Skyview Boss Key']).toBe(1);
        state = reducer(
            state,
            clickItem({ item: 'Skyview Boss Key', take: true }),
        );
        expect(state.inventory['Skyview Boss Key']).toBe(0);

        state = reducer(
            state,
            clickItem({ item: 'Key Piece', take: false }),
        );
        for (let i = 0; i < 10; i++) {
            state = reducer(state, clickItem({ item: 'Key Piece', take: false }));
        }
        expect(state.inventory['Key Piece']).toBe(5);
    });
});
