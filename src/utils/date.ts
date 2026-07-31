import { format } from "date-fns";
import { es } from "date-fns/locale";

export function formatDateTime(date: Date | string) {
  return format(new Date(date), "dd/MM/yyyy, HH:mm:ss", {
    locale: es,
  });
}

export function formatDate(date: Date | string) {
  return format(new Date(date), "dd/MM/yyyy", {
    locale: es,
  });
}
