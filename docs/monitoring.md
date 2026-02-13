# Monitoring with Prometheus and Grafana

Transcriptor MCP exposes Prometheus metrics on both the REST API and MCP HTTP server. You can scrape them with Prometheus and visualize in Grafana.

For error monitoring with stack traces and grouping, see [Sentry](sentry.md) (optional, [sentry.io](https://sentry.io) Cloud).

## Quick start (Docker Compose)

Add Prometheus and Grafana to your deployment:

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up -d
```

This starts:

- **Prometheus** at `http://localhost:9090` — scrapes `transcriptor-mcp-api:3000/metrics` and `transcriptor-mcp:4200/metrics`
- **Grafana** at `http://localhost:3001` — login: `admin` / `admin` (change on first login)

The Grafana Prometheus datasource is provisioned automatically.

## Endpoints

| Service | Metrics | Failures list |
|---------|---------|---------------|
| REST API (port 3000) | `GET /metrics` | `GET /failures` |
| MCP HTTP (port 4200) | `GET /metrics` | `GET /failures` |

## Available metrics

### REST API (`service=api`)

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_requests_total` | Counter | method, route, status_code | Total HTTP requests |
| `http_request_duration_seconds` | Histogram | method, route | Request latency |
| `http_request_errors_total` | Counter | — | Total 4xx/5xx responses |
| `cache_hits_total` | Counter | — | Cache hits |
| `cache_misses_total` | Counter | — | Cache misses |
| `subtitles_extraction_failures_total` | Counter | — | Videos where subtitles could not be obtained (neither YouTube nor Whisper) |

### MCP HTTP (`service=mcp`)

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `mcp_tool_calls_total` | Counter | tool | Successful MCP tool calls |
| `mcp_tool_errors_total` | Counter | tool | Failed MCP tool calls |
| `mcp_session_total` | Gauge | type=streamable\|sse | Active MCP sessions |
| `mcp_request_duration_seconds` | Histogram | endpoint | MCP request latency |
| `subtitles_extraction_failures_total` | Counter | — | Same as API |

## Failures endpoint

`GET /failures` returns a JSON list of URLs where subtitle extraction failed (YouTube subtitles and Whisper fallback both returned nothing):

```json
{
  "failures": [
    { "url": "https://youtube.com/watch?v=xxx", "timestamp": "2025-02-13T12:00:00.000Z" }
  ],
  "total": 42
}
```

- Only records failures when Whisper fallback was enabled and attempted.
- Stores the last 100 failures per process in memory (reset on restart).
- API and MCP each maintain their own list.

## PromQL examples

```
# Request rate (API)
rate(http_requests_total{service="api"}[5m])

# Error rate
rate(http_request_errors_total[5m])

# Latency p95 (API)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{service="api"}[5m]))

# Cache hit rate
rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))

# Subtitles extraction failures
increase(subtitles_extraction_failures_total[1h])

# MCP tool calls by tool
rate(mcp_tool_calls_total{service="mcp"}[5m])

# Active MCP sessions
mcp_session_total{service="mcp"}
```

## Configuration

Prometheus scrape config is in `monitoring/prometheus.yml`. Grafana datasource is provisioned from `monitoring/grafana/provisioning/datasources/datasources.yml`.

For a custom setup (e.g. existing Prometheus), add scrape targets:

```yaml
scrape_configs:
  - job_name: 'transcriptor-mcp-api'
    static_configs:
      - targets: ['<api-host>:3000']
    metrics_path: /metrics

  - job_name: 'transcriptor-mcp'
    static_configs:
      - targets: ['<mcp-host>:4200']
    metrics_path: /metrics
```
