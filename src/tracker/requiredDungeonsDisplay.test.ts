import { describe, expect, it } from 'vitest';
import { dungeonNames } from '../logic/Locations';
import { mergeWithManualOverrides } from './TrackerSync';

function displayedRequiredDungeons(
    selectedRequiredDungeons: string[],
    apRequiredDungeons: string[],
    numRequiredDungeons: number,
) {
    const useExplicitApDungeonList = apRequiredDungeons.length > 0;

    return dungeonNames.filter((d) =>
        d === 'Sky Keep'
            ? false
            : useExplicitApDungeonList
              ? selectedRequiredDungeons.includes(d)
              : numRequiredDungeons === 6 ||
                selectedRequiredDungeons.includes(d),
    );
}

describe('required dungeon display', () => {
    it('shows every surface dungeon when AP did not send a specific list', () => {
        const selected = [
            'Skyview',
            'Earth Temple',
            'Lanayru Mining Facility',
            'Ancient Cistern',
            'Sandship',
            'Fire Sanctuary',
        ];

        expect(
            displayedRequiredDungeons(selected, [], 6).filter(
                (dungeon) => dungeon !== 'Sky Keep',
            ),
        ).toHaveLength(6);
    });

    it('only shows AP dungeons when the server sent goal_dungeon_location_codes', () => {
        const apDungeons = ['Skyview', 'Sandship'];
        const selected = mergeWithManualOverrides(new Set(apDungeons), {});

        expect(displayedRequiredDungeons(selected, apDungeons, 6)).toEqual(
            apDungeons,
        );
    });

    it('lets players disable an AP dungeon until the next tracker reset', () => {
        const apDungeons = ['Skyview', 'Sandship', 'Earth Temple'];
        const selected = mergeWithManualOverrides(new Set(apDungeons), {
            Sandship: false,
        });

        expect(displayedRequiredDungeons(selected, apDungeons, 6)).toEqual([
            'Skyview',
            'Earth Temple',
        ]);
    });
});
