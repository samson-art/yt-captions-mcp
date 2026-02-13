/**
 * Sentry instrumentation. Must be loaded first via node -r ./dist/instrument.js
 * so that error and performance instrumentation is applied before other modules.
 * When SENTRY_DSN is not set, the SDK does not send events.
 */
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT,
  release: process.env.SENTRY_RELEASE,
});
