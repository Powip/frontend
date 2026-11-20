import ubigeo from "@/utils/json/ubigeos.json";

// FEAT-24 H2-F — departamentos y provincias de Perú para las reglas de reserva
// (la misma lista con la que se registran las direcciones de los pedidos).

const departments = ubigeo[0].departments;
const norm = (value: string) =>
  value.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g, "");

export const DEPARTMENT_NAMES: string[] = departments.map((department) => department.name);

export function provinceNames(department: string): string[] {
  if (!department.trim()) return [];
  const found = departments.find((candidate) => norm(candidate.name) === norm(department));
  return found ? found.provinces.map((province) => province.name) : [];
}

/** Si la regla guardada tiene un valor que no está en la lista, se ofrece igual (para no perderlo). */
export function withCurrent(options: string[], current: string): string[] {
  return current.trim() && !options.some((option) => norm(option) === norm(current)) ? [current, ...options] : options;
}

/** La opción de la lista que corresponde al valor guardado (sin tildes ni mayúsculas), o el valor tal cual. */
export function optionFor(options: string[], current: string): string {
  return options.find((option) => norm(option) === norm(current)) ?? current;
}
