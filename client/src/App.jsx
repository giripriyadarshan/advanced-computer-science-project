import {createSignal, Show} from 'solid-js';
import {useStore} from './store';
import LoginForm from './components/LoginForm';
import ChatRoom from './components/ChatRoom';
import RoomsPanel from "./components/RoomsPanel.jsx";
import styles from './App.module.css';
import '@material/web/button/elevated-button.js';

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
        <div class={styles["main-div"]}>
            <Show when={isLoggedIn()} fallback={<LoginForm onLogin={() => setIsLoggedIn(true)}/>}>
                <div class={styles["chat-window"]}>
                    <RoomsPanel onRoomSelected={handleRoomSelected}/>
                    <ChatRoom room={selectedRoom}/>
                    {/*<button class={styles["logout-button"]} onClick={logoutClicked}>Logout</button>*/}
                    <md-elevated-button onClick={logoutClicked} class={styles["logout-button"]}>Logout
                    </md-elevated-button>
                </div>
            </Show>
        </div>
    );
}
