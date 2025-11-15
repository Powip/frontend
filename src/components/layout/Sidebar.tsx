"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Menu,
  Sun,
  LogOut,
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileText,
  Users,
  Building2,
  Truck,
  UserCog,
  DollarSign,
  BarChart,
  Headphones,
  Settings,
  FileSearch,
} from "lucide-react";

import { Button } from "../ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/layout/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarProps {
  className?: string;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { auth, logout } = useAuth();

  const navigation: NavigationItem[] = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Inventario", href: "/inventario", icon: Package },
    { name: "Órdenes", href: "/ordenes", icon: ShoppingCart },
    { name: "Registrar venta", href: "/registrar-venta", icon: FileText },
    { name: "Clientes", href: "/clientes", icon: Users },
    { name: "Proveedores", href: "/proveedores", icon: Building2 },
    { name: "Repartidores", href: "/repartidores", icon: Truck },
    { name: "Usuarios", href: "/usuarios", icon: UserCog },
    { name: "Finanzas", href: "/finanzas", icon: DollarSign },
    { name: "Reportes", href: "/reportes", icon: BarChart },
    {
      name: "Servicio al cliente",
      href: "/servicio-cliente",
      icon: Headphones,
    },
    { name: "Configuración", href: "/configuracion", icon: Settings },
    { name: "Auditoría", href: "/auditoria", icon: FileSearch },
  ];

  return (
    <div
      className={cn(
        "flex flex-col p-6 h-full bg-white border-r border-gray-200 transition-all duration-300 ",
        isCollapsed ? "w-20" : "w-64",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-4 w-full">
            <Image
              src="/logo_icon.png"
              alt="Powip icon"
              width={40}
              height={40}
              priority
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8"
            >
              <Menu className="h-4 w-4 text-green" />
            </Button>
          </div>
        ) : (
          <>
            <Link href="/">
              <Image
                src="/logo_powip.png"
                alt="Powip logo"
                width={120}
                height={40}
                priority
              />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8"
            >
              <Menu className="h-4 w-4 text-green" />
            </Button>
          </>
        )}
      </div>

      {/* Menu items */}
      <div className="flex-1 overflow-y-auto scrollbar-none py-4">
        <nav
          className={cn("flex flex-col gap-3", isCollapsed && "items-center")}
        >
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.name}
                className={cn("w-full", isCollapsed && "flex justify-center ")}
              >
                <Link
                  href={item.href}
                  className={cn(isCollapsed ? "w-auto" : "w-full")}
                >
                  <Button
                    variant="ghost"
                    className={cn(
                      "flex items-center gap-3 h-10 cursor-pointer",
                      isCollapsed
                        ? "justify-center w-10"
                        : "justify-start w-full"
                    )}
                  >
                    <Icon className="h-5 w-5 text-green" />
                    {!isCollapsed && (
                      <span className="text-sm">{item.name}</span>
                    )}
                  </Button>
                </Link>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer (modo claro + usuario) */}
      <div className="space-y-4 pt-4 ">
        <div className="flex items-center">
          {isCollapsed ? (
            <Button variant="ghost" size="icon" className="h-8 w-8 mx-auto">
              <Sun className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <Sun className="h-4 w-4" />
                <span className="text-sm">Modo claro</span>
              </div>
              <div className="w-10 h-6 bg-gray-900 rounded-full relative">
                <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1 transition-transform" />
              </div>
            </div>
          )}
        </div>

        {/* Usuario */}
        <div className="flex items-center">
          {isCollapsed ? (
            <Button variant="ghost" size="icon" className="h-8 w-8 mx-auto">
              <LogOut className="h-4 w-4 text-red" />
            </Button>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src="https://www.svgrepo.com/show/17068/user.svg"
                    alt="Usuario"
                  />
                  <AvatarFallback>US</AvatarFallback>
                </Avatar>
                <div className="ml-3">
                  <div className="text-sm font-medium">Usuario</div>
                  <div className="text-xs text-gray-500">{auth?.user.role}</div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => logout()}
              >
                <LogOut className="h-4 w-4 text-red" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
