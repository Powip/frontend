/** @jest-environment node */
import {
  adminReadDenialFor,
  adminReadSessionEpoch,
  denyAdminReadSession,
  getAdminReadDenialSnapshot,
} from "../admin-read-session-state";

it("does not store bearers or denials in shared server rendering state", () => {
  expect(typeof window).toBe("undefined");
  expect(adminReadSessionEpoch("server-session-A")).toBe(0);
  expect(adminReadSessionEpoch("server-session-B")).toBe(0);
  denyAdminReadSession("server-user", "server-session-A", new Error("Denied"));
  expect(adminReadDenialFor("server-user", "server-session-A")).toBeNull();
  expect(getAdminReadDenialSnapshot()).toBe(0);
});
