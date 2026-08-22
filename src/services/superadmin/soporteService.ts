import { ITicket, IMensajeTicket, PrioridadTicket } from "@/interfaces/superadmin";
import { ticketsMock } from "@/mocks/superadmin";
import { nextId } from "@/mocks/superadmin/seed";
import { mockDelay } from "./shared";

export async function getTickets(prioridad?: PrioridadTicket | "todas"): Promise<ITicket[]> {
  let items = [...ticketsMock];
  if (prioridad && prioridad !== "todas") items = items.filter((t) => t.prioridad === prioridad);
  return mockDelay(items.sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime()));
}

export async function getKpisSoporte() {
  const abiertos = ticketsMock.filter((t) => t.estado === "Abierto").length;
  const criticos = ticketsMock.filter((t) => t.prioridad === "Alta").length;
  return mockDelay({
    abiertos,
    criticos,
    tiempoRespuestaProm: "38 min",
    csat: "4.6/5",
  });
}

export async function getTicketById(id: string): Promise<ITicket | null> {
  return mockDelay(ticketsMock.find((t) => t.id === id) ?? null);
}

export async function responderTicket(ticketId: string, texto: string): Promise<ITicket | null> {
  const ticket = ticketsMock.find((t) => t.id === ticketId);
  if (!ticket) return mockDelay(null);
  const mensaje: IMensajeTicket = {
    id: nextId("msg"),
    autor: "Tú",
    esEquipoPowip: true,
    texto,
    creadoEn: new Date().toISOString(),
  };
  ticket.mensajes.push(mensaje);
  if (ticket.estado === "Abierto") ticket.estado = "En proceso";
  return mockDelay(ticket, 300);
}

export async function resolverTicket(id: string): Promise<ITicket | null> {
  const ticket = ticketsMock.find((t) => t.id === id);
  if (!ticket) return mockDelay(null);
  ticket.estado = "Resuelto";
  return mockDelay(ticket, 300);
}
