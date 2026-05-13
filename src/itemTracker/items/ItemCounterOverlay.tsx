import styles from './CounterItem.module.css';

export function ItemCounterOverlay({
    count,
    hideWhenZero = true,
    className,
}: {
    count: number;
    hideWhenZero?: boolean;
    className?: string;
}) {
    if (hideWhenZero && count <= 0) {
        return null;
    }

    return <div className={className ?? styles.counter}>{count}</div>;
}
