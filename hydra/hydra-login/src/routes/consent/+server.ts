import type { RequestHandler } from "@sveltejs/kit";

import axios from "axios";
import postgres from "postgres";

declare interface Session {
  id_token: Identity;
  access_token: Identity;
}

declare interface Identity {
  email?: string;
  name?: string;
}

declare interface Account {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
}

const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL || "";

const POSTGRES_HOST = process.env.PG_HOST || "hydra-users";
const POSTGRES_USER = process.env.PG_USER || "hydra_user";
const POSTGRES_PASSWORD = process.env.PG_PASSWORD || "hydra_password";
const POSTGRES_DATABASE = process.env.PG_DB || "hydra_db";
const POSTGRES_PORT = process.env.PG_PORT || "5432";

const buildSession = (grant_scope: string[], user: Account): Session => {
  const session: Session = {
    id_token: {
      ...(grant_scope.includes("email") && { email: user.email }),
      ...(grant_scope.includes("profile") && {
        name: `${user.first_name} ${user.last_name}`,
      }),
    },
    access_token: {
      ...(grant_scope.includes("email") && { email: user.email }),
      ...(grant_scope.includes("profile") && {
        name: `${user.first_name} ${user.last_name}`,
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
      JSON.stringify({ scopes: consentRequest.requested_scope }),
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
  const { consent_challenge, grant_scope, remember } = await request.json();

  try {
    const { data: consentRequest } = await axios.get(
      `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/consent?consent_challenge=${consent_challenge}`,
    );

    const sql = postgres(
      `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/{${POSTGRES_DATABASE}`,
    );

    const user: Account[] =
      (await sql`SELECT id,email,first_name,last_name,username FROM accounts WHERE email=${consentRequest.subject}`) as unknown as Account[];
    if (user.length === 0) {
      return new Response(JSON.stringify({ message: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (consentRequest.skip) {
      const { data: body } = await axios.put(
        `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/consent/accept?consent_challenge=${consent_challenge}`,
        {
          grant_scope,
          grant_access_token_audience:
            consentRequest.requested_access_token_audience,
          session: buildSession(grant_scope, user[0]),
          remember,
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
        grant_scope,
        grant_access_token_audience:
          consentRequest.requested_access_token_audience,
        session: buildSession(grant_scope, user[0]),
        remember,
        remember_for: 3600,
      },
    );

    return new Response(JSON.stringify({ redirect_to: body.redirect_to }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ message: "Error during consent handling" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
