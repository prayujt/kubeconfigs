import type { RequestHandler } from "@sveltejs/kit";
import { hydraAdmin } from "$lib/api";

export const POST: RequestHandler = async ({ request }) => {
  const { email, password } = await request.json();

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
    const loginChallenge = request.headers.get("login_challenge");
    const { data: loginRequest } = await hydraAdmin.get(
      `/oauth2/auth/requests/login?login_challenge=${loginChallenge}`,
    );

    if (loginRequest.skip) {
      const { data: body } = await hydraAdmin.put(
        `/oauth2/auth/requests/login/accept?login_challenge=${loginChallenge}`,
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
    const { data: body } = await hydraAdmin.put(
      `/oauth2/auth/requests/login/accept?login_challenge=${loginChallenge}`,
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
    return new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
};
