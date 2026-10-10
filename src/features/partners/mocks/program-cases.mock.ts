import type { ProgramCase } from "../models/program-case";

export const PROGRAM_CASES_MOCK: ProgramCase[] = [
  { id: "case-1", title: "Registro por correo", description: "El partner registra el email del negocio; le llega invitación de activación.", result: "Correo enviado", resultTone: "neutral" },
  { id: "case-2", title: "No abre / no activa la cuenta", description: "No crea su cuenta en X días.", result: "Recordatorio; la invitación/código expira", resultTone: "neutral" },
  { id: "case-3", title: "Entra por link vs por código", description: "Link = atribución automática; código = lo escribe al registrarse.", result: "Ambos suman al mismo partner", resultTone: "neutral" },
  { id: "case-4", title: "Referido ya es cliente / pipeline directo", description: "El email ya existía en POWIP.", result: "Sin comisión", resultTone: "danger" },
  { id: "case-5", title: "Referido duplicado (2 partners)", description: "Dos partners reclaman el mismo email.", result: "Gana el 1° en la ventana de atribución", resultTone: "neutral" },
  { id: "case-6", title: "Auto-referido", description: "Mismo email/teléfono del partner.", result: "Bloqueado (anti-fraude)", resultTone: "danger" },
  { id: "case-7", title: "Activó pero no paga el 1er mes", description: "Creó cuenta, no completó el pago.", result: "Pendiente", resultTone: "warning" },
  { id: "case-8", title: "Paga el 1er mes", description: "Primer pago confirmado (con descuento).", result: "Comisión 1er mes + recurrente se activan", resultTone: "success" },
  { id: "case-9", title: "Cancela en el mes 1", description: "Baja/reembolso el primer mes.", result: "Clawback: revierte 1er mes", resultTone: "danger" },
  { id: "case-10", title: "Cancela en el mes 2+", description: "Baja después del primer mes.", result: "Recurrente se detiene, sin reverso", resultTone: "neutral" },
  { id: "case-11", title: "Reembolso / chargeback", description: "Contracargo de un pago liquidado.", result: "Reverso en el siguiente ciclo", resultTone: "danger" },
  { id: "case-12", title: "Upgrade de plan", description: "Sube de Standard a Full.", result: "Recurrente sube al nuevo plan", resultTone: "neutral" },
  { id: "case-13", title: "Downgrade de plan", description: "Baja de plan.", result: "Recurrente baja al nuevo plan", resultTone: "neutral" },
  { id: "case-14", title: "Pago anual", description: "Paga el año adelantado.", result: "1er mes + recurrente del año en 1 desembolso", resultTone: "success" },
  { id: "case-15", title: "Pago atrasado del cliente", description: "Se atrasa en su mensualidad.", result: "En riesgo — se pausa", resultTone: "warning" },
  { id: "case-16", title: "Descuento: ¿quién lo asume?", description: "Configurable por campaña.", result: "POWIP absorbe o sale de comisión del partner", resultTone: "neutral" },
  { id: "case-17", title: "Comisión bajo umbral", description: "Monto del ciclo < mínimo.", result: "Se acumula al siguiente ciclo", resultTone: "neutral" },
  { id: "case-18", title: "Partner suspendido", description: "Incumple o se da de baja.", result: "Comisiones en pausa", resultTone: "warning" },
];
