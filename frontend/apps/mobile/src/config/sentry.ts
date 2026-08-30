import * as Sentry from "@sentry/react-native";
import { ENV } from "@/config/env";

/** No-op when EXPO_PUBLIC_SENTRY_DSN is unset, matching the backend's `if SENTRY_DSN:` guard. */
export function initSentry(): void {
  if (!ENV.sentry.dsn) return;

  Sentry.init({
    dsn: ENV.sentry.dsn,
    environment: ENV.sentry.environment,
    tracesSampleRate: 1.0,
    sendDefaultPii: true,
    enableLogs: true,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],
  });
}

export { Sentry };
