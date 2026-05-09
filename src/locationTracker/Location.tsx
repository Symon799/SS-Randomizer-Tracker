import clsx from 'clsx';
import { useCallback, type CSSProperties } from 'react';
import type { TriggerEvent } from 'react-contexify';
import { useDispatch, useSelector } from 'react-redux';
import Tooltip from '../additionalComponents/Tooltip';
import exitImg from '../assets/dungeons/entrance.png';
import goddessCubeImg from '../assets/sidequests/goddess_cube.png';
import gossipStoneImg from '../assets/sidequests/gossip_stone.png';
import { useDroppable } from '../dragAndDrop/DragAndDrop';
import images, { findRepresentativeIcon } from '../itemTracker/Images';
import type { InventoryItem } from '../logic/Inventory';
import type { Check } from '../logic/Locations';
import { isRegularItemCheck } from '../logic/Logic';
import { useAppDispatch, type RootState } from '../store/Store';
import {
    useEntrancePath,
    useTooltipDebug,
    useTooltipExpr,
} from '../tooltips/TooltipHooks';
import { clickCheck } from '../tracker/Actions';
import {
    checkHintSelector,
    checkSelector,
    exitsByIdSelector,
    isCheckBannedSelector,
} from '../tracker/Selectors';
import { mapEntrance } from '../tracker/Slice';
import keyDownWrapper from '../utils/KeyDownWrapper';
import { useContextMenu } from './context-menu';
import styles from './Location.module.css';
import PathTooltip from './PathTooltip';
import RequirementsTooltip from './RequirementsTooltip';

export interface LocationContextMenuProps {
    checkId: string;
}

export default function Location({
    compact,
    id,
    onChooseEntrance,
}: {
    compact: boolean;
    id: string;
    onChooseEntrance: (exitId: string) => void;
}) {
    const check = useSelector(checkSelector(id));
    if (check.type === 'exit') {
        return (
            <Exit
                compact={compact}
                onChooseEntrance={onChooseEntrance}
                id={id}
            />
        );
    } else {
        return <CheckLocation compact={compact} id={id} />;
    }
}

function CheckLocation({ id, compact }: { id: string; compact: boolean }) {
    const dispatch = useAppDispatch();
    const isBanned = useSelector((state: RootState) =>
        isCheckBannedSelector(state)(id),
    );

    const check = useSelector(checkSelector(id));

    const onClick = () => dispatch(clickCheck({ checkId: id }));

    const style = {
        color: check.checked
            ? `var(--scheme-checked)`
            : `var(--scheme-${check.logicalState})`,
    } satisfies CSSProperties;

    const { show } = useContextMenu<LocationContextMenuProps>({
        id: 'location-context',
    });

    const displayMenu = useCallback(
        (e: TriggerEvent) => {
            show({ event: e, props: { checkId: id } });
        },
        [id, show],
    );

    const expr = useTooltipExpr(id);
    const debug = useTooltipDebug(id, expr);
    const path = useEntrancePath(id);
    const canAssignItemHint =
        check.type !== 'exit' && isRegularItemCheck(check.type);

    const { setNodeRef, active, isOver } = useDroppable(
        canAssignItemHint
            ? {
                  type: 'location',
                  checkId: id,
              }
            : undefined,
    );

    const draggedItem =
        active?.type === 'item' && canAssignItemHint ? active.item : undefined;

    return (
        <Tooltip
            content={
                <>
                    <RequirementsTooltip requirements={expr} />
                    {path && (
                        <>
                            <hr />
                            <PathTooltip segments={path} />
                        </>
                    )}
                    {debug && (
                        <>
                            <hr />
                            <div className={styles.debugBlock}>
                                <div className={styles.debugTitle}>
                                    Debug logic
                                </div>
                                <div>{`checkId: ${debug.checkId}`}</div>
                                <div>{`area: ${debug.area ?? 'unknown'}`}</div>
                                <div>{`checkBit: ${debug.checkBit ?? 'missing'}`}</div>
                                <div>{`inLogic path: ${debug.inLogicPathFound}`}</div>
                                <div>{`optimistic path: ${debug.optimisticPathFound}`}</div>
                                <div>{`start entrance: ${debug.startEntrance ?? 'unset'}`}</div>
                                <div>{`ER settings: dungeon=${String(debug.entranceSettings.randomizeDungeonEntrances)}, interior=${String(debug.entranceSettings.randomizeInteriorEntrances)}, overworld=${String(debug.entranceSettings.randomizeOverworldEntrances)}, trials=${String(debug.entranceSettings.randomizeTrialEntrances)}, legacy=${String(debug.entranceSettings.randomizeEntrances)}`}</div>
                                <div className={styles.debugSection}>
                                    Raw requirements:
                                </div>
                                {debug.rawStaticRequirements.map((line) => (
                                    <div
                                        key={line}
                                        className={styles.debugLine}
                                    >
                                        {line}
                                    </div>
                                ))}
                                <div className={styles.debugSection}>
                                    Static requirements:
                                </div>
                                {debug.staticRequirements.map((line) => (
                                    <div
                                        key={line}
                                        className={styles.debugLine}
                                    >
                                        {line}
                                    </div>
                                ))}
                                <div className={styles.debugSection}>
                                    Requirement states:
                                </div>
                                {debug.staticRequirementStates.map((line) => (
                                    <div
                                        key={line}
                                        className={styles.debugLine}
                                    >
                                        {line}
                                    </div>
                                ))}
                                {debug.relevantExits.length > 0 && (
                                    <>
                                        <div className={styles.debugSection}>
                                            Region exits:
                                        </div>
                                        {debug.relevantExits.map((line) => (
                                            <div
                                                key={line}
                                                className={styles.debugLine}
                                            >
                                                {line}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        </>
                    )}
                    {isBanned && (
                        <div className={styles.tooltipNote}>
                            This location is excluded by current settings and
                            will never be logically required.
                        </div>
                    )}
                </>
            }
        >
            <div
                className={clsx(styles.location, {
                    [styles.compact]: compact,
                    [styles.checked]: check.checked,
                    [styles.droppable]: Boolean(draggedItem),
                    [styles.droppableHover]: draggedItem && isOver,
                })}
                style={style}
                role="button"
                onClick={onClick}
                onKeyDown={keyDownWrapper(onClick)}
                onContextMenu={displayMenu}
                ref={setNodeRef}
            >
                <span className={styles.text}>{check.checkName}</span>
                <CheckIcon
                    check={check}
                    overrideHint={isOver ? draggedItem : undefined}
                    compact={compact}
                />
            </div>
        </Tooltip>
    );
}

function CheckIcon({
    check,
    overrideHint,
    compact,
}: {
    check: Check;
    overrideHint?: InventoryItem;
    compact?: boolean;
}) {
    let hintItem = useSelector(checkHintSelector(check.checkId));
    let preview = false;
    const isCheckBanned = useSelector(isCheckBannedSelector);
    let name: string | undefined = undefined;
    let src: string | undefined = undefined;
    if (check.type === 'exit') {
        name = 'Exit';
        src = exitImg;
    } else if (check.type === 'gossip_stone') {
        name = 'Gossip Stone';
        src = gossipStoneImg;
    } else if (check.type === 'tr_cube') {
        name = 'Goddess Cube';
        src = goddessCubeImg;
    } else if (check.type === 'loose_crystal') {
        name = 'Gratitude Crystal';
        const banned = isCheckBanned(check.checkId);
        if (banned) {
            name += ' (not required)';
        }
        src = images['Gratitude Crystals Grid'][banned ? 0 : 1];
    } else {
        if (overrideHint) {
            hintItem = overrideHint;
            preview = true;
        }
        if (hintItem) {
            name = hintItem;
            src = findRepresentativeIcon(hintItem);
        }
    }

    if (src && name) {
        return (
            <div
                className={clsx(styles.hintItem, { [styles.preview]: preview })}
            >
                <img
                    src={src}
                    height={compact ? 28 : 36}
                    title={name}
                    alt={name}
                />
            </div>
        );
    }
}

function Exit({
    compact,
    id,
    onChooseEntrance,
    // setActiveArea,
}: {
    compact: boolean;
    id: string;
    onChooseEntrance: (exitId: string) => void;
    // TODO
    // setActiveArea: (area: string) => void;
}) {
    const dispatch = useDispatch();
    const exit = useSelector(
        (state: RootState) => exitsByIdSelector(state)[id],
    );
    const check = useSelector(checkSelector(id));

    const style = {
        color: check.checked
            ? `var(--scheme-checked)`
            : `var(--scheme-${check.logicalState})`,
    };

    const expr = useTooltipExpr(id);
    const path = useEntrancePath(id);

    const onClick = () => onChooseEntrance(id);

    return (
        <>
            <Tooltip
                content={
                    <>
                        <RequirementsTooltip requirements={expr} />
                        {path && (
                            <>
                                <hr />
                                <PathTooltip segments={path} />
                            </>
                        )}
                    </>
                }
            >
                <div
                    className={styles.location}
                    role="button"
                    onClick={onClick}
                    onKeyDown={keyDownWrapper(onClick)}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        dispatch(
                            mapEntrance({
                                from: exit.exit.id,
                                to: undefined,
                            }),
                        );
                    }}
                >
                    <div className={clsx(styles.exit, styles.text)}>
                        <span style={style}>{check.checkName}</span>
                        <span>
                            ↳{exit.entrance?.name ?? 'Select entrance...'}
                        </span>
                    </div>
                    <CheckIcon check={check} compact={compact} />
                </div>
            </Tooltip>
        </>
    );
}
