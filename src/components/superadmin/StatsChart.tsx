"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatsChartProps {
  title: string;
  data: any[];
  xKey: string;
  lines: {
    key: string;
    name: string;
    color: string;
  }[];
}

export default function StatsChart({
  title,
  data,
  xKey,
  lines,
}: StatsChartProps) {
  return (
    <Card className="w-full border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0 pb-6">
        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-gray-500">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="currentColor"
                className="text-slate-200 dark:text-white/5"
                opacity={0.5}
              />
              <XAxis
                dataKey={xKey}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 600, fill: "currentColor" }}
                className="text-slate-400 dark:text-gray-500"
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 600, fill: "currentColor" }}
                className="text-slate-400 dark:text-gray-500"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "12px",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: "12px",
                  fontWeight: "600",
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                }}
                itemStyle={{ padding: "2px 0" }}
                cursor={{ stroke: "hsl(var(--muted))", strokeWidth: 2 }}
              />
              <Legend 
                verticalAlign="top" 
                align="right"
                height={36} 
                iconType="circle"
                wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              />
              {lines.map((line) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.name}
                  stroke={line.color}
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--background))" }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
