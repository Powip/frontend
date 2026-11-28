# Conexión de la cuenta Mercado Pago por tienda

La página `/configuracion/integraciones/mercadopago` usa las tiendas de la empresa
de la sesión. La selección es local a esta pantalla y no cambia la tienda global.
Los permisos de gestión y el estado de la cuenta proceden del backend; los
parámetros de retorno OAuth son únicamente avisos visuales.

## Contrato de Ventas

- `GET /merchant-payments/stores/:storeId/mercadopago/connection` devuelve
  `connected`, `mode`, `collectorId`, `accountLabel`, `canManage`, `oauthReady`,
  `revocationRequired` y `connectionType` (`oauth`). Los datos opcionales ausentes
  se omiten. Una cuenta conectada exige un collector válido y tipo OAuth.
- `POST /merchant-payments/stores/:storeId/mercadopago/connect`, con
  `{ "mode": "production" }`, devuelve `authorizationUrl` y una cookie nonce.
- `POST /merchant-payments/stores/:storeId/mercadopago/disconnect` deshabilita
  la cuenta. La pantalla vuelve a consultar el GET antes de mostrar su estado.
- El callback es `GET /merchant-payments/mercadopago/oauth/callback`.

Los tres endpoints de administración requieren el Bearer vigente. El backend
comprueba el usuario, la empresa y la propiedad de la tienda. La página no pide
contraseñas, access tokens ni client secrets de Mercado Pago.

## Transporte OAuth

El navegador inicia la conexión mediante el proxy del mismo origen
`POST /api/merchant-payments/stores/:storeId/mercadopago/connect`. El callback
registrado en Mercado Pago debe apuntar a
`https://DOMINIO_FRONTEND/api/merchant-payments/mercadopago/oauth/callback`.

En el servidor frontend, `MERCHANT_MERCADOPAGO_API_GATEWAY` especifica la base
fija de API Ventas; si se omite se usa `NEXT_PUBLIC_API_VENTAS` o la base existente
`GATEWAY.ventas` (`NEXT_PUBLIC_API_GATEWAY` más `/ventas`). Las dos primeras incluyen
el prefijo de Ventas cuando corresponde, por ejemplo `https://API/ventas`.
No contienen credenciales. El proxy exige HTTPS en producción y no sigue
redirecciones del upstream.

La cookie es `__Host-powip_merchant_mp_` más los primeros 16 caracteres hex de
SHA-256 del state. Es HttpOnly, Secure, SameSite=Lax y Path=/. El proxy únicamente
reenvía esa cookie en el callback, nunca las demás cookies de la aplicación.
El backend conserva el state, PKCE y los tokens; ningún código de autorización
se entrega a JavaScript del navegador. Tras finalizar se elimina el nonce.

La URL de retorno configurada en Ventas debe usar el mismo origen frontend y
el path `/configuracion/integraciones/mercadopago`. Únicamente se aceptan los
parámetros `mp=connected|error` y `storeId=UUID`. La URL de autorización se limita
a `https://auth.mercadopago.com/authorization` con un state de 43 caracteres.

## Validación

Las pruebas focales cubren el transporte del nonce, destinos permitidos,
redacción de errores, permisos, metadata posterior a la desconexión y respuestas
tardías al cambiar de tienda o sesión. Usan fixtures y fetch/servicios simulados.
Este frontend no implementa el cobro de pedidos ni certifica la configuración
productiva de la aplicación Mercado Pago.
