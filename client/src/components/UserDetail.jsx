import {createSignal, createEffect} from 'solid-js';
import {getUserDetails} from '../api/auth.js'; // You'll need to create this function

export default function UserDetail(props) {
    const [userDetails, setUserDetails] = createSignal(null);
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal(null);

    createEffect(() => {
        if (props.username) {
            setLoading(true);
            setError(null);
            getUserDetails(props.username)
                .then((details) => {
                    setUserDetails(details);
                    setLoading(false);
                })
                .catch((err) => {
                    setError('Failed to fetch user details');
                    setLoading(false);
                });
        }
    });

    return (
        <div>
            {loading() && <p>Loading...</p>}
            {error() && <p>{error()}</p>}
            {userDetails() && (
                <div>
                    <h3>Full Name: {userDetails().full_name}</h3>
                    <p>Username: {userDetails().username}</p>
                </div>
            )}
        </div>
    );
}
