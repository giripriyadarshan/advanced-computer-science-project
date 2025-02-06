import {createSignal, onMount, onCleanup, createEffect} from 'solid-js';
import {useStore} from '../store';
import {createChatEventSource, sendMessage, sendHeartbeat} from '../api/chat';
import styles from './ChatRoom.module.scss';
import '@material/web/button/outlined-button.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/dialog/dialog.js';
import '@material/web/iconbutton/icon-button.js';
import UserDetail from "./UserDetail.jsx";

export default function ChatRoom(props) {
    // If you store the token in a global store, you can grab it here:
    const [store] = useStore();
    const token = store.token; // Or props.token if you pass it in from the parent.

    // We'll store the messages in a Solid signal
    const [messages, setMessages] = createSignal([]);
    // We'll have a signal for the user's text input
    const [messageText, setMessageText] = createSignal('');

    const [selectedUser, setSelectedUser] = createSignal(null);

    // We'll keep a reference to our EventSource so we can close it and re-initialize it
    let eventSource;
    let heartbeatInterval;
    let formRef;


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
                scrollToBottom();
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
            document.getElementById('chatFormInput').focus();
            scrollToBottom();
        } catch (err) {
            console.error('Failed to send message:', err);
        }
    }

    function handleInput(e) {
        if (e.key === 'Enter') {
            document.getElementById('chatFormSubmit').click();
            if (e.currentTarget.value === '') {
                document.getElementById('chatFormInput').focus();
            }
        }
    }

    function scrollToBottom() {
        let messageDisplay = document.getElementById('message-display');
        messageDisplay.scrollTop = messageDisplay.scrollHeight;
    }

    return (
        <div class={styles["chat-div"]}>
            <h2>Chat Room: {props.room}</h2>

            <div>
                {/* Messages Display */}
                <div class={styles["message-container"]} id={"message-display"}>
                    {messages().map((msg) => (
                        msg.room === props.room() &&
                        <div>
                            <strong
                                onClick={
                                    () => {
                                        setSelectedUser(msg.username)
                                    }
                                }
                                class={`${msg.username === store.user ? styles["own-username"] : ""}`}
                            >
                                {/* If the server sets user_id, show it. Otherwise show a default */}
                                {msg.username ? `${msg.username}` : 'System'}
                            </strong>
                            : {msg.message}
                        </div>
                    ))}
                </div>

                {/* Send Message Form */}
                <form onSubmit={handleSend} ref={formRef} id="chatForm">
                    <md-outlined-text-field type="text"
                                            value={messageText()}
                                            onkeypress={(e) => handleInput(e)}
                                            onInput={(e) => setMessageText(e.currentTarget.value)}
                                            label="Message"
                                            id="chatFormInput">
                    </md-outlined-text-field>
                    <md-outlined-button type="submit" id="chatFormSubmit">Send</md-outlined-button>
                </form>
            </div>

            {/* User Details */}
            <md-dialog open={selectedUser()} tabIndex="-1">
                    <span slot={"headline"} tabIndex="2">
                       <span> User Details: {selectedUser()}</span>
                        <md-icon-button form="user-details-form" value="close" aria-label="Close dialog"
                                        tabIndex="3"
                                        onClick={() => setSelectedUser(null)}>
                                            <svg xmlns="http://www.w3.org/2000/svg" height="24px"
                                                 viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path
                                                d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
                        </md-icon-button>
                    </span>
                <form slot="content" method="dialog" id={"user-details-form"} tabIndex="-1">
                    <UserDetail username={selectedUser()}/>
                </form>
            </md-dialog>


        </div>
    );
}
