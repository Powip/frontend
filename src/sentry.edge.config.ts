import * as Sentry from "@sentry/nextjs";
import { safeBreadcrumb, scrubEvent } from "@/lib/observability";
import { publicSentryDsn } from "@/lib/sentryPublicConfig";
import { installErrorReporting } from "@/lib/httpErrorReporting";

Sentry.init({
  dsn: process.env.SENTRY_DSN || publicSentryDsn,
  enabled: Boolean(process.env.SENTRY_DSN || publicSentryDsn),
  environment:
    process.env.SENTRY_ENVIRONMENT ||
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
    process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,
  sampleRate: 1,
  tracesSampleRate: 0.1,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
  },
  enhanceFetchErrorMessages: "report-only",
  initialScope: { tags: { service: "frontend-edge" } },
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  beforeBreadcrumb: safeBreadcrumb,
});

if (process.env.SENTRY_DSN || publicSentryDsn) installErrorReporting();
