This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Sentry

The deployed panel reports uncaught browser, React, Next.js server and Edge errors,
and handled failures from Axios (including created clients), fetch, React Query
queries/mutations and console.error. HTTP 5xx/network errors are issues; 408/429
are warnings. Expected validation/authentication 4xx responses are breadcrumbs,
and intentional request cancellations are ignored. Error events use 100% sampling;
performance traces use 10% sampling. Retry attempts remain separate HTTP failures;
the same error object is reported only once across transport/query/boundary handlers.

Production has the public ingest DSN of Powip's existing frontend project in
src/lib/sentryPublicConfig.ts. It grants no read access. Override it with
NEXT_PUBLIC_SENTRY_DSN (before building); nonproduction builds require an explicit
DSN. SENTRY_DSN can separately override the server/Edge destination. Vercel sets the
environment and commit release automatically; other hosts can set SENTRY_ENVIRONMENT,
SENTRY_RELEASE and their NEXT_PUBLIC_ equivalents. No customer payloads, credentials,
cookies, headers or URL query values are sent. Each event includes service, operation,
status and a stack trace. Configure the build-only SENTRY_AUTH_TOKEN to upload source
maps; without it, error reporting works with the deployed JavaScript stack.

Validation: npm test -- --runInBand src/lib/__tests__/observability.test.ts
src/lib/__tests__/httpErrorReporting.test.ts src/lib/__tests__/axiosAuth.test.ts,
npm run typecheck, npm run build. The tests reproduce a handled 503, offline failures,
query deduplication, cancellations and credential/customer-data stripping.


## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
