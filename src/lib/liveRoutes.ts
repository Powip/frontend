/** Public store slugs and opaque order capabilities; administrative routes remain private. */
export function isPublicLiveRoute(pathname: string): boolean {
  if (
    (pathname === "/live" || pathname === "/catalogo") &&
    typeof window !== "undefined" &&
    /^[a-z0-9-]+\.powip\.lat$/.test(window.location.hostname) &&
    !["www.powip.lat", "app.powip.lat", "api.powip.lat", "admin.powip.lat"].includes(
      window.location.hostname,
    )
  )
    return true;
  if (
    /^\/(live|catalogo)\/[a-z0-9][a-z0-9-]{1,48}[a-z0-9]\/?$/.test(pathname) &&
    !["admin", "settings", "config", "payments"].includes(pathname.split("/")[2])
  )
    return true;
  if (/^\/p\/[A-Za-z0-9_-]{43}\/?$/.test(pathname)) return true;
  return /^\/live\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/?$/i.test(
    pathname,
  );
}
