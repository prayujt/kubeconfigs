# gbrain

Self-hosted [GBrain](https://github.com/garrytan/gbrain) memory layer — CLI + remote
HTTP MCP server — at **https://gbrain.prayujt.com**, backed by Postgres+pgvector,
running Anthropic **Opus 4.8** for enrichment. Pinned to `server-master`, local
hostPath storage under `/srv/gbrain`.

## Components

| File | What |
|------|------|
| `namespace.yaml` | `gbrain` namespace |
| `secrets.yaml` | all credentials (⚠️ plaintext — see Security) |
| `volume.yaml` | RWO hostPath PVs/PVCs at `/srv/gbrain/{data,psql}` |
| `psql.yaml` | `pgvector/pgvector:pg16` + pgvector init + ClusterIP |
| `deployment.yaml` | GBrain server (Deployment, replicas:1, Recreate) + ClusterIP `gbrain:3131` |
| `ingress.yaml` | `gbrain.prayujt.com` TLS via cert-manager |
| `Dockerfile` | builds `docker.prayujt.com/gbrain:latest` (Bun + gbrain from source) |

### Data-ingestion bridges (push into gbrain via the `put_page` MCP tool)

| Source | Mechanism | Schedule / endpoint | Files |
|--------|-----------|---------------------|-------|
| Slack | poll (Web API, user token) | CronJob every 15m | `slack-bridge.ts`, `slack-cron.yaml` |
| GitHub | poll (search `involves:@me`) | CronJob every 30m | `github-bridge.ts`, `github-cron.yaml` |
| Gmail | poll (Gmail API, OAuth refresh) | CronJob every 10m | `gmail-bridge.ts`, `gmail-cron.yaml` |
| Slack + GitHub | **webhooks (real-time)** | `https://gbrain-hooks.prayujt.com` | `webhook-receiver.ts`, `webhook.yaml` |
| Slack (one-off) | 6-month backfill: threads + reactions | manual Job | `slack-backfill-job.yaml` |
| Gmail (one-off) | 6-month backfill: all mail | manual Job | `gmail-backfill-job.yaml` |

All pods are pinned to `server-master` via `nodeSelector` — the gbrain image is
**amd64-only** and the three worker nodes are arm64, so master is the only node
that can run it. (A multi-arch image would lift this.)

Gmail real-time push is **not** wired: Gmail has no plain HTTP webhook — it needs
Cloud Pub/Sub + `users.watch()` (which also expires every 7d and needs renewal),
a heavier GCP setup. The 10-minute cron is the practical equivalent.

Polling crons and webhooks run together: webhooks give real-time, crons are the
backstop that catches anything missed. Each bridge stores its cursor as a
`system/*-sync-cursor` page in gbrain (idempotent). Each has its own revocable
bearer token (`gbrain auth revoke <name>`).

## ⚠️ Remaining manual steps (need access I don't have)

### 1. Embeddings (semantic search) — needs an API key
Anthropic has no embedding endpoint, so vector search is **off**; retrieval is
keyword + graph only. To enable, provide an OpenAI (`sk-`) or Voyage (`pa-`) key:
```bash
kubectl -n gbrain exec deploy/gbrain -c gbrain -- gbrain config set openai_api_key sk-...
kubectl -n gbrain exec deploy/gbrain -c gbrain -- gbrain config set embedding_model openai:text-embedding-3-large
kubectl -n gbrain exec deploy/gbrain -c gbrain -- gbrain embed --all   # backfill
```

### 2. Slack webhook (real-time) — needs Slack app admin
The receiver is live at `https://gbrain-hooks.prayujt.com/slack/events`. To connect:
1. Create/own a Slack app at https://api.slack.com/apps.
2. **Event Subscriptions** → Request URL: `https://gbrain-hooks.prayujt.com/slack/events`
   (the receiver answers the `url_verification` challenge automatically).
3. Subscribe to bot/user events: `message.channels`, `message.groups`,
   `message.im`, `message.mpim`.
4. Copy the app **Signing Secret** (Basic Information) into the k8s secret and
   restart the receiver:
   ```bash
   kubectl -n gbrain patch secret gbrain-secrets --type=merge \
     -p '{"stringData":{"slack-signing-secret":"<SIGNING_SECRET>"}}'
   kubectl -n gbrain rollout restart deploy/webhook-receiver
   ```
   Until set, Slack events are accepted **unverified** (receiver logs a warning).

### 3. GitHub webhook (real-time) — needs repo/org admin
The read-only PAT can't create hooks (403). The receiver is live at
`https://gbrain-hooks.prayujt.com/github`. To connect, in a repo/org's
**Settings → Webhooks → Add webhook**:
- Payload URL: `https://gbrain-hooks.prayujt.com/github`
- Content type: `application/json`
- Secret: the value of `github-webhook-secret` in `gbrain-secrets`
  (`kubectl -n gbrain get secret gbrain-secrets -o jsonpath='{.data.github-webhook-secret}' | base64 -d`)
- Events: Pull requests, Issues.

## Clients / tokens

- Bootstrap admin token (for `/admin`): `kubectl -n gbrain logs deploy/gbrain -c gbrain | grep -A1 "Admin Token"`
- Connect a client: `gbrain connect https://gbrain.prayujt.com/mcp --token <gbrain_…>`
- Bearer tokens minted: `claude-code`, `slack-bridge`, `github-bridge`,
  `webhook-receiver`.

## Security

`secrets.yaml` holds live credentials in **plaintext** (Anthropic key, Slack
user token, GitHub PAT, Telegram bot token, webhook secrets, bearer tokens).
Do **not** push without addressing this — gitignore it or move to
sealed-secrets/SOPS. The `/mcp` endpoint is internet-exposed but requires a
256-bit bearer token (verified: unauthenticated → 401).

## Notes

- Telegram ingestion was removed at the user's request (token + sync + bridge
  deleted; it had captured no data). The bot token still exists in
  `ironclaw-secrets` (its original home) — untouched.
