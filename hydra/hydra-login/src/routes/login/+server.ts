import type { RequestHandler } from "@sveltejs/kit";
import axios from "axios";

const HYDRA_ADMIN_URL =
  process.env.HYDRA_ADMIN_URL || "https://auth.prayujt.com/admin";
const CLIENT_ID = process.env.CLIENT_ID || "your-client-id";
const REDIRECT_URI =
  process.env.REDIRECT_URI || "https://your-app.com/callback";

export const POST: RequestHandler = async ({ request }) => {
  const { email, password, loginChallenge } = await request.json();

  try {
    // Validate credentials (for simplicity, using hardcoded values)
    if (email !== "prayujtuli@hotmail.com" || password !== "testing") {
      return new Response(
        JSON.stringify({
          error: "The username / password combination is not correct",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // Fetch the login request
    const { data: loginRequest } = await axios.get(
      `${HYDRA_ADMIN_URL}/oauth2/auth/requests/login?login_challenge=${loginChallenge}`,
    );

    if (loginRequest.skip) {
      const { data: body } = await axios.put(
        `${HYDRA_ADMIN_URL}/oauth2/auth/requests/login/accept?login_challenge=${loginChallenge}`,
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
      `${HYDRA_ADMIN_URL}/oauth2/auth/requests/login/accept?login_challenge=${loginChallenge}`,
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
  } catch (error) {
    return new Response(
      JSON.stringify({ message: `Unauthorized: ${error.errors}` }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
