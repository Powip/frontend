"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSoles } from "@/features/partners/utils/format-currency";

interface MrrByMonthChartProps {
  monthlyMrr: { month: string; mrr: number }[] | undefined;
  isLoading: boolean;
}

export function MrrByMonthChart({ monthlyMrr, isLoading }: MrrByMonthChartProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>MRR referido por mes</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !monthlyMrr ? (
          <Skeleton className="h-[220px] w-full" />
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyMrr} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <YAxis hide />
                <Tooltip
                  formatter={(value: number) => formatSoles(value)}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  cursor={{ fill: "var(--foreground)", opacity: 0.05 }}
                />
                <Bar dataKey="mrr" fill="#0E9E96" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
