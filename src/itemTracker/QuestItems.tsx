import type { CSSProperties } from 'react';
import Item from './Item';
import { GratitudeCrystals } from './items/sidequest/GratitudeCrystals';

import questItemBlock from '../assets/quest_items_block.png';

const QUEST_BLOCK_HEIGHT_RATIO = 187 / 746;

function questTop(width: number, bottomRatio: number): number {
    return width * (QUEST_BLOCK_HEIGHT_RATIO - bottomRatio);
}

export default function QuestItems({ width }: { width: number }) {
    const letterWidth = width / 6.5;
    const cBeetleWidth = width / 6.5;
    const rattleWidth = width / 6.5;
    const crystalWidth = width / 8;

    const letterStyle: CSSProperties = {
        position: 'absolute',
        top: questTop(width, 0.19),
        left: width / 14,
    };
    const cBeetleStyle: CSSProperties = {
        position: 'absolute',
        top: questTop(width, 0.205),
        left: width / 3.26,
    };
    const rattleStyle: CSSProperties = {
        position: 'absolute',
        top: questTop(width, 0.207),
        left: width / 1.85,
    };
    const crystalStyle: CSSProperties = {
        position: 'absolute',
        top: questTop(width, 0.195),
        left: width / 1.26,
    };

    return (
        <div id="quest-items" style={{ display: 'flex' }}>
            <img src={questItemBlock} alt="" width={width} draggable={false} />
            <div style={letterStyle}>
                <Item itemName="Cawlin's Letter" imgWidth={letterWidth} />
            </div>
            <div style={cBeetleStyle}>
                <Item
                    itemName="Horned Colossus Beetle"
                    imgWidth={cBeetleWidth}
                />
            </div>
            <div style={rattleStyle}>
                <Item itemName="Baby Rattle" imgWidth={rattleWidth} />
            </div>
            <div style={crystalStyle}>
                <GratitudeCrystals imgWidth={crystalWidth} />
            </div>
        </div>
    );
}
