import type { RequestHandler } from '@sveltejs/kit';
import axios from 'axios';

export const POST: RequestHandler = async ({ request }) => {
    const { email, password } = await request.json();

    // Replace these with your Hydra endpoint details
    const HYDRA_ADMIN_URL = 'https://auth.prayujt.com/admin';
    const CLIENT_ID = 'your-client-id';
    const REDIRECT_URI = 'https://your-app.com/callback';
    const SCOPE = 'openid profile email';

    try {
        // Simulate a successful login
        // In a real application, validate credentials and interact with Hydra

        // Interact with Hydra to initiate the OAuth2 flow
        const authResponse = await axios.post(`${HYDRA_ADMIN_URL}/oauth2/auth`, {
            client_id: CLIENT_ID,
            response_type: 'code',
            redirect_uri: REDIRECT_URI,
            scope: SCOPE,
            state: 'random_state_string',
            email,
            password,
        });

        // Simulate a successful response
        const responseToken = 'dummy-access-token';
        const responseEmail = email;
        const firstName = 'John';
        const lastName = 'Doe';

        return new Response(
            JSON.stringify({
                token: responseToken,
                email: responseEmail,
                firstName,
                lastName,
            }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ message: 'Unauthorized' }),
            {
                status: 401,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    }
};
