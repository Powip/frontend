"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminDashboardSummary } from "@/features/partners/models/admin-dashboard-summary";

interface ReferralsByOriginChartProps {
  referralsByOrigin: AdminDashboardSummary["referralsByOrigin"] | undefined;
  clickToPayConversionPct: number | undefined;
  isLoading: boolean;
}

const ORIGIN_COLORS: Record<string, string> = {
  link: "#0E9E96",
  manual: "#8b5cf6",
  codigo: "#f59e0b",
};

const ORIGIN_LABELS: Record<string, string> = {
  link: "Link",
  manual: "Manual",
  codigo: "Código",
};

export function ReferralsByOriginChart({
  referralsByOrigin,
  clickToPayConversionPct,
  isLoading,
}: ReferralsByOriginChartProps) {
  const data = referralsByOrigin
    ? (Object.keys(referralsByOrigin) as (keyof typeof referralsByOrigin)[]).map((key) => ({
        key,
        label: ORIGIN_LABELS[key],
        value: referralsByOrigin[key],
      }))
    : [];

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Referidos por origen</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !referralsByOrigin ? (
          <Skeleton className="h-[180px] w-full" />
        ) : (
          <div className="flex items-center gap-6">
            <div className="h-[130px] w-[130px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={38}
                    outerRadius={62}
                    paddingAngle={2}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.key} fill={ORIGIN_COLORS[entry.key]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5">
              {data.map((entry) => (
                <div key={entry.key} className="flex items-center gap-2 text-sm text-foreground">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: ORIGIN_COLORS[entry.key] }}
                  />
                  {entry.label} · {entry.value}%
                </div>
              ))}
              {clickToPayConversionPct !== undefined && (
                <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                  Conversión clic→pago:{" "}
                  <span className="font-semibold text-foreground">{clickToPayConversionPct}%</span>
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
