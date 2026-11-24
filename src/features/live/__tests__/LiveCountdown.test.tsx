import { render, screen } from "@testing-library/react";
import { LiveCountdown } from "../LiveShared";

/** FEAT-33 L4c: con más de una hora se lee en horas («3 h 00 min»), no «180:00». */
const now = "2026-11-24T15:00:00.000Z";
const after = (ms: number) => new Date(Date.parse(now) + ms).toISOString();
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(now));
});
afterEach(() => jest.useRealTimers());

test.each([
  [11 * 60e3 + 5e3, "11:05"],
  [59 * 60e3 + 59e3, "59:59"],
  [3 * 3600e3, "3 h 00 min"],
  [24 * 3600e3 + 5 * 60e3, "24 h 05 min"],
])("%p ms left → %s", (ms, text) => {
  render(<LiveCountdown expiresAt={after(ms)} serverNow={now} />);
  expect(screen.getByText(text)).toBeInTheDocument();
});
