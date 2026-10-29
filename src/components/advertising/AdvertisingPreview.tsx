"use client";

import { useState } from "react";
import { AdvertisingConnectionDialog } from "./AdvertisingConnectionDialog";
import { AdvertisingDashboard } from "./AdvertisingDashboard";
import { type AdvertisingFixtureScenario, createAdvertisingFixture } from "./advertising-fixtures";
import type { AdvertisingProvider } from "./advertising-model";

interface Flow {
  provider: AdvertisingProvider;
  mode: "connect" | "manage" | "reconnect";
}

const discovery = createAdvertisingFixture("currencies");

/** Interactive sample used by Storybook only. Never mounted on company routes. */
function InteractivePreview({ scenario }: { scenario: AdvertisingFixtureScenario }) {
  const [snapshot, setSnapshot] = useState(() => createAdvertisingFixture(scenario));
  const [flow, setFlow] = useState<Flow | null>(null);
  const [notice, setNotice] = useState("");
  const from = scenario === "no-orders" ? "2026-10-07" : "2026-10-01";
  const to = scenario === "no-orders" ? "2026-10-07" : "2026-10-08";

  function confirmAccounts(ids: string[]) {
    if (!flow) return;
    const { provider, mode } = flow;
    setSnapshot((current) => {
      const accounts = current.accounts.map((account) =>
        account.provider === provider ? { ...account, enabled: ids.includes(account.id) } : account,
      );
      const addedIds = ids.filter((id) => !accounts.some((account) => account.id === id));
      accounts.push(
        ...discovery.accounts
          .filter((account) => addedIds.includes(account.id))
          .map((account) => ({ ...account, enabled: true })),
      );
      const refreshIds = mode === "reconnect" ? ids : addedIds;
      const days = [
        ...current.days.filter((day) => !refreshIds.includes(day.accountId)),
        ...discovery.days.filter((day) => refreshIds.includes(day.accountId)),
      ];
      return {
        ...current,
        accounts,
        days,
        providers: {
          ...current.providers,
          [provider]: { available: true, status: ids.length ? "connected" : "paused" },
        },
      };
    });
    setNotice(
      ids.length ? "Gastos de ejemplo actualizados." : "Actualizaciones de ejemplo pausadas.",
    );
  }

  return (
    <>
      <p className="px-4 pt-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
        {from === to ? "7 oct 2026 · día sin pedidos" : "1–8 oct 2026"}
      </p>
      <p className="sr-only" role="status">
        {notice}
      </p>
      <AdvertisingDashboard
        companyName="Casa Andina"
        from={from}
        to={to}
        snapshot={snapshot}
        isDemo
        onConnect={(provider) => setFlow({ provider, mode: "connect" })}
        onManage={(provider) => setFlow({ provider, mode: "manage" })}
        onReconnect={(provider) => setFlow({ provider, mode: "reconnect" })}
        onPause={(provider) => {
          setSnapshot((current) => ({
            ...current,
            accounts: current.accounts.map((account) =>
              account.provider === provider ? { ...account, enabled: false } : account,
            ),
            providers: {
              ...current.providers,
              [provider]: { ...current.providers[provider], status: "paused" },
            },
          }));
          setNotice(
            "Actualizaciones de ejemplo pausadas. Los gastos anteriores siguen disponibles.",
          );
        }}
        onResolveManual={(recordId, accountId) => {
          setSnapshot((current) => ({
            ...current,
            manualRecords: current.manualRecords.map((record) =>
              record.id === recordId
                ? { ...record, status: "represented", importedAccountId: accountId }
                : record,
            ),
          }));
          setNotice("Gasto de ejemplo confirmado. Se cuenta una sola vez.");
        }}
        onReopenManual={(recordId) =>
          setSnapshot((current) => ({
            ...current,
            manualRecords: current.manualRecords.map((record) =>
              record.id === recordId ? { ...record, status: "pending" } : record,
            ),
          }))
        }
      />
      {flow ? (
        <AdvertisingConnectionDialog
          open
          onOpenChange={(open) => {
            if (!open) setFlow(null);
          }}
          provider={flow.provider}
          mode={flow.mode}
          companyName="Casa Andina"
          accounts={discovery.accounts}
          enabledAccountIds={snapshot.accounts
            .filter((account) => account.enabled)
            .map((account) => account.id)}
          onConfirm={confirmAccounts}
          isDemo
        />
      ) : null}
    </>
  );
}

export function AdvertisingPreview({
  scenario = "complete",
}: {
  scenario?: AdvertisingFixtureScenario;
}) {
  return <InteractivePreview key={scenario} scenario={scenario} />;
}
