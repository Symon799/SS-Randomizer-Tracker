import React from 'react';
import { useSelector } from 'react-redux';
import type { TrackerLocationFilter } from '../LocalStorage';
import type { HintRegion } from '../logic/Locations';
import type { RootState } from '../store/Store';
import { checkSelector } from '../tracker/Selectors';
import LocationGroup from './LocationGroup';

export function Locations({
    compact,
    filter,
    wide,
    hintRegion,
    onChooseEntrance,
}: {
    compact: boolean;
    filter: TrackerLocationFilter;
    wide: boolean;
    hintRegion: HintRegion<string>;
    onChooseEntrance: (exitId: string) => void;
}) {
    const filteredChecks = useSelector((state: RootState) => {
        const matchesFilter = (id: string) => {
            const check = checkSelector.selector(state, id);
            if (filter === 'all') {
                return true;
            }
            if (filter === 'checked') {
                return check.checked;
            }
            return !check.checked && check.logicalState === 'inLogic';
        };

        return {
            primary: hintRegion.checks.list.filter(matchesFilter),
            extras: Object.fromEntries(
                (
                    [
                        'loose_crystal',
                        'tr_cube',
                        'gossip_stone',
                        'exits',
                    ] as const
                ).map((type) => [
                    type,
                    (hintRegion.extraLocations[type]?.list ?? []).filter(
                        matchesFilter,
                    ),
                ]),
            ) as Record<
                'loose_crystal' | 'tr_cube' | 'gossip_stone' | 'exits',
                string[]
            >,
        };
    });
    return (
        <>
            <LocationGroup
                compact={compact}
                wide={wide}
                onChooseEntrance={onChooseEntrance}
                locations={filteredChecks.primary}
            />
            {(
                ['loose_crystal', 'tr_cube', 'gossip_stone', 'exits'] as const
            ).map(
                (type) =>
                    Boolean(filteredChecks.extras[type].length) && (
                        <React.Fragment key={type}>
                            <hr />
                            <LocationGroup
                                compact={compact}
                                wide={wide}
                                onChooseEntrance={onChooseEntrance}
                                locations={filteredChecks.extras[type]}
                            />
                        </React.Fragment>
                    ),
            )}
        </>
    );
}
