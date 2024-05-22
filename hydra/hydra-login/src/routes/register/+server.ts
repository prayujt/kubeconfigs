import type { RequestHandler } from "@sveltejs/kit";

import postgres from "postgres";

const POSTGRES_HOST = process.env.PG_HOST || "hydra-users";
const POSTGRES_USER = process.env.PG_USER || "hydra_user";
const POSTGRES_PASSWORD = process.env.PG_PASSWORD || "hydra_password";
const POSTGRES_DATABASE = process.env.PG_DB || "hydra_db";
const POSTGRES_PORT = process.env.PG_PORT || "5432";

export const POST: RequestHandler = async ({ request }) => {
  const { email, password, firstName, lastName, username } =
    await request.json();

  const sql = postgres(
    `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}`,
  );

  let result = await sql`
    INSERT INTO accounts (id, email, password, first_name, last_name, username)
    VALUES (gen_random_uuid(), ${email}, ${password}, ${firstName}, ${lastName}, ${username})
  `;

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
};
