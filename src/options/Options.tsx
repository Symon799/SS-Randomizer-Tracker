import clsx from 'clsx';
import {
    type Dispatch,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    ClientManagerContext,
    useApConnectionStatus,
    useApConnectionStatusString,
    useApRequiredDungeonDiagnostic,
    useIsApConnected,
} from '../archipelago/ClientHooks';
import { debugModeSelector } from '../customization/Selectors';
import { setDebugMode } from '../customization/Slice';
import { LOCAL_SSHD_STRING } from '../loader/LogicLoader';
import {
    getStoredArchipelagoServer,
    getStoredArchipelagoSlot,
} from '../LocalStorage';
import { loadLogic } from '../logic/Slice';
import type { OptionDefs } from '../permalink/SettingsTypes';
import { useAppDispatch } from '../store/Store';
import { acceptSettings, reset } from '../tracker/Slice';
import Acknowledgement from './Acknowledgment';
import styles from './Options.module.css';
import {
    type LoadingState,
    type OptionsAction,
    useOptionsState,
} from './OptionsReducer';

const SSHD_REMOTE = { type: 'localSshd' } as const;

export default function Options() {
    const {
        counters,
        dispatch,
        loaded,
        loadingState,
        settings,
        selectedRemote,
    } = useOptionsState();
    const appDispatch = useAppDispatch();
    const navigate = useNavigate();
    const isClientConnected = useIsApConnected();

    useEffect(() => {
        if (selectedRemote.type !== 'localSshd') {
            dispatch({ type: 'selectRemote', remote: SSHD_REMOTE });
        }
    }, [dispatch, selectedRemote.type]);

    const launch = useCallback(
        (shouldReset?: boolean) => {
            if (!loaded || !settings) {
                return;
            }
            appDispatch(loadLogic(loaded));
            if (shouldReset) {
                appDispatch(reset({ settings }));
            } else {
                appDispatch(acceptSettings({ settings }));
            }
            navigate('/tracker');
        },
        [appDispatch, loaded, navigate, settings],
    );

    return (
        <div className={styles.optionsPage}>
            <h1>Skyward Sword HD AP Tracker</h1>
            <div className={styles.logicAndPermalink}>
                <LogicStatusCard loadingState={loadingState} />
                <ConnectionCard options={loaded?.options} dispatch={dispatch} />
            </div>
            <LaunchButtons
                counters={counters}
                loaded={Boolean(loaded)}
                launch={launch}
                clientConnected={isClientConnected}
            />
            <div
                className={clsx(
                    styles.optionsCategory,
                    styles.permalinkChooser,
                )}
            >
                <legend>Run Behavior</legend>
                <div className={styles.connectionNote}>
                    This SSHD-only build loads logic and settings from
                    Archipelago. Manual release selection and manual run
                    settings are intentionally disabled.
                </div>
                <div className={styles.connectionNote}>
                    The only setting that may still need manual input is the
                    required dungeon selection, because the SSHD AP world does
                    not currently expose the selected dungeon list in
                    <code> slot_data</code>.
                </div>
            </div>
            <hr />
            <Acknowledgement />
        </div>
    );
}

function LogicStatusCard({
    loadingState,
}: {
    loadingState: LoadingState | undefined;
}) {
    return (
        <div className={clsx(styles.optionsCategory, styles.logicChooser)}>
            <legend>Randomizer Version</legend>
            <div className={styles.connectionStatus}>
                {`Fixed to ${LOCAL_SSHD_STRING}`}
            </div>
            <div className={styles.connectionNote}>
                This tracker now targets Skyward Sword HD only.
            </div>
            <LoadingStateIndicator loadingState={loadingState} />
        </div>
    );
}

function LaunchButtons({
    loaded,
    counters,
    launch,
    clientConnected,
}: {
    loaded: boolean;
    counters:
        | { numChecked: number; numAccessible: number; numRemaining: number }
        | undefined;
    launch: (shouldReset?: boolean) => void;
    clientConnected: boolean;
}) {
    const canStart = loaded;
    const canResume = loaded && Boolean(counters);

    const confirmLaunch = useCallback(
        (shouldReset?: boolean) => {
            const allow =
                !shouldReset ||
                (canStart &&
                    (!canResume ||
                        window.confirm(
                            'Reset your tracker and start a new run?',
                        )));
            if (allow) {
                launch(shouldReset);
            }
        },
        [canResume, canStart, launch],
    );

    return (
        <div className={styles.launchButtons}>
            <button
                type="button"
                className="tracker-button"
                disabled={!canResume || !clientConnected}
                onClick={() => confirmLaunch()}
            >
                <div className={styles.continueButton}>
                    <span>Continue Tracker</span>
                    <span className={styles.counters}>
                        {counters &&
                            `${counters.numChecked}/${counters.numRemaining}`}
                    </span>
                </div>
            </button>
            <button
                type="button"
                className="tracker-button"
                disabled={!canStart || !clientConnected}
                onClick={() => confirmLaunch(true)}
            >
                Launch New Tracker
            </button>
        </div>
    );
}

function ConnectionCard({
    options,
    dispatch,
}: {
    options: OptionDefs | undefined;
    dispatch: Dispatch<OptionsAction>;
}) {
    const storedServer = getStoredArchipelagoServer();
    const storedSlot = getStoredArchipelagoSlot();
    const clientManager = useContext(ClientManagerContext);
    const appDispatch = useAppDispatch();
    const [server, setServer] = useState(
        storedServer ?? 'archipelago.gg:XXXXX',
    );
    const [inputSlot, setInputSlot] = useState(storedSlot ?? '');
    const [inputPassword, setInputPassword] = useState('');
    const apStatus = useApConnectionStatus();
    const apStatusString = useApConnectionStatusString();
    const requiredDungeonDiagnostic = useApRequiredDungeonDiagnostic();
    const debugMode = useSelector(debugModeSelector);
    const isConnected = apStatus.state === 'loggedIn';
    const canConnect = options !== undefined && apStatus.state !== 'loggingIn';

    const connectToArchipelago = () => {
        if (!options) {
            return;
        }
        clientManager
            ?.login(server, inputSlot, inputPassword, options)
            .then((connected) => {
                if (connected) {
                    dispatch({
                        type: 'changeSettings',
                        settings: clientManager.getLoadedSettings()!,
                    });
                }
            });
    };

    const disconnectFromArchipelago = () => {
        clientManager?.resetClient();
    };

    return (
        <div className={clsx(styles.optionsCategory, styles.permalinkChooser)}>
            <legend>Archipelago Connection</legend>
            <div className={styles.permalinkInput}>
                <input
                    type="text"
                    className="tracker-input"
                    disabled={isConnected}
                    placeholder="archipelago.gg:XXXXX"
                    value={server ?? ''}
                    onChange={(e) => setServer(e.target.value)}
                />
                <input
                    type="text"
                    className="tracker-input"
                    placeholder="Slot name"
                    disabled={isConnected}
                    value={
                        apStatus.state === 'loggedIn'
                            ? apStatus.slotName
                            : inputSlot || ''
                    }
                    onChange={(e) => setInputSlot(e.target.value)}
                />
                <input
                    type="text"
                    className="tracker-input"
                    placeholder="Password (optional)"
                    disabled={isConnected}
                    value={inputPassword}
                    onChange={(e) => setInputPassword(e.target.value)}
                />
            </div>
            <div className={styles.connectionStatus}>
                {apStatus.state === 'loggedOut' && !apStatus.error
                    ? 'Connect to Archipelago to load the SSHD seed settings.'
                    : apStatusString}
            </div>
            <div className={styles.connectionActions}>
                <button
                    type="button"
                    className="tracker-button"
                    disabled={!canConnect}
                    onClick={connectToArchipelago}
                >
                    Connect
                </button>
                <button
                    type="button"
                    className="tracker-button"
                    disabled={!isConnected && apStatus.state !== 'loggingIn'}
                    onClick={disconnectFromArchipelago}
                >
                    Disconnect
                </button>
                <button
                    type="button"
                    className="tracker-button"
                    onClick={() => appDispatch(setDebugMode(!debugMode))}
                >
                    {debugMode ? 'Debug On' : 'Debug Off'}
                </button>
            </div>
            {debugMode && isConnected && requiredDungeonDiagnostic && (
                <div className={styles.connectionNote}>
                    <div>
                        <strong>Required dungeons diagnostic:</strong>{' '}
                        {requiredDungeonDiagnostic.verdict}
                    </div>
                    <div>
                        <strong>`required_dungeons` raw value:</strong>{' '}
                        <code>
                            {JSON.stringify(
                                requiredDungeonDiagnostic.requiredDungeonsRaw,
                            )}
                        </code>
                    </div>
                    <div>
                        <strong>Matching keys in `slot_data`:</strong>{' '}
                        <code>
                            {requiredDungeonDiagnostic.keysContainingRequired
                                .length > 0
                                ? requiredDungeonDiagnostic.keysContainingRequired.join(
                                      ', ',
                                  )
                                : '(none)'}
                        </code>
                    </div>
                </div>
            )}
            <div className={styles.connectionNote}>
                Settings are loaded automatically from Archipelago. Manual run
                settings are disabled in this build.
            </div>
        </div>
    );
}

function LoadingStateIndicator({
    loadingState,
}: {
    loadingState: LoadingState | undefined;
}) {
    return (
        <div className={styles.loadingState}>
            <span>
                {loadingState?.type === 'loading'
                    ? 'Loading SSHD logic...'
                    : loadingState
                      ? `❌ ${loadingState.error}`
                      : 'SSHD logic ready'}
            </span>
        </div>
    );
}
