"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CreditCard, AlertTriangle } from 'lucide-react';
import { EmptyState } from "@/components/ui/empty-state";

interface PaymentDistributionItem {
  name: string;
  value: number;
}

interface SaasDistributionChartsProps {
  data?: PaymentDistributionItem[];
  isLoading?: boolean;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

export const SaasDistributionCharts: React.FC<SaasDistributionChartsProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="h-[400px] w-full bg-slate-100 dark:bg-white/5 animate-pulse rounded-2xl border border-slate-200 dark:border-white/5" />
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-full bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm">
        <EmptyState
          icon={AlertTriangle}
          title="Sin datos de pago"
          description="Aún no hay métodos de pago registrados en las suscripciones activas."
          className="h-full py-12"
        />
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/5 rounded-2xl h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <CreditCard className="h-4 w-4 text-blue-500" />
        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Métodos de Pago (SaaS)</h4>
      </div>
      <div className="flex-1 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1a1f2e', 
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '12px'
              }}
              formatter={(value, name) => [`${value} suscripciones`, name]}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              iconType="circle"
              formatter={(value) => <span className="text-xs font-bold text-slate-500 uppercase">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
