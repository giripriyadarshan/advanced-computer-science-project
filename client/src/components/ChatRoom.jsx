// File: src/components/ChatRoom.jsx

import {createSignal, onMount, onCleanup, createEffect} from 'solid-js';
import {useStore} from '../store';
import {createChatEventSource, sendMessage, sendHeartbeat} from '../api/chat';

export default function ChatRoom(props) {
    // If you store the token in a global store, you can grab it here:
    const [store] = useStore();
    const token = store.token; // Or props.token if you pass it in from the parent.

    // We'll store the messages in a Solid signal
    const [messages, setMessages] = createSignal([]);
    // We'll have a signal for the user's text input
    const [messageText, setMessageText] = createSignal('');

    // We'll keep a reference to our EventSource so we can close it and re-initialize it
    let eventSource;
    let heartbeatInterval;

    let x = ([]);

    // Whenever props.room changes, re-initialize the SSE source
    createEffect(() => {
        // Close the old EventSource if it exists
        if (eventSource) {
            eventSource.close();
        }

        // Create the SSE event source, scoping by the chosen room
        eventSource = createChatEventSource(token, props.room());

        // On new message, parse the JSON and filter if needed
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            // If the server sends messages for ALL rooms on the same endpoint,
            //   filter them here:
            if (data.room === props.room()) {
                setMessages((prev) => [...prev, data]);
            }
            // If the server is already returning only this room's messages,
            //   you may omit the filtering check.
        };

        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }

        heartbeatInterval = setInterval(() => {
            let room_string = props.room();
            sendHeartbeat(token, room_string).catch((err) => {
                console.error('Failed to send heartbeat:', err);
            });
        }, 5000);

        eventSource.onerror = (err) => {
            console.error('SSE error:', err);
        };
    });

    // When this component unmounts, be sure to close the SSE
    onCleanup(() => {
        if (eventSource) {
            eventSource.close();
        }

        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
    });

    // A function to send a message to the current room
    async function handleSend(e) {
        e.preventDefault();
        if (!messageText()) return;

        try {
            await sendMessage(token, props.room, messageText());
            setMessageText(''); // Clear the input
        } catch (err) {
            console.error('Failed to send message:', err);
        }
    }

    return (
        <div style={{marginLeft: '1rem'}}>
            <h2>Chat Room: {props.room}</h2>

            {/* Messages Display */}
            <div
                style={{
                    border: '1px solid #ccc',
                    height: '200px',
                    width: '300px',
                    overflowY: 'auto',
                    padding: '0.5rem',
                    marginBottom: '0.5rem',
                }}
            >
                {messages().map((msg) => (
                    msg.room === props.room() &&
                    <div>
                        <strong>
                            {/* If the server sets user_id, show it. Otherwise show a default */}
                            {msg.username ? `${msg.username}` : 'System'}
                        </strong>
                        : {msg.message}
                    </div>
                ))}
            </div>

            {/* Send Message Form */}
            <form onSubmit={handleSend}>
                <input
                    type="text"
                    value={messageText()}
                    onInput={(e) => setMessageText(e.currentTarget.value)}
                    style={{width: '200px', marginRight: '0.5rem'}}
                />
                <button type="submit">Send</button>
            </form>
        </div>
    );
}
