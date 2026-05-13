import { useSelector } from 'react-redux';
import type { InventoryItem } from '../../logic/Inventory';
import { rawItemCountSelector } from '../../tracker/Selectors';
import Item from '../Item';
import counterStyles from './CounterItem.module.css';
import { ItemCounterOverlay } from './ItemCounterOverlay';

export function CounterItem({
    itemName,
    imgWidth,
    grid,
}: {
    itemName: InventoryItem;
    imgWidth: number;
    grid?: boolean;
}) {
    const current = useSelector(rawItemCountSelector(itemName));
    return (
        <Item
            className={counterStyles.counterItemContainer}
            itemName={itemName}
            grid={grid}
            imgWidth={imgWidth}
        >
            <ItemCounterOverlay count={current} />
        </Item>
    );
}
