"use client";

import type { OrderDetail } from "@/components/modals/GuideDetailsModal";
import { useSelectedOlvaHeadquarter } from "../hooks/use-selected-olva-headquarter";
import { OlvaOrderCard } from "./OlvaOrderCard";
import { OlvaSenderSection } from "./OlvaSenderSection";
import { OlvaSubmitBar } from "./OlvaSubmitBar";

interface OlvaLotFormProps {
  /** One entry per row of the lot, in form order. */
  itemKeys: readonly string[];
  ordersById: ReadonlyMap<string, OrderDetail>;
  previousErrors: ReadonlyMap<string, string>;
  isSubmitting: boolean;
  onRemove: (index: number) => void;
  onCancel: () => void;
}

/** The editable lot: shared sender/origin/payment on top, one card per order, submit bar below. */
export function OlvaLotForm({
  itemKeys,
  ordersById,
  previousErrors,
  isSubmitting,
  onRemove,
  onCancel,
}: OlvaLotFormProps) {
  const { headquarter } = useSelectedOlvaHeadquarter();

  return (
    <div className="grid gap-4">
      <OlvaSenderSection />

      {itemKeys.map((itemKey, index) => {
        const order = ordersById.get(itemKey);

        return order ? (
          <OlvaOrderCard
            key={itemKey}
            index={index}
            order={order}
            headquarter={headquarter}
            previousError={previousErrors.get(itemKey)}
            canRemove={itemKeys.length > 1 && !isSubmitting}
            onRemove={onRemove}
          />
        ) : null;
      })}

      <OlvaSubmitBar headquarter={headquarter} isSubmitting={isSubmitting} onCancel={onCancel} />
    </div>
  );
}
