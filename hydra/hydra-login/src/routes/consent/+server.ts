import type { RequestHandler } from '@sveltejs/kit';
import { hydraAdmin } from '$lib/api';

export const POST: RequestHandler = async ({ request }) => {
    const { consent_challenge, grant_scope, remember } = await request.json();

    try {
        const { data: consentRequest } = await hydraAdmin.get(`/oauth2/auth/requests/consent?consent_challenge=${consent_challenge}`);

        if (consentRequest.skip) {
            const { data: body } = await hydraAdmin.put(`/oauth2/auth/requests/consent/accept?consent_challenge=${consent_challenge}`, {
                grant_scope,
                grant_access_token_audience: consentRequest.requested_access_token_audience,
                session: {},
                remember,
                remember_for: 3600
            });

            return new Response(
                JSON.stringify({ redirect_to: body.redirect_to }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { data: body } = await hydraAdmin.put(`/oauth2/auth/requests/consent/accept?consent_challenge=${consent_challenge}`, {
            grant_scope,
            grant_access_token_audience: consentRequest.requested_access_token_audience,
            session: {},
            remember,
            remember_for: 3600
        });

        return new Response(
            JSON.stringify({ redirect_to: body.redirect_to }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        return new Response(JSON.stringify({ message: ‘Unauthorized’ }), { status: 401, headers: { ‘Content-Type’: ‘application/json’ } });
    }
};
