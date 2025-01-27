import {createSignal, Show} from 'solid-js';
import {useStore} from '../store';
import {loginUser, registerUser} from '../api/auth';
import {createRoom} from "../api/chat.js";
import {jwtDecode} from "jwt-decode";
import styles from './LoginForm.module.scss';
import '@material/web/button/outlined-button.js';
import '@material/web/button/filled-button.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';

export default function LoginForm(props) {
    const [store, {setToken, setUser, addRoom}] = useStore();
    const [username, setUsername] = createSignal('');
    const [password, setPassword] = createSignal('');
    const [fullName, setFullName] = createSignal('');
    const [mode, setMode] = createSignal('login'); // or 'register'
    const [error, setError] = createSignal('');
    let passwordRef;

    async function handleLoginOrRegister(e) {
        e.preventDefault();
        try {
            if (mode() === 'register') {
                await registerUser(fullName(), username(), password());
            }
            const token = await loginUser(username(), password());
            const decoded = jwtDecode(token);
            setToken(token);
            setUser(decoded.username);
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

    function handlePasswordToggle(e) {
        e.preventDefault();
        passwordRef.type = passwordRef.type === 'password' ? 'text' : 'password';
    }

    return (

        <div class={styles.formdiv}>
            <h2>{mode() === 'login' ? 'Login' : 'Register'}</h2>
            <form onSubmit={handleLoginOrRegister} id={"loginForm"}>
                <Show when={mode() === 'register'}>
                    <div>
                        {/*<label>Full Name: </label>*/}
                        {/*<input*/}
                        {/*    type="text"*/}
                        {/*    value={fullName()}*/}
                        {/*    onInput={(e) => setFullName(e.currentTarget.value)}*/}
                        {/*    required*/}
                        {/*/>*/}
                        <md-outlined-text-field type="text" value={fullName()}
                                                onInput={(e) => setFullName(e.currentTarget.value)}
                                                label="Full Name"
                                                required="true">

                        </md-outlined-text-field>
                    </div>
                </Show>
                <div>
                    {/*<label>Username: </label>*/}
                    {/*<input*/}
                    {/*    type="text"*/}
                    {/*    value={username()}*/}
                    {/*    onInput={(e) => setUsername(e.currentTarget.value)}*/}
                    {/*    required*/}
                    {/*/>*/}
                    <md-outlined-text-field type="text" value={username()}
                                            onInput={(e) => setUsername(e.currentTarget.value)}
                                            label="Username"
                                            required="true">

                    </md-outlined-text-field>
                </div>
                <div>
                    {/*<label>Password: </label>*/}
                    {/*<input*/}
                    {/*    type="password"*/}
                    {/*    value={password()}*/}
                    {/*    onInput={(e) => setPassword(e.currentTarget.value)}*/}
                    {/*    required*/}
                    {/*/>*/}

                    <md-outlined-text-field type="password" value={password()}
                                            onInput={(e) => setPassword(e.currentTarget.value)}
                                            ref={passwordRef}
                                            label="Password"
                                            required="true">
                        <md-icon-button toggle="true" slot="trailing-icon" onClick={(e) => handlePasswordToggle(e)}>
                            <md-icon>
                                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960"
                                     width="24px" fill="#e8eaed">
                                    <path
                                        d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/>
                                </svg>
                            </md-icon>
                            <md-icon slot="selected">
                                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960"
                                     width="24px" fill="#e8eaed">
                                    <path
                                        d="m644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t37.5-4q75 0 127.5 52.5T660-500q0 20-4 37.5T644-428Zm128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302Zm20 246L624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736-56 56ZM222-624q-29 26-53 57t-41 67q50 101 143.5 160.5T480-280q20 0 39-2.5t39-5.5l-36-38q-11 3-21 4.5t-21 1.5q-75 0-127.5-52.5T300-500q0-11 1.5-21t4.5-21l-84-82Zm319 93Zm-151 75Z"/>
                                </svg>
                            </md-icon>
                        </md-icon-button>
                    </md-outlined-text-field>
                </div>
            </form>
            <div>
                <md-outlined-button onClick={() => setMode(mode() === 'login' ? 'register' : 'login')}>
                    Switch to {mode() === 'login' ? 'Register' : 'Login'}
                </md-outlined-button>
                <md-filled-button form={"loginForm"} type="submit">Submit</md-filled-button>
            </div>
            <Show when={error()}>
                <p style={{color: 'red'}}>{error()}</p>
            </Show>
        </div>

    );
}
