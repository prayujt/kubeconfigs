import type { RequestHandler } from "@sveltejs/kit";

import axios from "axios";
import postgres from "postgres";

const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL || "";

const POSTGRES_HOST = process.env.PG_HOST || "hydra-users";
const POSTGRES_USER = process.env.PG_USER || "hydra_user";
const POSTGRES_PASSWORD = process.env.PG_PASSWORD || "hydra_password";
const POSTGRES_DATABASE = process.env.PG_DB || "hydra_db";
const POSTGRES_PORT = process.env.PG_PORT || "5432";

export const POST: RequestHandler = async ({ request }) => {
  const { user, password, loginChallenge } = await request.json();

  const sql = postgres(
    `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}`,
  );

  let result = await sql`
    SELECT EXISTS(
      SELECT * FROM accounts
      WHERE
        (email=${user} OR username=${user})
        AND
        password=encode(sha256(${password}), 'hex'))
    AS authorized`;
  if (!(result[0].authorized as boolean)) {
    return new Response("Incorrect login", {
      status: 401,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Fetch the login request
  const { data: loginRequest } = await axios.get(
    `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/login?login_challenge=${loginChallenge}`,
  );

  if (loginRequest.skip) {
    const { data: body } = await axios.put(
      `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/login/accept?login_challenge=${loginChallenge}`,
      {
        subject: String(loginRequest.subject),
      },
    );
    return new Response(JSON.stringify({ redirect_to: body.redirect_to }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Accept the login request
  const { data: body } = await axios.put(
    `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/login/accept?login_challenge=${loginChallenge}`,
    {
      subject: email,
      remember: true,
      remember_for: 3600,
    },
  );

  return new Response(JSON.stringify({ redirect_to: body.redirect_to }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
