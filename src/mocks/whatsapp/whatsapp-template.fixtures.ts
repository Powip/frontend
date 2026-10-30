export const templatePreviewValuesFixture = {
  cliente: "Carlos",
  orden: "ORD-149912",
  courier: "Shalom",
  link_rastreo: "powip.lat/r/K7X2Q",
  fecha_entrega: "jueves 8 de octubre",
  agencia: "Shalom Arequipa – Av. Ejército 710",
  saldo: "298.00",
  tienda: "LIVII",
  tipo_comprobante: "boleta",
  serie_numero: "B001-000482",
};

export const inTransitTemplateFixture = {
  header: "📦 Tu pedido va en camino",
  body: "Hola {{cliente}}, tu pedido *{{orden}}* ya está en camino con {{courier}}.\n\nLlegada estimada: *{{fecha_entrega}}*.\nSigue tu envío en tiempo real con el botón de abajo.",
  footer: "Responde STOP para no recibir avisos",
  buttonText: "Rastrear mi pedido",
};

export const agencyTemplateFixture = {
  body: "Hola {{cliente}}, tu pedido *{{orden}}* ya llegó a la agencia y está listo para recoger:\n\n📍 {{agencia}}\n\nLleva tu DNI y el código de tu guía.",
  buttonText: "Ver guía y dirección",
};

export const invoiceTemplateFixture = {
  body: "Hola {{cliente}}, te enviamos tu {{tipo_comprobante}} {{serie_numero}} por tu compra en {{tienda}}. ¡Gracias!",
  buttonText: "Ver mi pedido",
};

export const unsafeTemplateFixture = {
  body: 'Hola {{cliente}} <script>alert("x")</script> <b>no es negrita</b> y *sí es negrita*',
};
