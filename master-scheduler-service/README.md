# master-scheduler-service

This is a Cloudflare Worker (Wrangler) service that reads from D1 (`create-exams`) and writes schedules into `master_schedules`.

To install dependencies:

```bash
bun install
```

To run locally (recommended):

```bash
wrangler dev -c wrangler.jsonc
```

Environment:

- Local dev: put your key in `master-scheduler-service/.dev.vars` as `GEMINI_API_KEY=...`
- Remote deploy: use Wrangler secrets (do not commit keys):

```bash
wrangler secret put GEMINI_API_KEY -c wrangler.jsonc
```

Notes:

- If you see `no such table: ...`, apply D1 migrations for `create-exam-service` first (local/remote), then run the seeds.
