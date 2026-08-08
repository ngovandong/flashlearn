import * as Sentry from "@sentry/react";

/** No-op when VITE_SENTRY_DSN is unset, matching the backend's `if SENTRY_DSN:` guard. */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 1.0,
    sendDefaultPii: true,
  });
}

export { Sentry };
