import type { RequestHandler } from '@sveltejs/kit';
import axios from 'axios';

const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL || 'https://auth.prayujt.com/admin';

export const POST: RequestHandler = async ({ request }) => {
    const { logout_challenge, accept } = await request.json();

    try {
        if (accept) {
            const { data: body } = await axios.put(`${HYDRA_ADMIN_URL}/oauth2/auth/requests/logout/accept?logout_challenge=${logout_challenge}`);
            return new Response(
                JSON.stringify({ redirect_to: body.redirect_to }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        } else {
            const { data: body } = await axios.put(`${HYDRA_ADMIN_URL}/oauth2/auth/requests/logout/reject?logout_challenge=${logout_challenge}`);
            return new Response(
                JSON.stringify({ redirect_to: body.redirect_to }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }
    } catch (error) {
        return new Response(
            JSON.stringify({ message: 'Unauthorized' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
