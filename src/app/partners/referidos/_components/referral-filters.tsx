"use client";

import { Button } from "@/components/ui/button";
import { REFERRAL_FILTERS, type ReferralFilterKey } from "../_lib/referral-filters";

interface ReferralFiltersProps {
  value: ReferralFilterKey;
  onChange: (value: ReferralFilterKey) => void;
}

export function ReferralFilters({ value, onChange }: ReferralFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar referidos por estado">
      {REFERRAL_FILTERS.map((filter) => (
        <Button
          key={filter.key}
          type="button"
          size="sm"
          variant={value === filter.key ? "default" : "outline"}
          aria-pressed={value === filter.key}
          onClick={() => onChange(filter.key)}
        >
          {filter.label}
        </Button>
      ))}
    </div>
  );
}
