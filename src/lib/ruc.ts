// FEAT-24 H0 — misma regla que ms-logistics (supplier/ruc.ts): 11 dígitos,
// prefijo 10/15/16/17/20 y dígito verificador módulo 11.
const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const PREFIXES = ["10", "15", "16", "17", "20"];

export function isValidRuc(value: string): boolean {
  if (!/^\d{11}$/.test(value) || !PREFIXES.includes(value.slice(0, 2))) return false;
  const sum = WEIGHTS.reduce((total, weight, index) => total + weight * Number(value[index]), 0);
  const rest = 11 - (sum % 11);
  const check = rest === 10 ? 0 : rest === 11 ? 1 : rest;
  return check === Number(value[10]);
}
