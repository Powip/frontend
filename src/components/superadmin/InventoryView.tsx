"use client";

import React, { useState, useMemo } from 'react';
import { 
  Package, 
  AlertTriangle, 
  Search, 
  Filter, 
  Archive, 
  Layers,
  Building2,
  TrendingDown,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";

interface InventoryViewProps {
  outOfStockItems: any[];
  metrics: any;
  companies: any[];
}

const ITEMS_PER_PAGE = 8;

export function InventoryView({
  outOfStockItems,
  metrics,
  companies
}: InventoryViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // KPIs
  const kpis = useMemo(() => {
    return {
      total: metrics?.totalProducts || 0,
      outOfStock: metrics?.outOfStockCount || 0,
      lowStock: outOfStockItems.filter(item => item.availableStock > 0 && item.availableStock < 5).length,
      variants: outOfStockItems.length // Just as a reference
    };
  }, [metrics, outOfStockItems]);

  // Filtering
  const filteredItems = useMemo(() => {
    if (!searchTerm) return outOfStockItems;
    const lower = searchTerm.toLowerCase();
    return outOfStockItems.filter(item => 
      item.productName?.toLowerCase().includes(lower) || 
      item.sku?.toLowerCase().includes(lower)
    );
  }, [outOfStockItems, searchTerm]);

  // Pagination
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard 
          label="Total Productos" 
          value={kpis.total.toString()} 
          sub="En todas las tiendas"
        />
        <KpiCard 
          label="Sin Stock" 
          value={kpis.outOfStock.toString()} 
          sub="Requiere reposición"
          trend="Critical"
          trendUp={false}
        />
        <KpiCard 
          label="Bajo Stock" 
          value={kpis.lowStock.toString()} 
          sub="Menos de 5 unidades"
          trend="Monitor"
          trendUp={false}
        />
        <KpiCard 
          label="Variantes" 
          value={filteredItems.length.toString()} 
          sub="Modelos y atributos"
          trend="+8%"
          trendUp={true}
        />
      </div>

      {/* Main Content */}
      <Card className="bg-[#0f1117] border-white/10 overflow-hidden shadow-2xl">
        <CardHeader className="border-b border-white/5 bg-white/[0.01]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                <Archive className="h-5 w-5 text-primary" /> Alerta Global de Existencias
              </CardTitle>
              <CardDescription className="text-gray-400">
                Monitoreo consolidado de productos con stock crítico en toda la red Powip.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative w-full md:w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input 
                  placeholder="Buscar por producto o SKU..." 
                  className="pl-10 bg-white/5 border-white/10 text-white focus:ring-primary/50"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <Button variant="outline" className="border-white/10 bg-white/5 text-gray-300">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/[0.02]">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-gray-400 font-bold uppercase text-[10px] tracking-wider pl-6">Producto</TableHead>
                <TableHead className="text-gray-400 font-bold uppercase text-[10px] tracking-wider">SKU / Identificador</TableHead>
                <TableHead className="text-gray-400 font-bold uppercase text-[10px] tracking-wider">Empresa</TableHead>
                <TableHead className="text-gray-400 font-bold uppercase text-[10px] tracking-wider text-right pr-6">Stock Actual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item) => (
                <TableRow key={item.variantId} className="border-white/5 hover:bg-white/[0.02] transition-colors group">
                  <TableCell className="pl-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <Package className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">
                          {item.productName}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          ID: {item.variantId.substring(0, 12)}...
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="px-2 py-1 rounded bg-white/5 border border-white/10 inline-block font-mono text-[10px] text-gray-400 group-hover:text-primary transition-colors">
                      {item.sku || "SN-SKU-001"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-blue-500/10 text-blue-500">
                          <Building2 className="h-3 w-3" />
                        </div>
                        <div className="text-xs text-gray-300 font-medium">
                          {companies.find(c => c.id === item.variantId.substring(0, item.variantId.indexOf('-')) || item.variantId.substring(0,8))?.name || `Empresa ${item.variantId.substring(0, 4)}`}
                        </div>
                      </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex flex-col items-end">
                      <div className={`text-lg font-black ${item.availableStock === 0 ? 'text-red-500 animate-pulse' : 'text-amber-500'}`}>
                        {item.availableStock}
                      </div>
                      <Badge className={`px-1.5 py-0 text-[8px] font-black uppercase ${item.availableStock === 0 ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                        {item.availableStock === 0 ? 'AGOTADO' : 'CRÍTICO'}
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredItems.length === 0 && (
            <div className="py-20 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
                <Package className="h-8 w-8 text-gray-600" />
              </div>
              <h3 className="text-lg font-bold text-white">No hay productos en riesgo</h3>
              <p className="text-gray-500 text-sm">Todas las existencias están por encima del umbral crítico.</p>
            </div>
          )}

          <div className="p-6 border-t border-white/5">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredItems.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Help Note */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-4">
        <div className="p-2 bg-primary/20 rounded-lg text-primary">
          <ArrowUpRight className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white">¿Cómo gestionar el stock?</h4>
          <p className="text-xs text-gray-400 mt-1">
            Para realizar ajustes manuales o reposiciones, accede al detalle de la empresa desde la pestaña **Empresas** y selecciona el módulo de inventario específico.
          </p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, trend, trendUp }: any) {
  return (
    <div className="relative bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/5 rounded-2xl p-4 flex flex-col gap-2 overflow-hidden transition-all hover:shadow-md hover:border-primary/20 group">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-gray-500 group-hover:text-primary transition-colors">{label}</span>
        {trend && (
          <span className={cn(
            'text-[9px] font-black px-2 py-0.5 rounded-full',
            trendUp ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
          )}>
            {trend}
          </span>
        )}
      </div>
      <div className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{value}</div>
      <div className="text-xs text-slate-500 dark:text-gray-400 font-medium">{sub}</div>
    </div>
  );
}
