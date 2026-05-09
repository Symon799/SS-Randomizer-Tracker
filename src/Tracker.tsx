import { useContext, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate } from 'react-router-dom';
import {
    ClientManagerContext,
    useApConnectionStatus,
    useApConnectionStatusString,
    useApRequiredDungeonDiagnostic,
} from './archipelago/ClientHooks';
import { buildSshdApLocationResolver } from './archipelago/locationMapping';
import BasicCounters from './BasicCounters';
import CustomizationModal from './customization/CustomizationModal';
import {
    autoRegionLoadingSelector,
    debugModeSelector,
    hasCustomLayoutSelector,
} from './customization/Selectors';
import { setDebugMode } from './customization/Slice';
import stageToRegion from './data/stageToRegion.json';
import { DragAndDropContext } from './dragAndDrop/DragAndDrop';
import EntranceTracker from './entranceTracker/EntranceTracker';
import { TextClient } from './hints/TextClient';
import { ExportButton, ExportUtSnapshotButton } from './ImportExport';
import { TrackerLayoutCustom } from './layouts/TrackerLayoutCustom';
import { TrackerLayout } from './layouts/TrackerLayouts';
import { useSyncTrackerStateToLocalStorage } from './LocalStorage';
import LocationContextMenu from './locationTracker/LocationContextMenu';
import LocationGroupContextMenu from './locationTracker/LocationGroupContextMenu';
import { isLogicLoadedSelector, logicSelector } from './logic/Selectors';
import { getInitialItems } from './logic/TrackerModifications';
import { MakeTooltipsAvailable } from './tooltips/TooltipHooks';
import styles from './Tracker.module.css';
import { settingsSelector } from './tracker/Selectors';
import {
    replaceCheckedChecks,
    replaceItemCounts,
    // clickDungeonName,
    setApLocationCounts,
    setRequiredDungeons,
    type TrackerState,
} from './tracker/Slice';
import { useTrackerInterfaceReducer } from './tracker/TrackerInterfaceReducer';
// import { requiredDungeonsSelector } from './tracker/Selectors';
// import type { RegularDungeon } from './logic/Locations';

export default function TrackerContainer() {
    const logicLoaded = useSelector(isLogicLoadedSelector);

    // If we haven't loaded logic yet, redirect to the main menu,
    // which will take care of loading logic for us.
    if (!logicLoaded) {
        return <Navigate to="/" />;
    }

    return (
        <MakeTooltipsAvailable>
            <DragAndDropContext>
                <Tracker />
            </DragAndDropContext>
            <TrackerStateSaver />
        </MakeTooltipsAvailable>
    );
}

// Split out into separate component to optimize rerenders
function TrackerStateSaver() {
    useSyncTrackerStateToLocalStorage();
    return null;
}

function Tracker() {
    const [activeView, setActiveView] = useState<'tracker' | 'server'>(
        'tracker',
    );
    const [showCustomizationDialog, setShowCustomizationDialog] =
        useState(false);
    const [showEntranceDialog, setShowEntranceDialog] = useState(false);

    return (
        <>
            <div className={styles.shell}>
                <div className={styles.mainArea}>
                    {activeView === 'tracker' ? (
                        <TrackerContents
                            openTools={() => setActiveView('server')}
                        />
                    ) : (
                        <TrackerToolsView
                            closeTools={() => setActiveView('tracker')}
                            openCustomization={() =>
                                setShowCustomizationDialog(true)
                            }
                            openEntrances={() => setShowEntranceDialog(true)}
                        />
                    )}
                </div>
            </div>
            <CustomizationModal
                open={showCustomizationDialog}
                onOpenChange={setShowCustomizationDialog}
            />
            <EntranceTracker
                open={showEntranceDialog}
                onOpenChange={setShowEntranceDialog}
            />
        </>
    );
}

function TrackerContents({ openTools }: { openTools: () => void }) {
    const logic = useSelector(logicSelector);
    const [trackerInterfaceState, trackerInterfaceDispatch] =
        useTrackerInterfaceReducer();

    const hasCustomLayout = useSelector(hasCustomLayoutSelector);
    const dispatch = useDispatch();
    const clientManager = useContext(ClientManagerContext);
    const autoRegionLoading = useSelector(autoRegionLoadingSelector);
    const trackerSettings = useSelector((state: { tracker: TrackerState }) => {
        return state.tracker.settings;
    });
    const seenUnmappedApLocations = useRef<Set<string>>(new Set());
    const autotrackedChecks = useRef<{
        locations: Set<string>;
    }>({
        locations: new Set(),
    });
    // const reqDungeons = useSelector(requiredDungeonsSelector);

    // Configure the AP client for auto-tracking
    useEffect(() => {
        const resolveApLocation = buildSshdApLocationResolver(logic);

        const clientLocationCallback = (locs: string[]) => {
            const mappedChecks: string[] = [];
            const newlyUnmappedLocations: string[] = [];

            for (const loc of locs) {
                const trackerCheck = resolveApLocation(loc);
                if (trackerCheck !== undefined) {
                    mappedChecks.push(trackerCheck);
                } else if (!seenUnmappedApLocations.current.has(loc)) {
                    seenUnmappedApLocations.current.add(loc);
                    newlyUnmappedLocations.push(loc);
                }
            }

            if (newlyUnmappedLocations.length > 0) {
                console.warn(
                    'Unmapped SSHD AP locations:',
                    newlyUnmappedLocations,
                );
            }
            autotrackedChecks.current.locations = new Set(mappedChecks);
            dispatch(
                replaceCheckedChecks([...autotrackedChecks.current.locations]),
            );
        };

        const clientCubeCallback = (cubeflags: number) => {
            // Legacy AP worlds may still send an auxiliary cube bitfield.
            // SSHD AP 0.6.x already exposes cube strikes as regular AP locations,
            // so checked_locations is the authoritative source and this callback
            // only remains as a harmless compatibility hook.
            void cubeflags;
        };

        const clientItemCallback = (inv: TrackerState['inventory']) => {
            const mergedInventory = getInitialItems(
                trackerSettings as Parameters<typeof getInitialItems>[0],
            );
            for (const [item, count] of Object.entries(inv)) {
                mergedInventory[item] =
                    (mergedInventory[item] ?? 0) + (count ?? 0);
            }
            dispatch(
                replaceItemCounts(
                    Object.entries(mergedInventory).map(([item, count]) => ({
                        item,
                        count: count ?? 0,
                    })),
                ),
            );
        };

        const stageCallback = (stage: string) => {
            if (autoRegionLoading) {
                const region =
                    stageToRegion[stage as keyof typeof stageToRegion];
                if (region !== undefined) {
                    trackerInterfaceDispatch({
                        type: 'selectHintRegion',
                        hintRegion: region,
                    });
                }
            }
        };

        const requiredDungeonsCallback = (dungeons: string[]) => {
            dispatch(setRequiredDungeons({ dungeons }));
        };

        const locationStatsCallback = (stats: {
            total?: number;
            checked: number;
        }) => {
            dispatch(
                setApLocationCounts({
                    total: stats.total,
                    checked: stats.checked,
                }),
            );
        };

        clientManager?.setLocationCallback(clientLocationCallback);
        clientManager?.setItemCallback(clientItemCallback);
        clientManager?.setNewStageCallback(stageCallback);
        clientManager?.setRequiredDungeonsCallback(requiredDungeonsCallback);
        clientManager?.setLocationStatsCallback(locationStatsCallback);
        clientManager?.setCubeCallback(clientCubeCallback);
        /* This will have to happen somewhere else to work properly
        if (clientManager !== undefined) {
            for (const dungeonName of clientManager!.requiredDungeons) {
                const dungeon = dungeonName as RegularDungeon;
                if (dungeon !== undefined && !reqDungeons.includes(dungeon)) {
                    dispatch(clickDungeonName({dungeonName: dungeon}));
                }
            }
        } */
    }, [
        dispatch,
        logic,
        clientManager,
        autoRegionLoading,
        trackerInterfaceDispatch,
        trackerSettings,
    ]);

    return (
        <>
            <LocationContextMenu />
            <LocationGroupContextMenu
                interfaceDispatch={trackerInterfaceDispatch}
            />
            {hasCustomLayout ? (
                <TrackerLayoutCustom
                    footerContent={<TrackerFooterNav openTools={openTools} />}
                    interfaceDispatch={trackerInterfaceDispatch}
                    interfaceState={trackerInterfaceState}
                />
            ) : (
                <TrackerLayout
                    footerContent={<TrackerFooterNav openTools={openTools} />}
                    interfaceDispatch={trackerInterfaceDispatch}
                    interfaceState={trackerInterfaceState}
                />
            )}
        </>
    );
}

function TrackerToolsView({
    closeTools,
    openCustomization,
    openEntrances,
}: {
    closeTools: () => void;
    openCustomization: () => void;
    openEntrances: () => void;
}) {
    const dispatch = useDispatch();
    const debugMode = useSelector(debugModeSelector);
    const settings = useSelector(settingsSelector) as Record<
        string,
        string | number | boolean | string[] | undefined
    >;
    const requiredDungeonDiagnostic = useApRequiredDungeonDiagnostic();

    const canUseEntrances = [
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

    return (
        <div className={styles.toolsLayout}>
            <div className={styles.toolsSidebar}>
                <div className={styles.toolsOverviewCard}>
                    <div className={styles.toolsSection}>
                        <div className={styles.toolsTitle}>Session</div>
                        <div className={styles.toolsCountersCentered}>
                            <BasicCounters embedded fullLabels />
                        </div>
                    </div>
                </div>
                <div className={styles.toolsCard}>
                    <div className={styles.toolsSection}>
                        <div className={styles.toolsTitle}>Tools</div>
                        <div className={styles.toolsButtons}>
                            <ExportButton />
                            <ExportUtSnapshotButton />
                            {canUseEntrances && (
                                <button
                                    type="button"
                                    className="tracker-button"
                                    onClick={openEntrances}
                                >
                                    Entrances
                                </button>
                            )}
                            <button
                                type="button"
                                className="tracker-button"
                                onClick={openCustomization}
                            >
                                Customization
                            </button>
                            <button
                                type="button"
                                className="tracker-button"
                                onClick={() =>
                                    dispatch(setDebugMode(!debugMode))
                                }
                            >
                                {debugMode ? 'Debug On' : 'Debug Off'}
                            </button>
                        </div>
                    </div>
                </div>
                {debugMode && requiredDungeonDiagnostic && (
                    <div className={styles.toolsCard}>
                        <div className={styles.toolsSection}>
                            <div className={styles.toolsTitle}>Debug</div>
                            <div className={styles.debugStack}>
                                <div className={styles.debugLine}>
                                    <strong>
                                        Required dungeons diagnostic:
                                    </strong>{' '}
                                    {requiredDungeonDiagnostic.verdict}
                                </div>
                                <div className={styles.debugLine}>
                                    <strong>
                                        `required_dungeons` raw value:
                                    </strong>{' '}
                                    <code>
                                        {JSON.stringify(
                                            requiredDungeonDiagnostic.requiredDungeonsRaw,
                                        )}
                                    </code>
                                </div>
                                <div className={styles.debugLine}>
                                    <strong>
                                        Matching keys in `slot_data`:
                                    </strong>{' '}
                                    <code>
                                        {requiredDungeonDiagnostic
                                            .keysContainingRequired.length > 0
                                            ? requiredDungeonDiagnostic.keysContainingRequired.join(
                                                  ', ',
                                              )
                                            : '(none)'}
                                    </code>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <ToolsFooterNav closeTools={closeTools} />
            </div>
            <div className={styles.toolsLogPane}>
                <div className={styles.toolsLogHeader}>
                    <div className={styles.toolsTitle}>Server Log</div>
                    <div className={styles.logHeaderNote}>
                        Archipelago messages and commands
                    </div>
                </div>
                <div className={styles.logClientWrap}>
                    <TextClient />
                </div>
            </div>
        </div>
    );
}

function FooterStatusBlock({
    primaryAction,
    secondaryAction,
}: {
    primaryAction: React.ReactNode;
    secondaryAction: React.ReactNode;
}) {
    return (
        <div className={styles.footerNav}>
            <div className={styles.footerNavRow}>
                <div className={styles.footerNavButtons}>
                    {primaryAction}
                    {secondaryAction}
                </div>
                <TrackerStatusLine />
            </div>
        </div>
    );
}

function TrackerFooterNav({ openTools }: { openTools: () => void }) {
    return (
        <FooterStatusBlock
            primaryAction={
                <button
                    type="button"
                    className={`${styles.iconButton} tracker-button`}
                    onClick={openTools}
                    aria-label="Open Server and Tools"
                    title="Server & Tools"
                >
                    ⚙
                </button>
            }
            secondaryAction={
                <Link
                    to="/"
                    className={`${styles.footerLinkReset} ${styles.footerIconLink}`}
                    aria-label="Connect"
                    title="Connect"
                >
                    <div className={`${styles.iconButton} tracker-button`}>
                        🔌
                    </div>
                </Link>
            }
        />
    );
}

function ToolsFooterNav({ closeTools }: { closeTools: () => void }) {
    return (
        <FooterStatusBlock
            primaryAction={
                <button
                    type="button"
                    className={`${styles.iconButton} tracker-button`}
                    onClick={closeTools}
                    aria-label="Tracker"
                    title="Tracker"
                >
                    ▣
                </button>
            }
            secondaryAction={
                <Link
                    to="/"
                    className={`${styles.footerLinkReset} ${styles.footerIconLink}`}
                    aria-label="Connect"
                    title="Connect"
                >
                    <div className={`${styles.iconButton} tracker-button`}>
                        🔌
                    </div>
                </Link>
            }
        />
    );
}

function TrackerStatusLine() {
    const status = useApConnectionStatus();
    const statusString = useApConnectionStatusString();
    const shortStatus =
        status.state === 'loggedIn'
            ? `${status.serverName} as ${status.slotName}`
            : statusString;
    return <div className={styles.footerStatus}>{shortStatus}</div>;
}
