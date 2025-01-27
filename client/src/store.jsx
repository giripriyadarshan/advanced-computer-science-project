import {createContext, useContext} from 'solid-js';
import {createStore} from 'solid-js/store';

const StoreContext = createContext();

export function StoreProvider(props) {
    // Load existing token from localStorage if available
    const initialToken = localStorage.getItem('token') || null;
    const initialRooms = JSON.parse(localStorage.getItem('rooms')) || [];

    const [state, setState] = createStore({
        token: initialToken,
        user: null,
        rooms: initialRooms
    });

    const store = [
        state,
        {
            setToken: (token) => {
                setState('token', token);
                // Also persist in localStorage
                if (token) {
                    localStorage.setItem('token', token);
                } else {
                    localStorage.removeItem('token');
                }
            },
            setUser: (user) => {
                setState('user', user)
                localStorage.setItem('user', user);
            },
            setRooms: (rooms) => {
                setState('rooms', rooms);
                localStorage.setItem('rooms', JSON.stringify(rooms));
            },
            addRoom: (room) => {
                if (!state.rooms.includes(room)) {
                    const updatedRooms = [...state.rooms, room];
                    setState('rooms', updatedRooms);
                    localStorage.setItem('rooms', JSON.stringify(updatedRooms));
                }
            },
            logout: () => {
                setState('token', null);
                setState('user', null);
                setState('rooms', []);
                localStorage.removeItem('token');
                localStorage.removeItem('rooms');
            }
        }
    ];

    return (
        <StoreContext.Provider value={store}>
            {props.children}
        </StoreContext.Provider>
    );
}

export function useStore() {
    return useContext(StoreContext);
}
