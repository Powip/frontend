/** Navegación a una página fuera de Powip (ej. Flow). Aparte para poder mockearla en tests. */
export function goToExternalPage(url: string): void {
  window.location.assign(url);
}
