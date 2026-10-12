"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { resolveEffectivePermissions } from "@/features/whatsapp/utils/whatsapp-permissions.util";
import { ConnectionView } from "./ConnectionView";

const PENDING = { kind: "pending-integration" } as const;
const NO_MUTATIONS = {};

interface ConnectionTabProps {
  canManage: boolean;
}

export function ConnectionTab({ canManage }: ConnectionTabProps) {
  const { auth, selectedStoreId } = useAuth();
  const storesSource = auth?.company?.stores;
  const stores = useMemo(
    () => (storesSource ?? []).map((store) => ({ id: store.id, name: store.name })),
    [storesSource],
  );
  const [storeId, setStoreId] = useState<string | null>(null);
  const effectivePermissions = useMemo(() => resolveEffectivePermissions(null), []);
  const activeStoreId =
    storeId ?? stores.find((store) => store.id === selectedStoreId)?.id ?? stores[0]?.id ?? null;

  return (
    <ConnectionView
      stores={stores}
      storeId={activeStoreId}
      onStoreChange={setStoreId}
      now={new Date()}
      canManage={canManage}
      effectivePermissions={effectivePermissions}
      status={PENDING}
      account={PENDING}
      accounts={PENDING}
      templates={PENDING}
      testRun={null}
      contingency={PENDING}
      agents={PENDING}
      assistedQueue={PENDING}
      pricing={PENDING}
      usage={PENDING}
      signupAvailable={false}
      mutations={NO_MUTATIONS}
    />
  );
}
