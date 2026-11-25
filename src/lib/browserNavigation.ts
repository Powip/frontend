/** Navegación a una página fuera de Powip (ej. Flow). Aparte para poder mockearla en tests. */
export function goToExternalPage(url: string): void {
  window.location.assign(url);
}

/** Carga completa que descarta la memoria de la sesión y no deja volver atrás. */
export function replacePage(url: string): void {
  window.location.replace(url);
}
