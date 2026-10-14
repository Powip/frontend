// Sentry's public ingest DSN carries no read access or authentication privileges.
// An environment override remains available; the deployed panel uses Powip's project.
export const publicSentryDsn =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  (process.env.NODE_ENV === "production"
    ? "https://96b383cefc190bcf1361e6705e780458@o4512251270332416.ingest.us.sentry.io/4512252094644224"
    : undefined);
