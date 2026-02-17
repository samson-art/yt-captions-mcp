# Use case: Self-hosted and enterprise

Run Transcriptor MCP on your own infrastructure with optional authentication, Redis cache, Prometheus metrics, and Sentry — for teams that need control over data, rate limits, and monitoring.

## Who this is for

- **Teams** that require the MCP server (and optionally the REST API) to run on **your VPS, Tailscale, or private cloud**.
- You need **optional authentication** (Bearer token), **rate limiting**, and **audit-friendly** behavior.
- You want **observability**: Prometheus metrics, failure tracking, and optional Sentry for errors.

## Deployment options

- **Docker** (recommended): run the MCP HTTP server (and optionally the REST API) in containers; use `docker-compose.example.yml` for a full stack with Prometheus and Grafana.
- **Node.js**: build with `npm run build`, then `npm run start:mcp:http` (and/or `npm start` for the API). Set env vars as in [configuration.md](configuration.md).

For remote access (e.g. Cursor, Claude, n8n) use **HTTP/SSE** or **streamable HTTP** on a host reachable via your network (e.g. Tailscale) or reverse proxy.

## Authentication

- **MCP_AUTH_TOKEN** (optional): when set, the MCP HTTP server requires `Authorization: Bearer <token>` on requests. Clients (Cursor, Claude Code, n8n, Smithery) must send this token. See [configuration.md](configuration.md) for allowlists and CORS.
- **REST API**: no built-in auth; put the API behind a reverse proxy (e.g. nginx, Cloudflare) with your own auth if needed.

Keep tokens and secrets in environment variables or a secret manager; do not commit them. See the main [README](https://github.com/samson-art/transcriptor-mcp#readme) Security section.

## Caching and performance

- **Redis:** Set `CACHE_MODE=redis` and `CACHE_REDIS_URL` to cache subtitles and metadata. Reduces yt-dlp calls and improves latency for repeated URLs. See [caching.md](caching.md).
- **Rate limiting:** MCP server supports configurable rate limits (see [configuration.md](configuration.md)). Use yt-dlp sleep options (`YT_DLP_SLEEP_REQUESTS`, `YT_DLP_SLEEP_SUBTITLES`) to avoid platform throttling when running heavy batch jobs.

## Monitoring

### Prometheus metrics

Both the **REST API** (port 3000) and **MCP HTTP** (port 4200) expose:

- **GET /metrics** — Prometheus-format metrics.

Key metrics for MCP:

- `mcp_tool_calls_total` (by tool) — successful tool calls.
- `mcp_tool_errors_total` (by tool) — failed tool calls.
- `mcp_session_total` — active sessions (streamable vs SSE).
- `mcp_request_duration_seconds` — request latency.
- `subtitles_extraction_failures_total` — videos where neither YouTube nor Whisper returned subtitles.
- `whisper_requests_total` (by mode) — Whisper transcription attempts.

Scrape these with Prometheus; use the provided [docker-compose.example.yml](https://github.com/samson-art/transcriptor-mcp/blob/main/docker-compose.example.yml) for a ready-made Prometheus + Grafana setup. Full metric list and PromQL examples: [monitoring.md](monitoring.md).

### Failures endpoint

- **GET /failures** (API and MCP HTTP): returns a JSON list of URLs where subtitle extraction failed (last 100 per process). Useful for debugging and alerting. See [monitoring.md](monitoring.md).

### Sentry (optional)

For error tracking with stack traces and grouping, configure Sentry via environment variables. The app uses `@sentry/node`; 5xx and 4xx can include request context and breadcrumbs. Details: [sentry.md](sentry.md).

## Quick reference: key docs

| Topic | Document |
|-------|----------|
| Env vars, auth, rate limits, yt-dlp, Redis | [configuration.md](configuration.md) |
| Prometheus, Grafana, /metrics, /failures, PromQL | [monitoring.md](monitoring.md) |
| Redis cache setup | [caching.md](caching.md) |
| Sentry setup | [sentry.md](sentry.md) |
| MCP Docker/Node/HTTP setup | [quick-start.mcp.md](quick-start.mcp.md) |

## See also

- [Researchers and batch processing](use-case-researchers-batch.md) — heavy use with playlists and search filters; self-host + Redis + monitoring.
- [n8n automation](use-case-n8n-automation.md) — connecting n8n to your self-hosted MCP server URL.
