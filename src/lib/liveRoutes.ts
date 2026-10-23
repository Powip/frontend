/** The public catalogue is one store UUID; the console and every other subroute stay private. */
export function isPublicLiveRoute(pathname: string): boolean {
  return /^\/live\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/?$/i.test(
    pathname,
  );
}
