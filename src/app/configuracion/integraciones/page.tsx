'use client';

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  Package,
  ShoppingBag,
  Truck,
  Send,
  MessageCircle,
  Search,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { getShalomConfig } from "@/services/shalomService";
import { getAliclikCredentials } from "@/services/aliclikService";
import { getEvaCredentials } from "@/services/evaService";
import { getYavendioConfig } from "@/services/yavendioService";

const API_INTEGRATIONS = (
  process.env.NEXT_PUBLIC_API_INTEGRATIONS || "http://localhost:3004"
).replace(/\/$/, "");

type Category = "courier" | "canal";
type CategoryFilter = "all" | Category;

interface IntegrationDef {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  color: string;
  bgColor: string;
  category: Category;
  categoryLabel: string;
  methodTag: string;
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "shalom",
    title: "Shalom Courier",
    description: "Genera y despacha guías directamente desde el Centro de Envíos, con tracking en cada pedido.",
    icon: Truck,
    href: "/configuracion/integraciones/shalom",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/40",
    category: "courier",
    categoryLabel: "Courier",
    methodTag: "Cuenta",
  },
  {
    id: "aliclik",
    title: "Aliclik",
    description: "Despacha pedidos y recibí actualizaciones de estado automáticas por webhook en tiempo real.",
    icon: Package,
    href: "/configuracion/integraciones/aliclik",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/40",
    category: "courier",
    categoryLabel: "Courier",
    methodTag: "API Key",
  },
  {
    id: "eva",
    title: "EVA Courier",
    description: "Conectá tu cuenta de EVA Courier (Fly Express) para despachar y recibir estados por webhook.",
    icon: Send,
    href: "/configuracion/integraciones/eva",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/40",
    category: "courier",
    categoryLabel: "Courier · Fly Express",
    methodTag: "API Key",
  },
  {
    id: "yavendio",
    title: "Yavendio",
    description: "Vendé tu catálogo por WhatsApp/IA y recibí automáticamente en Powip los pedidos cerrados ahí.",
    icon: MessageCircle,
    href: "/configuracion/integraciones/yavendio",
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-50 dark:bg-teal-950/40",
    category: "canal",
    categoryLabel: "Canal de venta · WhatsApp IA",
    methodTag: "API Key",
  },
  {
    id: "shopify",
    title: "Shopify",
    description: "Sincroniza tus órdenes, inventarios y sucursales. La configuración vive en Tiendas.",
    icon: ShoppingBag,
    href: "/configuracion/tiendas",
    color: "text-green-600 dark:text-emerald-400",
    bgColor: "bg-green-50 dark:bg-emerald-950/40",
    category: "canal",
    categoryLabel: "Canal de venta · Ecommerce",
    methodTag: "OAuth",
  },
];

const CATEGORY_CHIPS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "courier", label: "Couriers" },
  { value: "canal", label: "Canales de venta" },
];

export default function IntegracionesHubPage() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;
  const token = auth?.accessToken;

  const [statusMap, setStatusMap] = useState<Record<string, boolean>>({});
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!companyId || !token) {
      setStatusLoaded(true);
      return;
    }
    let cancelled = false;

    (async () => {
      const [shalom, aliclik, eva, yavendio, shopify] = await Promise.allSettled([
        getShalomConfig(token, companyId),
        getAliclikCredentials(token, companyId),
        getEvaCredentials(token, companyId),
        getYavendioConfig(token, companyId),
        axios
          .get(`${API_INTEGRATIONS}/shopify/status/${companyId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          .then((res) => res.data),
      ]);
      if (cancelled) return;

      setStatusMap({
        shalom: shalom.status === "fulfilled" && !!shalom.value?.isActive,
        aliclik: aliclik.status === "fulfilled" && !!aliclik.value?.isActive,
        eva: eva.status === "fulfilled" && !!eva.value?.isActive,
        yavendio: yavendio.status === "fulfilled" && !!yavendio.value?.isActive,
        shopify:
          shopify.status === "fulfilled" &&
          Array.isArray(shopify.value) &&
          shopify.value.length > 0,
      });
      setStatusLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INTEGRATIONS.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (q && !(i.title + " " + i.description).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [category, query]);

  const connectedCount = Object.values(statusMap).filter(Boolean).length;
  const totalCount = INTEGRATIONS.length;

  return (
    <main className="flex-1 p-8">
      <HeaderConfig
        title="Centro de Integraciones"
        description="Administra todas las integraciones de terceros disponibles para tu empresa."
      >
        <div className="flex items-center gap-4 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-5 py-2.5 shadow-sm">
          <div className="text-center">
            <b className="block text-xl font-extrabold leading-none text-green-600 dark:text-emerald-400">
              {statusLoaded ? connectedCount : "–"}
            </b>
            <small className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
              Conectadas
            </small>
          </div>
          <div className="w-px h-7 bg-gray-200 dark:bg-slate-700" />
          <div className="text-center">
            <b className="block text-xl font-extrabold leading-none dark:text-slate-100">
              {statusLoaded ? totalCount - connectedCount : "–"}
            </b>
            <small className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
              Disponibles
            </small>
          </div>
          <div className="w-px h-7 bg-gray-200 dark:bg-slate-700" />
          <div className="text-center">
            <b className="block text-xl font-extrabold leading-none dark:text-slate-100">{totalCount}</b>
            <small className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
              Partners
            </small>
          </div>
        </div>
      </HeaderConfig>

      <div className="max-w-5xl mx-auto px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap gap-2">
            {CATEGORY_CHIPS.map((chip) => {
              const count =
                chip.value === "all"
                  ? INTEGRATIONS.length
                  : INTEGRATIONS.filter((i) => i.category === chip.value).length;
              const active = category === chip.value;
              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setCategory(chip.value)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-teal-600 text-white"
                      : "bg-white dark:bg-slate-800 border dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600"
                  }`}
                >
                  {chip.label}{" "}
                  <span className={active ? "opacity-80" : "opacity-50"}>{count}</span>
                </button>
              );
            })}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar integración…"
              className="pl-9"
            />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {filtered.map((integration) => {
            const Icon = integration.icon;
            const connected = statusMap[integration.id];
            return (
              <Link key={integration.id} href={integration.href}>
                <Card className="h-full cursor-pointer transition-all hover:shadow-lg hover:border-teal-300 dark:hover:border-teal-700 relative group">
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`${integration.bgColor} w-fit rounded-lg p-3`}>
                        <Icon className={`h-6 w-6 ${integration.color}`} />
                      </div>
                      {connected ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-emerald-900/40 px-3 py-1 text-xs font-semibold text-green-700 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          Conectado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-slate-700 px-3 py-1 text-xs font-semibold text-gray-500 dark:text-slate-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                          Disponible
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                      {integration.categoryLabel}
                    </div>
                    <h3 className="font-semibold text-lg mt-1 mb-2 dark:text-slate-100">
                      {integration.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-slate-300 flex-1">
                      {integration.description}
                    </p>

                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between text-sm font-medium">
                      <span
                        className={`inline-flex items-center gap-1.5 ${
                          connected
                            ? "text-green-700 dark:text-emerald-400"
                            : "text-teal-600 dark:text-teal-400"
                        }`}
                      >
                        {connected ? "Gestionar" : "Conectar"}
                        <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                      </span>
                      <span className="text-[10.5px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                        {integration.methodTag}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-sm text-gray-500 dark:text-slate-400">
            No se encontraron integraciones para “{query}”.
          </div>
        )}
      </div>
    </main>
  );
}
