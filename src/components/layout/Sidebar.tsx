"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
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
  BarChart2,
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
  Phone,
  Activity,
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
  hasAdminAccess,
} from "@/config/permissions.config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface SidebarProps {
  className?: string;
}

interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ElementType;
  children?: { name: string; href: string; icon?: React.ElementType; group?: string }[];
}



const navigation: NavigationItem[] = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    children: [
      { name: "Principal", href: "/dashboard", icon: LayoutDashboard },
      { name: "Ventas", href: "/metricas/ventas", icon: ShoppingCart },
      { name: "Inventario", href: "/metricas/inventario", icon: Package },
      { name: "Operaciones", href: "/metricas/operaciones", icon: Truck },
      { name: "Seguimiento", href: "/metricas/seguimientos", icon: MapPin },
      { name: "Atención Cliente", href: "/metricas/atencion-cliente", icon: Headphones },
      { name: "Call Center", href: "/metricas/call-center", icon: Phone },
      { name: "Courier", href: "/metricas/couriers", icon: Truck },
      { name: "Clientes", href: "/metricas/clientes", icon: Users },
    ],
  },
  {
    name: "Comercial",
    icon: ShoppingCart,
    children: [
      { name: "Ventas", href: "/ventas", icon: ShoppingCart },
      { name: "Registrar venta", href: "/registrar-venta", icon: FileText },
      { name: "Clientes", href: "/clientes", icon: Users },
    ],
  },
  {
    name: "Productos",
    icon: Package,
    children: [
      { name: "Lista de productos", href: "/productos", icon: Tags },
      { name: "Inventario", href: "/inventario", icon: Package },
      { name: "Compras", href: "/compras", icon: PackagePlus },
      { name: "Proveedores", href: "/proveedores", icon: Building2 },
    ],
  },
  {
    name: "Operaciones",
    icon: Truck,
    children: [
      { name: "Gestión Operaciones", href: "/operaciones", icon: Truck },
      { name: "Seguimiento", href: "/seguimiento", icon: MapPin },
      { name: "Couriers", href: "/couriers", icon: Truck },
    ],
  },
  {
    name: "Atención al cliente",
    icon: Headphones,
    href: "/atencion-cliente",
  },
  {
    name: "Finanzas",
    icon: DollarSign,
    children: [
      { name: "Resumen", href: "/finanzas", icon: BarChart },
      { name: "Facturación", href: "/facturacion", icon: FileText },
    ],
  },
  {
    name: "Administración",
    icon: Settings,
    children: [
      { name: "Usuarios", href: "/usuarios", icon: UserCog },
      { name: "Configuración", href: "/configuracion", icon: Settings },
    ],
  },
  {
    name: "Super Admin",
    icon: ShieldCheck,
    href: "/superadmin",
  },
];

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});
  const { auth, logout, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const navigation: NavigationItem[] = useMemo(() => [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      children: [
        { name: "Principal", href: "/dashboard", icon: LayoutDashboard },
        { name: "Ventas", href: "/metricas/ventas", icon: ShoppingCart },
        { name: "Inventario", href: "/metricas/inventario", icon: Package },
        { name: "Operaciones", href: "/metricas/operaciones", icon: Truck },
        { name: "Seguimiento", href: "/metricas/seguimientos", icon: MapPin },
        { name: "Atención Cliente", href: "/metricas/atencion-cliente", icon: Headphones },
        { name: "Call Center", href: "/metricas/call-center", icon: Phone },
        { name: "Courier", href: "/metricas/couriers", icon: Truck },
        { name: "Clientes", href: "/metricas/clientes", icon: Users },
      ],
    },
    {
      name: "Comercial",
      icon: ShoppingCart,
      children: [
        { name: "Ventas", href: "/ventas", icon: ShoppingCart },
        { name: "Registrar venta", href: "/registrar-venta", icon: FileText },
        { name: "Clientes", href: "/clientes", icon: Users },
      ],
    },
    {
      name: "Productos",
      icon: Package,
      children: [
        { name: "Lista de productos", href: "/productos", icon: Tags },
        { name: "Inventario", href: "/inventario", icon: Package },
        { name: "Compras", href: "/compras", icon: PackagePlus },
        { name: "Proveedores", href: "/proveedores", icon: Building2 },
      ],
    },
    {
      name: "Operaciones",
      icon: Truck,
      children: [
        { name: "Gestión Operaciones", href: "/operaciones", icon: Truck },
        { name: "Seguimiento", href: "/seguimiento", icon: MapPin },
        { name: "Seguimiento Courier", href: "/couriers", icon: Activity },
      ],
    },
    {
      name: "Atención al cliente",
      icon: Headphones,
      href: "/atencion-cliente",
    },
    {
      name: "Finanzas",
      icon: DollarSign,
      children: [
        { name: "Resumen", href: "/finanzas", icon: BarChart },
        { name: "Facturación", href: "/facturacion", icon: FileText },
      ],
    },
    {
      name: "Administración",
      icon: Settings,
      children: [
        { name: "Usuarios", href: "/usuarios", icon: UserCog },
        { name: "Configuración", href: "/configuracion", icon: Settings },
      ],
    },
    {
      name: "Super Admin",
      icon: ShieldCheck,
      href: "/superadmin",
    },
  ], []);

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
    const activeSubmenu = navigation.find(item => 
      item.children?.some(child => pathname === child.href || pathname.startsWith(child.href + "/"))
    );
    if (activeSubmenu) {
      setOpenSubmenus(prev => ({ ...prev, [activeSubmenu.name]: true }));
    }
  }, [pathname, navigation]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const toggleSubmenu = (name: string) => {
    setOpenSubmenus((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  // Filtrar navegación por permisos y mostrar Superadmin solo a autorizados
  const filteredNavigation = navigation
    .filter((item: NavigationItem) => {
      // Si es Super Admin, verificar específicamente por email
      if (item.name === "Super Admin") {
        return isSuperadmin(auth?.user.email);
      }

      // Si es Administración, verificar si es admin o superadmin
      if (item.name === "Administración") {
        return isSuperadmin(auth?.user.email) || hasAdminAccess(auth?.user.role);
      }

      const requiredPermission = SIDEBAR_ITEMS_PERMISSIONS[item.name];
      if (!requiredPermission) return true;
      return hasPermission(requiredPermission);
    })
    .map((item: NavigationItem) => {
      if (item.children) {
        return {
          ...item,
          children: item.children.filter((child: { name: string }) => {
            // También filtramos sub-ítems que puedan ser de superadmin si existieran
            if (child.name.toLowerCase().includes("superadmin") || child.name.toLowerCase().includes("super admin")) {
              return isSuperadmin(auth?.user.email);
            }
            const childPermission = SIDEBAR_ITEMS_PERMISSIONS[child.name];
            if (!childPermission) return true;
            return hasPermission(childPermission);
          }),
        };
      }
      return item;
    });

  return (
    <div
      className={cn(
        "flex flex-col px-3 pt-6 pb-6 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300",
        isCollapsed ? "w-16 px-1" : "w-64 px-3",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        {isCollapsed ? (
          <div className="flex flex-col items-center w-full gap-4">
            <Link
              href="/"
              className="flex h-14 w-14 items-center justify-center p-0"
            >
              <Image
                src="/logo_mini.jpeg"
                alt="Powip Logo"
                width={56}
                height={56}
                className="rounded-xl object-contain"
              />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8"
            >
              <Menu className="h-5 w-5 text-primary" />
            </Button>
          </div>
        ) : (
          <>
            <Link href="/" className="flex items-center pl-4">
              <Image
                src="/logo_powip.svg"
                alt="Powip Logo"
                width={140}
                height={40}
                priority
                style={{ height: "auto" }}
              />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-7 w-7"
            >
              <Menu className="h-4 w-4 text-primary" />
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
            const isActive = item.href ? pathname === item.href : item.children?.some((c: { href: string }) => pathname === c.href);

            return (
              <div
                key={item.name}
                className={cn("w-full mb-1", isCollapsed && "flex flex-col items-center")}
              >
                {hasChildren && isCollapsed ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "flex items-center justify-center h-10 w-10 p-0 rounded-lg transition-all duration-200",
                          isActive 
                            ? "bg-primary/10 text-primary shadow-sm" 
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100",
                        )}
                      >
                        <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-gray-400")} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" sideOffset={10} className="w-48 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                      <DropdownMenuLabel className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase px-2 py-1.5">{item.name}</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-800" />
                      {item.children?.map((child) => (
                        <DropdownMenuItem key={child.name} asChild>
                          <Link 
                            href={child.href} 
                            className={cn(
                              "flex items-center gap-2.5 px-2 py-2 cursor-pointer rounded-md transition-colors",
                              pathname === child.href 
                                ? "bg-primary/5 text-primary font-semibold shadow-sm" 
                                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                            )}
                          >
                            {child.icon ? (
                              <child.icon className={cn("h-4 w-4", pathname === child.href ? "text-primary" : "text-gray-400")} />
                            ) : (
                              <div className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                pathname === child.href ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                              )} />
                            )}
                            <span className="text-sm">{child.name}</span>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : hasChildren && !isCollapsed ? (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => toggleSubmenu(item.name)}
                      className={cn(
                        "flex items-center justify-between h-10 w-full gap-2 px-3 rounded-lg transition-all duration-200",
                        isActive 
                          ? "bg-primary/5 text-primary font-semibold shadow-sm" 
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-gray-400")} />
                        <span className="text-[13.5px]">{item.name}</span>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="h-3 w-3 opacity-50" />
                      ) : (
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      )}
                    </Button>
                    {isOpen && (
                      <div className="ml-5 flex flex-col gap-1 mt-1 border-l-2 pl-3 border-gray-100 dark:border-gray-800">
                        {item.children?.map((child) => (
                          <div key={child.name}>
                            <Link href={child.href} className="w-full">
                              <Button
                                variant="ghost"
                                className={cn(
                                  "flex items-center gap-2.5 h-9 w-full justify-start text-[13px] rounded-md transition-all",
                                  pathname === child.href 
                                    ? "text-primary font-semibold bg-primary/5 shadow-sm"
                                    : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-transparent",
                                )}
                              >
                                {child.icon ? (
                                  <child.icon className={cn("h-4 w-4", pathname === child.href ? "text-primary" : "text-gray-400")} />
                                ) : (
                                  <div className={cn(
                                    "w-1.5 h-1.5 rounded-full transition-all",
                                    pathname === child.href ? "bg-primary scale-125" : "bg-gray-300 dark:bg-gray-600 group-hover:bg-gray-400"
                                  )} />
                                )}
                                <span>{child.name}</span>
                              </Button>
                            </Link>
                          </div>
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
                        "flex items-center gap-2.5 h-10 px-3 rounded-lg transition-all duration-200",
                        isCollapsed
                          ? "justify-center w-10 h-10 p-0"
                          : "justify-start w-full",
                        isActive 
                          ? "bg-primary/5 text-primary font-semibold shadow-sm" 
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100",
                      )}
                    >
                      <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-gray-400")} />
                      {!isCollapsed && (
                        <span className="text-[13.5px] font-medium">{item.name}</span>
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
