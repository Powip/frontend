'use client';

import { Fragment, useEffect, useMemo, useState } from "react";
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
  Calculator,
  Ship,
  Megaphone,
  Check,
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

type Category = "courier" | "canal" | "servicio";
type CategoryFilter = "all" | Category;

interface IntegrationDef {
  id: string;
  title: string;
  description: string;
  /** Ícono de respaldo — se usa mientras no haya `logo` (ver Jook, todavía sin logo). */
  icon: LucideIcon;
  color: string;
  bgColor: string;
  category: Category;
  categoryLabel: string;
  methodTag: string;
  /** Ruta interna con la integración real (login/API/OAuth). */
  href?: string;
  /** Logo real del partner, en `public/integrations/`. Si está, reemplaza al ícono. */
  logo?: string;
  /** Fondo del chip de logo — solo necesario si el logo es claro/transparente (ver Aliclik). */
  logoBg?: string;
  /**
   * Partner de servicio sin integración vía API: no hay forma de detectar el
   * estado automáticamente, así que el "Conectado" lo marca el usuario a mano
   * (ver `manualStorageKey` más abajo).
   */
  externalLink?: string;
  ctaLabel?: string;
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "shalom",
    title: "Shalom Courier",
    description: "Genera y despacha guías directamente desde el Centro de Envíos, con tracking en cada pedido.",
    icon: Truck,
    href: "/configuracion/integraciones/shalom",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/40",
    logo: "/integrations/shalom.jpg",
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
    logo: "/integrations/aliclik.png",
    // El logo es blanco sobre transparente (pensado para fondo oscuro) — con el
    // chip claro por defecto se vuelve invisible, así que necesita este fondo.
    logoBg: "bg-cyan-600",
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
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/40",
    logo: "/integrations/eva.png",
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
    logo: "/integrations/yavendio.png",
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
    logo: "/integrations/shopify.png",
    category: "canal",
    categoryLabel: "Canal de venta · Ecommerce",
    methodTag: "OAuth",
  },
  {
    id: "grint",
    title: "Grint Solutions",
    description: "GRINT te ayuda con contabilidad, SUNAT y formalización para que puedas enfocarte en hacer crecer tu negocio.",
    icon: Calculator,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/40",
    logo: "/integrations/grint.png",
    category: "servicio",
    categoryLabel: "Servicio · Contabilidad",
    methodTag: "Referido",
    externalLink: "https://tally.so/r/rj4WB2",
    ctaLabel: "Solicita asesoría",
  },
  {
    id: "nihao",
    title: "Nihao Importaciones",
    description: "Encuentra proveedores, cotiza tus productos y recibí asesoría para importar a Perú con nuestro partner NIHAO.",
    icon: Ship,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/40",
    logo: "/integrations/nihao.jpeg",
    category: "servicio",
    categoryLabel: "Servicio · Importación China",
    methodTag: "Referido",
    externalLink: "https://tally.so/r/3yzZLW",
    ctaLabel: "Solicita tu cotización",
  },
  {
    id: "jook",
    title: "Jook Agency",
    description: "JOOK combina tráfico + creativos + ángulos de venta para ayudarte a encontrar qué funciona y escalar tus ventas.",
    icon: Megaphone,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-950/40",
    logo: "/integrations/jook.jpeg",
    category: "servicio",
    categoryLabel: "Servicio · Tráfico + Creativos",
    methodTag: "Referido",
    externalLink: "https://tally.so/r/1Ae5vW",
    ctaLabel: "Quiero vender más",
  },
];

/** Estado manual (sin backend) de los partners de servicio — ver `IntegrationDef.externalLink`. */
const MANUAL_PARTNER_IDS = INTEGRATIONS.filter((i) => !i.href).map((i) => i.id);
const manualStorageKey = (companyId: string) => `powip:integraciones-manuales:${companyId}`;

/** Un color por método de conexión — misma señal visual que el mockup (login/apikey/oauth/service). */
const METHOD_TAG_STYLES: Record<string, string> = {
  Cuenta: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  "API Key": "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400",
  OAuth: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400",
  Referido: "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400",
};

const CATEGORY_CHIPS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "courier", label: "Couriers" },
  { value: "canal", label: "Canales de venta" },
  { value: "servicio", label: "Servicios" },
];

const CATEGORY_ORDER: Category[] = ["courier", "canal", "servicio"];
const SECTION_LABELS: Record<Category, string> = {
  courier: "🚚 Couriers",
  canal: "🛍️ Canales de venta",
  servicio: "🤝 Partners de servicio",
};

export default function IntegracionesHubPage() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;
  const token = auth?.accessToken;

  const [statusMap, setStatusMap] = useState<Record<string, boolean>>({});
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [manualStatus, setManualStatus] = useState<Record<string, boolean>>({});
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");

  // Estado manual de partners de servicio (sin API): persiste en localStorage,
  // igual que otros datos "puente" del proyecto mientras no hay backend
  // (ver `src/app/administracion/_lib/useLocalStorage.ts`).
  useEffect(() => {
    if (!companyId) return;
    try {
      const raw = window.localStorage.getItem(manualStorageKey(companyId));
      setManualStatus(raw ? (JSON.parse(raw) as Record<string, boolean>) : {});
    } catch {
      setManualStatus({});
    }
  }, [companyId]);

  const toggleManualStatus = (id: string) => {
    if (!companyId) return;
    setManualStatus((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem(manualStorageKey(companyId), JSON.stringify(next));
      } catch {
        // localStorage lleno, bloqueado (modo privado) o inaccesible — el
        // toggle sigue funcionando en memoria para esta sesión.
      }
      return next;
    });
  };

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

  const sections = useMemo(
    () =>
      CATEGORY_ORDER.map((cat) => ({
        cat,
        items: filtered.filter((i) => i.category === cat),
      })).filter((section) => section.items.length > 0),
    [filtered],
  );

  const connectedCount =
    Object.values(statusMap).filter(Boolean).length +
    MANUAL_PARTNER_IDS.filter((id) => manualStatus[id]).length;
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
          {sections.map((section) => (
            <Fragment key={section.cat}>
              <div className="col-span-full flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mt-2 first:mt-0">
                {SECTION_LABELS[section.cat]}
                <span className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
              </div>
              {section.items.map((integration) => {
                const Icon = integration.icon;
                const isManual = !integration.href;
                const connected = isManual ? !!manualStatus[integration.id] : statusMap[integration.id];

                const statusBadge = isManual ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleManualStatus(integration.id);
                    }}
                    title="Marcar manualmente — no hay integración automática con este partner"
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      connected
                        ? "bg-green-100 dark:bg-emerald-900/40 text-green-700 dark:text-emerald-400 hover:bg-green-200 dark:hover:bg-emerald-900/70"
                        : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600"
                    }`}
                  >
                    {connected ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                    )}
                    {connected ? "Activado" : "Disponible"}
                  </button>
                ) : connected ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-emerald-900/40 px-3 py-1 text-xs font-semibold text-green-700 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Conectado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-slate-700 px-3 py-1 text-xs font-semibold text-gray-500 dark:text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                    Disponible
                  </span>
                );

                const cardBody = (
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      {integration.logo ? (
                        <div
                          className={`h-12 max-w-[130px] rounded-lg px-2.5 flex items-center justify-center ${
                            integration.logoBg ??
                            "bg-white dark:bg-slate-100 border border-gray-100 dark:border-slate-300"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- ancho variable por logo, next/image exige dimensiones fijas */}
                          <img
                            src={integration.logo}
                            alt={integration.title}
                            className="h-8 w-auto max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className={`${integration.bgColor} w-fit rounded-lg p-3`}>
                          <Icon className={`h-6 w-6 ${integration.color}`} />
                        </div>
                      )}
                      {statusBadge}
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
                      {isManual ? (
                        <a
                          href={integration.externalLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-teal-600 dark:text-teal-400 hover:underline"
                        >
                          {integration.ctaLabel}
                          <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                        </a>
                      ) : (
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
                      )}
                      <span
                        className={`text-[10.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                          METHOD_TAG_STYLES[integration.methodTag] ??
                          "bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500"
                        }`}
                      >
                        {integration.methodTag}
                      </span>
                    </div>
                  </CardContent>
                );

                const cardClass =
                  "h-full transition-all hover:shadow-lg hover:border-teal-300 dark:hover:border-teal-700 relative group";

                return isManual ? (
                  <Card key={integration.id} className={cardClass}>
                    {cardBody}
                  </Card>
                ) : (
                  <Link key={integration.id} href={integration.href!}>
                    <Card className={`${cardClass} cursor-pointer`}>{cardBody}</Card>
                  </Link>
                );
              })}
            </Fragment>
          ))}
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
