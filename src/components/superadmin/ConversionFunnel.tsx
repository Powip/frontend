import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from 'recharts';

interface FunnelData {
  leads: number;
  prospects: number;
  closed: number;
  active: number;
}

interface ConversionFunnelProps {
  data: FunnelData;
}

export const ConversionFunnel: React.FC<ConversionFunnelProps> = ({ data }) => {
  const chartData = [
    { name: 'Leads', value: data.leads, fill: '#3b82f6', description: 'Prospectos totales' },
    { name: 'Contactados', value: data.prospects, fill: '#6366f1', description: 'En interacción' },
    { name: 'Cerrados', value: data.closed, fill: '#8b5cf6', description: 'Empresas creadas' },
    { name: 'Activos', value: data.active, fill: '#10b981', description: 'Con ventas reales' },
  ];

  const calculateConversion = (current: number, previous: number) => {
    if (!previous) return '0%';
    return `${((current / previous) * 100).toFixed(1)}%`;
  };

  return (
    <Card className="h-full border-none shadow-sm bg-background/50">
      <CardHeader>
        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Embudo de Conversión Comercial
        </CardTitle>
        <CardDescription>Rendimiento del pipeline este mes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              barSize={40}
            >
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={100} 
                tick={{ fontSize: 12, fontWeight: 'bold' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border p-2 rounded-lg shadow-xl text-xs">
                        <p className="font-bold">{data.name}</p>
                        <p className="text-muted-foreground">{data.description}</p>
                        <p className="font-mono text-primary mt-1">{data.value} registros</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
                <LabelList 
                  dataKey="value" 
                  position="right" 
                  style={{ fontSize: '12px', fontWeight: 'bold', fill: 'currentColor' }} 
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Leads → Cont.</p>
            <p className="text-sm font-black text-blue-500">{calculateConversion(data.prospects, data.leads)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Cont. → Cerr.</p>
            <p className="text-sm font-black text-indigo-500">{calculateConversion(data.closed, data.prospects)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Cerr. → Act.</p>
            <p className="text-sm font-black text-emerald-500">{calculateConversion(data.active, data.closed)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
