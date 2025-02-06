import {EventSourcePolyfill} from 'event-source-polyfill';

const CHAT_SERVICE_URL = 'http://34.159.3.169';

// For normal chat POST requests with JWT in Authorization header
export async function sendMessage(token, room, message) {
    const formData = new URLSearchParams();
    formData.append('room', room());
    formData.append('message', message);
    formData.append('timestamp', Date.now());
    formData.append('username', '0');

    const response = await fetch(`${CHAT_SERVICE_URL}/message`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${token}`,
        },
        body: formData,
    });
    if (!response.ok) {
        throw new Error('Failed to send message');
    }
}

export async function sendHeartbeat(token, room) {
    const response = await fetch(`${CHAT_SERVICE_URL}/heartbeat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({room}),
    });
    if (!response.ok) {
        // throw new Error('Heartbeat failed');
    }
}

// For SSE, if your chat-service does not allow query params for the token,
// you may need to set up a custom SSE polyfill or proxy.
// Here is a naive approach passing it as a query parameter:
export function createChatEventSource(token) {
    // NOTE: The chat-service in [1] expects an Authorization header,
    // which standard EventSource won't provide.
    // This is just a demonstration of SSE usage if the server accepted "?token=...".
    // const url = `${CHAT_SERVICE_URL}/events?token=${encodeURIComponent(token)}`;
    // return new EventSource(url, {withCredentials: true});

    return new EventSourcePolyfill(`${CHAT_SERVICE_URL}/events`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        withCredentials: true,
    });
}


export async function createRoom(token, roomName) {
    const response = await fetch(`${CHAT_SERVICE_URL}/rooms`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({room: roomName}),
    });
    if (!response.ok) {
        if (response.status === 409) { // Room already exists
            throw new Error('409 Conflict');
        } else {
            throw new Error(`Failed to create room: ${response.statusText}`);
        }
    }
    return response.text(); // e.g., "Room added successfully"
}

export async function listRooms(token) {
    const response = await fetch(`${CHAT_SERVICE_URL}/rooms`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error('Failed to fetch rooms');
    }
    return response.json(); // e.g., ["lobby", "general", "someNewRoom"]
}