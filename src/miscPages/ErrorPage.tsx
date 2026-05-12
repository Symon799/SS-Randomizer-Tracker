import DiscordButton from '../additionalComponents/DiscordButton';
import { ExportButton } from '../ImportExport';

export default function ErrorPage({
    error,
    resetErrorBoundary,
}: {
    error: unknown;
    resetErrorBoundary: () => void;
}) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return (
        <div>
            <div>
                Something went wrong. Try reloading the page, exporting your
                tracker state, or resetting the tracker.
            </div>
            <pre style={{ color: 'red' }}>{errorMsg}</pre>
            <div>
                We would appreciate a bug report with an attached tracker export
                and a screenshot of the browser console (
                <code>Ctrl+Shift+J</code>)
            </div>
            <div>
                <DiscordButton />
            </div>
            <br />
            <div style={{ display: 'flex', gap: 4 }}>
                <ExportButton />
                <button
                    type="button"
                    className="tracker-button"
                    onClick={() => window.location.reload()}
                >
                    Reload Page
                </button>
                <button
                    type="button"
                    className="tracker-button"
                    onClick={() => resetErrorBoundary()}
                >
                    Try Again
                </button>
            </div>
            {error instanceof Error && error.stack ? (
                <pre style={{ color: 'red' }}>{error.stack}</pre>
            ) : undefined}
        </div>
    );
}
