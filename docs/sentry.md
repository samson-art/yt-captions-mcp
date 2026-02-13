# Error monitoring with Sentry

Transcriptor MCP can send errors to [Sentry](https://sentry.io) for grouping, stack traces, and context. This complements Prometheus metrics (see [monitoring.md](monitoring.md)) with detailed error reporting.

## Why Sentry

- **Single place for errors** — 5xx responses, unhandled rejections, uncaught exceptions, and shutdown failures are captured with stack traces.
- **Grouping and context** — Request URL/method are attached for API errors; you can set environment and release for filtering.
- **Alerts** — Configure Sentry Alerts and notifications (email, Slack) for new or recurring issues.

## Sentry Cloud setup

1. Sign up at [sentry.io](https://sentry.io) (free tier available).
2. Create an organization and a project; choose **Node.js** as the platform.
3. In the project settings, copy the **DSN** (e.g. `https://<key>@o0.ingest.sentry.io/<project_id>`).
4. Optionally configure [Alerts](https://docs.sentry.io/product/alerts/) and notification integrations (Slack, email).

## Application configuration

Set these environment variables when running the REST API or MCP HTTP server:

| Variable | Description |
|----------|-------------|
| `SENTRY_DSN` | Your project DSN from Sentry. If unset, the SDK does not send any events (no-op). |
| `SENTRY_ENVIRONMENT` | Optional. e.g. `production`, `staging`. Shown in Sentry for filtering. |
| `SENTRY_RELEASE` | Optional. e.g. version from package.json or CI. Helps match errors to deployments. |

Example (`.env` or Docker):

```bash
SENTRY_DSN=https://your-key@o0.ingest.sentry.io/your-project-id
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=0.5.0
```

When `SENTRY_DSN` is not set, the app runs as before; no events are sent to Sentry.

## What is captured

- **REST API:** All 4xx and 5xx from the error handler (with request method, URL, and statusCode in context). 4xx are sent with level **warning**, 5xx with level **error**. Also: startup failures, shutdown errors, unhandled rejections, uncaught exceptions.
- **MCP HTTP:** SSE transport errors, startup failures, shutdown errors, unhandled rejections, uncaught exceptions.

In Sentry you can filter by `request.statusCode` (in the event context) or by level (warning vs error) to separate client errors from server errors.

## Alerts in Sentry

In the Sentry UI: **Alerts** → create a rule (e.g. when an issue is first seen or when event count exceeds a threshold) and add notification actions (email, Slack, etc.). Filter by environment or release if you set `SENTRY_ENVIRONMENT` / `SENTRY_RELEASE`.
