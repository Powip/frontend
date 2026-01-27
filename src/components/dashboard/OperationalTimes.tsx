"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { Timer, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardCard } from "./DashboardCard";

interface OperationalTime {
  status: string;
  avgHours: number;
}

const STATUS_LABELS: Record<string, string> = {
  PREPARACION: "Preparación",
  DESPACHO: "Despacho",
  CREADA: "Creación",
  LLAMADO: "Validación",
  PENDIENTE_DE_PAGO: "Pago",
  LISTO_PARA_DESPACHO: "Envío",
  ENTREGADO: "Entrega Final",
};

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export const OperationalTimes: React.FC = () => {
  const { selectedStoreId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OperationalTime[]>([]);

  const fetchTimes = async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/stats/operational-times`,
        {
          params: { storeId: selectedStoreId },
        },
      );
      setData(response.data);
    } catch (error) {
      console.error("Error fetching operational times:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimes();
  }, [selectedStoreId]);

  const avgTotal = data.reduce(
    (acc, curr) => acc + (Number(curr.avgHours) || 0),
    0,
  );

  return (
    <div className="grid grid-cols-1 gap-6">
      <DashboardCard
        title="Tiempos de Respuesta Operativa (Horas)"
        isLoading={loading}
        data={data}
        summaryStats={[
          {
            label: "Tiempo Total Promedio",
            value: `${(avgTotal || 0).toFixed(1)}h`,
          },
        ]}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data.map((d, i) => ({
              ...d,
              label: STATUS_LABELS[d.status] || d.status,
              fill: CHART_COLORS[i % CHART_COLORS.length],
            }))}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#f0f0f0"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              style={{ fontSize: "12px" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              style={{ fontSize: "12px" }}
            />
            <Tooltip
              formatter={(value) => [
                `${Number(value).toFixed(1)} horas`,
                "Promedio",
              ]}
              contentStyle={{
                borderRadius: "8px",
                border: "none",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            />
            <Bar dataKey="avgHours" radius={[4, 4, 0, 0]} barSize={50} />
            <ReferenceLine
              y={24}
              label="Objetivo 24h"
              stroke="#ef4444"
              strokeDasharray="3 3"
            />
          </BarChart>
        </ResponsiveContainer>
      </DashboardCard>
    </div>
  );
};
