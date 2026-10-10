import { advertisingPeriodFromParams } from "../advertising-period";

describe("advertising links from store closures", () => {
  it("preserves an exact day and a leap-year annual range", () => {
    expect(
      advertisingPeriodFromParams(new URLSearchParams("from=2026-10-01&to=2026-10-01")),
    ).toEqual({ from: "2026-10-01", to: "2026-10-01" });
    expect(
      advertisingPeriodFromParams(new URLSearchParams("from=2024-01-01&to=2024-12-31")),
    ).toEqual({ from: "2024-01-01", to: "2024-12-31" });
  });
  it.each([
    "from=2026-02-30&to=2026-03-01",
    "from=2026-10-02&to=2026-10-01",
    "from=2026-01-01&to=2027-12-31",
    "from=2026-10-01&to=2026-10-02&from=2026-01-01",
    "from=2026-10-01",
    "from=2026-1-1&to=2026-10-01",
  ])("rejects invalid or ambiguous dates: %s", (query) => {
    expect(advertisingPeriodFromParams(new URLSearchParams(query))).toBeNull();
  });
});
