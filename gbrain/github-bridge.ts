// github-bridge.ts — pulls PRs (and issues) involving you into gbrain.
//
// Runs as a k8s CronJob on the gbrain image (Bun). Uses the GitHub search API
// (`involves:@me`) to find PRs/issues you authored, are assigned, review, or
// are mentioned in — across every repo the token can see. Each becomes a page;
// sync state lives in the `system/github-sync-cursor` brain page.
//
// v1 captures the PR/issue title + body + metadata from the search result
// (one API call per page, no per-item fan-out — stays well inside the 30/min
// search rate limit). Comment/review threads are not pulled (future work).
//
// Env:
//   GITHUB_TOKEN                  PAT with repo read
//   GBRAIN_MCP_URL                e.g. http://gbrain:3131/mcp
//   GBRAIN_TOKEN                  gbrain_… bearer
//   FIRST_RUN_LOOKBACK_DAYS       first-sight backfill window (default 30)
//   MAX_ITEMS_PER_RUN             per-run cap, logged when hit (default 300)

const GH_TOKEN = process.env.GITHUB_TOKEN!;
const MCP_URL = process.env.GBRAIN_MCP_URL!;
const MCP_TOKEN = process.env.GBRAIN_TOKEN!;
const LOOKBACK_DAYS = Number(process.env.FIRST_RUN_LOOKBACK_DAYS ?? "30");
const MAX_ITEMS = Number(process.env.MAX_ITEMS_PER_RUN ?? "300");
const CURSOR_SLUG = "system/github-sync-cursor";

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
  const payload = dataLine ? dataLine.slice(6) : text;
  return JSON.parse(payload).result?.content?.[0]?.text as string | undefined;
}

async function gh(path: string) {
  const url = `https://api.github.com${path}`;
  for (;;) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "gbrain-github-bridge",
      },
    });
    if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
      const reset = Number(res.headers.get("x-ratelimit-reset") ?? "0") * 1000;
      const wait = Math.max(2000, reset - Date.now() + 1000);
      console.error(`[gh] rate limited; waiting ${Math.round(wait / 1000)}s`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`gh ${path}: ${res.status} ${await res.text()}`);
    return res.json();
  }
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

async function loadCursor(): Promise<{ since?: string }> {
  const content = await mcp("get_page", { slug: CURSOR_SLUG, include_deleted: true });
  if (!content) return {};
  try {
    const truth = JSON.parse(content).compiled_truth || "";
    const m = truth.match(/```json\s*([\s\S]*?)```/);
    if (m) return JSON.parse(m[1]);
  } catch { /* first run */ }
  return {};
}

async function saveCursor(cur: { since?: string }) {
  const content =
    `---\ntype: system\ntitle: GitHub Sync Cursor\n---\n` +
    `Last-synced GitHub updated_at watermark. Managed by github-bridge — do not edit.\n\n` +
    "```json\n" + JSON.stringify(cur, null, 2) + "\n```\n";
  await mcp("put_page", { slug: CURSOR_SLUG, content });
}

// Page through the search API for one issue-type, ascending by updated so the
// cursor advances monotonically. Returns items + whether the cap was hit.
async function searchInvolves(kind: "pr" | "issue", since: string) {
  const q = encodeURIComponent(
    `is:${kind === "pr" ? "pull-request" : "issue"} involves:@me updated:>=${since}`,
  );
  const items: any[] = [];
  let page = 1;
  for (;;) {
    const j = await gh(`/search/issues?q=${q}&sort=updated&order=asc&per_page=100&page=${page}`);
    items.push(...(j.items ?? []));
    if (!j.items?.length || j.items.length < 100 || items.length >= MAX_ITEMS) break;
    page++;
  }
  const capped = items.length > MAX_ITEMS;
  return { items: items.slice(0, MAX_ITEMS), capped };
}

function pageFor(item: any) {
  const repo = item.repository_url.split("/repos/")[1]; // owner/name
  const kind = item.pull_request ? "pr" : "issue";
  const slug = `github/${slugify(repo)}/${kind}-${item.number}`;
  const labels = (item.labels ?? []).map((l: any) => l.name).join(", ");
  const fm =
    `---\ntype: reference\ntitle: ${JSON.stringify(`${repo}#${item.number} ${item.title}`.slice(0, 120))}\n` +
    `tags: [github, ${kind}]\n---\n`;
  const body =
    `# ${repo}#${item.number} — ${item.title}\n\n` +
    `- **State:** ${item.state}${item.draft ? " (draft)" : ""}\n` +
    `- **Author:** ${item.user?.login}\n` +
    `- **Updated:** ${item.updated_at}\n` +
    (labels ? `- **Labels:** ${labels}\n` : "") +
    `- **URL:** ${item.html_url}\n\n` +
    `${item.body || "_(no description)_"}\n`;
  return { slug, content: fm + body, updated: item.updated_at };
}

async function main() {
  const cur = await loadCursor();
  const since = cur.since ||
    new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString().slice(0, 10);
  console.error(`[gh-bridge] syncing items updated since ${since}`);

  let written = 0, maxUpdated = cur.since || since;
  const cappedKinds: string[] = [];

  for (const kind of ["pr", "issue"] as const) {
    let res;
    try { res = await searchInvolves(kind, since); }
    catch (e: any) { console.error(`[gh-bridge] ${kind} search failed: ${e.message}`); continue; }
    if (res.capped) cappedKinds.push(kind);
    for (const item of res.items) {
      const p = pageFor(item);
      await mcp("put_page", {
        slug: p.slug, content: p.content,
        source_kind: "webhook", ingested_via: "github-bridge",
      });
      written++;
      if (p.updated > maxUpdated) maxUpdated = p.updated;
    }
    console.error(`[gh-bridge] ${kind}: ${res.items.length} items`);
  }

  await saveCursor({ since: maxUpdated });
  console.error(`[gh-bridge] done: ${written} pages; cursor -> ${maxUpdated}`);
  if (cappedKinds.length)
    console.error(`[gh-bridge] WARN: hit ${MAX_ITEMS}-item cap for [${cappedKinds.join(", ")}] (remainder next run)`);
}

main().catch((e) => { console.error("[gh-bridge] FATAL", e); process.exit(1); });
