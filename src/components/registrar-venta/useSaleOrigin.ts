"use client";

import { useState } from "react";
import type { SaleInventory, SaleStore } from "@/services/saleContextService";

interface Origin {
  storeId: string;
  inventoryId?: string | null;
}

interface Options {
  scope: string;
  editing: boolean;
  saved: Origin | null;
  stores: SaleStore[];
  inventories: SaleInventory[];
}

/** The sale's origin is independent of the store selected in navigation. */
export function useSaleOrigin({ scope, editing, saved, stores, inventories }: Options) {
  const [choice, setChoice] = useState({ scope, storeId: "", inventoryId: "" });
  const current = choice.scope === scope ? choice : null;
  const storeId = editing
    ? saved?.storeId ?? ""
    : stores.find((store) => store.id === current?.storeId)?.id ??
      (stores.length === 1 ? stores[0].id : "");
  const inventoryId = editing
    ? saved?.inventoryId ?? ""
    : inventories.find((inventory) => inventory.id === current?.inventoryId)?.id ??
      (inventories.length === 1 ? inventories[0].id : "");

  function chooseStore(value: string) {
    if (editing || !stores.some((store) => store.id === value)) return;
    setChoice((previous) => ({
      scope,
      storeId: value,
      inventoryId: previous.scope === scope ? previous.inventoryId : "",
    }));
  }

  function chooseInventory(value: string) {
    if (editing || !inventories.some((inventory) => inventory.id === value)) return;
    setChoice((previous) => ({
      scope,
      storeId: previous.scope === scope ? previous.storeId : "",
      inventoryId: value,
    }));
  }

  function reset() {
    setChoice({ scope, storeId: "", inventoryId: "" });
  }

  return {
    storeId,
    inventoryId,
    chooseStore,
    chooseInventory,
    reset,
    hasStore: Boolean(storeId),
    // Historical orders keep their unknown warehouse; editing never guesses one.
    hasInventory: editing ? Boolean(saved) : Boolean(inventoryId),
  };
}
