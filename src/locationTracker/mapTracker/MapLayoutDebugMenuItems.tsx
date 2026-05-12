import { useEffect, useMemo, useState } from 'react';
import { Item, Separator } from 'react-contexify';
import { useSelector } from 'react-redux';
import { debugModeSelector } from '../../customization/Selectors';
import {
    ENABLE_MAP_LAYOUT_DEBUG,
    getActiveLayoutMovePath,
    subscribeActiveLayoutMove,
    toggleActiveLayoutMovePath,
} from './layoutDebug';

export interface MapLayoutDebugContextMenuProps {
    layoutDebugPath?: string;
}

function useActiveLayoutMovePath() {
    const [activePath, setActivePath] = useState(getActiveLayoutMovePath);

    useEffect(
        () =>
            subscribeActiveLayoutMove(() =>
                setActivePath(getActiveLayoutMovePath()),
            ),
        [],
    );

    return activePath;
}

export function useMapLayoutDebugEnabled() {
    const debugMode = useSelector(debugModeSelector);
    return ENABLE_MAP_LAYOUT_DEBUG || debugMode;
}

export function useMapLayoutDebugMenuElements() {
    const mapLayoutDebugEnabled = useMapLayoutDebugEnabled();
    const activeLayoutMovePath = useActiveLayoutMovePath();

    return useMemo(() => {
        if (!mapLayoutDebugEnabled) {
            return [];
        }

        return [
            <Item
                key="map-layout-debug-move"
                disabled={({ props }) => !props?.layoutDebugPath}
                hidden={({ props }) =>
                    activeLayoutMovePath === props?.layoutDebugPath
                }
                onClick={(params) => {
                    const path = params.props?.layoutDebugPath;
                    if (path) {
                        toggleActiveLayoutMovePath(path);
                    }
                }}
            >
                Move map marker on map
            </Item>,
            <Item
                key="map-layout-debug-stop"
                disabled={({ props }) => !props?.layoutDebugPath}
                hidden={({ props }) =>
                    activeLayoutMovePath !== props?.layoutDebugPath
                }
                onClick={(params) => {
                    const path = params.props?.layoutDebugPath;
                    if (path) {
                        toggleActiveLayoutMovePath(path);
                    }
                }}
            >
                Stop moving map marker
            </Item>,
            <Separator
                key="map-layout-debug-separator"
                hidden={({ props }) => !props?.layoutDebugPath}
            />,
        ];
    }, [activeLayoutMovePath, mapLayoutDebugEnabled]);
}
