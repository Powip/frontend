/** Deja solo dígitos; 9 dígitos ⇒ prefijo 51 (Perú). Vacío o inválido ⇒ null. */
export function normalizarTelefono(telefono?: string | null): string | null {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  if (digitos.length === 9) return `51${digitos}`;
  if (digitos.length >= 10 && digitos.length <= 15) return digitos;
  return null;
}

export function whatsappLink({
  telefono,
  texto,
}: {
  telefono?: string | null;
  texto: string;
}): string {
  const numero = normalizarTelefono(telefono);
  return `https://wa.me/${numero ?? ""}?text=${encodeURIComponent(texto)}`;
}
