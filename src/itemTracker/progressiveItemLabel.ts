import type { InventoryItem } from '../logic/Inventory';
import { itemMaxes } from '../logic/Inventory';

export function isProgressiveInventoryItem(
    itemName: InventoryItem,
): itemName is InventoryItem {
    return itemName.startsWith('Progressive');
}

export function progressiveItemMax(itemName: InventoryItem): number {
    return itemMaxes[itemName];
}

export function formatProgressiveItemProgress(
    itemName: InventoryItem,
    count: number,
): string {
    return `${count}/${progressiveItemMax(itemName)}`;
}

export function formatProgressiveItemLabel(
    itemName: InventoryItem,
    count: number,
): string {
    return `${itemName} (${formatProgressiveItemProgress(itemName, count)})`;
}
