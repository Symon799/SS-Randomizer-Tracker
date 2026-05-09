import clsx from 'clsx';
import type { JSX } from 'react';
import styles from './LocationGrid.module.css';

/**
 * A list of locations/entrances. `wide` arranges the locations
 * in a two-column layout.
 * `children` MUST be an array of JSX elements with unique keys.
 * JSX children are not type-checked by TypeScript or eslint-typescript,
 * so handle with care.
 */
export default function LocationGrid({
    compact,
    wide,
    children,
}: {
    compact: boolean;
    wide: boolean;
    children: JSX.Element[];
}) {
    return (
        <div
            className={clsx(styles.locationGroup, {
                [styles.wide]: wide,
                [styles.compact]: compact,
            })}
        >
            {children.map((child) => (
                <div
                    key={child.key}
                    className={clsx(styles.locationCell, {
                        [styles.compactCell]: compact,
                    })}
                >
                    {child}
                </div>
            ))}
        </div>
    );
}
