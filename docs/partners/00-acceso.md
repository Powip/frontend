# Acceso al portal de partners

## Alcance

Identidad y acceso del portal `/partners/*` (excepto `/partners/admin/*`). Resumen, comisiones y pagos siguen con datos mock porque sus contratos son provisionales; este cambio solo decide si se muestran.

## Contrato

Colección Postman "POWIP Partners — Frontend Contract v2", carpeta "02 · STABLE SHAPE", `GET /me`.

```
GET {NEXT_PUBLIC_API_PARTNERS}/me
Authorization: Bearer <token>

200 { "id", "status", "displayName", "country", "currency", "referralLink", "referralCode", "permissions": [...] }
403 { "code": "PARTNER_NOT_ACTIVE", "message", "correlationId", "details" }
```

El navegador nunca envía `partnerId`; la identidad sale del bearer.

## Capas

`api/partner-me.api.ts` → `dto/partner-me-response.dto.ts` → `mappers/to-partner-profile.ts` + `mappers/to-partner-identity-from-error.ts` → `services/get-partner-identity.ts` → `hooks/use-partner-identity.ts` (`partnersKeys.me()`) → `utils/partner-access.ts` → `app/partners/_components/partner-portal-gate.tsx`.

## Respuesta → estado visible

| Respuesta | Estado | Pantalla |
| --- | --- | --- |
| pendiente | `loading` | "Verificando tu cuenta de partner…" |
| 200 `ACTIVE` | `active` | portal con pestañas según permisos |
| 200 `SUSPENDED` o 403 `PARTNER_NOT_ACTIVE` con `SUSPENDED` | `suspended` | "Tu cuenta de partner está suspendida" |
| 200/403 con `APPLIED`, `REJECTED` u otro | `inactive` | aviso de cuenta no activa |
| 404 u otro 403 | `no_profile` | "Esta cuenta no tiene un perfil de partner" |
| 401 | `unauthorized` | "No pudimos validar tu sesión…" + Reintentar |
| red / 5xx | `error` | "No pudimos verificar tu cuenta…" + Reintentar + `correlationId` si vino |

Estado desconocido nunca se trata como activo. Un fallo de la API nunca se reemplaza con datos mock. Si un refetch falla, se conserva la última identidad conocida. Solo se reintenta una vez ante red/5xx.

## Permisos

| Permiso | Controla |
| --- | --- |
| `REFERRALS_READ` | pestaña y ruta `/partners/referidos` |
| `REFERRALS_CREATE` | botón "Registrar referido", acción del estado vacío y diálogo de alta |
| `COMMISSIONS_READ` | pestaña y ruta `/partners/comisiones` |
| `PAYOUTS_READ` | pestaña y ruta `/partners/pagos` |

Resumen, Mi Link y Mi Plan no tienen permiso asociado en el contrato: se muestran a cualquier partner activo. Ocultar controles en el frontend no es autorización; el backend debe validar cada request.

El perfil activo se expone con `useCurrentPartner()` (`features/partners/context/current-partner.context.tsx`).
