import type { RequestHandler } from "@sveltejs/kit";

import axios from "axios";

const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL || "";

export const POST: RequestHandler = async ({ request }) => {
  const { loginChallenge, session } = await request.json();

  const { data: loginRequest } = await axios.get(
    `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/login?login_challenge=${loginChallenge}`,
  );

  if (loginRequest.skip) {
    const { data: body } = await axios.put(
      `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/login/accept?login_challenge=${loginChallenge}`,
      {
        subject: session.identity.id,
      },
    );
    return new Response(JSON.stringify({ redirect_to: body.redirect_to }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: body } = await axios.put(
    `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/login/accept?login_challenge=${loginChallenge}`,
    {
      subject: session.identity.id,
      remember: true,
      remember_for: 3600,
      identity_provider_session_id: session.id,
    },
  );

  return new Response(JSON.stringify({ redirect_to: body.redirect_to }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
