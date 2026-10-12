# 07 · Ficha del pedido › Seguimiento › Mensajes de WhatsApp (X1)

Referencias: PDF §6.4.7, §6.4.4, §14.4, §14.6. Mockup de Gestión CC no entregado (D-23).

**Estado (etapa 8, 2026-10-10):** implementado y montado. `CustomerServiceModal` (la ficha que abren "Ver" en Ventas, Operaciones y Gestión CC) muestra en la pestaña Seguimiento, antes de "Acciones", la sección "Mensajes de WhatsApp". Sin C-22.7 muestra una línea "Pendiente de integración…" y no hace peticiones.

| Campo | Detalle |
|---|---|
| Componentes | `OrderWhatsAppMessages` (contenedor, `src/components/whatsapp/OrderWhatsAppMessages.tsx`) y `OrderWhatsAppMessagesView` (vista) |
| Montaje | `src/components/modals/CustomerServiceModal.tsx`, dentro de `TabsContent value="seguimiento"`, con `orderId` de la ficha (3 líneas agregadas, nada más cambia) |
| Disparador | Abrir la ficha y entrar a Seguimiento (o `initialTab: "seguimiento"`) |
| Datos | Por cada conversación del pedido (puede haber más de una si cambió el teléfono): teléfono, estado del último aviso, "Respondió" si hay respuesta pendiente, y el hilo reutilizable `WhatsAppThread` (plantillas, entrantes y adjuntos, respuestas, automáticas, ecos, notas, evidencia por tipo) |
| Evidencia | `PREPARATION` "Evidencia de preparación", `DISPATCH` "Evidencia de despacho · no confirma la entrega", `DELIVERY` "Foto de entrega". C-E5 hoy solo devuelve preparación y despacho; la foto de entrega requiere otra fuente (D-56) |
| Abrir conversación | Enlace a `/configuracion/whatsapp?tab=conversaciones&thread={id real}` |
| Estados | Sin pedido real: no se renderiza. Pendiente: una línea. Carga, error con Reintentar, vacío ("Aún no se enviaron avisos por WhatsApp para este pedido"), contenido |
| Rendimiento | La sección vive dentro de la pestaña Seguimiento (Radix solo monta la pestaña activa) y la ficha es un único modal por página: una consulta por ficha abierta, nunca por fila |
| Lectura propuesta | C-22.7 `GET /wa/threads/by-order/:orderId` → `{ items: [conversación con mensajes, forma C-22.3] }`; `404` = sin conversaciones (vacío); `403` = sin `WA_VIEW` (no mostrar); empresa del token |
| Integración pendiente | Reemplazar el estado pendiente por un `useQuery` con `whatsappKeys.threadsByOrder(companyId, orderId)`, habilitado solo con la pestaña abierta; invalidar tras mutaciones del cajón |
| Botón WhatsApp de la ficha | Sin cambios: sigue abriendo `wa.me` con el link de la landing (D-02). El indicador del último aviso (X2) se puede sumar cuando el detalle traiga `waLastNotice` |
| Pruebas | `src/components/whatsapp/__tests__/integrations.test.tsx`; tests existentes de la ficha siguen pasando |
| Criterios de aceptación | §14.4/14.6 con datos reales: el mismo hilo se ve en la ficha con sus estados y la evidencia correcta |
