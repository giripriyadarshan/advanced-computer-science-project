import {createSignal, Show} from 'solid-js';
import {useStore} from '../store';
import {loginUser, registerUser} from '../api/auth';
import {createRoom} from "../api/chat.js";

export default function LoginForm(props) {
    const [store, {setToken, setUser, addRoom}] = useStore();
    const [username, setUsername] = createSignal('');
    const [password, setPassword] = createSignal('');
    const [fullName, setFullName] = createSignal('');
    const [mode, setMode] = createSignal('login'); // or 'register'
    const [error, setError] = createSignal('');

    async function handleLoginOrRegister(e) {
        e.preventDefault();
        try {
            if (mode() === 'register') {
                await registerUser(fullName(), username(), password());
                // Optionally immediately log in after successful registration
            }
            const token = await loginUser(username(), password());
            setToken(token);
            setUser({username: username()});
            setError('');
            try {
                await createRoom(token, 'lobby');
            } catch (_) {
                // Ignore if the room already exists
            }
            addRoom('lobby');
            props.onLogin?.();
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <div>
            <h2>{mode() === 'login' ? 'Login' : 'Register'}</h2>
            <form onSubmit={handleLoginOrRegister}>
                <Show when={mode() === 'register'}>
                    <div>
                        <label>Full Name: </label>
                        <input
                            type="text"
                            value={fullName()}
                            onInput={(e) => setFullName(e.currentTarget.value)}
                            required
                        />
                    </div>
                </Show>
                <div>
                    <label>Username: </label>
                    <input
                        type="text"
                        value={username()}
                        onInput={(e) => setUsername(e.currentTarget.value)}
                        required
                    />
                </div>
                <div>
                    <label>Password: </label>
                    <input
                        type="password"
                        value={password()}
                        onInput={(e) => setPassword(e.currentTarget.value)}
                        required
                    />
                </div>
                <button type="submit">Submit</button>
            </form>
            <button onClick={() => setMode(mode() === 'login' ? 'register' : 'login')}>
                Switch to {mode() === 'login' ? 'Register' : 'Login'}
            </button>
            <Show when={error()}>
                <p style={{color: 'red'}}>{error()}</p>
            </Show>
        </div>
    );
}
