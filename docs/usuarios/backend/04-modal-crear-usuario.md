# 04 — Modal Crear nuevo usuario

Estado: UI preparada · alta integrada en frontend con E1 para los campos actuales · backend pendiente de confirmar.

## 1. Pantalla y controles que desbloquea

Modal grande de dos columnas («Crear nuevo usuario»):

- Izquierda — Datos personales: Nombre, Apellidos, Usuario/login, Género, Email, Teléfono (+51). Dirección: Dirección, ubicación, DNI. Contraseña.
- Derecha — Rol y accesos: tarjetas de rol, descripción del rol, «Personalizar permisos por módulo y ruta» con la matriz.
- Pie: Cancelar / Crear usuario.

## 2. Estado actual y evidencia

- [FE] `src/components/forms/UserForm.tsx` → `createCompanyUser` (E1) envía exactamente: `identityDocument, name, surname, email, password, address, department, province, district, phoneNumber, roleName`.
- [FE] Usuario/login y Género se muestran **deshabilitados** con aviso; no se envían.
- [FE] Tarjetas de rol: solo roles de E2 elegibles por el filtro local `COMPANY_USER_ROLES` (`src/config/userRoles.ts`), con `description` si E2 la trae. La tarjeta «Personalizado» está deshabilitada («Pendiente de backend»). No se ofrecen los seis roles del mockup porque no existen con esos nombres.
- [FE] Matriz: vista previa sin casillas activas (bloque 11).
- [FE] Contraseña: política actual del frontend (mínimo 6, una minúscula, un número). El aviso «podrá cambiar su contraseña al primer ingreso» del mockup **no se muestra** porque no existe (bloque 18).
- [FE] Teléfono: el prefijo +51 es solo visual; se envía lo que se escribe.
- [FE] Ubicación: se usan departamento, provincia y distrito del ubigeo (el mockup pide solo distrito como texto).
- [FE] Se conservan las protecciones previas: un solo envío a la vez, bloqueo de cierre mientras guarda, campos recortados, ningún éxito sin respuesta de la API.
- No se envía ningún campo nuevo a E1 sin confirmación.

## 3. Datos necesarios

| Campo | Significado |
|---|---|
| `name`, `surname` | Obligatorios. |
| `username` | Login, único en el ámbito que decida backend (D5/D12). |
| `gender` | Catálogo cerrado u opcional (D12). |
| `email` | Obligatorio; unicidad según D5. |
| `phoneNumber` | Formato documentado (E.164 o nacional). |
| `address`, `district`, `province`, `department` | Ubicación. |
| `identityDocument` | DNI (8 dígitos) o RUC, regla a definir. |
| `password` | Temporal si se adopta `mustChangePassword` (bloque 18). |
| `roleIds[]` (o `roleName` actual) | Roles asignables por el actor. |
| `permissions` | Overrides por usuario, solo si el bloque 11 los habilita. |

## 4. Operaciones

| Operación | Tipo |
|---|---|
| E1 `POST /api/v1/auth/company/{companyId}/user` con `CreateCompanyUserRequest` | [FE] |
| E1 ampliado (o versión nueva) con `username`, `gender`, `roleIds[]`, `permissions?`, `mustChangePassword` | [PROPUESTA] |
| Header `Idempotency-Key` en el alta | [PROPUESTA] |

## 5. Ejemplos

Request actual (E1):

```json
{
  "identityDocument": "00000000",
  "name": "Ana",
  "surname": "Torres",
  "email": "ana@example.com",
  "password": "<contraseña>",
  "address": "Av. Ejemplo 100",
  "department": "Lima",
  "province": "Lima",
  "district": "Breña",
  "phoneNumber": "900000000",
  "roleName": "VENTAS"
}
```

Request propuesto:

```json
{
  "username": "atorres",
  "gender": "female",
  "name": "Ana",
  "surname": "Torres",
  "email": "ana@example.com",
  "phoneNumber": "+51900000000",
  "identityDocument": "00000000",
  "address": "Av. Ejemplo 100",
  "district": "Breña",
  "province": "Lima",
  "department": "Lima",
  "password": "<contraseña temporal>",
  "mustChangePassword": true,
  "roleIds": ["rol_ventas"],
  "permissions": null
}
```

Respuesta propuesta `201`:

```json
{ "user": { "id": "usr_10", "status": true, "roles": [{ "id": "rol_ventas", "name": "VENTAS" }], "mustChangePassword": true, "version": 1 }, "welcomeEmail": { "status": "not_sent" } }
```

`welcomeEmail.status` se informa aparte; un `201` no significa que se envió un email.

## 6. Validaciones, permisos y aislamiento por empresa

- Empresa desde el token (bloque 00); permiso `users.write`.
- Rol no asignable, de otra empresa o de nivel superior al actor → `422 ROLE_NOT_ASSIGNABLE`.
- Si un admin puede crear otros admins (D13) se expresa con `assignable` del catálogo (bloque 08), no con una lista del frontend.
- Duplicados → `409 EMAIL_ALREADY_EXISTS`, `409 USERNAME_ALREADY_EXISTS`, `409 DOCUMENT_ALREADY_EXISTS`.
- Contraseña débil → `400` con `fields.password`.
- Nunca devolver la contraseña.

## 7. Errores y comportamiento esperado en frontend

- `400` con `fields`: error junto a cada campo.
- `409`: mensaje del campo duplicado.
- `422`: «El rol no se puede asignar».
- Error de red o `5xx`: toast de error, el modal sigue abierto y se puede reintentar sin duplicar (idempotencia).
- Éxito: se cierra el modal, se recarga el listado y se informa «Usuario creado». Solo se menciona el email si `welcomeEmail.status` lo confirma.

## 8. Transacciones, concurrencia e idempotencia

- Alta del usuario y asignación de roles/permisos en una transacción: si falla una parte, no queda un usuario incompleto.
- `Idempotency-Key` (o equivalente) para reintentos.
- Envío de bienvenida desacoplado del alta.

## 9. Dependencias mínimas

Bloques 00 y 08. Para permisos por usuario: bloque 11. Para contraseña temporal: bloque 18.

## 10. Pruebas de aceptación

- Crear y recargar muestra todos los campos enviados.
- Duplicado → `409`; rol no asignable → `422`; contraseña débil → error de campo.
- Un reintento con la misma clave no crea dos usuarios.
- Un fallo en la asignación de roles revierte el alta.
- El usuario creado pertenece a la empresa del token aunque la URL diga otra.

## 11. Decisiones pendientes y desviaciones del mockup

- Seis roles del mockup (Administrador, Ventas, Operaciones, Marketing, Contact Center, Personalizado) vs. roles reales (D1). El frontend muestra los reales.
- Login y género (D12); DNI de 8 dígitos o documento libre.
- Política de contraseña: mínimo 8 del mockup vs. 6 actual (D6).
- Permisos por usuario (D15).
- El frontend usa ubigeo de 3 niveles en lugar de solo distrito.

## 12. Checklist de entrega e integración

- [ ] OpenAPI del alta con campos nuevos, errores y `Idempotency-Key`.
- [ ] Decisiones D1, D5, D6, D12, D13, D15.
- [ ] Frontend: habilitar login y género, enviar `roleIds[]` y `mustChangePassword` según contrato.
- [ ] Frontend: errores por campo con `fields`.
- [ ] Prueba de aceptación completa contra entorno de prueba.
