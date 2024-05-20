import type { RequestHandler } from "@sveltejs/kit";
import axios from "axios";

const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL || "";

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

    if (consentRequest.skip) {
      const { data: body } = await axios.put(
        `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/consent/accept?consent_challenge=${consent_challenge}`,
        {
          grant_scope,
          grant_access_token_audience:
            consentRequest.requested_access_token_audience,
          session: {},
          remember,
          remember_for: 3600,
        },
      );

      return new Response(JSON.stringify({ redirect_to: body.redirect_to }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let session = { id_token: {}, access_token: {} };
    console.log("grant_scope", grant_scope);
    console.log("consent_request", consentRequest);
    if (grant_scope.includes("profile")) {
      session.id_token.name = "Prayuj Tuli";
      session.access_token.name = "Prayuj Tuli";
    }
    if (grant_scope.includes("email")) {
      session.id_token.email = consentRequest.subject;
      session.access_token.email = consentRequest.subject;
    }
    console.log("session", session);

    const { data: body } = await axios.put(
      `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/consent/accept?consent_challenge=${consent_challenge}`,
      {
        grant_scope,
        grant_access_token_audience:
          consentRequest.requested_access_token_audience,
        session,
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
