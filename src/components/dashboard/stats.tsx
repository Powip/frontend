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
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, Store, TrendingUp, Users } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  trend?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  description,
  trend,
}) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <div className="flex items-center pt-1">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-xs text-green-500">{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const dailySalesData = [
  { name: "Lun", ventas: 4000 },
  { name: "Mar", ventas: 3000 },
  { name: "Mié", ventas: 5000 },
  { name: "Jue", ventas: 2780 },
  { name: "Vie", ventas: 6890 },
  { name: "Sáb", ventas: 8390 },
  { name: "Dom", ventas: 3490 },
];

const storeSalesData = [
  { name: "Tienda Central", value: 5000 },
  { name: "Tienda Norte", value: 3000 },
  { name: "Tienda Sur", value: 2000 },
  { name: "Tienda Este", value: 1500 },
  { name: "Tienda Oeste", value: 3500 },
];

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

// 🧠 Interfaces de datos
interface SalesData {
  month: string;
  total: number;
}

export const Stats: React.FC = () => {
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    tiendas: 4,
    productos: 640,
    vendedores: 7,
  });
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // eEn el futuro: cambiar esta URL por tu endpoint real del backend
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
    <div className="flex flex-col h-full w-full overflow-auto min-h-0">
      {/* Contenido principal */}
      <div className="flex-1 flex flex-col px-4 py-2 gap-6 min-h-0">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Ventas Totales"
            value="S/. 15,231.89"
            icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
            description="Ventas del mes actual"
            trend="+20% desde el mes pasado"
          />

          <StatCard
            title="Tiendas"
            value={stats.tiendas}
            icon={<Store className="h-4 w-4 text-muted-foreground" />}
            description="Tiendas registradas"
            trend={
              stats.tiendas > 0 ? `${stats.tiendas} activas` : "Sin tiendas"
            }
          />

          <StatCard
            title="Productos"
            value={stats.productos}
            icon={<Package className="h-4 w-4 text-muted-foreground" />}
            description="Productos en catálogo"
            trend={
              stats.productos > 0
                ? `${stats.productos} registrados`
                : "Sin productos"
            }
          />

          <StatCard
            title="Vendedores"
            value={stats.vendedores}
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
            description="Vendedores activos"
            trend={
              stats.vendedores > 0
                ? `${stats.vendedores} registrados`
                : "Sin vendedores"
            }
          />
        </div>

        <div className="flex-1 grid gap-4 md:grid-cols-2 lg:grid-cols-7 min-h-[350px]">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Ventas por Día</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={dailySalesData}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => [`S/. ${value}`, "Ventas"]}
                    labelStyle={{ color: "var(--foreground)" }}
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="ventas"
                    stroke="#02a8e1"
                    activeDot={{ r: 8 }}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Ventas por Tienda</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={storeSalesData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {storeSalesData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`S/. ${value}`, "Ventas"]}
                    labelStyle={{ color: "var(--foreground)" }}
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
