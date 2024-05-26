import type { RequestHandler } from "@sveltejs/kit";

import axios from "axios";

declare interface Session {
  id_token: Identity;
  access_token: Identity;
}

declare interface Identity {
  email?: string;
  name?: string;
  username?: string;
}

declare interface Account {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
}

const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL || "";

const buildSession = (grant_scope: string[], user: Account): Session => {
  const session: Session = {
    id_token: {
      ...(grant_scope.includes("email") && { email: user.email }),
      ...(grant_scope.includes("profile") && {
        name: `${user.firstName} ${user.lastName}`,
        username: user.username,
      }),
    },
    access_token: {
      ...(grant_scope.includes("email") && { email: user.email }),
      ...(grant_scope.includes("profile") && {
        name: `${user.firstName} ${user.lastName}`,
        username: user.username,
      }),
    },
  };

  return session;
};

export const GET: RequestHandler = async ({ url }) => {
  const consent_challenge = url.searchParams.get("consent_challenge");

  try {
    const { data: consentRequest } = await axios.get(
      `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/consent?consent_challenge=${consent_challenge}`,
    );
    return new Response(
      JSON.stringify({
        scopes: consentRequest.requested_scope,
        clientName: consentRequest.client.client_name,
        context: consentRequest.context,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ message: "Error fetching consent request" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

export const POST: RequestHandler = async ({ request }) => {
  const { consent_challenge, scopes, granted, identity } = await request.json();

  try {
    const { data: consentRequest } = await axios.get(
      `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/consent?consent_challenge=${consent_challenge}`,
    );

    console.log(identity);
    if (!identity) {
      return new Response(
        JSON.stringify({ message: "No user information found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (!granted) {
      const { data: body } = await axios.put(
        `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/consent/reject?consent_challenge=${consent_challenge}`,
        {
          error: "access_denied",
          error_description: "The resource owner denied the request",
          status_code: 403,
        },
      );

      return new Response(JSON.stringify({ redirect_to: body.redirect_to }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (consentRequest.skip) {
      const { data: body } = await axios.put(
        `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/consent/accept?consent_challenge=${consent_challenge}`,
        {
          grant_scope: scopes,
          grant_access_token_audience:
            consentRequest.requested_access_token_audience,
          session: buildSession(scopes, identity),
          remember: true,
          remember_for: 3600,
        },
      );

      return new Response(JSON.stringify({ redirect_to: body.redirect_to }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: body } = await axios.put(
      `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/consent/accept?consent_challenge=${consent_challenge}`,
      {
        grant_scope: scopes,
        grant_access_token_audience:
          consentRequest.requested_access_token_audience,
        session: buildSession(scopes, identity),
        remember: true,
        remember_for: 3600,
      },
    );

    return new Response(JSON.stringify({ redirect_to: body.redirect_to }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.log(error);
    console.log(error.message);
    return new Response(
      JSON.stringify({ message: "Error during consent handling" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
