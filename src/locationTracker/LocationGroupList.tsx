import { useSelector } from 'react-redux';
import { isDungeon } from '../logic/Locations';
import {
    displayAreasSelector,
    unmappedAreaNamesSelector,
} from '../tracker/Selectors';
import type {
    InterfaceAction,
    InterfaceState,
} from '../tracker/TrackerInterfaceReducer';
import LocationGroupHeader from './LocationGroupHeader';

export function LocationGroupList({
    interfaceState,
    interfaceDispatch,
}: {
    interfaceState: InterfaceState;
    interfaceDispatch: React.Dispatch<InterfaceAction>;
}) {
    const areas = useSelector(displayAreasSelector);
    const unmappedAreaNames = useSelector(unmappedAreaNamesSelector);
    const setActiveArea = (area: string) =>
        interfaceDispatch({ type: 'selectHintRegion', hintRegion: area });

    return (
        <div style={{ padding: '8px 10px 8px 16px' }}>
            {areas
                .filter(
                    (area) =>
                        !isDungeon(area.name) &&
                        !area.nonProgress &&
                        !unmappedAreaNames.has(area.name),
                )
                .map((value) => (
                    <LocationGroupHeader
                        isActive={
                            interfaceState.type === 'viewingChecks' &&
                            interfaceState.hintRegion === value.name
                        }
                        setActiveArea={setActiveArea}
                        key={value.name}
                        area={value}
                    />
                ))}
        </div>
    );
}
