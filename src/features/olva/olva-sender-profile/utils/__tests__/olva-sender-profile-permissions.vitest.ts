import { describe, expect, it } from "vitest";
import type { OlvaSenderProfile } from "../../models/olva-sender-profile";
import {
  canArchiveOlvaSenderProfile,
  canSetDefaultOlvaSenderProfile,
  isFirstOlvaSenderProfile,
} from "../olva-sender-profile-permissions";

function buildProfile(overrides: Partial<OlvaSenderProfile> = {}): OlvaSenderProfile {
  return {
    id: "sender-profile-001",
    label: "Almacén principal",
    ruc: "20616141971",
    email: "remitente@empresa.com",
    firstNames: "Maria Fernanda",
    lastName: "Quispe Rojas",
    phone: null,
    businessName: null,
    isDefault: false,
    createdAt: new Date("2026-10-01T15:00:00.000Z"),
    updatedAt: new Date("2026-10-01T15:00:00.000Z"),
    ...overrides,
  };
}

describe("olva sender profile permissions", () => {
  it("lets a non-default profile become the default and be archived", () => {
    const profile = buildProfile({ isDefault: false });

    expect(canSetDefaultOlvaSenderProfile(profile)).toBe(true);
    expect(canArchiveOlvaSenderProfile(profile)).toBe(true);
  });

  it("offers neither action on the default profile", () => {
    const profile = buildProfile({ isDefault: true });

    expect(canSetDefaultOlvaSenderProfile(profile)).toBe(false);
    expect(canArchiveOlvaSenderProfile(profile)).toBe(false);
  });
});

describe("isFirstOlvaSenderProfile", () => {
  it("is true only when the company has no active profiles", () => {
    expect(isFirstOlvaSenderProfile([])).toBe(true);
    expect(isFirstOlvaSenderProfile([buildProfile()])).toBe(false);
  });

  it("does not lock anything while the list has not loaded", () => {
    expect(isFirstOlvaSenderProfile(undefined)).toBe(false);
  });
});
