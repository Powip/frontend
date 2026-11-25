import { isPublicLiveRoute } from "../liveRoutes";

/** FEAT-33 L5b: el portal de creadoras es público (tiene su propio ingreso), el resto sigue privado. */
test.each([
  ["/vendedor/kunca", true],
  ["/vendedor/kunca/", true],
  ["/vendedor", false],
  ["/vendedor/kunca/extra", false],
  ["/vendedor/Kunca", false],
  ["/live/kunca", true],
  ["/live", false],
  ["/configuracion", false],
])("%s → %s", (path, expected) => {
  expect(isPublicLiveRoute(path)).toBe(expected);
});
