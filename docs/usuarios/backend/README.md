# Usuarios, Roles y Referidos — contratos de backend por bloque

Fecha: 2026-10-07. Rama: `feat/usuarios-roles-permisos`.

Este directorio divide el trabajo de backend necesario para que `/usuarios` iguale funcionalmente a `powip-usuarios.html` (incluida la pestaña **Referidos y cobro**). Cada documento se puede trabajar sin leer los demás. El contrato general y sus decisiones previas siguen en [`../backend-contract.md`](../backend-contract.md).

## Convenciones

- **[FE]** el frontend ya llama a la operación (se cita el archivo). Prueba lo que el frontend espera, **no** lo que el backend cumple.
- **[BE]** confirmado por backend con OpenAPI o prueba de contrato. **Hoy no hay ningún punto [BE].**
- **[SPEC]** figura en los PDF de especificación o en el mockup; puede no existir.
- **[PROPUESTA]** ruta o campo nuevo sugerido en estos documentos. No existe hasta que backend lo confirme; se puede adaptar a rutas que backend ya tenga. No hay que implementar dos rutas equivalentes.
- Una operación que no aparece en el frontend **no** se asume inexistente en backend: cada bloque pide confirmar qué hay antes de crear algo nuevo.
- Los ejemplos JSON usan datos ficticios y nunca incluyen contraseñas, tokens ni cuentas completas.

Endpoints que el frontend usa hoy (referencia común, todos [FE]):

| ID | Operación | Uso en el frontend |
|---|---|---|
| E1 | `POST /api/v1/auth/company/{companyId}/user` | Alta desde `/usuarios` (`src/services/userService.ts` → `createCompanyUser`) y CRM superadmin |
| E2 | `GET /api/v1/roles` | Catálogo de roles (`getRoles`) en `/usuarios`, formulario y superadmin |
| E3 | `GET /api/v1/auth/company/{companyId}/users` | Listado completo de la empresa (`getUsersByCompany`) |
| E4 | `GET /api/v1/auth/users` | Listado de plataforma (superadmin) |
| E5 | `PUT /api/v1/auth/user/{userId}` | Edición (`updateUser`) en `/usuarios` y superadmin |
| E6 | `GET /api/v1/auth/user/{userId}` | Perfil (`getUserProfile`) en Shalom |
| E7 | `POST /api/v1/auth/admin/register` | Alta de plataforma (`createPlatformUser`) en CRM superadmin |
| E8 | `DELETE /api/v1/auth/user/{userId}` | **Solo** reversión en `LeadActivationFlow` |
| E10 | `POST /api/v1/auth/refresh` | Sesión (`AuthContext`) |
| E12 | `GET/PUT /auth/user/{id}`, `POST /auth/update-password` | `configuracion/editar-usuario`, sin `Authorization` |

## Estados

- **UI pendiente**: la pantalla no existe en el frontend.
- **UI preparada**: la pantalla y sus controles existen; las acciones sin contrato quedan deshabilitadas con un aviso breve para el usuario. Las referencias a estos documentos están solo en la documentación, no en el producto.
- **backend pendiente de confirmar**: no hay OpenAPI ni prueba de contrato.
- **backend confirmado**: backend entregó contrato y pruebas.
- **integrado en frontend**: el frontend llama a una operación que existe hoy y funciona con ella. No implica confirmación de backend.
- **integrado y confirmado**: además, backend confirmó el contrato y la prueba de aceptación pasa.

La falta de confirmación de backend **no** significa que la integración actual falle: listado, alta, edición, catálogo de roles y exportación funcionan hoy contra los endpoints existentes. Significa que su comportamiento (aislamiento, validaciones, errores) no está garantizado por un contrato.

## Orden recomendado y estado actual

| Orden | Documento | Pantalla | UI | Backend | Integración |
|---|---|---|---|---|---|
| 1 | [00-sesion-y-reglas.md](00-sesion-y-reglas.md) | Reglas comunes, sesión, aislamiento | — | pendiente de confirmar | — |
| 2 | [02-tab-usuarios-listado.md](02-tab-usuarios-listado.md) | Tarjetas, búsqueda, filtros, tabla | UI preparada | pendiente de confirmar | Integrado en frontend con E2/E3; presencia y roles personalizados sin datos |
| 3 | [01-pagina-usuarios.md](01-pagina-usuarios.md) | Página y contadores de pestañas | UI preparada | pendiente de confirmar | Integrado en frontend con E2/E3 |
| 4 | [05-modal-editar-usuario.md](05-modal-editar-usuario.md) | Editar usuario | UI preparada | pendiente de confirmar | Datos y rol integrados en frontend con E5; estado y email sin contrato |
| 5 | [04-modal-crear-usuario.md](04-modal-crear-usuario.md) | Crear usuario | UI preparada | pendiente de confirmar | Alta integrada en frontend con E1; login, género, permisos y contraseña temporal sin contrato |
| 6 | [08-tab-roles-y-permisos.md](08-tab-roles-y-permisos.md) | Catálogo de roles | UI preparada | pendiente de confirmar | Integrado en frontend con E2 y conteos locales |
| 7 | [06-eliminar-usuario.md](06-eliminar-usuario.md) | Confirmación de baja | UI preparada | pendiente de confirmar | Deshabilitado |
| 8 | [03-seleccion-y-exportacion.md](03-seleccion-y-exportacion.md) | Selección y Exportar | UI preparada | pendiente de confirmar (solo si se pagina) | Integrado en frontend (exportación local sobre E3 completo) |
| 9 | [07-resumen-usuario.md](07-resumen-usuario.md) | Resumen (extensión) | UI preparada | pendiente de confirmar | Perfil integrado en frontend con E3; actividad sin datos |
| 10 | [11-matriz-permisos-usuario.md](11-matriz-permisos-usuario.md) | Matriz de permisos | UI preparada (vista previa) | pendiente de confirmar | Deshabilitado |
| 11 | [09-modal-crear-rol.md](09-modal-crear-rol.md) | Crear rol personalizado | UI preparada | pendiente de confirmar | Deshabilitado |
| 12 | [10-modal-editar-permisos.md](10-modal-editar-permisos.md) | Editar permisos (extensión) | UI preparada | pendiente de confirmar | Deshabilitado |
| 13 | [18-primer-ingreso-cambio-password.md](18-primer-ingreso-cambio-password.md) | Contraseña temporal y cambio inicial | UI pendiente | pendiente de confirmar | — |
| 14 | [12-modal-invitar-email.md](12-modal-invitar-email.md) | Invitar por email | UI preparada | pendiente de confirmar | Deshabilitado |
| 15 | [13-pagina-aceptar-invitacion.md](13-pagina-aceptar-invitacion.md) | Aceptar invitación | UI pendiente | pendiente de confirmar | — |
| 16 | [14-tab-referidos-y-cobro.md](14-tab-referidos-y-cobro.md) | Referidos y cobro | UI preparada | pendiente de confirmar (servicio dueño sin definir) | Deshabilitado |
| 17 | [15-formulario-cuenta-bancaria.md](15-formulario-cuenta-bancaria.md) | Cuenta bancaria | UI preparada | pendiente de confirmar | Deshabilitado |
| 18 | [16-formulario-yape-plin.md](16-formulario-yape-plin.md) | Yape / Plin | UI preparada | pendiente de confirmar | Deshabilitado |
| 19 | [17-liquidacion-y-notificaciones.md](17-liquidacion-y-notificaciones.md) | Liquidación y avisos | Sin pantalla propia | pendiente de confirmar | — |

**Por qué este orden:** el bloque 00 condiciona la seguridad de todos los demás. Después conviene estabilizar lo que ya está conectado (listado, edición, alta), luego el modelo de roles y permisos (que alimenta crear rol, editar permisos e invitaciones) y al final Referidos, que tiene otro dueño de datos y depende de suscripciones.

## Archivos del frontend

| Archivo | Bloques |
|---|---|
| `src/app/usuarios/page.tsx` | 01, 02, 03, 06, 07, 08 |
| `src/components/users/UserSummaryCards.tsx` | 02 |
| `src/components/users/UsersTable.tsx`, `UsersPagination.tsx` | 02, 03, 06, 07 |
| `src/services/userListing.ts` | 02, 08 |
| `src/services/userExport.ts` | 03 |
| `src/components/forms/UserForm.tsx`, `src/components/modals/UserModal.tsx` | 04, 05, 11, 18 |
| `src/components/users/DeleteUserDialog.tsx` | 06 |
| `src/components/users/UserSummaryModal.tsx` | 07 |
| `src/components/users/RolesCatalog.tsx` | 08 |
| `src/components/users/CreateRoleModal.tsx` | 09 |
| `src/components/users/EditPermissionsModal.tsx` | 10 |
| `src/components/users/PermissionMatrix.tsx`, `permissionMatrixPreview.ts` | 09, 10, 11 |
| `src/components/users/InviteUserModal.tsx` | 12 |
| `src/components/users/referrals/ReferralsTab.tsx` | 14 |
| `src/components/users/referrals/BankAccountForm.tsx` | 15 |
| `src/components/users/referrals/WalletForm.tsx` | 16 |

## Criterio de 100 %

La UI completa no equivale a funcionalidad completa. Un bloque solo pasa a **integrado y confirmado** cuando:

1. Backend entregó contrato (OpenAPI o equivalente) y pruebas de contrato.
2. El frontend reemplazó el aviso de pendiente por la llamada real, sin éxitos simulados.
3. Los datos persisten tras recargar y están autorizados en el servidor (bloque 00).
4. Las pruebas de aceptación del documento pasan.
5. Se hizo la comparación visual con el mockup en desktop y mobile.
