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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Autenticación y recuperación después del pago

Login, renovación y cierre de sesión usan `POST /api/auth/login`,
`POST /api/auth/refresh` y `POST /api/auth/logout` en el dominio del frontend.
Los Route Handlers llaman a ms-auth desde el servidor. El refresh token se guarda
en la cookie `powip_refresh_token`, con `HttpOnly`, `SameSite=Lax`, sin `Domain`
y con `Path=/api/auth`; en producción y HTTPS también lleva `Secure`. Las
respuestas al navegador contienen el access token, nunca el refresh token.
Así, Safari no depende de una cookie de Railway en un contexto de terceros.

`AUTH_API_BASE_URL` permite configurar la base de ms-auth sólo en el servidor.
Si se omite, las rutas usan el valor existente de `NEXT_PUBLIC_API_USERS`.
La base admite el host raíz o la ruta `/api/v1`. En producción debe usar HTTPS.
Las rutas rechazan peticiones con origen ajeno, sólo aceptan JSON y no cachean
respuestas de sesión. El registro de cuentas y las APIs de negocio conservan
sus contratos actuales.

Las cookies anteriores pertenecen a Railway y no se pueden trasladar desde el
navegador al dominio de Powip. Durante la publicación puede ser necesario
iniciar sesión una vez más con la misma cuenta. Una suscripción activa se
recupera desde el backend; recuperar sesión no crea un nuevo checkout ni cobra
otra vez. Las renovaciones concurrentes dentro del mismo proveedor de sesión
comparten una petición, y una respuesta antigua no restaura una sesión cerrada.

La prueba de integración con WebKit se ejecuta con
`node scripts/verify-safari-auth.mjs`. Usa Next y servicios simulados locales,
sin credenciales, pagos o datos de producción. Verifica el login real, la cookie
propia, la actualización de sesión tras la confirmación de Flow, la recarga y
el cierre de sesión. Requiere los navegadores de Playwright instalados.
