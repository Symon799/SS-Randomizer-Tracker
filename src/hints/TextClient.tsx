import {
    memo,
    useContext,
    useEffect,
    useRef,
    useState,
    type FormEvent,
} from 'react';
import { useSelector } from 'react-redux';
import Tooltip from '../additionalComponents/Tooltip';
import type { ClientMessage, ColoredText } from '../archipelago/Archipelago';
import {
    ClientManagerContext,
    useIsApConnected,
} from '../archipelago/ClientHooks';
import { itemLocationAssignmentEnabledSelector } from '../customization/Selectors';
import { ItemAssignmentStatus } from './ItemAssignmentStatus';
import styles from './TextClient.module.css';

const getColorStyle = (ctxt: ColoredText) => {
    if (ctxt.customColor) return { color: ctxt.customColor };
    if (ctxt.color) return { color: `var(--scheme-${ctxt.color})` };
    return {};
};

const renderMessage = (msg: ClientMessage) =>
    msg.map((ctxt, idx) => (
        <Tooltip
            disabled={ctxt.tooltip === undefined}
            content={ctxt.tooltip}
            placement="bottom"
            key={idx}
        >
            <span
                style={{
                    cursor: 'default',
                    ...getColorStyle(ctxt),
                }}
            >
                {ctxt.text}
            </span>
        </Tooltip>
    ));

function useApMessages() {
    const clientManager = useContext(ClientManagerContext);
    const [messages, setMessages] = useState<ClientMessage[]>([]);

    useEffect(() => {
        clientManager?.setOnMessage((msgs: ClientMessage[]) =>
            setMessages([...msgs]),
        );
        return () => {
            clientManager?.setOnMessage(() => []);
        };
    }, [clientManager]);

    return messages;
}

// separate the list of messages so it only re-renders when new messages come in
const MessageList = memo(function MessageList({
    compact = false,
}: {
    compact?: boolean;
}) {
    const lastItem = useRef<HTMLLIElement>(null);
    const messages = useApMessages();

    useEffect(() => {
        lastItem.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <ul
            className={`${styles.apMessages} ${compact ? styles.apMessagesCompact : ''}`}
        >
            {messages.map((msg, idx) => {
                const isLast = idx === messages.length - 1;
                return (
                    <li key={idx} ref={isLast ? lastItem : undefined}>
                        {renderMessage(msg)}
                    </li>
                );
            })}
        </ul>
    );
});

export const CompactTextClient = memo(function CompactTextClient() {
    return (
        <div className={styles.compactTextClient}>
            <MessageList compact />
        </div>
    );
});

// Text client with color-coded nodes and tooltips to mirror that of the CommonClient
export const TextClient = memo(function TextClient() {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const autoItemAssignemt = useSelector(
        itemLocationAssignmentEnabledSelector,
    );
    const clientManager = useContext(ClientManagerContext);
    const isConnected = useIsApConnected();

    const sendMessage = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const currMsg = inputRef.current?.value ?? '';
        if (currMsg) {
            clientManager?.sendMessage(currMsg);
            if (inputRef.current) {
                inputRef.current.value = '';
            }
        }
    };

    return (
        <div className={styles.textClient}>
            <MessageList />
            <form onSubmit={sendMessage}>
                <input
                    ref={inputRef}
                    type="text"
                    className="tracker-input"
                    disabled={!isConnected}
                    placeholder="Enter a command here"
                    defaultValue=""
                />
            </form>
            {autoItemAssignemt && <ItemAssignmentStatus />}
        </div>
    );
});
