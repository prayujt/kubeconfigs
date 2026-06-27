// slack-bridge.ts — pulls Slack (all channels you're in + DMs) into gbrain.
//
// Runs as a k8s CronJob on the gbrain image (Bun). No native gbrain Slack
// sense exists, so this bridges the gap: Slack Web API -> gbrain MCP put_page.
// State (last-synced ts per conversation) is stored back in the brain itself
// as the `system/slack-sync-cursor` page, so the job is stateless/idempotent.
//
// Known limitation: pulls top-level channel messages, not threaded replies
// (would require a conversations.replies call per thread — Tier-3 rate budget).
//
// Env:
//   SLACK_TOKEN                       xoxp user token
//   GBRAIN_MCP_URL                    e.g. http://gbrain:3131/mcp
//   GBRAIN_TOKEN                      gbrain_… bearer
//   FIRST_RUN_LOOKBACK_DAYS           first-sight backfill window (default 7)
//   MAX_MSGS_PER_CHANNEL_PER_RUN      safety bound, logged when hit (default 5000)
//   FETCH_THREADS                     "true" to pull thread replies (default true)
//   BACKFILL_MODE                     "true" ignores the saved cursor (re-pulls
//                                     the whole LOOKBACK window) and REPLACES
//                                     day-pages instead of appending — safe to
//                                     re-run for a clean full-history backfill.

const SLACK_TOKEN = process.env.SLACK_TOKEN!;
const MCP_URL = process.env.GBRAIN_MCP_URL!;
const MCP_TOKEN = process.env.GBRAIN_TOKEN!;
const LOOKBACK_DAYS = Number(process.env.FIRST_RUN_LOOKBACK_DAYS ?? "7");
const MAX_MSGS = Number(process.env.MAX_MSGS_PER_CHANNEL_PER_RUN ?? "5000");
const FETCH_THREADS = (process.env.FETCH_THREADS ?? "true") !== "false";
// conversations.replies is heavily rate-limited; cap thread-fetching to a
// recent window and skip noisy bot/alert channels so the backfill actually
// finishes. Defaults to the message window if unset.
const THREAD_LOOKBACK_DAYS = Number(process.env.THREAD_LOOKBACK_DAYS ?? String(LOOKBACK_DAYS));
const SKIP_THREAD_CHANNELS = new RegExp(
  process.env.SKIP_THREAD_CHANNELS ?? "^alerts-|resolutions-auto|automatic-games|^monitoring|^logs-", "i");
const CURSOR_SLUG = "system/slack-sync-cursor";

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
      jsonrpc: "2.0",
      id: ++mcpId,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const text = await res.text();
  const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
  const payload = dataLine ? dataLine.slice(6) : text;
  const json = JSON.parse(payload);
  return json.result?.content?.[0]?.text as string | undefined;
}

async function slack(method: string, params: Record<string, unknown> = {}) {
  const url = new URL(`https://slack.com/api/${method}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (;;) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${SLACK_TOKEN}` } });
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") ?? "5");
      console.error(`[slack] 429 on ${method}; waiting ${wait}s`);
      await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
      continue;
    }
    const json = await res.json();
    if (!json.ok) {
      if (json.error === "ratelimited") { await new Promise((r) => setTimeout(r, 5000)); continue; }
      throw new Error(`slack ${method}: ${json.error}`);
    }
    return json;
  }
}

const userCache = new Map<string, string>();
async function userName(id?: string) {
  if (!id) return "unknown";
  if (userCache.has(id)) return userCache.get(id)!;
  try {
    const j = await slack("users.info", { user: id });
    const p = j.user?.profile ?? {};
    const name = p.display_name || p.real_name || j.user?.name || id;
    userCache.set(id, name);
    return name;
  } catch {
    userCache.set(id, id);
    return id;
  }
}

async function listConversations() {
  const all: any[] = [];
  let cursor = "";
  do {
    const j = await slack("users.conversations", {
      types: "public_channel,private_channel,im,mpim",
      exclude_archived: true,
      limit: 200,
      ...(cursor ? { cursor } : {}),
    });
    all.push(...(j.channels ?? []));
    cursor = j.response_metadata?.next_cursor || "";
  } while (cursor);
  return all;
}

async function convLabel(c: any) {
  if (c.is_im) return `dm-${await userName(c.user)}`;
  if (c.is_mpim) return c.name || `groupdm-${c.id}`;
  return c.name || c.id;
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

// Slack message text uses <...> tokens for mentions/links and escapes only
// &, <, > as HTML entities. Render to clean readable text AND emit gbrain
// wikilinks so the brain builds a graph: @mentions -> [[people/<id>]] and
// #channel refs -> [[slack-channel/<slug>]]. Targets get stub pages (see
// ensureEntityStubs) so links resolve to real edges, not phantoms.
function cleanText(s: string): string {
  return (s || "")
    .replace(/<@([UW][A-Z0-9]+)\|([^>]+)>/g, "[[people/$1|@$2]]") // <@U123|name> -> link
    .replace(/<@([UW][A-Z0-9]+)>/g, "[[people/$1]]")             // <@U123> -> link (id only)
    .replace(/<#(C[A-Z0-9]+)\|([^>]+)>/g,                        // <#C123|chan> -> link
      (_m, _id, name) => `[[slack-channel/${slugify(name)}|#${name}]]`)
    .replace(/<#(C[A-Z0-9]+)>/g, "#$1")                          // bare channel id (rare) -> text
    .replace(/<!subteam\^[A-Z0-9]+\|([^>]+)>/g, "$1")    // group mention
    .replace(/<!(here|channel|everyone)>/g, "@$1")
    .replace(/<(?:https?|mailto):[^>|]+\|([^>]+)>/g, "$1") // <url|text> -> text
    .replace(/<((?:https?|mailto):[^>]+)>/g, "$1")        // <url> -> url
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

// Idempotent stub page for a graph entity (person / channel): only created if
// absent, so we never clobber a page later enriched by dream. These are the
// resolution targets for the [[people/…]] / [[slack-channel/…]] wikilinks.
async function ensureStub(slug: string, content: string) {
  const existing = await mcp("get_page", { slug });
  if (existing) return false;
  await mcp("put_page", { slug, content, source_kind: "webhook", ingested_via: "slack-bridge" });
  return true;
}

// Create person + channel stub pages for everything seen this run. People come
// from the userName cache (id -> display name); channels from the labels we
// wrote. Bounded by distinct users/channels in the window.
async function ensureEntityStubs(channels: Map<string, string>) {
  let made = 0;
  for (const [id, name] of userCache) {
    if (!/^[UW][A-Z0-9]+$/.test(id)) continue; // skip bot_id / non-user keys
    const fm = `---\ntype: reference\ntitle: ${JSON.stringify(name)}\ntags: [person, slack]\n---\n`;
    if (await ensureStub(`people/${id}`, `${fm}# ${name}\n\nSlack user \`${id}\`. Authored messages and @mentions link here.\n`)) made++;
  }
  for (const [slug, label] of channels) {
    const fm = `---\ntype: reference\ntitle: ${JSON.stringify(`#${label}`)}\ntags: [slack, channel]\n---\n`;
    if (await ensureStub(`slack-channel/${slug}`, `${fm}# #${label}\n\nSlack channel. See backlinks for daily conversations.\n`)) made++;
  }
  return made;
}

// Paginate the full window (newest-first). MAX_MSGS is a safety bound only;
// when hit we keep the OLDEST messages and report capped, so the cursor (set
// to the newest *kept* ts) advances from the bottom up without leaving a gap.
async function history(channelId: string, oldest: string) {
  const msgs: any[] = [];
  let cursor = "";
  do {
    const j = await slack("conversations.history", {
      channel: channelId,
      oldest,
      limit: 200,
      ...(cursor ? { cursor } : {}),
    });
    msgs.push(...(j.messages ?? []));
    cursor = j.has_more ? j.response_metadata?.next_cursor || "" : "";
  } while (cursor && msgs.length < MAX_MSGS);
  const capped = !!cursor; // more remained beyond the bound
  if (capped) msgs.splice(0, msgs.length - MAX_MSGS); // keep oldest MAX_MSGS
  return { msgs, capped };
}

// Pull all replies in a thread (excludes the parent message itself).
async function threadReplies(channelId: string, parentTs: string) {
  const all: any[] = [];
  let cursor = "";
  do {
    const j = await slack("conversations.replies", {
      channel: channelId, ts: parentTs, limit: 200,
      ...(cursor ? { cursor } : {}),
    });
    all.push(...(j.messages ?? []));
    cursor = j.has_more ? j.response_metadata?.next_cursor || "" : "";
  } while (cursor);
  return all.filter((m) => m.ts !== parentTs);
}

const iso = (ts: string) => new Date(Number(ts.split(".")[0]) * 1000).toISOString();

async function loadCursor(): Promise<Record<string, string>> {
  // include_deleted: a soft-deleted cursor still holds valid timestamps;
  // reading it prevents a silent full re-backfill if the page ever gets
  // soft-deleted out from under us.
  const content = await mcp("get_page", { slug: CURSOR_SLUG, include_deleted: true });
  if (!content) return {};
  try {
    const truth = JSON.parse(content).compiled_truth || "";
    const m = truth.match(/```json\s*([\s\S]*?)```/);
    if (m) return JSON.parse(m[1]);
  } catch { /* fall through to empty cursor (treated as first run) */ }
  return {};
}

async function saveCursor(cur: Record<string, string>) {
  const content =
    `---\ntype: system\ntitle: Slack Sync Cursor\n---\n` +
    `Last-synced Slack message timestamps per conversation. ` +
    `Managed by slack-bridge — do not edit.\n\n` +
    "```json\n" + JSON.stringify(cur, null, 2) + "\n```\n";
  await mcp("put_page", { slug: CURSOR_SLUG, content });
}

const BACKFILL_MODE = process.env.BACKFILL_MODE === "true";

async function main() {
  const now = Math.floor(Date.now() / 1000);
  const defaultOldest = String(now - LOOKBACK_DAYS * 86400);
  // Backfill ignores the saved cursor (re-pulls the whole window) and REPLACES
  // day-pages so it's safe to re-run; steady-state honors the cursor + appends.
  const cursor = BACKFILL_MODE ? {} : await loadCursor();
  const convs = await listConversations();
  console.error(`[bridge] ${convs.length} conversations to scan${BACKFILL_MODE ? " (BACKFILL)" : ""}`);

  let totalMsgs = 0, pagesWritten = 0, threadsPulled = 0;
  const capped: string[] = [];
  const channelsSeen = new Map<string, string>(); // slug -> label, for stub pages

  for (const c of convs) {
    const label = await convLabel(c);
    const oldest = cursor[c.id] || defaultOldest;
    let res;
    try { res = await history(c.id, oldest); }
    catch (e: any) { console.error(`[bridge] skip ${label}: ${e.message}`); continue; }

    // base messages, plus thread replies for any parent with replies. Threads
    // are capped to a recent window and skip bot/alert channels (replies API
    // is the rate-limit bottleneck).
    const pool: any[] = [...res.msgs];
    const threadCutoff = now - THREAD_LOOKBACK_DAYS * 86400;
    if (FETCH_THREADS && !SKIP_THREAD_CHANNELS.test(label)) {
      for (const m of res.msgs) {
        if (m.reply_count > 0 && m.thread_ts && Number(m.ts) > threadCutoff) {
          try { pool.push(...(await threadReplies(c.id, m.thread_ts))); threadsPulled++; }
          catch (e: any) { console.error(`[bridge] thread ${label}/${m.ts}: ${e.message}`); }
        }
      }
    }

    const fresh = pool
      .filter((m: any) => m.type === "message" && m.ts && Number(m.ts) > Number(oldest))
      .sort((a: any, b: any) => Number(a.ts) - Number(b.ts));
    if (!fresh.length) continue;
    channelsSeen.set(slugify(label), label); // remember for the channel stub page

    const byDay = new Map<string, any[]>();
    for (const m of fresh) {
      const day = iso(m.ts).slice(0, 10);
      (byDay.get(day) ?? byDay.set(day, []).get(day)!).push(m);
    }

    for (const [day, dayMsgs] of byDay) {
      const lines: string[] = [];
      for (const m of dayMsgs) {
        const who = await userName(m.user || m.username || m.bot_id);
        const time = iso(m.ts).slice(11, 19);
        const txt = cleanText(m.text || "");
        const thread = m.thread_ts && m.thread_ts !== m.ts ? " ↳" : "";
        // reactions arrive inline on the message (needs reactions:read scope)
        const rx = (m.reactions ?? []).map((r: any) => `:${r.name}:×${r.count}`).join(" ");
        // Link the author to their person node when we have a real user id.
        const author = m.user ? `[[people/${m.user}|${who}]]` : who;
        lines.push(`**${author}** (${time})${thread}: ${txt}${rx ? `  [${rx}]` : ""}`);
      }
      const slug = `slack/${slugify(label)}/${day}`;
      const fm = `---\ntype: conversation\ntitle: "Slack ${label} ${day}"\ntags: [slack]\n---\n`;
      let existingBody = "";
      if (!BACKFILL_MODE) {
        const existing = await mcp("get_page", { slug });
        if (existing) {
          try { existingBody = (JSON.parse(existing).compiled_truth || "").trim(); } catch { /* recreate */ }
        }
      }
      const body = existingBody
        ? `${existingBody}\n${lines.join("\n")}`
        : `# Slack: [[slack-channel/${slugify(label)}|#${label}]] — ${day}\n\n${lines.join("\n")}`;
      await mcp("put_page", {
        slug, content: `${fm}${body}\n`,
        source_kind: "webhook", ingested_via: "slack-bridge",
      });
      pagesWritten++;
    }

    totalMsgs += fresh.length;
    cursor[c.id] = String(Math.max(...fresh.map((m: any) => Number(m.ts))));
    if (res.capped) capped.push(label);
  }

  const stubs = await ensureEntityStubs(channelsSeen);
  await saveCursor(cursor);
  console.error(`[bridge] done: ${totalMsgs} messages (${threadsPulled} threads) -> ${pagesWritten} pages, ${stubs} entity stub(s) across ${convs.length} conversations`);
  if (capped.length)
    console.error(`[bridge] WARN: hit ${MAX_MSGS}-msg bound (oldest kept, rest next run): ${capped.join(", ")}`);
}

main().catch((e) => { console.error("[bridge] FATAL", e); process.exit(1); });
