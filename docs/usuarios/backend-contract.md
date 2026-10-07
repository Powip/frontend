# Contrato técnico de backend — Usuarios, Roles e Invitaciones

Estado: **borrador para validar con backend**. Fecha de elaboración: 2026-10-02.
Rama de referencia: `feat/usuarios-roles-permisos`. El documento está trackeado desde el commit `e9ef6af` («feat: contrato»), subido a `origin/feat/usuarios-roles-permisos`. Las referencias `archivo:línea` se verificaron contra el commit anterior, `1f1c824` («fix(users): restrict access and remove unpersisted actions»); cambios posteriores en esos archivos pueden desplazarlas. Las secciones 1.7 a 1.9 describen el trabajo de frontend posterior (2026-10-06 y 2026-10-07) y citan archivos sin número de línea. Desde 2026-10-07 el trabajo de backend está dividido por bloques en [`backend/README.md`](backend/README.md).

## 0. Alcance, fuentes y convención de evidencia

**Dentro de alcance:** usuarios de empresa, roles/permisos e invitaciones por email. **Desde 2026-10-07** el alcance es todo `powip-usuarios.html`, incluida la pestaña «Referidos y cobro»; Referidos mantiene contrato y servicio dueño propios, documentados en los bloques 14 a 17 de [`backend/`](backend/README.md).

**Fuera de alcance (contratos separados):** cuotas/metas, comisiones y facturación. El programa de referidos estuvo fuera hasta 2026-10-06 (D8) y ahora se trabaja en los bloques 14 a 17 sin asumir ms-auth como dueño. Solo se citan como frontera:

- `GET/PATCH /api/usuarios/:id/funciones` (spec de comisiones) pertenece al contrato de comisiones/cuotas.
- La pestaña «Referidos y cobro» del prototipo tiene tablas y endpoints propios (spec v2 §4); su ubicación se deja como decisión abierta (D8).

**Fuentes consultadas**

| Fuente | Qué se usó |
|---|---|
| Código del repo, revisado en el commit `1f1c824` de esta rama (los archivos de `/usuarios` pueden haber cambiado después) | Estado comprobable desde frontend en ese commit |
| `powip_doc_tecnica_v2.docx.pdf` (Mauricio Martinez / Octavio Toledo), §3 y §6 | Módulo Usuarios: tablas, invitación, endpoints, roles personalizados |
| `powip_permisos_roles_spec.docx.pdf`, §1, §7.3, §8 | Roles semilla, JWT recomendado, middleware |
| `powip_doc_tecnica_comisiones-equipo-completa.docx.pdf`, §2.4 y §5 | Solo la frontera (`rol_call`, `supervisor`, `/funciones`) |
| `powip_billing_estados.docx.pdf` | Revisado; no contiene contenido de usuarios/roles |
| Prototipo «Powip — Módulo Usuarios» (`powip-usuarios.html`, citado como `powip_usuarios.html` en spec v2 §7.1) | **Revisado completo**, incluido el `<script>`: modales, datos de ejemplo (`USERS`, `ROLES_DATA`, `PERMS_STRUCTURE`) y funciones. Es un mockup estático: no llama a ninguna API y varias acciones solo muestran un aviso. Lo que pide al backend está en §2.0; lo que deja sin definir, en §2.0.1. Los números y datos de ejemplo (12 usuarios, conteos por rol, nombres y emails) **no** son datos reales y no se reproducen aquí. |

**Etiquetas de evidencia**

- **[FE]** *usado por frontend*: el repo lo llama o lo consume (se cita archivo:línea). Prueba que el frontend lo espera, **no** que el backend lo cumpla.
- **[BE]** *confirmado por backend*: no hay acceso al código ni a Swagger de ms-auth; **ningún punto de este documento está marcado [BE]**.
- **[SPEC]** *solo propuesto en las specs*: figura en los PDF (se cita documento y sección) y puede no existir.
- **[PROPUESTA]** ruta o campo nuevo definido aquí; no existe hasta que ms-auth lo confirme.

---

## 1. Estado actual comprobable desde frontend

### 1.1 Endpoints de ms-auth que el frontend usa hoy

Base: `NEXT_PUBLIC_API_USERS` (con `/api/v1` retirado en `src/services/userService.ts:4-6`) + `/api/v1/...`. Los archivos `editar-usuario`, `LoginForm` y `onboardingService` usan `NEXT_PUBLIC_API_USERS` directamente (que ya incluye `/api/v1`).

| # | Método y ruta | Request | Response (según el tipo que declara el frontend) | Usado en | Evidencia |
|---|---|---|---|---|---|
| E1 | `POST /api/v1/auth/company/{companyId}/user` | `CreateCompanyUserRequest`: `identityDocument, name, surname, email, password, roleName` + opcionales `address, department, province, district, phoneNumber` (`userService.ts:8-20`) | Sin tipar (`response.data`) (`userService.ts:29-45`) | `src/components/forms/UserForm.tsx:204-213`, `src/components/superadmin/CreateUserModal.tsx` | [FE] |
| E2 | `GET /api/v1/roles` | Bearer | `Role[]` = `{id, name, description?}` (`userService.ts:22-26,48-55`) | `UserForm.tsx:88`, `src/app/superadmin/page.tsx:200` | [FE] |
| E3 | `GET /api/v1/auth/company/{companyId}/users` | Bearer; **sin** paginación, búsqueda ni orden | `any[]`; la pantalla lee `id, identityDocument, name, surname, email, status, role.name` (`src/app/usuarios/page.tsx:47,67,194,205-210`) | `usuarios/page.tsx:47`, `CompaniesView.tsx:431` | [FE] |
| E4 | `GET /api/v1/auth/users` (todos los usuarios de la plataforma) | Bearer | `any[]`; aquí el rol llega como `roleName` plano (ver 1.5) | `src/app/superadmin/page.tsx:228`, `src/app/metricas/superadmin/page.tsx:62` | [FE] |
| E5 | `PUT /api/v1/auth/user/{userId}` | `UpdateUserRequest`: `name, surname, address, city, province, district, phoneNumber, roleName, password` (todos opcionales). **No incluye `status`** (`userService.ts:83-112`) | Sin tipar | `UserForm.tsx:195`, `src/components/superadmin/UserDetailModal.tsx:106` | [FE] |
| E6 | `GET /api/v1/auth/user/{userId}` | Bearer (en `userService`) | `UserProfile`: `id, name, surname, email, address?, city?, province?, district?, phoneNumber?, identityDocument?, status` (`userService.ts:187-216`); `getUserProfile` oculta cualquier error devolviendo `null` | `src/components/shalom/SendToShalomModal.tsx:418` | [FE] |
| E7 | `POST /api/v1/auth/admin/register` | `identityDocument, name, surname, email, password, address, city, province, district, phoneNumber, role:{name}`; el frontend aplica regex `^(?=.*[a-z])(?=.*\d).{6,}$` «del backend» (`userService.ts:114-184`) | Objeto `User`; el frontend normaliza `userId = id` | `CreateUserModal.tsx:78`, `LeadActivationFlow.tsx:213` | [FE] |
| E8 | `DELETE /api/v1/auth/user/{userId}` | Bearer | Sin tipar; documentado en el código como «Rollback» (`userService.ts:218-229`) | `LeadActivationFlow.tsx:282` | [FE] |
| E9 | `PATCH /api/v1/auth/users/cc-status` y `PATCH /api/v1/auth/users/{targetId}/cc-status` | `UpdateCcStatusRequest`: `ccActivo: boolean, ccRol?: "agente" \| "supervisor", ccMaxPedidos?: number` (`src/services/agentesService.ts:16-20,38,49`). Frontera con el contrato de comisiones/call center | — | `agentesService.ts` | [FE] |
| E10 | `POST /api/v1/auth/refresh` (cookie httpOnly, `withCredentials`) | — | `accessToken` que el cliente decodifica (`src/contexts/AuthContext.tsx:113-133`) | `AuthContext.tsx` | [FE] |
| E11 | `POST /api/v1/auth/login`, `POST /api/v1/auth/register`, `POST /api/v1/auth/logout` | ver archivos | register devuelve `{userId}` | `LoginForm.tsx:59`, `src/services/onboardingService.ts:35,41`, `AuthContext.tsx:275` | [FE] |
| E12 | `GET /auth/user/{userId}`, `PUT /auth/user/{userId}`, `POST /auth/update-password` `{userId, currentPassword, newPassword, confirmPassword}` | **axios plano, sin cabecera `Authorization`** (depende de `axios.defaults.withCredentials`, `AuthContext.tsx:19`) | — | `src/app/configuracion/editar-usuario/page.tsx:60,86,119` | [FE] |

**Lo que NO existe en el frontend hoy** (ningún archivo lo llama): paginación/búsqueda/orden en servidor, cambio persistente de estado (activar/desactivar), resumen de actividad, invitaciones (crear, validar token, activar cuenta), CRUD de roles, matriz de permisos, endpoint de «mis permisos efectivos».

### 1.2 Campos reales de usuario, rol y JWT

| Elemento | Campos | Fuente | Evidencia |
|---|---|---|---|
| `User` (pantalla `/usuarios`) | `id, identityDocument, name, surname, email, address?, department?, province?, district?, phoneNumber?, status: boolean, role: {id,name,description?} \| null` | `src/interfaces/IUser.ts:7-20` | [FE] |
| `Role` | `id: string`, `name: string`, `description?` | `IUser.ts:1-5`, `userService.ts:22-26` | [FE] |
| JWT decodificado | `role: string` (nombre, no id), `id`, `email`, `companyId?`, `permissions?: string[]`, `name?`, `surname?`, `exp`, `iat` | `src/lib/jwt.ts:3-13` | [FE] |
| Sesión | `auth.user.{role, permissions, companyId}`, `auth.company` (se obtiene por `fetchUserCompany(decoded.id)` de ms-company, con respaldo en `decoded.companyId`) | `AuthContext.tsx:60-72,132-148,228-244` | [FE] |
| Nombres de rol observados | `ADMIN, OWNER, SUPERADMIN, ADMINISTRADOR` (+ variantes en minúscula), `AGENTES, VENTAS, OPERACIONES, COURIER, CALLER`, `USUARIO` | `permissions.config.ts:18-26`, `UserForm.tsx:33`, `operationsPermissions.ts:8-13,57-65`, `UserForm.roles.test.tsx` | [FE] (el comentario de `operationsPermissions.ts` es del propio frontend, **no** confirma lo que ms-auth emite) |
| Permisos observados | Cadenas libres: `VIEW_SUPER_ADMIN` (`permissions.config.ts:92`), `VIEW_FINANCES` (ms-ventas, `docs/FIXES.md` FIX-01), `MANAGE_USERS`/`MANAGE_ROLES` (solo en un comentario de `PermissionGuard.tsx`), `OPS_*` planeados (`operationsPermissions.ts:20-42`, «para que backend los empiece a emitir») | | [FE]; que `permissions` venga poblado en el JWT real **no está probado** |
| Especificación (otro modelo) | JWT con `sub, empresa_id, rol_id: "rol_ventas", nombre`; tablas `usuarios/roles/invitaciones` con `permisos` JSONB por ruta (`ver/crear/editar/eliminar/admin`) | permisos spec §8.1; v2 §3.2, §3.5 | [SPEC] |

### 1.3 Control de acceso que aplica hoy el frontend

- Regla única `hasRouteAccess` (`src/config/permissions.config.ts:141-149`), usada por `AuthGuard` y `Sidebar`. `/usuarios` exige `"__ADMIN_ROLE__"` (`:48`) = `hasAdminAccess(role)` contra `ADMIN_ROLES` (`:18-26`, `:114-117`).
- Superadmin = **lista de correos hardcodeada** en el bundle (`:3-15`); no se verifica rol ni claim. `AuthContext.hasPermission` también da bypass por correo (`AuthContext.tsx:299-301`).
- Esto es solo UX: **no hay evidencia de que ms-auth exija el mismo rol/empresa en E1-E8**. Los controles del frontend se pueden saltar llamando a la API directamente.
- El `companyId` de las rutas E1/E3 proviene del estado del cliente (`auth.company.id`, `usuarios/page.tsx:47`, `UserForm.tsx:213`), es decir, es controlable por el usuario.

### 1.4 Cambios recientes de `/usuarios` revisados (commit `1f1c824`)

Archivos: `permissions.config.ts`, `AuthGuard.tsx`, `Sidebar.tsx`, `app/usuarios/page.tsx`, `forms/UserForm.tsx` y sus pruebas.

1. Acceso a `/usuarios` restringido a rol admin/superadmin con una sola regla compartida (ver 1.3).
2. **Se retiró la acción «Desactivar»** de la tabla. Antes cambiaba el estado solo en pantalla. El tipo que el frontend envía a `PUT /auth/user/{id}` (`UpdateUserRequest`, `userService.ts:83-93`) no incluye `status`, y no se pudo confirmar que ms-auth lo acepte (`usuarios/page.tsx:91-95`, con comentario). Esto crea la dependencia **P0-04 / O-05** de este contrato.
3. `UserForm` solo ofrece roles que devuelve `GET /api/v1/roles`, filtrados por `COMPANY_USER_ROLES = AGENTES, VENTAS, OPERACIONES, COURIER, CALLER` (`UserForm.tsx:33,88-93`); sin respaldo local. Si el usuario editado tiene un rol no asignable (p. ej. `ADMINISTRADOR`), se muestra deshabilitado y se permite guardar sin cambio (`UserForm.tsx:164-167`; pruebas en `UserForm.roles.test.tsx`).
4. Búsqueda y paginación siguen siendo **en cliente** sobre el listado completo (`usuarios/page.tsx:47,67`).

Implicación para backend: el filtro `COMPANY_USER_ROLES` es una decisión de frontend sin respaldo; ver D1 y D2.

### 1.5 Inconsistencias detectadas en los contratos actuales

| Inconsistencia | Evidencia |
|---|---|
| El rol llega como `role.name` en E3 y como `roleName` plano en E4 | `usuarios/page.tsx:68,199` (`u.role?.name`) vs `src/components/superadmin/UsersView.tsx:72,98,243` (`u.roleName`) |
| Crear usa `department`; actualizar y registrar usan `city` para el mismo dato | `userService.ts:15` vs `:87` vs `:125` |
| `UpdateUserRequest` acepta `password` (el admin cambia la contraseña de otro) sin exigir contraseña actual | `userService.ts:92`, `UserForm.tsx:191-192` |
| Existen dos altas: `company/{id}/user` (E1) y `admin/register` (E7) con payloads distintos | `userService.ts:29`, `:114` |
| `editar-usuario` (perfil propio) no envía `Authorization: Bearer`. Toma el `userId` de la sesión (`auth?.user.id`), pero lo manda en la ruta, así que el backend no puede confiar en él sin compararlo con el token | `editar-usuario/page.tsx:37` (origen del id), `:60,86,119` (llamadas sin Bearer) |
| Política de contraseña: regex mín. 6 + minúscula + número (frontend) vs mín. 8 (spec v2 §3.5) | `userService.ts:152`; v2 §3.5 |

### 1.6 Qué no se puede afirmar desde el frontend

Si ms-auth valida rol y empresa en cada endpoint; si `status=false` bloquea el login y revoca refresh tokens; unicidad real de email/documento; qué devuelve `permissions` en el JWT; si existe soft-delete; códigos de error reales (el frontend solo muestra mensajes genéricos o `JSON.stringify(err.response.data)`, `userService.ts:174-182`). Todo esto pasa a verificación en la sección 5 (P0-01).

### 1.7 Cierre de frontend de Usuarios y Roles (2026-10-06)

Cambios hechos solo en el frontend, sobre los endpoints que ya usa (E1, E2, E3, E5). **No** se agregó ningún endpoint ni campo nuevo en las peticiones, y nada de esta sección pasa a [BE]. Las referencias son a archivos, sin número de línea.

| Cambio | Archivos | Qué hace el frontend | Qué **no** prueba |
|---|---|---|---|
| Guardado bloqueante en el modal | `src/components/modals/UserModal.tsx`, `src/components/forms/UserForm.tsx` | Mientras E1/E5 están en curso, el modal no se cierra (Cancelar, X, Esc, clic afuera) y un segundo envío se ignora. El modal solo refleja lo que informa el formulario montado: si un formulario se desmonta durante el guardado (otro usuario, modal cerrado), libera su propio bloqueo una sola vez, en el mismo commit en que se desmonta, y después no llama a `onUserSaved` ni vuelve a tocar el estado del modal. El aviso de éxito o error se sigue mostrando porque refleja la respuesta real | Que E1/E5 sean idempotentes; si la red reintenta, el backend podría recibir dos altas (ver Q-06) |
| Rol propio | `UserForm.tsx` | Al editarse a sí mismo, el selector de rol queda deshabilitado y el envío rechaza cualquier `roleName` distinto del actual. Se sigue enviando `roleName` con el valor actual en cada edición, porque no se sabe si omitirlo equivale a «sin cambio». Si el usuario que se edita a sí mismo no tiene rol (`role: null`), el formulario explica que no puede asignárselo y no permite guardar: no se inventa un rol ni se habilita la autoasignación | Que ms-auth impida cambiar el propio rol (P0-05). El control del frontend se salta llamando a E5 directamente |
| Ubicación (`department`/`city`) | `src/interfaces/IUser.ts`, `UserForm.tsx`, `src/app/usuarios/page.tsx` | El modelo `User` acepta `department` y `city` (el modal de superadmin ya lee `city \|\| department`). La edición inicializa el departamento con `department \|\| city`. El alta sigue enviando `department` y la edición `city`, pero **la edición ya no envía `city` vacío**. La tabla muestra solo las partes disponibles de distrito y provincia, o «—» | Qué campo devuelve realmente E3 (P1-02). **Consecuencia:** hasta confirmar el contrato, desde `/usuarios` no se puede borrar el departamento de un usuario, porque omitir `city` evita enviar un vacío que podría borrar el dato sin querer |
| Validación de campos | `UserForm.tsx` | Recorta nombre, apellido, email, documento, teléfono y dirección; rechaza vacíos en nombre y apellido (y en email y documento al crear). No recorta ni transforma la contraseña | Formato de teléfono y documento: no se impuso ninguno (D12) |
| Política de contraseña | `UserForm.tsx` | Aplica la regla que el frontend ya usaba en E7 (`^(?=.*[a-z])(?=.*\d).{6,}$`): obligatoria al crear, y al editar solo si se completa. El campo usa `autoComplete="new-password"` para que el navegador no complete la contraseña del admin | Que ms-auth aplique la misma regla en E1/E5; el mínimo de 8 de la spec sigue pendiente (D6) |
| Roles sin sesión | `UserForm.tsx` | Sin `accessToken` no se llama a E2: se muestra «Sesión no disponible» y no se permite guardar, en lugar de quedar en «Cargando roles» | — |
| Listado: solo vale la última petición | `page.tsx` | Cada carga de E3 tiene un número; una respuesta o error de una petición anterior se descarta. Al cambiar de empresa, perder la sesión o desmontar, la carga en curso se invalida y la lista se vacía, así que no se muestran usuarios de la empresa previa | Que E3 filtre por la empresa del token (P0-02) |
| Mensaje de error de `createPlatformUser` (E7) | `src/services/userService.ts` | El error y el `console.error` por contraseña inválida ya no incluyen ningún fragmento de la contraseña. En los errores de ms-auth, el mensaje (que puede ser el cuerpo completo vía `JSON.stringify`) oculta el valor exacto de la contraseña enviada, también en su forma escapada en JSON. Firma, payload y normalización de `userId` sin cambios | Qué devuelve ms-auth en un error de E7. No hay evidencia de que devuelva la contraseña, pero el formato de validación de Spring incluye `rejectedValue` y el frontend mostraba el cuerpo sin filtrar. Que ms-auth no registre contraseñas (P0-08) |

**Preguntas para ms-auth derivadas de este cierre** (se suman a P0-01; ninguna tiene respuesta todavía):

| ID | Pregunta | Por qué importa al frontend |
|---|---|---|
| Q-01 | ¿E3 devuelve el departamento como `department`, como `city` o como ambos? ¿Y E5 y E6? | Hoy se lee `department \|\| city`; si es solo uno, se simplifica el modelo (P1-02) |
| Q-02 | En E5 (`PUT /api/v1/auth/user/{id}`), un campo **ausente**, ¿se conserva o se pone en `null`? ¿Y un string vacío? | Define si se puede volver a enviar `city` vacío para borrar el departamento, y si omitir `roleName` es seguro |
| Q-03 | ¿E5 acepta `roleName` igual al rol actual cuando ese rol no es asignable por el actor (p. ej. `ADMINISTRADOR`)? | Con la anti-escalada de P0-06, editar los datos de un admin podría fallar aunque el rol no cambie |
| Q-04 | ¿E5 rechaza que el actor cambie su propio rol (`CANNOT_CHANGE_OWN_ROLE`, P0-05)? | El bloqueo del frontend es solo de interfaz |
| Q-05 | ¿Qué política de contraseña aplica ms-auth en E1 y E5? ¿Es la misma regex que el frontend atribuye a E7? | El frontend valida 6 + minúscula + número sin confirmación (D6) |
| Q-06 | ¿E1 es seguro ante una petición duplicada (mismo email o documento → `409`)? | El frontend evita el doble envío, pero no puede garantizarlo ante reintentos de red |

### 1.8 Nueva UI de Usuarios y Roles con los endpoints actuales (2026-10-06)

> Reemplazada por §1.9: las decisiones de UI reducida de esta sección (pestaña «Roles», tarjetas «Activos» y «Sin rol», sin acciones pendientes) quedaron sustituidas por el alcance completo del mockup. Se conserva como registro; la regla de identificación de roles sigue vigente.

Se implementó la parte del prototipo que se puede sostener con E2 y E3 sin endpoints nuevos. Todo se calcula en el navegador sobre la respuesta completa de E3 (usuarios de la empresa de la sesión) y la de E2 (catálogo de roles). Nada de esta sección pasa a [BE]. Archivos: `src/app/usuarios/page.tsx`, `src/services/userListing.ts`, `src/config/userRoles.ts`, `src/components/users/`, `src/components/forms/UserForm.tsx`, `src/components/modals/UserModal.tsx`.

| Elemento | Qué muestra hoy | Origen y límite |
|---|---|---|
| Pestañas | «Usuarios» y «Roles». Sin «Referidos» ni «permisos» en el título | — |
| Tarjetas | Total, **Activos** (`status === true`, es decir, cuenta habilitada), Inactivos (todo lo que no es `status === true`) y Sin rol. No cambian con búsqueda ni filtros; durante la carga muestran un esqueleto y, si E3 falla, «—» | Sobre E3 completo. No representan presencia ni actividad: «Activos ahora» del prototipo requiere O-07 o equivalente. Si E3 pasa a paginarse, hacen falta los `counts` de O-01 |
| Búsqueda | Nombre, apellido, email, documento, teléfono, rol y distrito; sin distinguir mayúsculas ni tildes | En el navegador (O-01 para servidor) |
| Filtro de rol | Roles de E2, más los que aparecen en E3 y no están en E2 (marcados «fuera del catálogo»), más «Sin rol». Un rol se identifica primero por `id` exacto; el nombre (sin distinguir mayúsculas ni espacios) solo se usa cuando una de las dos fuentes no trae `id` y la coincidencia es única. Dos `id` distintos con el mismo nombre no se fusionan: la etiqueta agrega «· id …» o «· sin id». Si un rol sin `id` coincide con varios por nombre, o si E3 trae varios `id` para un nombre que E2 tiene sin `id`, no se asigna a ninguno y aparece por separado. Filtro, conteo y «Ver usuarios» usan la misma regla | Depende de que E2 y E3 usen los mismos `id` de rol (P0-01, P1-02, O-12) |
| Filtro de estado | Todos, Activos, Inactivos | Sobre `status` de E3 |
| Orden | Nombre, apellido, email y estado, con desempate estable (apellido/nombre, email e `id`) | En el navegador |
| Paginación | 10, 25 o 50 filas; vuelve a la página 1 al cambiar búsqueda, filtros, orden o tamaño | En el navegador |
| Tabla | Avatar con iniciales, nombre, apellido, email, documento, teléfono, dirección, distrito/provincia, rol, estado y Editar. Desplazamiento horizontal en pantallas chicas | Sin login, género ni varios roles (D12, D14). Sin acciones de estado, baja ni resumen (P0-04, D10, O-07) |
| Pestaña Roles | Catálogo de E2 con carga, error con reintento y vacío; nombre, `description` solo si E2 la trae, y cantidad de usuarios de la empresa con ese rol (solo cuando E3 cargó bien). «Ver usuarios» vuelve a Usuarios con ese rol, sin búsqueda ni filtro de estado. La nota «Se puede elegir al crear o editar usuarios» describe el formulario actual (`COMPANY_USER_ROLES`), **no** una autorización de ms-auth | Sin permisos, módulos ni distinción sistema/personalizado (O-12, O-15, D2, D16). ADMINISTRADOR y USUARIO solo aparecen si E2 los devuelve y no se pueden asignar desde el formulario (D13) |
| Alta y edición | Dos columnas en desktop y una en mobile; rol con tarjetas seleccionables (radios nativos, navegables con teclado) solo para los roles elegibles de E2 con su `description` si existe; se conservan el rol actual no asignable, el bloqueo del rol propio, las validaciones y la protección del guardado. El modal limita su altura y los botones quedan visibles | Sin campos nuevos (D12), sin contraseña temporal ni aviso de email (D6), sin estado (P0-04/D17) y sin aviso de propagación inmediata del rol (D9) |

**Dependencias que siguen abiertas para completar el prototipo:** O-01 (paginación, búsqueda y `counts` en servidor), O-05/P0-04 (estado), O-07 (actividad o presencia), O-08..O-11 (invitaciones), O-12/P1-04 (catálogo con `assignable` y `userCount`), O-13..O-15 (roles personalizados y permisos), D10 (baja), D12 (login, género, DNI), D13 (asignar Administrador) y D14 (varios roles). Además de P0-02, P0-05, P0-06 y Q-01..Q-06.

---

### 1.9 Alcance completo del mockup (2026-10-07)

El frontend implementa la estructura completa de `powip-usuarios.html`. Las acciones sin contrato quedan visibles con su modal o formulario, pero deshabilitadas, con un aviso breve para el usuario (sin referencias técnicas ni enlaces a estos documentos). «Integrado en frontend» significa que funciona hoy con los endpoints existentes; no equivale a confirmado por backend. Nada de esta sección pasa a [BE].

| Elemento del mockup | Integración actual | Bloque |
|---|---|---|
| Pestañas con contadores | «Usuarios (N)» desde E3 y «Roles y permisos (N)» desde E2; sin contador si la carga falla | [01](backend/01-pagina-usuarios.md) |
| Tarjetas | Total e Inactivos reales; «Activos ahora» y «Roles personalizados» muestran «No disponible» (sin presencia ni `isCustom`) | [02](backend/02-tab-usuarios-listado.md) |
| Tabla, búsqueda, filtros, orden, 50/25/10 | Integrado en frontend sobre E3 completo; Usuario muestra `username` o «—» (el email no se presenta como login); género si llega | [02](backend/02-tab-usuarios-listado.md) |
| Selección y Exportar | Integrado en frontend: local (ExcelJS) sobre E3 completo; selección por id; celdas de texto, sin fórmulas | [03](backend/03-seleccion-y-exportacion.md) |
| Crear usuario | Integrado en frontend con E1 para los campos actuales; login, género, «Personalizado», permisos y contraseña temporal deshabilitados | [04](backend/04-modal-crear-usuario.md), [11](backend/11-matriz-permisos-usuario.md), [18](backend/18-primer-ingreso-cambio-password.md) |
| Editar usuario | Integrado en frontend con E5 para los campos actuales; rol con select; estado visible y no editable; email de solo lectura | [05](backend/05-modal-editar-usuario.md) |
| Eliminar | Confirmación sin habilitar; E8 sigue siendo solo rollback de leads | [06](backend/06-eliminar-usuario.md) |
| Resumen (extensión) | Perfil con datos de E3; actividad no disponible | [07](backend/07-resumen-usuario.md) |
| Roles y permisos | Catálogo E2, conteos locales, «Ver usuarios»; «Personalizado» como acción | [08](backend/08-tab-roles-y-permisos.md) |
| Crear rol personalizado | Modal completo sin guardado | [09](backend/09-modal-crear-rol.md) |
| Editar permisos (extensión) | Modal con matriz en vista previa sin guardado | [10](backend/10-modal-editar-permisos.md) |
| Matriz de permisos | Estructura de ejemplo del mockup, casillas deshabilitadas y sin marcar | [11](backend/11-matriz-permisos-usuario.md) |
| Invitar por email | Modal completo sin envío | [12](backend/12-modal-invitar-email.md), [13](backend/13-pagina-aceptar-invitacion.md) |
| Referidos y cobro | Diseño completo; elección local sin guardar; estadísticas «—»; link no disponible | [14](backend/14-tab-referidos-y-cobro.md) |
| Cuenta bancaria / Yape / Plin | Formularios sin guardado y sin promesa de cifrado | [15](backend/15-formulario-cuenta-bancaria.md), [16](backend/16-formulario-yape-plin.md) |
| Liquidación y avisos | Sin datos | [17](backend/17-liquidacion-y-notificaciones.md) |

Desviaciones visuales registradas: se conserva el shell global de Powip (sin sidebar ni campana propios del mockup) y su tipografía; la ubicación usa ubigeo de tres niveles; en edición, la pestaña «Más datos» conserva documento, contraseña y dirección. Desde 2026-10-07 los modales priorizan una UI clara y responsive (shadcn/ui) sobre la fidelidad de píxel al mockup.

## 2. Contrato requerido para la nueva UI

**Convenciones.** Todas las rutas siguen bajo `/api/v1/auth` (usuarios, invitaciones, sesión) y `/api/v1/roles` (roles), por coherencia con E1-E12. **Todas las rutas nuevas son PROPUESTAS hasta que ms-auth las confirme**; las que reutilizan una ruta que el frontend usa hoy (E1-E12) lo indican, y aun así su comportamiento no está confirmado (P0-01). Las rutas `/api/usuarios/*` de la spec v2 §3.7 se toman solo como referencia de funcionalidad [SPEC].

- **companyId**: en operaciones de empresa, el backend lo toma del JWT; el `{companyId}` de la URL (si se conserva por compatibilidad) debe ser igual al del token o responder `403`, salvo superadmin (sección 3).
- **Permisos** (nombres provisionales, dependen de D3): `USERS_READ`, `USERS_WRITE`, `USERS_STATUS`, `USERS_INVITE`, `ROLES_READ`, `ROLES_WRITE`. Hasta resolver D3, el equivalente es «rol admin de la empresa».
- **Formato de error propuesto**: `{ "code": "<MACHINE_CODE>", "message": "<texto>", "fields"?: { "<campo>": "<motivo>" } }`; la UI se apoya en `code`, no en `message`. Códigos HTTP: `400` validación, `401` sin sesión, `403` sin permiso/otra empresa, `404` no existe (también para otra empresa, para no revelar existencia), `409` conflicto, `410` token expirado/usado, `422` regla de negocio, `429` rate limit.

### 2.0 Qué pide el prototipo al backend

| Elemento del prototipo | Necesidad de backend | Operación | Estado hoy |
|---|---|---|---|
| Tarjetas «Total usuarios / Activos ahora / Inactivos / Roles personalizados» | Conteos por empresa que no dependan de la página cargada | O-01 (`counts`) | No existe; hoy se cuenta en cliente sobre E3 |
| Búsqueda, filtros «Todos los roles» y «Todos los estados», orden por columnas Usuario/Nombre/Apellidos, «50/25/10 por página» | Paginación, búsqueda, orden y filtros en servidor | O-01 | No existe (`usuarios/page.tsx:47,67`) |
| Botón «Exportar» | Exportación del listado filtrado, o al menos el listado completo filtrable | O-01b | No existe |
| Columnas Usuario (login con avatar de iniciales), Nombre, Apellidos, Dirección, Distrito, Email, Género, Roles, Estado, Teléfono | Campos `username` y `gender`, que hoy no existen en `User` (`src/interfaces/IUser.ts:7-20`). Los datos de ejemplo también traen `dni`, aunque la tabla no lo muestra | O-01, O-02, D12 | Parcial |
| Columna «Roles» con valores combinados («Ventas/Operaciones», «Operaciones/Marketing») | Más de un rol por usuario | D14 | Hoy `role` es un único objeto (`IUser.ts:19`) |
| Checkbox de selección múltiple | Acciones masivas: el prototipo no les asigna ninguna | — | Fuera de este contrato hasta que se definan |
| Acciones por fila: editar (lápiz), eliminar (tacho, con `confirm` «no se puede deshacer»), «Resumen» | Edición, baja y resumen de actividad | O-04, O-05/D10, O-07 | Solo editar (`usuarios/page.tsx`) |
| Modal «Editar usuario»: nombre, apellidos, email, teléfono, rol (Administrador, Ventas, Operaciones, Marketing, Contact Center, Personalizado, Solo lectura) y **estado** (Activo/Inactivo), con el aviso «Cambiar el rol afecta los permisos de acceso del colaborador de forma inmediata» | Edición con email editable, rol y estado en el mismo formulario, y propagación inmediata | O-04, O-05, D9, D17 | Hoy no se edita el estado; el email no se envía en `UpdateUserRequest` |
| Tarjetas de roles: icono, «N usuarios», descripción, módulos; botones «Ver usuarios» y «Editar permisos» también en los roles del sistema; la tarjeta «Personalizado» abre «Crear nuevo» | `userCount` por rol, filtro de usuarios por rol y edición de permisos de roles del sistema | O-01 (`roleId`), O-12, O-14, D16 | No existe |
| Modal «Crear nuevo usuario»: nombre, apellidos, usuario/login, género, email, teléfono +51, dirección, distrito, DNI (8), contraseña temporal (mín. 8) y aviso «podrá cambiar su contraseña al primer ingreso» | Campos nuevos, política de contraseña y `mustChangePassword` | O-03, D6, D12 | Parcial: hoy usa ubigeo de 3 niveles y `identityDocument` libre (`UserForm.tsx`) |
| Selector de 6 roles: Administrador, Ventas, Operaciones, Marketing, Contact Center, Personalizado | Catálogo con `assignable` y decidir si un admin puede crear admins | O-12, D1, D13 | El frontend excluye `ADMINISTRADOR` (`UserForm.tsx:33`) |
| Modal «Crear rol personalizado» (nombre, descripción, 6 colores, matriz Ver/Crear/Editar/Eliminar/Admin con las mismas rutas que la spec v2 §3.5, casilla por sección que marca toda la sección) | Roles por empresa, catálogo de permisos y `color` | O-13, O-14, O-15, D2–D4 | No existe |
| «Personalizar permisos por módulo y ruta» **dentro del alta de usuario**: la matriz se abre sola al elegir «Personalizado», pero el desplegable permite abrirla con cualquier rol | Permisos por usuario, además de los del rol | D15 | No existe |
| Modal «Invitar por email» (email, nombre completo, rol a asignar incluido «Solo lectura»; enlace de 48 h) | Invitaciones | O-08..O-11, D7 | No existe |
| Pestaña «Referidos y cobro» | Programa, recompensa, destinos de cobro y liquidación | Bloques 14–17 (contrato propio; antes fuera de alcance, D8) | UI preparada, sin integración |

Inconsistencias internas del prototipo:

- Los selectores de rol no coinciden: el alta ofrece 6 (sin «Solo lectura»), la invitación 6 (sin «Personalizado», con «Solo lectura») y la edición 7. Los datos de ejemplo usan además «Atención al cliente», que no figura en ningún selector. Ver D1.
- El modal de invitación dice en el subtítulo que el colaborador recibe «sus credenciales de acceso», y en el cuerpo que recibe un enlace para definir su contraseña. Al crear un usuario con contraseña temporal, el aviso final dice «Email enviado al colaborador». Ver §3.3: una contraseña nunca se envía por email.
- La invitación afirma que el perfil queda creado «con el correo como usuario», mientras que la spec v2 §3.6 permite que el invitado cambie su nombre de usuario. Ver D12.
- En la matriz, cada ruta arranca con «Ver» marcado, incluidas `finanzas/gastos` y las de Administración, que la spec de permisos §1.2 reserva al administrador. Ver §3.2.10.

### 2.0.1 Lo que el prototipo deja sin definir

Con el script completo se pudo ver cómo se comporta cada control. El mockup trabaja sobre un arreglo en memoria y no llama a ninguna API, así que las acciones de abajo **no definen** el comportamiento que necesita el backend:

| Control | Qué hace en el mockup | Qué queda por definir | Operación |
|---|---|---|---|
| Búsqueda (`filterTable`, en la barra superior) | Filtra en el navegador sobre **todos** los campos del usuario, incluidos DNI, teléfono y email, y actualiza «Mostrando 1–N de N» | En qué campos busca el servidor (O-01 propone `name, surname, email, identityDocument`) | O-01 |
| Filtro de rol (`filterRole`) | Filtra en el navegador por coincidencia parcial del texto del rol, así que «Ventas» también trae a quien tiene «Ventas/Operaciones» | Filtrar por `roleId` y cómo se comporta con usuarios de varios roles (D14) | O-01, D14 |
| Filtro «Todos los estados», orden por columna (`th.sortable`), selector «50/25/10 por página», botones de paginación | Sin manejador | Valores por defecto de orden y tamaño de página | O-01 |
| Botón «Exportar» | Sin manejador | Formato y columnas | O-01b |
| Checkbox «seleccionar todo» y por fila | Sin manejador | Si habrá acciones masivas | — |
| «Resumen» | Solo muestra el aviso «Abriendo resumen de …» | Contenido del resumen | O-07 |
| Eliminar | `confirm` «no se puede deshacer» y borra la fila del arreglo | Borrado físico o lógico | D10 |
| «Guardar cambios» del modal de edición (`saveEditar`) | Guarda nombre, apellidos, rol y estado; **ignora** email y teléfono aunque los muestra; con varios roles conserva solo el primero (`rol.split('/')[0]`) | Si email y teléfono son editables, y cómo se editan varios roles | O-04, D12, D14 |
| «Crear usuario» (`guardarUsuario`) | No valida nada; avisa «Acceso activado · Email enviado al colaborador» | Validaciones (§1.5, D6) y si se envía un email al crear (sin contraseña, §3.3) | O-03, D6 |
| «Enviar invitación» (`enviarInvitacion`) | Solo exige email, nombre y rol; avisa «El link expira en 48 horas» | Formato del email, caducidad (D7), email ya existente (D5) | O-08, D5, D7 |
| «Guardar rol personalizado» (`guardarRol`) y color (`selColor`) | No valida nada; el color elegido solo cambia el borde y no se guarda | Validación del nombre y si `color` se persiste | O-13 |
| «Ver usuarios» y «Editar permisos» en las tarjetas de roles | Solo muestran un aviso | Si los roles del sistema son editables por empresa | O-14, D16 |
| Contadores (tarjetas de totales, «N usuarios» por rol, insignia «12» del sidebar, pestaña «Roles y permisos (6)») | Números fijos | Origen de cada conteo (la pestaña cuenta «Personalizado» como un rol) | O-01 (`counts`), O-12 (`userCount`) |

### O-01 Listar usuarios (paginado, búsqueda, orden, filtros)

- **Objetivo:** reemplazar el listado completo + filtro en cliente (`usuarios/page.tsx:47,67`).
- **Ruta [PROPUESTA]:** `GET /api/v1/auth/users/company` (alternativa: ampliar E3 con query params, retrocompatible). Hoy `GET /company/{companyId}/users` (E3) devuelve todo sin parámetros.
- **Input (query):** `page` (≥1, def. 1), `pageSize` (1-100, def. 20), `q` (busca en `name, surname, email, identityDocument`; mín. 2 caracteres), `sort` = `campo:asc|desc` con whitelist `name, surname, email, status, role, createdAt` (valor no permitido → `400`), `status` = `active|inactive|all` (def. `all`), `roleId`.
- **Output:** `{ items: UserSummary[], page, pageSize, total, totalPages, counts: { total, active, inactive, customRoles } }`, con `UserSummary = { id, identityDocument, name, surname, email, phoneNumber?, status: boolean, role: {id, name} | null, createdAt, lastLoginAt? }` (+ `username?`, `gender?` según D12). `role` siempre como objeto (unificar con E4) y **singular**: este contrato asume un rol por usuario mientras D14 siga abierta. El filtro `roleId` filtra por ese único rol. Si se elige D14-B, `roles[]`, el significado de `roleId` con varios roles y los conteos por rol requieren una **nueva versión del contrato** (ver D14). `counts` corresponde a la empresa entera, no a la página ni al filtro, y alimenta las tarjetas del prototipo. `customRoles` solo tiene sentido si D2 admite roles personalizados.
- **Errores:** `400 INVALID_QUERY`, `401`, `403 FORBIDDEN`.
- **Permisos:** `USERS_READ` (rol admin de empresa). Solo usuarios de la empresa del token.

### O-01b Exportar usuarios

- **Objetivo:** botón «Exportar» del prototipo.
- **Ruta [PROPUESTA]:** `GET /api/v1/auth/users/company/export?format=csv` con los mismos filtros que O-01. Alternativa sin endpoint: el frontend pagina O-01 hasta el final y genera el archivo; es aceptable mientras la empresa tenga pocos usuarios.
- **Output:** CSV con los mismos campos de `UserSummary`, **sin** `password*`, tokens ni datos de otras empresas.
- **Errores:** `400`, `403`. **Permisos:** `USERS_READ`. Registrar la exportación en auditoría porque incluye datos personales (§3.3).

### O-02 Detalle de usuario

- **Ruta [PROPUESTA]:** `GET /api/v1/auth/users/{userId}` (E6 hoy es `/auth/user/{id}`; unificar en singular o plural y documentar la elegida).
- **Output:** `UserSummary` + `address, city|department (unificar), province, district, gender?, createdAt, updatedAt, role: {id, name, description?}`.
- **Errores:** `404 USER_NOT_FOUND` (también si es de otra empresa), `403`.
- **Permisos:** `USERS_READ`, o el propio usuario viendo su perfil.

### O-03 Crear usuario (alta directa con contraseña temporal)

- **Ruta:** reutiliza E1 `POST /api/v1/auth/company/{companyId}/user`, que el frontend usa hoy [FE] (su comportamiento real no está confirmado, P0-01). `companyId` debe coincidir con el token.
- **Input:** los de `CreateCompanyUserRequest` (`userService.ts:8-20`). **Cambios [PROPUESTA]:** aceptar `roleId` (preferido) además de `roleName`; unificar `department`/`city`; sumar los campos de perfil que se elijan en D12. Si el rol pedido es de administrador, aplica D13.
- **Output [PROPUESTA]:** `201` con `UserSummary` (**nunca** `password` ni `passwordHash`). Campo `mustChangePassword: true` si la contraseña es temporal (ver D6). Hoy la respuesta no está tipada en el frontend.
- **Errores [PROPUESTA]:** `400 VALIDATION_ERROR` (con `fields`), `409 EMAIL_ALREADY_EXISTS`, `409 DOCUMENT_ALREADY_EXISTS`, `422 ROLE_NOT_ASSIGNABLE` (rol inexistente, de otra empresa o de nivel superior al del actor), `403 FORBIDDEN`. Los límites de usuarios por plan quedan fuera de este contrato.
- **Permisos:** `USERS_WRITE`.

### O-04 Editar usuario

- **Ruta:** E5 `PUT /api/v1/auth/user/{userId}`, que el frontend usa hoy [FE] (comportamiento real no confirmado, P0-01). **[PROPUESTA]:** aceptar también `PATCH` parcial.
- **Input:** `UpdateUserRequest` (`userService.ts:83-93`); **[PROPUESTA]:** `roleId` además de `roleName`. `identityDocument` no editable por esta ruta. **El cambio de contraseña ajena se separa** a O-06.
- **Email:** el modal de edición del prototipo lo muestra editable (aunque su script no lo guarda) y hoy `UpdateUserRequest` no lo incluye. Si se permite cambiarlo, tiene que reverificarse el nuevo email antes de usarlo para iniciar sesión, y aplica la unicidad de D5. Si no, la UI lo muestra de solo lectura.
- **Estado:** el prototipo edita datos, rol y estado en el mismo formulario y con un solo «Guardar cambios». El contrato los mantiene separados (estado en O-05) porque tienen reglas y efectos distintos. Si la UI los combina con dos llamadas, una puede funcionar y la otra fallar; cómo se resuelve queda en **D17**.
- **Output:** `200` `UserSummary` actualizado.
- **Errores:** `404`, `403 FORBIDDEN`, `403 CANNOT_CHANGE_OWN_ROLE`, `409 LAST_ADMIN` (si el cambio de rol deja a la empresa sin admin activo), `422 ROLE_NOT_ASSIGNABLE`, `400`.
- **Permisos:** `USERS_WRITE`; el propio usuario puede editar solo datos personales (no rol, no estado).

### O-05 Activar / desactivar de forma persistente

- **Objetivo:** devolver la acción retirada en `usuarios/page.tsx:91-95`.
- **Ruta [PROPUESTA]:** `PATCH /api/v1/auth/users/{userId}/status`, body `{ "status": boolean }`.
- **Output:** `200` `{ id, status, updatedAt }`.
- **Efectos inmediatos exigidos:** `status=false` impide el login y `POST /auth/refresh`, y revoca los refresh tokens vigentes del usuario.
- **Access tokens ya emitidos:** siguen siendo válidos hasta que expiran, salvo que se implemente la revocación de P2-03. ms-auth tiene que **documentar el plazo máximo** durante el cual un usuario desactivado todavía puede operar con un token anterior (hoy el TTL no se conoce, O-18). Ese plazo es la respuesta a D9 mientras no exista P2-03.
- **Errores:** `403 CANNOT_DEACTIVATE_SELF`, `409 LAST_ADMIN`, `404`, `403`.
- **Permisos:** `USERS_STATUS`.

### O-06 Restablecer contraseña por un admin

- **Ruta [PROPUESTA]:** `POST /api/v1/auth/users/{userId}/password-reset`. Dos variantes (D6): (a) envía email con enlace de un solo uso; (b) establece contraseña temporal con `mustChangePassword`.
- **Output:** `202 { message }`; **nunca** devuelve la contraseña.
- **Errores:** `404`, `403`, `429`.
- **Permisos:** `USERS_WRITE`. `update-password` (E12) sigue siendo el cambio propio con contraseña actual y **debe exigir autenticación** con el mecanismo que se confirme en P0-07.

### O-07 Resumen de actividad de un usuario

- **Ruta [PROPUESTA]:** `GET /api/v1/auth/users/{userId}/activity-summary` [SPEC: `GET /api/usuarios/:id/resumen`, v2 §3.7, sin detalle de campos].
- **Output mínimo propuesto:** `{ userId, lastLoginAt, lastActivityAt, loginCountLast30d, status, createdAt, invitedBy?, role }`. Métricas de negocio (pedidos creados, ventas) **no** las calcula ms-auth: si la UI las quiere, será otro contrato (ms-ventas) por `userId`. En el prototipo, «Resumen» solo muestra un aviso y no define contenido (§2.0.1), así que estos campos son una propuesta mínima a confirmar con producto.
- **Errores:** `404`, `403`. **Permisos:** `USERS_READ`.

### O-08 Crear invitación por email

- **Ruta [PROPUESTA]:** `POST /api/v1/auth/invitations` [SPEC: `POST /api/usuarios/invitar` `{email, nombre, rol_id}`, v2 §3.6].
- **Input:** `{ email, name, roleId }` (+ `surname?`). `companyId` y `invitedBy` salen del token.
- **Output:** `201 { id, email, roleId, status: "PENDING", expiresAt }`. **Sin token ni enlace en la respuesta.**
- **Reglas:** el token es aleatorio (≥128 bits), de un solo uso, se guarda **hasheado**, caduca (24 h o 48 h, ver D7); una invitación `PENDING` previa al mismo email/empresa se invalida o se rechaza (`409 INVITATION_PENDING`).
- **Errores:** `409 EMAIL_ALREADY_EXISTS` (ya es usuario; según D5), `409 INVITATION_PENDING`, `422 ROLE_NOT_ASSIGNABLE`, `400`, `429`.
- **Permisos:** `USERS_INVITE`. El envío de email requiere un servicio emisor (ver P1-03).

### O-09 Listar, reenviar y revocar invitaciones

- **Rutas [PROPUESTAS]:** `GET /api/v1/auth/invitations?status=&page=&pageSize=`; `POST /api/v1/auth/invitations/{id}/resend`; `DELETE /api/v1/auth/invitations/{id}` (revoca).
- **Output:** `InvitationSummary = { id, email, name, role:{id,name}, status: PENDING|ACCEPTED|EXPIRED|REVOKED, expiresAt, createdAt, createdBy }` (sin token).
- **Errores:** `404`, `409 INVITATION_ALREADY_USED`, `403`. **Permisos:** `USERS_INVITE`. `resend` genera un token nuevo y deja inválido el anterior.

### O-10 Validar token de invitación (pública)

- **Ruta [PROPUESTA]:** `POST /api/v1/auth/invitations/validate` con `{ token }` en body [SPEC: `GET /api/auth/validate-invitation?token=`, v2 §3.6]. Se prefiere POST para que el token no quede en logs ni en `Referer`.
- **Output:** `{ valid: true, email, name, companyName, roleName }` | `{ valid: false, code: "TOKEN_EXPIRED"|"TOKEN_USED"|"TOKEN_INVALID" }`.
- **Seguridad:** rate limit por IP; respuesta indistinguible en tiempo para token inexistente; no exponer `companyId`, `roleId` ni datos de otros usuarios.

### O-11 Activar cuenta desde invitación (pública)

- **Ruta [PROPUESTA]:** `POST /api/v1/auth/invitations/accept` [SPEC: `POST /api/auth/activate-account` `{token, password, usuario?}` devuelve `{access_token, user}`].
- **Input:** `{ token, password, name?, surname?, identityDocument?, phoneNumber? }`.
- **Efecto atómico:** crea usuario con `companyId` y rol de la invitación (**no** del body), marca la invitación `ACCEPTED`, rechaza segundo uso.
- **Output:** `201 { userId }`. Decisión abierta (**D-O11**): si además inicia sesión (access token + cookie de refresh) o redirige a login (la spec v2 §3.6 dice login).
- **Errores:** `410 TOKEN_EXPIRED`, `410 TOKEN_USED`, `400 PASSWORD_POLICY`, `409 EMAIL_ALREADY_EXISTS`, `429`.

### O-12 Catálogo de roles

- **Ruta:** E2 `GET /api/v1/roles`, que el frontend usa hoy [FE] (hoy devuelve, según el tipo del frontend, solo `{id, name, description?}`). **Cambios [PROPUESTA]:** devolver solo los roles visibles para la empresa del token (globales + propios) y ampliar el esquema.
- **Output [PROPUESTA]:** `RoleSummary[] = { id, name, description?, color?, isSystem: boolean, assignable: boolean, scope: "GLOBAL"|"COMPANY", userCount, permissions?: string[] }`. `assignable` lo calcula el backend (hoy lo decide el frontend con `COMPANY_USER_ROLES`, `UserForm.tsx:33`).
- **Errores:** `401`, `403`. **Permisos:** `ROLES_READ` (los no admin no necesitan listarlos).

### O-13 Crear rol personalizado

- **Ruta [PROPUESTA]:** `POST /api/v1/roles` [SPEC: `POST /api/usuarios/roles`, v2 §3.8].
- **Input:** `{ name, description?, color?, permissions: string[] }` (modelo plano; ver D4 para el modelo matriz).
- **Output:** `201 RoleSummary`.
- **Errores:** `409 ROLE_NAME_EXISTS`, `422 UNKNOWN_PERMISSION` (permiso fuera del catálogo O-15), `422 PERMISSION_ESCALATION` (el actor intenta conceder permisos que él no tiene), `400`.
- **Permisos:** `ROLES_WRITE`. Un rol creado queda ligado a la empresa del token; nunca global.

### O-14 Editar y eliminar rol personalizado

- **Rutas [PROPUESTAS]:** `PUT /api/v1/roles/{roleId}`, `DELETE /api/v1/roles/{roleId}` [SPEC v2 §3.8].
- **Reglas [SPEC v2 §3.8 / permisos spec §1.1]:** roles de sistema no editables ni eliminables (`409 ROLE_IS_SYSTEM`); no se elimina un rol con usuarios (`409 ROLE_IN_USE` con `userCount`); los cambios de permisos aplican a todos los usuarios del rol (**ver O-18** para cómo se propaga).
- **Permisos:** `ROLES_WRITE`; rol de otra empresa → `404`.

### O-15 Catálogo de permisos

- **Ruta [PROPUESTA]:** `GET /api/v1/roles/permissions` → `{ groups: [{ key, label, permissions: [{ key, label, dangerous?: boolean }] }] }`. Alimenta la matriz de la UI; sin este endpoint el frontend tendría que hardcodear las claves (la spec lista rutas, v2 §3.5 «Estructura de rutas», que no coinciden con las rutas reales de la app, ver D4).
- **Permisos:** `ROLES_READ`.

### O-16 Permisos efectivos del usuario autenticado

- **Ruta [PROPUESTA]:** `GET /api/v1/auth/me` → `{ id, email, name, surname, companyId, role:{id,name}, permissions: string[], permissionsVersion: number, isSuperadmin: boolean }`.
- **Objetivo:** que el frontend deje de derivar privilegios del nombre del rol y de la lista de correos (`permissions.config.ts:3-26`), y tenga una fuente única que coincida con lo que el backend aplica.
- **Rol singular:** `role` es un solo objeto, igual que el claim `role` del JWT actual (`jwt.ts:4`). `permissions` son los del rol (y los extra por usuario, si D15-B). Si se elige D14-B, pasar a `roles[]` con `permissions` calculados como unión requiere una **nueva versión del contrato** (ver D14).
- **Errores:** `401`.

### O-17 Refresco de sesión cuando cambian los permisos

El frontend ya refresca con `POST /api/v1/auth/refresh` (cookie httpOnly, `AuthContext.tsx:113-133`) y expone `refreshSession` (`:318`) [FE]. No se sabe si hoy el refresh relee el rol desde la base. Requisitos para el backend, todos **[PROPUESTA]**:

1. El refresh **recalcula** `role` y `permissions` desde base de datos, no los copia del token anterior.
2. Cada vez que cambie el rol de un usuario, su estado o los permisos de un rol, se incrementa `permissionsVersion` (por usuario o por rol; ver D4/O-18).
3. Las respuestas de la API incluyen cabecera `X-Permissions-Version` (o el claim `pv` en el JWT) para que el cliente detecte desfase y llame a `refresh` + `GET /auth/me`; alternativa mínima: TTL de access token corto.
4. Usuario desactivado o eliminado: `refresh` responde `401 USER_INACTIVE` y el cliente cierra sesión.

### O-18 Propagación de cambios de rol/permisos y revocación

Según `docs/FIXES.md` (FIX-01, documento de este repo, no de backend), ms-ventas valida permisos leyendo el JWT (`@RequirePermissions('VIEW_FINANCES')` en dos endpoints de pagos). No hay evidencia de cómo autorizan ms-products, ms-logistics u otros servicios. Si los servicios leen los permisos del JWT, un cambio de rol no se refleja hasta que expira el access token. Hay que fijar el máximo aceptable de desfase (ver D9) y, si es menor que el TTL, añadir revocación (`tokenVersion` en el JWT comparada con un valor en caché/DB). No se define aquí el TTL porque no se conoce el actual.

---

## 3. Seguridad y alcance por empresa

### 3.1 Actores

| Actor | Alcance | Cómo debe identificarse (backend) |
|---|---|---|
| Admin de empresa | Usuarios, roles e invitaciones **solo de su `companyId`** | rol/permisos del JWT firmado + membresía en BD |
| Superadmin Powip | Cualquier empresa; endpoints de plataforma (E4, E7 y el rollback por E8 de la activación de leads) | claim/rol `SUPERADMIN` verificado en servidor. **No** una lista de correos en el cliente (`permissions.config.ts:3-10`). La migración desde la lista de correos sigue el orden de P0-03 para no cortar `LeadActivationFlow` |
| Usuario sin rol admin | Solo su propio perfil (O-02, O-06 propio) | — |

### 3.2 Reglas obligatorias de backend

1. **No confiar en IDs de la URL.** En E1/E3 y en cualquier ruta con `{companyId}` o `{userId}`: comparar contra `companyId` del token; el usuario objetivo debe pertenecer a esa empresa (`404`, no `403`, para no revelar existencia). Superadmin queda exento con auditoría.
2. **Validar autenticación, rol y empresa en cada endpoint**, incluidos los de `editar-usuario` (E12), que hoy el frontend llama sin `Authorization`. El mecanismo de autenticación de E12 (Bearer o cookie) queda por confirmar (P0-07).
3. **Escalada de privilegios:** un actor solo asigna roles de nivel menor o igual al suyo y solo concede permisos que posee (`PERMISSION_ESCALATION`). Un admin de empresa no puede asignar `SUPERADMIN`, `OWNER` ni roles globales no asignables.
4. **Editar el propio rol:** prohibido (`CANNOT_CHANGE_OWN_ROLE`); tampoco puede desactivarse a sí mismo (`CANNOT_DEACTIVATE_SELF`).
5. **Último administrador:** rechazar con `409 LAST_ADMIN` cualquier cambio de rol, desactivación o eliminación que deje a la empresa sin ningún admin activo (verificado en transacción para evitar carreras).
6. **Invitaciones a otra empresa:** `companyId` y `roleId` de la invitación se resuelven en servidor (token del actor); si el `roleId` pertenece a otra empresa → `422`. Al aceptar, el usuario se crea en la empresa de la invitación, nunca en la del body. Un email ya registrado en otra empresa se trata según D5.
7. **Roles personalizados** son por empresa: un admin no ve, edita ni asigna roles de otra empresa.
8. **Auditoría:** registrar (actor, objetivo, acción, antes/después, IP, fecha) para alta, cambio de rol, cambio de estado, restablecimiento de contraseña, invitación y cambios de rol/permisos.
9. **Rate limiting** en login, validar token, aceptar invitación y reenvío.
10. **Permisos por defecto mínimos:** un rol personalizado nuevo arranca sin permisos. El prototipo arranca la matriz con «Ver» marcado en todas las rutas, incluidas `finanzas/gastos` y Administración, que la spec de permisos §1.2 reserva al administrador. Si la UI conserva ese comportamiento, el backend igual tiene que rechazar (`422 PERMISSION_ESCALATION`) cualquier permiso que el actor no tenga.

### 3.3 Datos que no deben salir en ninguna respuesta ni log

`password`, `passwordHash`/`password_hash`, tokens de invitación (solo se guardan hasheados y se envían por email), refresh tokens, secretos HMAC, y contraseñas temporales. **Ningún email enviado por ms-auth incluye una contraseña**, ni siquiera la temporal del alta directa: el prototipo habla de enviar «credenciales de acceso», y lo que se envía tiene que ser un enlace de un solo uso (O-06, O-08). Los endpoints de validación no deben permitir enumerar emails. `identityDocument`, teléfono y dirección son datos personales: devolverlos solo a admin de la empresa o al propio usuario.

**Tokens de sesión: dónde sí y dónde no.** El `accessToken` es una respuesta legítima de los endpoints de autenticación, así que la regla no puede ser «ninguna respuesta contiene `token`». Se define por endpoint:

| Endpoint | Puede devolver en el cuerpo | Nunca devuelve |
|---|---|---|
| `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh` (E10, E11) | `accessToken` (hoy el frontend lo lee de `response.data.accessToken`, `AuthContext.tsx:113-133`) | contraseña, hash, refresh token (va solo en la cookie httpOnly) |
| O-11 `accept`, solo si D-O11 decide que inicia sesión | `accessToken` | lo mismo que login |
| Resto: E1-E9, `register` y `logout` (E11), E12 y O-01 a O-16 | Ningún token ni credencial | `password`, `passwordHash`, `token`, `accessToken`, `refreshToken`, tokens de invitación o de restablecimiento, secretos |

---

## 4. Decisiones abiertas (a tomar con backend y producto)

No hay evidencia suficiente para elegir; se presentan alternativas y consecuencias.

| ID | Decisión | Alternativas y consecuencia |
|---|---|---|
| **D1** | **Nombres e IDs de rol**: reales (`ADMIN, OWNER, ADMINISTRADOR, AGENTES, VENTAS, OPERACIONES, COURIER, CALLER, USUARIO`) vs IDs de spec (`rol_admin, rol_ventas, rol_ops, rol_mkt, rol_cc, rol_readonly`; la spec de comisiones usa `rol_call` y `supervisor`) | **A.** Mantener nombres reales y definir un mapeo oficial a la spec: no rompe tokens ni los `@RequirePermissions` actuales; hay que redefinir qué roles de la spec no tienen equivalente (Marketing, Solo lectura). **B.** Migrar a los IDs de la spec: unifica con los PDF, pero obliga a migrar datos, JWT y a ms-ventas/ms-products/ms-logistics a la vez. **C.** Identificar roles por `id` UUID y tratar el nombre como etiqueta: el frontend deja de depender de cadenas, a costa de cambiar el JWT (`role` hoy es nombre, `jwt.ts:4`). |
| **D2** | **Roles personalizados vs comprobaciones fijas** (hoy `ADMIN_ROLES` fijo en el cliente, `permissions.config.ts:18-26`) | **A.** Solo roles fijos: simple, pero la UI de «crear rol» no tiene sentido. **B.** Roles personalizados con permisos del catálogo (O-13/O-15): requiere que *todos* los servicios autoricen por permiso y no por nombre de rol, y propagación (O-18). **C.** Fijos ahora, personalizados después, reservando ya `GET /roles` ampliado y `permissions` en el JWT: menor riesgo inicial, la matriz queda en solo lectura. |
| **D3** | **Nombres reales de permisos y rutas** (hoy `VIEW_FINANCES`, `VIEW_SUPER_ADMIN`, `OPS_*` planeados, `MANAGE_USERS` solo en un comentario) vs matriz por ruta de la spec (`ventas/pedidos: {ver,crear,editar,eliminar,admin}`) | **A.** Permisos planos `MODULO_ACCION` (p. ej. `USERS_WRITE`): compatible con lo existente y con el JWT. **B.** Matriz por ruta de la spec: más granular, pero las rutas de la spec (`ventas/pedido/detalle`, `stock/almacenes`…) no coinciden con las rutas reales del frontend (`/ventas`, `/inventario`, `/operaciones`…) y el JWT crecería. **C.** Planos en el JWT y matriz solo como representación de UI que se compila a planos. Necesario antes de O-13/O-15. |
| **D4** | **Modelo de permisos del rol** (se deriva de D3) | Lista de cadenas (`permissions: string[]`) vs objeto `{ruta: {ver,crear,editar,eliminar,admin}}`. Con objeto, el catálogo y la validación son más complejos; con lista, la UI agrupa por prefijo. |
| **D5** | **Unicidad de email y usuario**: la spec v2 es contradictoria: DDL con `usuario` y `email` `UNIQUE` global (§3.2) vs texto «único en empresa» (§3.5, §6.2). No se conoce la restricción real de ms-auth | **A.** Global: un email = una cuenta = una empresa; simple y compatible con login por email sin empresa, pero impide que una misma persona trabaje en dos empresas. **B.** Por empresa: permite varias membresías, pero el login debe resolver la empresa (selector o tabla `membership`) y cambia el JWT. **C.** Cuenta global + membresías: lo más flexible y lo más costoso. Esta decisión condiciona O-08/O-11 (invitar a un email ya existente) y el `409`. También decidir si `identityDocument` es único y bajo qué ámbito, y si existe `usuario`/username (el frontend actual no lo usa). |
| **D6** | **Política de contraseña** y alta directa | Hoy: mín. 6 + minúscula + número (`userService.ts:152`); spec v2 §3.5: mín. 8 para la temporal. **A.** Mín. 8 con letra y número en todos los flujos. **B.** Mantener 6: menos fricción, más débil. Para el alta directa: temporal con `mustChangePassword` (recomendable) vs el admin define la clave definitiva y la conoce. |
| **D7** | **Caducidad de invitación**: 24 h (v2 §1.1) vs 48 h (v2 §3.6 y §6.1) | Una sola cifra, configurable por variable de entorno; 24 h reduce ventana de abuso, 48 h reduce reenvíos. |
| **D8** | **¿La pestaña «Referidos» pertenece a este módulo?** (v2 §3.1 y §4) | **A.** Mantenerla en la UI de Usuarios pero con contrato propio (otro servicio, p. ej. ms-subscription o nuevo): el contrato de usuarios queda limpio. **B.** Moverla a Configuración. Dependerá de qué servicio posea las tablas de referidos; este contrato no la cubre. |
| **D9** | **Desfase tolerable de permisos** tras cambiar un rol o desactivar un usuario (O-05, O-17, O-18). Login y refresh se bloquean al instante (P0-04); lo que se decide aquí es cuánto puede seguir usándose un access token ya emitido. El prototipo promete que el cambio de rol se aplica «de forma inmediata»; con la opción A ese texto sería falso. Backend tiene que fijar el plazo máximo aceptable | **A.** Hasta expirar el access token (sin cambios; hay que conocer el TTL). **B.** Revocación por `tokenVersion`/`permissionsVersion`: inmediato, requiere consulta o caché en cada servicio. **C.** TTL corto + refresh recalculado: compromiso intermedio. |
| **D10** | **Baja de usuario**: `DELETE /auth/user/{id}` lo llama el frontend solo como rollback (E8); no se sabe si borra físicamente; la spec dice soft delete `activo=false` (v2 §3.7), pero el prototipo pide confirmar con «Esta acción no se puede deshacer», que sugiere borrado físico | **A.** Solo desactivar (O-05) y dejar el `DELETE` solo para superadmin. **B.** Soft delete separado del estado «inactivo». Afecta a historial y auditoría. |
| **D11** | **Quién emite el email de invitación** | **A.** ms-auth directo: menos piezas, pero ms-auth pasa a depender de un proveedor de email. **B.** Un servicio de notificaciones aparte: desacopla, pero hoy el repo no muestra ninguno. La spec v2 §6.3 propone SendGrid dentro de un backend único Node/PostgreSQL con rutas `/api/...`. El frontend, en cambio, habla con microservicios separados (CLAUDE.md, «Contratos con otros servicios»), y ms-auth parece Spring a juzgar por el manejo de errores (`MethodArgumentNotValidException`, `UserForm.tsx:223`). La propuesta de la spec no se puede trasladar tal cual. |
| **D12** | **Campos de perfil**. El prototipo y la spec v2 §3.2/§3.5 piden `usuario` (login), `genero`, `dni` (8 dígitos), `apellidos`, `direccion` y `distrito`. El frontend actual usa `identityDocument` (DNI/RUC sin formato), `department/province/district` (ubigeo) y no tiene login distinto del email (`IUser.ts:7-20`, `UserForm.tsx`) | **A.** Agregar `username` y `gender` como opcionales y mantener `identityDocument` y el ubigeo: no rompe altas existentes, pero la UI muestra campos que el prototipo no tiene. **B.** Adoptar el modelo del prototipo (DNI de 8 dígitos, solo distrito): más simple, pero descarta provincia/departamento de los usuarios ya cargados y rechaza RUC (el campo actual admite «DNI / RUC», `UserForm.tsx`). **C.** Sin `username`, login siempre por email: coincide con el modal de invitación del prototipo («el correo como usuario») y con el login actual (E11), pero contradice el campo «Usuario / login» del alta y la spec §3.6. La unicidad de `username` depende de D5. |
| **D13** | **¿Un admin de empresa puede crear o promover otro administrador?** El selector del prototipo ofrece «Administrador»; el frontend actual lo excluye (`COMPANY_USER_ROLES`, `UserForm.tsx:33`) | **A.** Sí: el negocio puede tener varios admins y la regla LAST_ADMIN (§3.2.5) cobra sentido, pero cualquier admin puede crear otros admins. **B.** No: solo el dueño o un superadmin; hace falta distinguir dueño de admin (hoy existen `OWNER` y `ADMINISTRADOR` en `ADMIN_ROLES`, `permissions.config.ts:18-26`, sin regla documentada). **C.** Sí, pero solo el dueño (`OWNER`). Cualquiera de las tres define `assignable` en O-12 y la validación anti-escalada de P0-06. |
| **D14** | **¿Un usuario puede tener más de un rol?** El prototipo titula la columna «Roles» y sus datos de ejemplo combinan roles («Ventas/Operaciones», «Operaciones/Marketing»); hoy `User.role` es un único objeto (`IUser.ts:19`), el JWT lleva un solo `role` (`jwt.ts:4`) y la spec v2 §3.2 define `usuarios.rol_id` único | **A.** Un solo rol, y quien necesite más usa un rol personalizado (D2): no cambia el JWT ni las tablas, pero obliga a crear un rol por cada combinación. **B.** Varios roles por usuario (tabla intermedia): refleja el prototipo, pero el JWT pasa a `roles: []` y los permisos efectivos se calculan como unión, lo que afecta a O-12, O-16, a la regla anti-escalada y a cada servicio que hoy compara un único `role`. **Contrato vigente:** todo este documento asume `role` singular (O-01, O-02, O-04, O-16 y el JWT). Elegir B no es un cambio menor sobre este contrato: `roles[]`, el filtro `roleId` con varios roles y la unión de permisos requieren una nueva versión del contrato, con su forma de convivencia con los clientes actuales (a definir: campos nuevos con período de transición o rutas versionadas). |
| **D15** | **¿Permisos por usuario además de por rol?** El alta de usuario del prototipo permite abrir la matriz con cualquier rol elegido, no solo con «Personalizado» | **A.** Solo por rol: un usuario con permisos distintos necesita su propio rol personalizado; modelo simple y auditable. **B.** Permisos extra por usuario sobre los del rol: más flexible, pero los permisos efectivos dejan de deducirse del rol, crece el JWT y la auditoría tiene que registrar cambios por usuario. Si se elige A, la UI solo muestra la matriz con «Personalizado». |
| **D16** | **¿Los roles del sistema son editables por cada empresa?** Las tarjetas del prototipo ofrecen «Editar permisos» en Administrador, Ventas, Operaciones, Marketing y Contact Center; la spec v2 §3.3 dice que los roles predefinidos son los mismos para todas las empresas y no se pueden eliminar | **A.** No editables (`isSystem=true`, O-14 responde `409 ROLE_IS_SYSTEM`): coincide con la spec; la UI cambia «Editar permisos» por «Ver permisos». **B.** Editables por empresa como copia propia: el rol del sistema queda intacto y la empresa trabaja con su versión, pero hay que definir qué pasa cuando Powip actualiza el rol base. |
| **D17** | **Guardar datos y estado desde el mismo formulario** (O-04 + O-05). El modal «Editar usuario» del prototipo tiene un solo botón para ambos | **A.** Operación atómica [PROPUESTA]: O-04 acepta también `status` y aplica todo en una transacción, con las reglas de O-05 (`CANNOT_DEACTIVATE_SELF`, `LAST_ADMIN`, revocación de refresh tokens). Un solo resultado para la UI, pero O-04 hereda los permisos y efectos de O-05 (`USERS_WRITE` + `USERS_STATUS`). **B.** Dos llamadas con éxito parcial explícito: la UI llama a O-04 y después a O-05; si la segunda falla, muestra que los datos se guardaron y el estado no (con el `code` del error), y vuelve a leer el usuario (O-02) para mostrar el estado real. Contrato más simple, pero la UI tiene que manejar el caso intermedio. **C.** Separar en la UI: el estado sale del formulario y pasa a una acción propia por fila (como la que se retiró en `1f1c824`). Evita el éxito parcial a costa de apartarse del prototipo. |

---

## 5. Tabla de trabajo para backend

Prioridades: **P0** bloquea gestionar usuarios con seguridad; **P1** bloquea la nueva UI; **P2** mejora posterior. Sin fechas. «Responsable sugerido» es el servicio, no una persona. Los criterios son comprobables con una prueba de integración o una llamada HTTP.

| ID | Prio | Tarea | Criterio de aceptación verificable | Responsable sugerido |
|---|---|---|---|---|
| P0-01 | P0 | Entregar a frontend el contrato real actual de ms-auth (OpenAPI/Swagger o lista confirmada) de E1-E12 y de los claims reales del JWT | **Prueba:** para cada endpoint E1-E12, una llamada real con el ejemplo del OpenAPI responde con el código y el esquema declarados (prueba de contrato automatizada). Un token emitido por `POST /api/v1/auth/login` decodificado contiene exactamente los claims documentados, incluido el contenido real de `role` y `permissions`. Con eso, §1.1 y §1.2 pasan de [FE] a [BE] | ms-auth |
| P0-02 | P0 | Verificar o forzar que E1, E3, E5, E6 y E8 comparan el `companyId` del token con la empresa del recurso | **Prueba** con dos empresas A y B y el token de un admin de A: `GET /api/v1/auth/company/{B}/users` → `403` o `404`; `POST /api/v1/auth/company/{B}/user` → `403`; `GET /api/v1/auth/user/{id de B}` → `404`; `PUT /api/v1/auth/user/{id de B}` → `404`; `DELETE /api/v1/auth/user/{id de B}` → `403` o `404`. Con el token de un usuario de A con rol `VENTAS`, las mismas cinco llamadas sobre A → `403` (salvo `GET /user/{su propio id}` → `200`). En todos los casos el recurso de B queda sin cambios | ms-auth |
| P0-03 | P0 | Restringir E4 (`GET /api/v1/auth/users`) y E7 (`POST /api/v1/auth/admin/register`) a superadmin verificado en servidor **sin romper la activación de leads**. E7 lo usan hoy `LeadActivationFlow` (`LeadActivationFlow.tsx:213`; alta del dueño con `roleName: 'ADMINISTRADOR'`, luego suscripción y empresa, con rollback por E8 en `:282`) y `CreateUserModal` (`CreateUserModal.tsx:78`), ambos dentro del CRM de `/superadmin`, que el frontend habilita por la lista de emails (`src/app/superadmin/page.tsx:334,354`). Orden: **(1)** ms-auth documenta qué exige hoy E7 y E8; **(2)** identifica qué cuentas ejecutan esos flujos y les asigna el rol o permiso superadmin en el servidor; **(3)** recién entonces aplica la restricción | **Prueba previa (antes de restringir):** con el token de cada cuenta del paso 2, una activación de lead completa en un entorno de prueba (E7 → suscripción → empresa) responde `201` en cada paso, y un fallo forzado en la empresa deja el usuario borrado por E8. **Prueba de la restricción:** con token de admin de empresa → `403` en E4 y E7; con token de un email de `SUPERADMIN_EMAILS` (`permissions.config.ts:3-10`) sin rol superadmin en ms-auth → `403`; con token de superadmin del servidor → `200`/`201`, y la prueba previa sigue pasando | ms-auth (+ quien opera el CRM, para el paso 2) |
| P0-04 | P0 | Estado persistente (O-05, o la ruta que ms-auth confirme); `status=false` bloquea login y `refresh` y revoca refresh tokens. Documentar el plazo máximo de validez de los access tokens ya emitidos (la invalidación inmediata es P2-03) | **Prueba de bloqueo:** desactivar al usuario X → `200` con `status:false`; `POST /api/v1/auth/login` con las credenciales de X → `401` o `403`; `POST /api/v1/auth/refresh` con la cookie que X tenía antes → `401`; `GET /api/v1/auth/company/{companyId}/users` (E3) devuelve X con `status:false`. Reactivar → X vuelve a poder iniciar sesión. **Prueba del plazo:** un access token de X emitido antes de desactivarlo deja de ser aceptado por ms-auth a más tardar al vencer el plazo documentado. Si el plazo no se documenta, P0-04 no se da por cumplido | ms-auth |
| P0-05 | P0 | Reglas de integridad: no cambiar el propio rol, no desactivarse, no dejar la empresa sin admin | **Prueba:** el admin X hace `PUT /api/v1/auth/user/{X}` con otro `roleName` → `403 CANNOT_CHANGE_OWN_ROLE` y su rol no cambia; X se desactiva a sí mismo → `403 CANNOT_DEACTIVATE_SELF`; con un solo admin activo, otro actor con permiso (superadmin) lo degrada o desactiva → `409 LAST_ADMIN`; con dos admins A1 y A2, dos peticiones simultáneas (A1 desactiva a A2 y A2 desactiva a A1) → como máximo una devuelve `200` y la empresa conserva al menos un admin activo | ms-auth |
| P0-06 | P0 | Anti-escalada en alta y edición: el rol asignado tiene que ser asignable por quien lo asigna | **Prueba:** con token de admin de empresa, `POST /api/v1/auth/company/{su empresa}/user` y `PUT /api/v1/auth/user/{id}` con `roleName` = `SUPERADMIN`, `OWNER` o un rol de otra empresa → `422 ROLE_NOT_ASSIGNABLE` y no se crea ni se modifica nada. La misma prueba se repite en O-08 cuando exista | ms-auth |
| P0-07 | P0 | Exigir autenticación y comprobar identidad y empresa en `GET/PUT /api/v1/auth/user/{id}` y `POST /api/v1/auth/update-password`, que usa `editar-usuario`. **Mecanismo por confirmar:** hoy el frontend hace estas llamadas sin `Authorization` (`editar-usuario/page.tsx:60,86,119`); el navegador solo adjunta las cookies del dominio porque `axios.defaults.withCredentials = true` (`AuthContext.tsx:19`). No se sabe si ms-auth autentica hoy esas llamadas de alguna forma. ms-auth tiene que documentar si las acepta con Bearer, con cookie o con ambas; si exige Bearer, el frontend tiene que cambiar esas tres llamadas antes de activar la restricción | **Prueba (con el mecanismo documentado):** las tres llamadas sin credenciales válidas → `401`; con la sesión del usuario X sin rol admin, `GET`/`PUT /user/{Y}` → `403`/`404` y `update-password` con `userId` de Y → `403`; con la sesión de X sobre su propio id → `200`; `update-password` de X con `currentPassword` incorrecta → `400` o `401`, y la contraseña no cambia | ms-auth (+ frontend si se exige Bearer) |
| P0-08 | P0 | Ninguna respuesta ni log incluye contraseña ni hash, y los tokens de sesión solo aparecen donde la tabla de §3.3 los permite | **Prueba automatizada por endpoint** con la tabla de §3.3: en las respuestas de E1-E9, E12 (y de cada O-xx al implementarse) falla si aparece alguna clave de la columna «Nunca devuelve»; en login y refresh exige `accessToken` y falla si aparece `password`, `passwordHash` o `refreshToken` en el cuerpo. **Prueba de logs:** crear un usuario por E1 con la contraseña `Canary-P0-08-x1`, editarlo por E5 con otra contraseña canario, iniciar sesión con ella, y buscar en los logs de ms-auth de ese intervalo ambas contraseñas y el `accessToken` emitido → 0 coincidencias | ms-auth |
| P1-01 | P1 | O-01: listado paginado con `q`, `sort` (whitelist), `status`, `roleId` y `counts` de la empresa | `pageSize=500` → `400` o se limita a 100; `sort=password:asc` → `400`; `q=ana` filtra en servidor; `total` coincide con el filtro; `counts.active + counts.inactive = counts.total` y no cambia al paginar ni al filtrar | ms-auth |
| P1-02 | P1 | Unificar shape: `role` siempre `{id,name}` y un solo nombre para departamento/ciudad en E1/E3/E4/E5/E6 | E3, E4 y E6 devuelven el mismo `UserSummary`; E5 devuelve `city` o `department`, no ambos | ms-auth |
| P1-03 | P1 | Invitaciones O-08..O-11: crear, listar, reenviar, revocar, validar, aceptar; token hasheado, un solo uso, caducidad configurable; envío de email | Aceptar con token usado → `410 TOKEN_USED`; con token caducado → `410 TOKEN_EXPIRED`; reenviar invalida el token anterior; la fila en BD no contiene el token en claro; el usuario creado pertenece a la empresa/rol de la invitación aunque el body diga otra cosa | ms-auth + emisor de email (D11) |
| P1-04 | P1 | O-12: catálogo de roles con `isSystem`, `assignable`, `userCount`, solo los visibles por la empresa | El front puede eliminar `COMPANY_USER_ROLES` y seguir ofreciendo exactamente los roles con `assignable=true`; un rol de otra empresa nunca aparece | ms-auth |
| P1-05 | P1 | O-16 `GET /auth/me` con permisos efectivos y `permissionsVersion` | Tras cambiar el rol de un usuario, `GET /auth/me` con un token recién refrescado refleja los nuevos permisos y una versión mayor | ms-auth |
| P1-06 | P1 | O-17: `refresh` recalcula rol y permisos desde BD y responde `401` si el usuario está inactivo | Cambiar rol → `refresh` → el nuevo JWT trae el rol nuevo; desactivar → `refresh` → `401 USER_INACTIVE` | ms-auth |
| P1-07 | P1 | Códigos de error estables (`code`, `fields`) en todo el módulo | Cada error de la sección 2 devuelve el `code` documentado; los mensajes ya no se usan para lógica en el cliente | ms-auth |
| P1-08 | P1 | O-07 resumen de actividad (campos mínimos) | `GET /users/{id}/activity-summary` devuelve `lastLoginAt` actualizado tras un login; `404` para usuario de otra empresa | ms-auth |
| P1-09 | P1 | Auditoría de acciones de usuarios y roles | Cada acción de 3.2.8 genera un registro con actor, objetivo, antes/después; consultable por superadmin | ms-auth |
| P1-10 | P1 | Decidir D1-D7, D9, D12-D17 y D-O11 (sección 4 y O-11) por escrito | Cada decisión queda registrada con la alternativa elegida en este documento | Backend + producto |
| P1-11 | P1 | Campos de perfil según D12 (`username`, `gender`, formato de documento) en alta, edición, detalle y listado | El alta con los campos elegidos devuelve `201` y O-02 los devuelve; un campo fuera de formato → `400` con `fields` | ms-auth |
| P2-01 | P2 (**P1 si «Roles y permisos» entra en la primera entrega funcional**) | Roles personalizados O-13/O-14 y catálogo de permisos O-15 (según D2/D3). Si la pestaña «Roles y permisos» del prototipo forma parte de la primera entrega, la creación y edición de roles y el catálogo de permisos pasan a P1, junto con P1-04 | Rol creado visible solo en su empresa; eliminar con usuarios → `409 ROLE_IN_USE`; permiso fuera del catálogo → `422`; editar permisos de un rol cambia los `permissions` en el siguiente `refresh` de sus usuarios | ms-auth |
| P2-02 | P2 | Autorización por permiso (no por nombre de rol) en ms-ventas, ms-products, ms-logistics, ms-courier | Un usuario con rol personalizado que tiene `X` accede a lo protegido por `X` y no a lo demás en cada servicio | Cada microservicio |
| P2-03 | P2 | Revocación inmediata de tokens (`tokenVersion`, D9) | Tras desactivar/cambiar rol, un access token previo es rechazado por ms-ventas en menos del desfase acordado | ms-auth + servicios |
| P2-04 | P2 | Reemplazar los correos superadmin del cliente por claim verificable (`isSuperadmin` en `/auth/me`) | El frontend elimina `SUPERADMIN_EMAILS`; el superadmin sigue accediendo; un correo de la antigua lista sin rol superadmin deja de entrar | ms-auth (+ frontend) |
| P2-05 | P2 | Fusionar E1 y E7 en un único alta documentado, y retirar `DELETE` como rollback si D10 lo permite | Una sola ruta de alta para empresa y otra solo-superadmin; `DELETE` documentado por D10 | ms-auth |
| P2-06 | P2 | O-01b exportación CSV del listado filtrado | El CSV contiene exactamente las filas de O-01 con el mismo filtro, ninguna columna `password*`/token y la exportación queda en auditoría | ms-auth |

### Frontera con otros contratos

- Límite de usuarios por plan, comisiones, `funciones` por usuario, `cc-status` (E9) y Referidos: **no** se definen aquí. Se citan solo porque comparten la tabla/entidad de usuario (`rol_call`, `supervisor`, `ccRol`).

### Dependencias del frontend que desbloquea este contrato

Persistir activar/desactivar (P0-04), paginación/búsqueda en servidor (P1-01), selector de roles sin lista local (P1-04), invitaciones (P1-03), matriz de permisos (P2-01) y reemplazo de `SUPERADMIN_EMAILS`/`ADMIN_ROLES` por permisos efectivos (P1-05, P2-04). Las respuestas a Q-01..Q-06 (§1.7) permiten volver a borrar el departamento desde la edición, decidir si `roleName` se omite cuando no cambia y alinear la política de contraseña.
