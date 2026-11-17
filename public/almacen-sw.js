/*
 * FEAT-24 H6-D — service worker del modo almacén (/almacen).
 *
 * Guarda SOLO el «shell»: las páginas de /almacen, los archivos estáticos de
 * Next que usan (/_next/static, con hash en el nombre) y el manifiesto con sus
 * íconos. NUNCA guarda respuestas de la API: lo que es de otro origen (los
 * microservicios) o de /api/ pasa directo a la red. Los datos para usar sin
 * señal los guarda la propia app en IndexedDB.
 *
 * Se registra con scope "/almacen" (ver WarehouseShell), así que no controla
 * el resto de POWIP. No es public/mockServiceWorker.js (ese es de MSW).
 */
const VERSION = "v1";
const SHELL_CACHE = `powip-almacen-shell-${VERSION}`;
const STATIC_CACHE = `powip-almacen-static-${VERSION}`;
const SCOPE_PATH = "/almacen";
const PAGES = [
  "/almacen",
  "/almacen/consultar",
  "/almacen/picking",
  "/almacen/recibir",
  "/almacen/recibir/devoluciones",
  "/almacen/revisar",
];
const FILES = [
  "/almacen/manifest.webmanifest",
  "/almacen/icon-192.png",
  "/almacen/icon-512.png",
  "/almacen/icon-maskable-512.png",
  "/almacen/apple-touch-icon.png",
];
const MAX_STATIC_ENTRIES = 300;
const STATIC_ASSET = /\/_next\/static\/[^"'\s\\)]+/g;

const inScope = (url) => url.pathname === SCOPE_PATH || url.pathname.startsWith(`${SCOPE_PATH}/`);

/** Guarda una página y anota los archivos estáticos que pide. */
async function cachePage(cache, path, assets) {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store" });
  // Una redirección (p. ej. al login) no es el shell: no se guarda.
  if (!response.ok || response.redirected) return;
  const html = await response.clone().text();
  await cache.put(path, response);
  for (const asset of html.match(STATIC_ASSET) || []) assets.add(asset);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      const assets = new Set();
      for (const page of PAGES) {
        try {
          await cachePage(shell, page, assets);
        } catch {
          // Sin red al instalar: se guarda en la próxima visita.
        }
      }
      await shell.addAll(FILES).catch(() => undefined);
      const statics = await caches.open(STATIC_CACHE);
      await Promise.all([...assets].map((asset) => statics.add(asset).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("powip-almacen-") && key !== SHELL_CACHE && key !== STATIC_CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

/** Los archivos de /_next/static no cambian (el nombre lleva hash): primero la copia. */
async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    // Los más viejos primero: se borran los que sobran de despliegues anteriores.
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES))) await cache.delete(key);
  }
  return response;
}

/** Páginas: primero la red (siempre la versión nueva); sin señal, la última copia. */
async function networkFirstPage(request, url) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected) await cache.put(url.pathname, response.clone());
    return response;
  } catch (error) {
    const cached = (await cache.match(url.pathname)) || (await cache.match(SCOPE_PATH));
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirstShellFile(request, url) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(url.pathname);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(url.pathname, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // La API (otro origen) y las rutas /api/ de Next: siempre a la red, nunca a la caché.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }
  if (!inScope(url)) return;
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request, url));
    return;
  }
  if (FILES.includes(url.pathname)) {
    event.respondWith(cacheFirstShellFile(request, url));
  }
  // El resto (p. ej. la carga RSC de una navegación interna) va a la red: sin señal, Next hace una
  // navegación completa y la página sale de la copia guardada.
});
