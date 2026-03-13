"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
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
  MapPin,
  PackagePlus,
  ShieldCheck,
  History,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { Button } from "../ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/layout/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import {
  SIDEBAR_ITEMS_PERMISSIONS,
  isSuperadmin,
} from "@/config/permissions.config";

interface SidebarProps {
  className?: string;
}

interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ElementType;
  children?: { name: string; href: string; icon?: React.ElementType }[];
}

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});
  const { auth, logout, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  // Auto-colapsar en móviles
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Mantener submenú abierto si el path actual es hijo
  useEffect(() => {
    if (pathname.includes("/facturacion") || pathname === "/finanzas") {
      setOpenSubmenus(prev => ({ ...prev, Finanzas: true }));
    }
  }, [pathname]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const toggleSubmenu = (name: string) => {
    setOpenSubmenus((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const navigation: NavigationItem[] = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Crear Productos", href: "/productos", icon: Tags },
    { name: "Registrar venta", href: "/registrar-venta", icon: FileText },
    { name: "Inventario", href: "/inventario", icon: Package },
    { name: "Compras", href: "/compras", icon: PackagePlus },
    { name: "Ventas", href: "/ventas", icon: ShoppingCart },
    { name: "Operaciones", href: "/operaciones", icon: Truck },
    {
      name: "Atención al cliente",
      href: "/atencion-cliente",
      icon: Headphones,
    },
    { name: "Seguimiento", href: "/seguimiento", icon: MapPin },
    {
      name: "Finanzas",
      icon: DollarSign,
      children: [
        { name: "Resumen Finanzas", href: "/finanzas", icon: BarChart },
        { name: "Facturación", href: "/facturacion", icon: FileText },
      ],
    },
    { name: "Clientes", href: "/clientes", icon: Users },
    { name: "Proveedores", href: "/proveedores", icon: Building2 },
    { name: "Usuarios", href: "/usuarios", icon: UserCog },
    { name: "Couriers", href: "/couriers", icon: Truck },
    { name: "Configuración", href: "/configuracion", icon: Settings },
    { name: "Superadmin", href: "/superadmin", icon: ShieldCheck },
  ];

  // Filtrar navegación por permisos del usuario
  const filteredNavigation = navigation.filter((item) => {
    if (item.name === "Superadmin") {
      return isSuperadmin(auth?.user.email);
    }

    const requiredPermission = SIDEBAR_ITEMS_PERMISSIONS[item.name];
    if (!requiredPermission) return true;
    return hasPermission(requiredPermission);
  });

  return (
    <div
      className={cn(
        "flex flex-col px-3 pb-6 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300",
        isCollapsed ? "w-16" : "w-56",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        {isCollapsed ? (
          <div className="flex flex-col items-center w-full">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center"
            >
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
              <Image
                src="/logo_powip_white.png"
                alt="Powip Logo"
                width={80}
                height={40}
                className="dark:hidden"
              />
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
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = openSubmenus[item.name] || false;
            const isActive = item.href ? pathname === item.href : item.children?.some(c => pathname === c.href);

            return (
              <div
                key={item.name}
                className={cn("w-full", isCollapsed && "flex flex-col items-center")}
              >
                {hasChildren && !isCollapsed ? (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => toggleSubmenu(item.name)}
                      className={cn(
                        "flex items-center justify-between h-9 w-full gap-2 cursor-pointer",
                        isActive && "bg-gray-100 dark:bg-gray-800",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-green" />
                        <span className="text-sm">{item.name}</span>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </Button>
                    {isOpen && (
                      <div className="ml-4 flex flex-col gap-1 mt-1 border-l pl-2 border-gray-100 dark:border-gray-800">
                        {item.children?.map((child) => (
                          <Link key={child.name} href={child.href} className="w-full">
                            <Button
                              variant="ghost"
                              className={cn(
                                "flex items-center gap-2 h-8 w-full justify-start text-[13px] opacity-80 hover:opacity-100",
                                pathname === child.href && "text-green font-medium opacity-100 bg-green/5",
                              )}
                            >
                              {child.icon ? (
                                <child.icon className="h-3.5 w-3.5" />
                              ) : (
                                <div className="w-1 h-1 rounded-full bg-green" />
                              )}
                              <span>{child.name}</span>
                            </Button>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href || "#"}
                    className={cn(isCollapsed ? "w-auto" : "w-full")}
                  >
                    <Button
                      variant="ghost"
                      className={cn(
                        "flex items-center gap-2 h-9 cursor-pointer",
                        isCollapsed
                          ? "justify-center w-9"
                          : "justify-start w-full",
                        isActive && "bg-gray-100 dark:bg-gray-800",
                      )}
                    >
                      <Icon className="h-4 w-4 text-green" />
                      {!isCollapsed && (
                        <span className="text-sm">{item.name}</span>
                      )}
                    </Button>
                  </Link>
                )}
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
                  theme === "dark" ? "bg-primary" : "bg-gray-300",
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                    theme === "dark" ? "right-1" : "left-1",
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
                    alt={auth?.user.name || "Usuario"}
                  />
                  <AvatarFallback>
                    {auth?.user.name
                      ? auth.user.name.substring(0, 1).toUpperCase() +
                        (auth.user.surname
                          ? auth.user.surname.substring(0, 1).toUpperCase()
                          : "")
                      : "US"}
                  </AvatarFallback>
                </Avatar>
                <div className="ml-2 overflow-hidden">
                  <div className="text-sm font-medium truncate">
                    {auth?.user.name
                      ? `${auth.user.name} ${auth.user.surname || ""}`.trim()
                      : "Usuario"}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 capitalize">
                    {auth?.user.role?.toLowerCase()}
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
