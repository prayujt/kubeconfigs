import type { RequestHandler } from "@sveltejs/kit";
import { hydraAdmin } from "$lib/api";

export const POST: RequestHandler = async ({ request }) => {
  const { logout_challenge } = await request.json();

  try {
    const { data: body } = await hydraAdmin.put(
      `/oauth2/auth/requests/logout/accept?logout_challenge=${logout_challenge}`,
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
