import clsx from 'clsx';
import type { CSSProperties, ReactNode } from 'react';
import styles from './InGameInventoryOverlay.module.css';

export function InGameItemSlot({
    size,
    className,
    style,
    children,
}: {
    size: number;
    className?: string;
    style?: CSSProperties;
    children: ReactNode;
}) {
    return (
        <div
            className={clsx('in-game-item-slot', className ?? styles.itemSlot)}
            style={{ width: size, height: size, ...style }}
        >
            {children}
        </div>
    );
}
