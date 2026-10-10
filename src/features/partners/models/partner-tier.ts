export type PartnerTierLevel = "bronce" | "plata" | "oro";

export interface PartnerTier {
  level: PartnerTierLevel;
  activeMrr: number;
  nextLevelThreshold: number | null;
  extraResidualPct: number;
}
