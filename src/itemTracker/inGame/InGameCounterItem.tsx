import clsx from 'clsx';
import type { CSSProperties } from 'react';
import { useSelector } from 'react-redux';
import type { InventoryItem } from '../../logic/Inventory';
import { rawItemCountSelector } from '../../tracker/Selectors';
import Item from '../Item';
import { ItemCounterOverlay } from '../items/ItemCounterOverlay';
import {
    formatProgressiveItemLabel,
    isProgressiveInventoryItem,
} from '../progressiveItemLabel';
import styles from './InGameInventoryOverlay.module.css';
import { InGameItemSlot } from './InGameItemSlot';

export function InGameCounterItem({
    itemName,
    imgWidth,
    className,
    counterClassName,
    style,
}: {
    itemName: InventoryItem;
    imgWidth: number;
    className?: string;
    counterClassName?: string;
    style?: CSSProperties;
}) {
    const current = useSelector(rawItemCountSelector(itemName));

    return (
        <InGameItemSlot size={imgWidth}>
            <Item
                className={clsx(styles.counterItemContainer, className)}
                style={style}
                itemName={itemName}
                imgWidth="100%"
                tooltipLabel={
                    isProgressiveInventoryItem(itemName)
                        ? formatProgressiveItemLabel(itemName, current)
                        : undefined
                }
            >
                <ItemCounterOverlay
                    count={current}
                    className={counterClassName ?? styles.counter}
                />
            </Item>
        </InGameItemSlot>
    );
}
