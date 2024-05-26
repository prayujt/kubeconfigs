import type { RequestHandler } from "@sveltejs/kit";

import axios from "axios";

const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL || "";

export const POST: RequestHandler = async ({ request }) => {
  const { subject, loginChallenge, session } = await request.json();
  console.log(subject);
  console.log(session);

  const { data: loginRequest } = await axios.get(
    `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/login?login_challenge=${loginChallenge}`,
  );

  if (loginRequest.skip) {
    const { data: body } = await axios.put(
      `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/login/accept?login_challenge=${loginChallenge}`,
      {
        subject,
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
      subject,
      remember: true,
      remember_for: 3600,
      identity_provider_session_id: session.id,
      context: session.identity.traits,
    },
  );

  return new Response(JSON.stringify({ redirect_to: body.redirect_to }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
