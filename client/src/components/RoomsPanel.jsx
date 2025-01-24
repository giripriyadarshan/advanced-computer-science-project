// src/components/RoomsPanel.jsx
import {createSignal, onMount, Show, For} from 'solid-js';
import {useStore} from '../store';
import {createRoom, listRooms} from '../api/chat';

export default function RoomsPanel(props) {
    // Our global store includes the JWT token
    const [store, {addRoom}] = useStore();

    // Local signals: list of rooms, new room name input, dynamic error
    const [rooms, setRooms] = createSignal([]);
    const [roomNameInput, setRoomNameInput] = createSignal('');
    const [error, setError] = createSignal('');

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
        props.onRoomSelected?.(r);
    }

    return (
        <div style={{border: '1px solid #ccc', padding: '1rem'}}>
            <h3>Rooms</h3>

            {/* CREATE ROOM FORM */}
            <form onSubmit={handleCreateRoom} style={{marginBottom: '1rem'}}>
                <input
                    type="text"
                    placeholder="Enter new room name"
                    value={roomNameInput()}
                    onInput={(e) => setRoomNameInput(e.currentTarget.value)}
                />
                <button type="submit">Create Room</button>
            </form>

            <Show when={error()}>
                <p style={{color: 'red'}}>{error()}</p>
            </Show>

            {/* LIST OF ROOMS */}
            <For each={rooms()} fallback={<p>No rooms yet</p>}>
                {(roomName) => (
                    <div
                        onClick={() => handleSelectRoom(roomName)}
                        style={{
                            cursor: 'pointer',
                            border: '1px solid #ccc',
                            marginBottom: '0.5rem',
                            padding: '0.5rem',
                            borderRadius: '4px'
                        }}
                    >
                        {roomName}
                    </div>
                )}
            </For>
        </div>
    );
}
