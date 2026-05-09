import clsx from 'clsx';
import { useCallback, type ReactNode } from 'react';
import type { TriggerEvent } from 'react-contexify';
import { useSelector } from 'react-redux';
import Tooltip from '../additionalComponents/Tooltip';
import {
    draggableToRegionHint,
    useDroppable,
} from '../dragAndDrop/DragAndDrop';
import { decodeHint } from '../hints/Hints';
import type { HintRegion } from '../logic/Locations';
import { areaHintSelector } from '../tracker/Selectors';
import keyDownWrapper from '../utils/KeyDownWrapper';
import { useContextMenu } from './context-menu';
import type { LocationGroupContextMenuProps } from './LocationGroupContextMenu';
import styles from './LocationGroupHeader.module.css';

export default function LocationGroupHeader({
    area,
    setActiveArea,
    alignCounters: _alignCounters,
    isActive,
    trailingContent,
}: {
    area: HintRegion;
    setActiveArea: (area: string) => void;
    alignCounters?: boolean;
    isActive?: boolean;
    trailingContent?: ReactNode;
}) {
    const onClick = useCallback(
        () => setActiveArea(area.name),
        [area.name, setActiveArea],
    );

    const areaHint = useSelector(areaHintSelector(area.name));

    const { show } = useContextMenu<LocationGroupContextMenuProps>({
        id: 'group-context',
    });

    const displayMenu = useCallback(
        (e: TriggerEvent) => {
            show({
                event: e,
                props: { area: area.name },
            });
        },
        [area, show],
    );

    const hints = areaHint.map(decodeHint);

    const { setNodeRef, active, isOver } = useDroppable({
        type: 'hintRegion',
        hintRegion: area.name,
    });

    const dragPreviewHint = active && draggableToRegionHint(active);
    const canDrop = Boolean(dragPreviewHint);
    if (dragPreviewHint && isOver) {
        hints.push({ ...decodeHint(dragPreviewHint), preview: true });
    }

    return (
        <div
            onClick={onClick}
            onKeyDown={keyDownWrapper(onClick)}
            role="button"
            tabIndex={0}
            onContextMenu={displayMenu}
            className={clsx(styles.locationGroupHeader, {
                [styles.droppable]: canDrop,
                [styles.droppableHover]: canDrop && isOver,
                [styles.selected]: isActive,
            })}
            ref={setNodeRef}
        >
            <div className={styles.name}>
                <span className={styles.nameText}>{area.name}</span>
                <span className={styles.nameCounter}>
                    ({area.checks.numAccessible}/{area.checks.numRemaining})
                </span>
            </div>
            {hints.map((hint, idx) => (
                <div
                    key={idx}
                    className={clsx(styles.hint, {
                        [styles.preview]: hint.preview,
                    })}
                >
                    <Tooltip
                        content={
                            <span
                                style={{ color: `var(--scheme-${hint.style})` }}
                            >
                                {hint.description}
                            </span>
                        }
                    >
                        <img src={hint.image} alt={hint.description} />
                    </Tooltip>
                </div>
            ))}
            {Boolean(trailingContent) && (
                <div className={styles.trailingContent}>{trailingContent}</div>
            )}
        </div>
    );
}
