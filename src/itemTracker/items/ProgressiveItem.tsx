import type { CSSProperties, ReactNode } from 'react';
import { useSelector } from 'react-redux';
import type { InventoryItem } from '../../logic/Inventory';
import { rawItemCountSelector } from '../../tracker/Selectors';
import Item from '../Item';
import { formatProgressiveItemLabel } from '../progressiveItemLabel';

export function ProgressiveItem({
    itemName,
    imgWidth,
    grid,
    className,
    style,
    children,
}: {
    itemName: InventoryItem;
    imgWidth: number | string;
    grid?: boolean;
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
}) {
    const count = useSelector(rawItemCountSelector(itemName));

    return (
        <Item
            className={className}
            style={style}
            itemName={itemName}
            imgWidth={imgWidth}
            grid={grid}
            tooltipLabel={formatProgressiveItemLabel(itemName, count)}
        >
            {children}
        </Item>
    );
}
