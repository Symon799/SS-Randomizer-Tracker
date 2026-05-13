import styles from './InGameInventoryOverlay.module.css';

export function InGameItemLabel({ children }: { children: React.ReactNode }) {
    return <div className={styles.label}>{children}</div>;
}
