"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// 🧠 Interfaces de datos
interface SalesData {
  month: string;
  total: number;
}

export const Stats: React.FC = () => {
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [loading, setLoading] = useState(true);

   const fakeData: SalesData[] = [
          { month: "Enero", total: 1200 },
          { month: "Febrero", total: 1800 },
          { month: "Marzo", total: 1500 },
          { month: "Abril", total: 2100 },
          { month: "Mayo", total: 2400 },
          { month: "Junio", total: 1900 },
        ];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // 🟩 En el futuro: cambiar esta URL por tu endpoint real del backend
        // const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/stats/sales`);
        // setSalesData(response.data);

        // 🔹 Por ahora: datos simulados (hardcodeados)
        const fakeData: SalesData[] = [
          { month: "Enero", total: 1200 },
          { month: "Febrero", total: 1800 },
          { month: "Marzo", total: 1500 },
          { month: "Abril", total: 2100 },
          { month: "Mayo", total: 2400 },
          { month: "Junio", total: 1900 },
        ];

        // Simulamos un pequeño delay de carga
        setTimeout(() => {
          setSalesData(fakeData);
          setLoading(false);
        }, 800);
      } catch (error) {
        console.error("Error al obtener las estadísticas:", error);
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-500 animate-pulse">Cargando estadísticas...</p>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
      {/* Gráfico de línea */}
      <Card className="shadow-md rounded-2xl">
        <CardHeader>
          <CardTitle>Ventas Mensuales</CardTitle>
        </CardHeader>
        <CardContent className="h-64"   >
            {salesData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#0ea5e9"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>):(<p className="text-gray-500">No hay datos disponibles.</p>
            )}
        </CardContent>
      </Card>

      {/* Gráfico de barras */}
      <Card className="shadow-md rounded-2xl">
        <CardHeader>
          <CardTitle>Comparativa de Ingresos</CardTitle>
        </CardHeader>
        <CardContent className = "h-64">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
