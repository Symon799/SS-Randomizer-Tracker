import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
    getStoredTrackerLocationFilter,
    setStoredTrackerLocationFilter,
    type TrackerLocationFilter,
} from '../LocalStorage';
import { areasSelector } from '../tracker/Selectors';
import type {
    InterfaceAction,
    InterfaceState,
} from '../tracker/TrackerInterfaceReducer';
import EntranceChooser from './EntranceChooser';
import LocationGroupHeader from './LocationGroupHeader';
import { Locations } from './Locations';

export function LocationsEntrancesList({
    includeHeader,
    wide,
    interfaceState,
    interfaceDispatch,
}: {
    includeHeader?: boolean;
    wide: boolean;
    interfaceState: InterfaceState;
    interfaceDispatch: React.Dispatch<InterfaceAction>;
}) {
    const areas = useSelector(areasSelector);
    const [locationFilter, setLocationFilter] = useState<TrackerLocationFilter>(
        () => getStoredTrackerLocationFilter() ?? 'all',
    );
    const activeArea =
        interfaceState.type === 'viewingChecks'
            ? interfaceState.hintRegion
            : undefined;
    const selectedArea =
        (activeArea && areas.find((a) => a.name === activeArea)) || undefined;
    const onChooseEntrance = (exitId: string) =>
        interfaceDispatch({ type: 'chooseEntrance', exitId });

    const setActiveArea = (hintRegion: string) =>
        interfaceDispatch({ type: 'selectHintRegion', hintRegion });

    useEffect(() => {
        setStoredTrackerLocationFilter(locationFilter);
    }, [locationFilter]);

    return (
        <>
            {selectedArea && (
                <div
                    style={{
                        display: 'flex',
                        flexFlow: 'column nowrap',
                        height: '100%',
                    }}
                >
                    {includeHeader && (
                        <div style={{ padding: '0 8px', width: '100%' }}>
                            <LocationGroupHeader
                                area={selectedArea}
                                setActiveArea={setActiveArea}
                                alignCounters
                                trailingContent={
                                    <>
                                        {(
                                            [
                                                ['accessible', 'Accessible'],
                                                ['checked', 'Checked'],
                                                ['all', 'All'],
                                            ] as const
                                        ).map(([value, label]) => (
                                            <button
                                                key={value}
                                                type="button"
                                                className="tracker-button"
                                                aria-pressed={
                                                    locationFilter === value
                                                }
                                                style={{
                                                    padding: '0.25rem 0.52rem',
                                                    fontSize: '0.77rem',
                                                    lineHeight: 1,
                                                    fontWeight:
                                                        locationFilter === value
                                                            ? 700
                                                            : 600,
                                                    background:
                                                        locationFilter === value
                                                            ? 'color-mix(in srgb, var(--scheme-text) 18%, white)'
                                                            : 'color-mix(in srgb, var(--scheme-background) 94%, white)',
                                                    borderColor:
                                                        locationFilter === value
                                                            ? 'color-mix(in srgb, var(--scheme-text) 34%, transparent)'
                                                            : 'color-mix(in srgb, var(--scheme-text) 12%, transparent)',
                                                    boxShadow:
                                                        locationFilter === value
                                                            ? 'inset 0 0 0 1px color-mix(in srgb, var(--scheme-text) 12%, transparent), 0 2px 8px color-mix(in srgb, var(--scheme-text) 10%, transparent)'
                                                            : 'none',
                                                }}
                                                onClick={() =>
                                                    setLocationFilter(value)
                                                }
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </>
                                }
                            />
                        </div>
                    )}
                    <div style={{ overflow: 'visible auto', flex: '1' }}>
                        <Locations
                            compact
                            filter={locationFilter}
                            wide={wide}
                            onChooseEntrance={onChooseEntrance}
                            hintRegion={selectedArea}
                        />
                    </div>
                </div>
            )}
            {interfaceState.type === 'choosingEntrance' && (
                <EntranceChooser
                    wide={wide}
                    exitId={interfaceState.exitId}
                    onChoose={(entranceId) =>
                        interfaceDispatch({
                            type: 'cancelChooseEntrance',
                            selectedEntrance: entranceId,
                        })
                    }
                />
            )}
        </>
    );
}
