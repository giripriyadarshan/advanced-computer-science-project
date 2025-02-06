const USER_SERVICE_URL = 'http://35.234.68.161';

export async function registerUser(fullName, username, password) {
    const response = await fetch(`${USER_SERVICE_URL}/register`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({full_name: fullName, username, password}),
    });
    if (!response.ok) {
        console.log(response);
        throw new Error('Registration failed');
    }
    return response.json();
}

export async function loginUser(username, password) {
    const response = await fetch(`${USER_SERVICE_URL}/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username, password}),
    });
    if (!response.ok) {
        throw new Error('Login failed');
    }
    const data = await response.json();
    // data.token contains the JWT
    return data.token;
}

export async function getUserDetails(username) {
    const response = await fetch(`${USER_SERVICE_URL}/user/${username}`);
    if (!response.ok) {
        throw new Error('Failed to fetch user details');
    }
    return response.json();
}
