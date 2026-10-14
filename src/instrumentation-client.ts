import * as Sentry from "@sentry/nextjs";
import { installBrowserErrorReporting } from "@/lib/httpErrorReporting";
import { safeBreadcrumb, scrubEvent } from "@/lib/observability";
import { publicSentryDsn } from "@/lib/sentryPublicConfig";

Sentry.init({
  dsn: publicSentryDsn,
  enabled: Boolean(publicSentryDsn),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
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
  initialScope: { tags: { service: "frontend" } },
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  beforeBreadcrumb: safeBreadcrumb,
});

if (publicSentryDsn) installBrowserErrorReporting();
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
