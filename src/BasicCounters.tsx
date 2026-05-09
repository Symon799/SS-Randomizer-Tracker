import { useSelector } from 'react-redux';
import Tooltip from './additionalComponents/Tooltip';
import styles from './BasicCounters.module.css';
import { counterBasisSelector } from './customization/Selectors';
import type { ExitMapping, LogicalState } from './logic/Locations';
import {
    exitsSelector,
    getRequirementLogicalStateSelector,
    settingsSelector,
    totalCountersSelector,
} from './tracker/Selectors';

export default function BasicCounters({ compact }: { compact?: boolean }) {
    const state = useSelector(totalCountersSelector);

    const exits = useSelector(exitsSelector);
    const getLogicalState = useSelector(getRequirementLogicalStateSelector);
    const counterBasis = useSelector(counterBasisSelector);
    const settings = useSelector(settingsSelector) as Record<
        string,
        string | number | boolean | string[] | undefined
    >;
    const shouldCount = (state: LogicalState) =>
        counterBasis === 'logic' ? state === 'inLogic' : state !== 'outLogic';
    const showEntrancesCounter = [
        settings['randomize-entrances'],
        settings['randomize-dungeon-entrances'],
        settings['randomize-interior-entrances'],
        settings['randomize-overworld-entrances'],
        settings['randomize-trials'],
        settings['random-start-entrance'],
        settings['random-start-statues'],
    ].some(
        (value) =>
            value !== undefined &&
            value !== false &&
            value !== 'off' &&
            value !== 'None' &&
            value !== 'vanilla',
    );

    const relevantExits = exits.filter(
        (e) =>
            e.canAssign &&
            !e.rule.isKnownIrrelevant &&
            !e.entrance &&
            shouldCount(getLogicalState(e.exit.id)),
    );

    const counterRows = [
        {
            value: state.numChecked,
            shortLabel: 'Checked',
            fullLabel: 'Locations Checked',
        },
        {
            value: state.numAccessible,
            shortLabel: 'Accessible',
            fullLabel: 'Locations Accessible',
        },
        {
            value: state.numRemaining,
            shortLabel: 'Remaining',
            fullLabel: 'Locations Remaining',
        },
        ...(showEntrancesCounter
            ? [
                  {
                      value: state.numExitsAccessible,
                      shortLabel: 'Entrances',
                      fullLabel: 'Entrances Accessible',
                      tooltip: relevantExits.length > 0 && (
                          <EntrancesTooltip exits={relevantExits} />
                      ),
                  },
              ]
            : []),
    ];

    return (
        <div className={compact ? styles.countersCompact : styles.counters}>
            {counterRows.flatMap((row) => [
                <span
                    key={`${row.shortLabel}-value`}
                    className={styles.counter}
                >
                    {row.value}
                </span>,
                <Tooltip
                    key={`${row.shortLabel}-label`}
                    content={
                        row.tooltip ? (
                            <>
                                <div>{row.fullLabel}</div>
                                <hr />
                                {row.tooltip}
                            </>
                        ) : (
                            row.fullLabel
                        )
                    }
                >
                    <span>{row.shortLabel}</span>
                </Tooltip>,
            ])}
        </div>
    );
}

function EntrancesTooltip({ exits }: { exits: ExitMapping[] }) {
    return (
        <ul>
            {exits.map((e) => (
                <li key={e.exit.id}>
                    <span className={styles.accessibleEntrance}>
                        {e.exit.name}
                    </span>
                </li>
            ))}
        </ul>
    );
}
