# 07 · Ficha del pedido › Seguimiento › Mensajes de WhatsApp (X1)

Referencias: PDF §6.4.7, §6.4.4 (evidencia), §14.4, §14.6; mockup de Gestión CC (`Powip_Confirmacion_Link_mockup.html`, botón Ver → Seguimiento) **no entregado** (D-23).

## X1 · Sección "Mensajes de WhatsApp"

| Campo | Detalle |
|---|---|
| Ubicación | `src/components/modals/CustomerServiceModal.tsx`, pestaña `seguimiento` (`TabsContent` en `:2188`). Esta ficha es la que abre el botón "Ver" en Ventas, Operaciones y Gestión CC a través de `OrderDetailModalProvider` / `OrderDetailButton` (`src/components/orders/OrderDetailModal.tsx`) |
| Posición propuesta | Después del bloque de estado del courier y línea de tiempo (`:2528` en adelante) y antes de "Acciones" (`:2853`), a ancho completo |
| Disparador | Abrir la ficha y entrar a Seguimiento (o abrirla con `initialTab: "seguimiento"`, ya soportado en `Props.initialTab`, `:180`) |
| Componente | Propuesto: `OrderWhatsAppMessages` (`src/components/whatsapp/`) que usa `WhatsAppThread` en modo compacto (solo lectura) |
| Datos | Línea de tiempo con cada aviso (plantilla, hora, ticks), respuestas del comprador, respuestas automáticas y de asesoras, notas internas, foto de entrega (C-E5), comprobante enviado. Encabezado con estado de la conversación y "Abrir conversación" |
| Lecturas | `GET /wa/threads/by-order/:orderId` → `{ items: [thread con messages] }` (puede haber más de un hilo si cambió el teléfono) |
| Estados | Pendiente: la sección no se muestra (PROPUESTA: evita ruido en una ficha muy usada; alternativa: título + "pendiente de integración" solo para administradores). Carga: skeleton de 3 burbujas. Vacío real: "Aún no se enviaron avisos por WhatsApp para este pedido". Tienda sin número (`409 WA_NOT_CONNECTED`): "Esta tienda no tiene WhatsApp conectado" + enlace a Configuración solo para administradores. Error: mensaje + Reintentar sin afectar el resto de la ficha. Sin `WA_VIEW`: no se muestra |
| Acción "Abrir conversación" | Navega a `/configuracion/whatsapp?tab=conversaciones&thread=<id>` (PROPUESTA). Alternativa: abrir `ConversationDrawer` encima de la ficha; descartada por ahora porque la ficha ya es un `Dialog` grande y anidar un `Sheet` complica foco y scroll. Decidir con producto: el PDF dice "así la asesora no cambia de módulo" |
| Mutaciones | Ninguna dentro de la ficha (solo lectura). Responder se hace en el cajón |
| Actualización | Polling 15 s mientras la pestaña Seguimiento está visible y la ficha abierta (los fetch de la ficha ya están condicionados a `open`, `OrderDetailModal.tsx:20-27`); invalidación por mutaciones del cajón (`thread-by-order`) |
| Rendimiento | La ficha se carga perezosamente (`lazy`) una vez por página; la query de WhatsApp solo corre con la pestaña Seguimiento activa |
| Permisos / tenant | `WA_VIEW`; backend valida que el pedido pertenezca a la empresa |
| Accesibilidad | Sección con encabezado `h3` "Mensajes de WhatsApp"; lista con orden cronológico |
| Pruebas | Extender `src/components/orders/__tests__/OrderDetailModal.test.tsx` y agregar test de `OrderWhatsAppMessages` con fixtures |
| Criterios de aceptación | §14.4 y §14.6: el mismo hilo se ve en la ficha › Seguimiento con sus estados; la foto de entrega aparece en el hilo |
| Contrato | C-22.7 PROPUESTA; C-E5 CONFIRMADO |

### Relación con el botón WhatsApp existente de la ficha

`CustomerServiceModal` tiene un botón WhatsApp (`handleWhatsApp`, `:581-593`) en Resumen (`:1268`) y en Seguimiento (`:2897`) que abre `wa.me` con un mensaje de rastreo armado en el navegador. Ese botón:

- sigue funcionando igual (no se toca en el Hito 1);
- no se registra como aviso ni cambia el estado del hilo (D-02);
- recibe el indicador del último aviso (X2) si el detalle del pedido trae `waLastNotice` (C-29);
- usa el link `/rastreo/{orderNumber}`; cuando exista C-30.3 debería usar el link con token. Cambio fuera de este hito, a decidir.
