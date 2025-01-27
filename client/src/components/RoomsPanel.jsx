// src/components/RoomsPanel.jsx
import {createSignal, onMount, Show, For} from 'solid-js';
import {useStore} from '../store';
import {createRoom, listRooms} from '../api/chat';
import styles from './RoomsPanel.module.scss';
import '@material/web/button/filled-tonal-button.js';
import '@material/web/chips/assist-chip.js';
import '@material/web/chips/filter-chip.js';
import '@material/web/chips/chip-set.js';
import '@material/web/textfield/filled-text-field.js';

export default function RoomsPanel(props) {
    // Our global store includes the JWT token
    const [store, {addRoom}] = useStore();

    // Local signals: list of rooms, new room name input, dynamic error
    const [rooms, setRooms] = createSignal([]);
    const [roomNameInput, setRoomNameInput] = createSignal('');
    const [error, setError] = createSignal('');
    const [selectedRoom, setSelectedRoom] = createSignal('lobby');

    // Fetch existing rooms on mount
    onMount(async () => {
        try {
            // const fetchedRooms = await listRooms(store.token);
            // setRooms(fetchedRooms);
            // setRooms(['lobby']);

            let rooms = store.rooms;
            setRooms(rooms);
        } catch (err) {
            console.error('Could not list rooms:', err);
        }
    });

    async function handleCreateRoom(e) {
        e.preventDefault();
        if (!roomNameInput()) return;

        setError('');
        const newRoom = roomNameInput();

        try {
            await createRoom(store.token, newRoom);
            // If successful, add it locally
            addLocalRoomIfMissing(newRoom);
            setRoomNameInput('');
        } catch (err) {
            if (err.message.includes('409') || err.message.includes('Conflict')) {
                // If the room already exists, auto-add it to the list, no error
                addLocalRoomIfMissing(newRoom);
                setRoomNameInput('');
            } else {
                setError(err.message);
            }
        }
    }

    // Add a room to our local list if not already present
    function addLocalRoomIfMissing(r) {
        if (!rooms().includes(r)) {
            addRoom(r);
            setRooms((prev) => [...prev, r]);
        }
    }

    // The user selects a room from the list
    function handleSelectRoom(r) {
        setSelectedRoom(r);
        props.onRoomSelected?.(r);
    }


    return (
        <div class={styles["room-panel"]}>
            <h3>Rooms</h3>
            <div class={styles["room-list"]}>
                {/* LIST OF ROOMS */}
                <md-chip-set>
                    <For each={rooms()} fallback={<p>No rooms yet</p>}>
                        {(roomName) => (
                            // <div
                            //     onClick={() => handleSelectRoom(roomName)}
                            //     style={{
                            //         cursor: 'pointer',
                            //         border: '1px solid #ccc',
                            //         marginBottom: '0.5rem',
                            //         padding: '0.5rem',
                            //         borderRadius: '4px'
                            //     }}
                            // >
                            //     {roomName}
                            // </div>

                            <md-filter-chip onClick={() => handleSelectRoom(roomName)}
                                            label={roomName}
                                            selected={roomName === selectedRoom()}
                                            always-focusable="true"
                            >
                                {roomName}
                            </md-filter-chip>
                        )}
                    </For>
                </md-chip-set>

                {/* CREATE ROOM FORM */}
                <form onSubmit={handleCreateRoom}>
                    {/*<input*/}
                    {/*    type="text"*/}
                    {/*    placeholder="Enter new room name"*/}
                    {/*    value={roomNameInput()}*/}
                    {/*    onInput={(e) => setRoomNameInput(e.currentTarget.value)}*/}
                    {/*/>*/}

                    <md-filled-text-field type="text" placeholder="Enter new room name" value={roomNameInput()}
                                          onInput={(e) => setRoomNameInput(e.currentTarget.value)}
                                          required="true"
                    >

                    </md-filled-text-field>
                    {/*<button type="submit">Create Room</button>*/}
                    <md-filled-tonal-button type="submit">Create Room</md-filled-tonal-button>
                </form>

                <Show when={error()}>
                    <p style={{color: 'red'}}>{error()}</p>
                </Show>
            </div>
        </div>
    );
}
