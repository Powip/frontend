"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useTheme } from "next-themes";
import {
  Menu,
  Sun,
  Moon,
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
  Tags,
} from "lucide-react";

import { Button } from "../ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/layout/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const navigation: NavigationItem[] = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Crear Productos", href: "/productos", icon: Tags },
    { name: "Registrar venta", href: "/registrar-venta", icon: FileText },
    { name: "Inventario", href: "/inventario", icon: Package },
    { name: "Ventas", href: "/ventas", icon: ShoppingCart },
    { name: "Operaciones", href: "/operaciones", icon: Truck },
    { name: "Finanzas", href: "/finanzas", icon: DollarSign },
    { name: "Clientes", href: "/clientes", icon: Users },
    {
      name: "Atención al cliente",
      href: "/atencion-cliente",
      icon: Headphones,
    },
    { name: "Proveedores", href: "/proveedores", icon: Building2 },
   /*  { name: "Repartidores", href: "/repartidores", icon: Truck }, */
    { name: "Usuarios", href: "/usuarios", icon: UserCog },
 /*    { name: "Reportes", href: "/reportes", icon: BarChart }, */

    { name: "Configuración", href: "/configuracion", icon: Settings },
 /*    { name: "Auditoría", href: "/auditoria", icon: FileSearch }, */
  ];

  return (
    <div
      className={cn(
        "flex flex-col px-3 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300",
        isCollapsed ? "w-16" : "w-56",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        {isCollapsed ? (
          <div className="flex flex-col items-center w-full">
            <Link href="/" className="flex h-10 w-10 items-center justify-center">
              <Image
                src="/logo_icon.png"
                alt="Powip Logo"
                width={40}
                height={40}
                className="rounded-lg"
              />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-7 w-7"
            >
              <Menu className="h-4 w-4 text-green" />
            </Button>
          </div>
        ) : (
          <>
            <Link href="/" className="flex items-center pl-4">
              {/* Logo for light mode */}
              <Image
                src="/logo_powip_white.png"
                alt="Powip Logo"
                  width={80}
                height={40}
                className="dark:hidden"
              />
              {/* Logo for dark mode */}
              <Image
                src="/logo_powip_dark.png"
                alt="Powip Logo"
                width={80}
                height={40}
                className="hidden dark:block"
              />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-7 w-7"
            >
              <Menu className="h-4 w-4 text-green" />
            </Button>
          </>
        )}
      </div>

      {/* Menu items */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <nav
          className={cn("flex flex-col gap-1", isCollapsed && "items-center")}
        >
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.name}
                className={cn("w-full", isCollapsed && "flex justify-center")}
              >
                <Link
                  href={item.href}
                  className={cn(isCollapsed ? "w-auto" : "w-full")}
                >
                  <Button
                    variant="ghost"
                    className={cn(
                      "flex items-center gap-2 h-9 cursor-pointer",
                      isCollapsed
                        ? "justify-center w-9"
                        : "justify-start w-full"
                    )}
                  >
                    <Icon className="h-4 w-4 text-green" />
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

      {/* Footer (modo claro/oscuro + usuario) */}
      <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          {isCollapsed ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 mx-auto"
              onClick={toggleTheme}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                {theme === "dark" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
                <span className="text-sm">
                  {theme === "dark" ? "Modo oscuro" : "Modo claro"}
                </span>
              </div>
              <button
                onClick={toggleTheme}
                className={cn(
                  "w-10 h-6 rounded-full relative transition-colors",
                  theme === "dark" ? "bg-primary" : "bg-gray-300"
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                    theme === "dark" ? "right-1" : "left-1"
                  )}
                />
              </button>
            </div>
          )}
        </div>

        {/* Usuario */}
        <div className="flex items-center">
          {isCollapsed ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 mx-auto"
              onClick={() => {
                logout();
                router.push("/login");
              }}
            >
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
                <div className="ml-2">
                  <div className="text-sm font-medium">Usuario</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {auth?.user.role}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
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
