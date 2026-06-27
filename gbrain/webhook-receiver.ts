// webhook-receiver.ts — real-time event ingestion into gbrain.
//
// A small Bun HTTP server (runs as a Deployment behind an Ingress) that accepts
// event callbacks and pushes them into gbrain via the put_page MCP tool — the
// complement to the polling CronJob bridges (which stay on as a backstop).
//
// Routes:
//   GET  /healthz        liveness
//   POST /slack/events   Slack Events API (url_verification + message events)
//   POST /github         GitHub webhooks (pull_request, issues, ping)
//
// Signatures are verified when the corresponding secret is configured:
//   SLACK_SIGNING_SECRET   (Slack app "Signing Secret"); if unset, a warning
//                          is logged and Slack events are accepted unverified.
//   GITHUB_WEBHOOK_SECRET  (the secret you enter when creating the webhook);
//                          required — unsigned/invalid GitHub posts are 401.
//
// Env: GBRAIN_MCP_URL, GBRAIN_TOKEN, SLACK_TOKEN (for name resolution),
//      SLACK_SIGNING_SECRET (optional), GITHUB_WEBHOOK_SECRET, PORT (default 8080)

import { createHmac, timingSafeEqual } from "node:crypto";

const MCP_URL = process.env.GBRAIN_MCP_URL!;
const MCP_TOKEN = process.env.GBRAIN_TOKEN!;
const SLACK_TOKEN = process.env.SLACK_TOKEN || "";
// The deployed secret ships with a placeholder until the real Slack app signing
// secret is provided; treat the placeholder as "unset" so URL verification works
// during setup (events accepted unverified), then verification turns on for real.
const SLACK_SIGNING_SECRET =
  (process.env.SLACK_SIGNING_SECRET || "") === "REPLACE_WITH_SLACK_APP_SIGNING_SECRET"
    ? "" : (process.env.SLACK_SIGNING_SECRET || "");
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";
const PORT = Number(process.env.PORT ?? "8080");

let mcpId = 0;
async function mcp(name: string, args: Record<string, unknown>) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MCP_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0", id: ++mcpId, method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const text = await res.text();
  const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
  return JSON.parse(dataLine ? dataLine.slice(6) : text).result?.content?.[0]?.text as string | undefined;
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

// Slack text uses <...> tokens for mentions/links and escapes only &, <, > as
// HTML entities. Render to clean readable text AND emit gbrain wikilinks so the
// brain builds a graph: @mentions -> [[people/<id>]], #channel -> [[slack-channel/<slug>]].
// Targets are stub pages created by the slack-bridge cron (same slug scheme).
function cleanText(s: string): string {
  return (s || "")
    .replace(/<@([UW][A-Z0-9]+)\|([^>]+)>/g, "[[people/$1|@$2]]")
    .replace(/<@([UW][A-Z0-9]+)>/g, "[[people/$1]]")
    .replace(/<#(C[A-Z0-9]+)\|([^>]+)>/g,
      (_m, _id, name) => `[[slack-channel/${slugify(name)}|#${name}]]`)
    .replace(/<#(C[A-Z0-9]+)>/g, "#$1")
    .replace(/<!subteam\^[A-Z0-9]+\|([^>]+)>/g, "$1")
    .replace(/<!(here|channel|everyone)>/g, "@$1")
    .replace(/<(?:https?|mailto):[^>|]+\|([^>]+)>/g, "$1")
    .replace(/<((?:https?|mailto):[^>]+)>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
const iso = (unixOrTs: number) => new Date(unixOrTs * 1000).toISOString();
const eqHex = (a: string, b: string) => {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
};

// ── Slack name resolution (best-effort, cached) ──────────────────────────────
const userCache = new Map<string, string>();
const chanCache = new Map<string, string>();
async function slackGet(method: string, params: Record<string, string>) {
  const url = new URL(`https://slack.com/api/${method}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const j = await (await fetch(url, { headers: { Authorization: `Bearer ${SLACK_TOKEN}` } })).json();
  if (!j.ok) throw new Error(j.error);
  return j;
}
async function userName(id?: string) {
  if (!id) return "unknown";
  if (userCache.has(id)) return userCache.get(id)!;
  if (!SLACK_TOKEN) return id;
  try {
    const p = (await slackGet("users.info", { user: id })).user?.profile ?? {};
    const name = p.display_name || p.real_name || id;
    userCache.set(id, name); return name;
  } catch { userCache.set(id, id); return id; }
}
async function channelLabel(id?: string) {
  if (!id) return "unknown";
  if (chanCache.has(id)) return chanCache.get(id)!;
  if (!SLACK_TOKEN) return id;
  try {
    const c = (await slackGet("conversations.info", { channel: id })).channel ?? {};
    const label = c.is_im ? `dm-${await userName(c.user)}` : (c.name || id);
    chanCache.set(id, label); return label;
  } catch { chanCache.set(id, id); return id; }
}

// Append one line to a day-page (create if missing).
async function appendToDay(prefix: string, label: string, tag: string, day: string, line: string) {
  const slug = `${prefix}/${slugify(label)}/${day}`;
  let existingBody = "";
  const existing = await mcp("get_page", { slug });
  if (existing) { try { existingBody = (JSON.parse(existing).compiled_truth || "").trim(); } catch {} }
  const fm = `---\ntype: conversation\ntitle: "${tag} ${label} ${day}"\ntags: [${tag.toLowerCase()}]\n---\n`;
  const body = existingBody ? `${existingBody}\n${line}` : `# ${tag}: [[${prefix}-channel/${slugify(label)}|#${label}]] — ${day}\n\n${line}`;
  await mcp("put_page", { slug, content: `${fm}${body}\n`, source_kind: "webhook", ingested_via: `${tag.toLowerCase()}-webhook` });
}

// ── Slack ────────────────────────────────────────────────────────────────────
function verifySlack(ts: string, sig: string, raw: string): boolean {
  if (!SLACK_SIGNING_SECRET) return true; // unverified (warned at startup)
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // replay window
  const mine = "v0=" + createHmac("sha256", SLACK_SIGNING_SECRET).update(`v0:${ts}:${raw}`).digest("hex");
  return eqHex(mine, sig);
}
async function handleSlack(req: Request, raw: string): Promise<Response> {
  if (!verifySlack(req.headers.get("x-slack-request-timestamp") || "",
                    req.headers.get("x-slack-signature") || "", raw))
    return new Response("bad signature", { status: 401 });
  const body = JSON.parse(raw);
  if (body.type === "url_verification") { console.error("[receiver] slack url_verification ok"); return Response.json({ challenge: body.challenge }); }
  if (body.type === "event_callback") {
    const e = body.event;
    if (e?.type === "message" && e.text && !e.bot_id && !e.subtype) {
      const label = await channelLabel(e.channel);
      const day = iso(Number(e.ts)).slice(0, 10);
      const who = await userName(e.user);
      const thread = e.thread_ts && e.thread_ts !== e.ts ? " ↳" : "";
      const txt = cleanText(e.text as string);
      const author = e.user ? `[[people/${e.user}|${who}]]` : who;
      await appendToDay("slack", label, "Slack", day, `**${author}** (${iso(Number(e.ts)).slice(11, 19)})${thread}: ${txt}`);
      console.error(`[receiver] slack message -> #${label} (${who})`);
    } else if (e?.type === "message") {
      console.error(`[receiver] slack message skipped (bot/subtype/empty): subtype=${e.subtype ?? "-"}`);
    }
    return new Response("ok"); // ack fast (Slack needs 200 within 3s)
  }
  return new Response("ignored");
}

// ── GitHub ─────────────────────────────────────────────────────────────────
function verifyGitHub(sig: string, raw: string): boolean {
  if (!GITHUB_WEBHOOK_SECRET) return false;
  if (!sig) return false;
  const mine = "sha256=" + createHmac("sha256", GITHUB_WEBHOOK_SECRET).update(raw).digest("hex");
  return eqHex(mine, sig);
}
async function handleGitHub(req: Request, raw: string): Promise<Response> {
  if (!verifyGitHub(req.headers.get("x-hub-signature-256") || "", raw))
    return new Response("bad signature", { status: 401 });
  const event = req.headers.get("x-github-event") || "";
  const b = JSON.parse(raw);
  if (event === "ping") return new Response("pong");
  if (event === "pull_request" || event === "issues") {
    const item = b.pull_request || b.issue;
    const repo = b.repository?.full_name || "unknown/unknown";
    const kind = b.pull_request ? "pr" : "issue";
    const slug = `github/${slugify(repo)}/${kind}-${item.number}`;
    const labels = (item.labels ?? []).map((l: any) => l.name).join(", ");
    const fm = `---\ntype: reference\ntitle: ${JSON.stringify(`${repo}#${item.number} ${item.title}`.slice(0, 120))}\ntags: [github, ${kind}]\n---\n`;
    const body =
      `# ${repo}#${item.number} — ${item.title}\n\n` +
      `- **State:** ${item.state}${item.draft ? " (draft)" : ""}\n` +
      `- **Action:** ${b.action}\n- **Author:** ${item.user?.login}\n` +
      `- **Updated:** ${item.updated_at}\n` + (labels ? `- **Labels:** ${labels}\n` : "") +
      `- **URL:** ${item.html_url}\n\n${item.body || "_(no description)_"}\n`;
    await mcp("put_page", { slug, content: fm + body, source_kind: "webhook", ingested_via: "github-webhook" });
  }
  return new Response("ok");
}

console.error(`[receiver] listening on :${PORT}`);
if (!SLACK_SIGNING_SECRET) console.error("[receiver] WARN: SLACK_SIGNING_SECRET unset — Slack events accepted UNVERIFIED");
if (!GITHUB_WEBHOOK_SECRET) console.error("[receiver] WARN: GITHUB_WEBHOOK_SECRET unset — GitHub posts will be rejected (401)");

Bun.serve({
  port: PORT,
  async fetch(req) {
    const { pathname } = new URL(req.url);
    if (req.method === "GET" && pathname === "/healthz") return new Response("ok");
    if (req.method !== "POST") return new Response("not found", { status: 404 });
    const raw = await req.text();
    try {
      if (pathname === "/slack/events") return await handleSlack(req, raw);
      if (pathname === "/github") return await handleGitHub(req, raw);
    } catch (e: any) {
      console.error(`[receiver] ${pathname} error:`, e.message);
      return new Response("error", { status: 500 });
    }
    return new Response("not found", { status: 404 });
  },
});
