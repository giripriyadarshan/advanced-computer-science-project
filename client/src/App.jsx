import {createSignal, Show} from 'solid-js';
import {useStore} from './store';
import LoginForm from './components/LoginForm';
import ChatRoom from './components/ChatRoom';
import RoomsPanel from "./components/RoomsPanel.jsx";

export default function App() {
    const [store, {logout}] = useStore();
    const [isLoggedIn, setIsLoggedIn] = createSignal(!!store.token);

    // Whenever the token changes in our store, update the "isLoggedIn" signal
    // so we can show/hide the ChatRoom or LoginForm.
    // This can also be done via an effect in store.js if desired.
    const [selectedRoom, setSelectedRoom] = createSignal('lobby');

    function handleRoomSelected(roomName) {
        setSelectedRoom(roomName);
    }

    const logoutClicked = () => {
        logout();
        setIsLoggedIn(false);
    }


    return (
        <div>
            <Show when={isLoggedIn()} fallback={<LoginForm onLogin={() => setIsLoggedIn(true)}/>}>
                <div style={{display: 'flex', flexDirection: 'row'}}>
                    <RoomsPanel onRoomSelected={handleRoomSelected}/>
                    <ChatRoom room={selectedRoom}/>
                    <button classList={["logout-button"]} onClick={logoutClicked}>Logout</button>
                </div>
            </Show>
        </div>
    );
}
