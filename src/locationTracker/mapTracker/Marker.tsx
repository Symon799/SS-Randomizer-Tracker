import clsx from 'clsx';
import type React from 'react';
import type { CSSProperties } from 'react';
import { useRef } from 'react';
import type { TriggerEvent } from 'react-contexify';
import Tooltip from '../../additionalComponents/Tooltip';
import type { ColorScheme } from '../../customization/ColorScheme';
import styles from './Marker.module.css';

export type PreviewStyle = 'droppable' | 'hover';
export type MarkerVariant = 'square' | 'rounded' | 'circle';
export type SubmarkerPlacement = 'left' | 'right';
export interface SubmarkerData {
    key: string;
    image: string;
    color: keyof ColorScheme;
}

const borderRadiuses: Record<MarkerVariant, string | undefined> = {
    square: styles.square,
    rounded: styles.rounded,
    circle: styles.circle,
};

export function Marker({
    variant,
    color,
    x,
    y,
    children,
    submarkers,
    submarkerPlacement = 'right',
    tooltip,
    onClick,
    onContextMenu,
    selected,
    previewStyle,
    ref,
    debugEnabled,
    onDebugMove,
    debugPath,
}: {
    variant: MarkerVariant;
    color: keyof ColorScheme;
    x: number;
    y: number;
    children: React.ReactNode;
    submarkers?: SubmarkerData[];
    submarkerPlacement?: SubmarkerPlacement;
    tooltip?: React.ReactNode;
    onClick: (ev: TriggerEvent) => void;
    onContextMenu?: (ev: React.MouseEvent) => void;
    selected: boolean;
    previewStyle?: PreviewStyle;
    ref?: React.Ref<HTMLDivElement>;
    debugEnabled?: boolean;
    onDebugMove?: (debugPath: string, x: number, y: number) => void;
    debugPath?: string;
}) {
    const dragStateRef = useRef<{
        pointerId: number;
        parentRect: DOMRect;
    } | null>(null);
    const positionVars = {
        '--map-marker-y': `${y}%`,
        '--map-marker-x': `${x}%`,
    };
    const markerStyle: CSSProperties = {
        background: `var(--scheme-${color})`,
    };

    if (selected) {
        markerStyle.boxShadow = `0 0 20px var(--scheme-${color})`;
    }

    if (debugEnabled) {
        markerStyle.cursor = 'move';
    }

    const updateDebugPosition = (
        ev: React.PointerEvent<HTMLDivElement>,
        parentRect: DOMRect,
    ) => {
        if (!debugPath || !onDebugMove) {
            return;
        }
        const nextX = ((ev.clientX - parentRect.left) / parentRect.width) * 100;
        const nextY = ((ev.clientY - parentRect.top) / parentRect.height) * 100;
        onDebugMove(debugPath, nextX, nextY);
    };

    return (
        <>
            <Tooltip content={tooltip} placement="bottom">
                <div
                    onClick={onClick}
                    onKeyDown={onClick}
                    role="button"
                    tabIndex={0}
                    onContextMenu={(ev) => {
                        ev.preventDefault();
                        onContextMenu?.(ev);
                    }}
                    style={{ ...markerStyle, ...positionVars }}
                    className={clsx(styles.marker, borderRadiuses[variant])}
                    ref={ref}
                    onPointerDown={(ev) => {
                        if (
                            !debugEnabled ||
                            !debugPath ||
                            !onDebugMove ||
                            ev.button !== 0
                        ) {
                            return;
                        }
                        const parentRect =
                            ev.currentTarget.parentElement?.getBoundingClientRect();
                        if (!parentRect) {
                            return;
                        }
                        ev.preventDefault();
                        ev.stopPropagation();
                        dragStateRef.current = {
                            pointerId: ev.pointerId,
                            parentRect,
                        };
                        ev.currentTarget.setPointerCapture(ev.pointerId);
                        updateDebugPosition(ev, parentRect);
                    }}
                    onPointerMove={(ev) => {
                        if (
                            !debugEnabled ||
                            !dragStateRef.current ||
                            dragStateRef.current.pointerId !== ev.pointerId
                        ) {
                            return;
                        }
                        ev.preventDefault();
                        ev.stopPropagation();
                        updateDebugPosition(
                            ev,
                            dragStateRef.current.parentRect,
                        );
                    }}
                    onPointerUp={(ev) => {
                        if (
                            !dragStateRef.current ||
                            dragStateRef.current.pointerId !== ev.pointerId
                        ) {
                            return;
                        }
                        ev.preventDefault();
                        ev.stopPropagation();
                        dragStateRef.current = null;
                        ev.currentTarget.releasePointerCapture(ev.pointerId);
                    }}
                    onPointerCancel={(ev) => {
                        if (
                            !dragStateRef.current ||
                            dragStateRef.current.pointerId !== ev.pointerId
                        ) {
                            return;
                        }
                        dragStateRef.current = null;
                        ev.currentTarget.releasePointerCapture(ev.pointerId);
                    }}
                >
                    <span>{children}</span>
                </div>
            </Tooltip>
            {previewStyle && (
                <div
                    style={positionVars as CSSProperties}
                    className={clsx({
                        [styles.droppableOutline]: Boolean(previewStyle),
                        [styles.droppableOutlineHover]:
                            previewStyle === 'hover',
                    })}
                />
            )}
            {submarkers && (
                <div
                    className={clsx(styles.submarkers, {
                        [styles.left]: submarkerPlacement === 'left',
                    })}
                    style={positionVars as CSSProperties}
                >
                    {submarkers?.map((data) => (
                        <div
                            key={data.key}
                            className={styles.submarker}
                            style={{
                                background: `var(--scheme-${data.color})`,
                            }}
                        >
                            <img src={data.image} />
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
