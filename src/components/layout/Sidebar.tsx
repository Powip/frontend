"use client";
import Image from "next/image";

import { useState } from "react";
import Link from "next/link";
import {
  Menu,
  Search,
  Package,
  ShoppingBag,
  Receipt,
  ChevronDown,
  ChevronRight,
  LogOut,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/layout/button";
import { Input } from "@/components/ui/layout/input";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/layout/avatar";
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <div
      className={cn(
        "flex flex-col p-6 h-screen bg-white border-r border-gray-200 transition-all duration-300",
        isCollapsed ? "w-20" : "w-64",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`h-8 w-8 ${!isCollapsed ? "hidden" : ""}`}
        >
          <Menu className="h-4 w-4 text-green" />
        </Button>
        {!isCollapsed && (
          <div className="flex items-center justify-center mb-4">
            {isCollapsed ? (
              <Image
                src="/logo_icon.png"
                alt="Powip icon"
                width={40}
                height={40}
                priority
              />
            ) : (
              <Link href="/">
                <Image
                  src="/logo_powip.png"
                  alt="Powip logo"
                  width={120}
                  height={40}
                  priority
                />
              </Link>
            )}
          </div>
        )}
        {!isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8"
          >
            <Menu className="h-4 w-4 text-green" />
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        {isCollapsed ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 mx-auto">
            <Search className="h-4 w-4 text-green" />
          </Button>
        ) : (
          <div className="relative pr-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Buscar..." className="pl-10" />
          </div>
        )}
      </div>

      {/* Menu items */}
      <div className="flex-1 overflow-y-auto py-4 px-2 scrollbar-hover">
        <nav className="flex flex-col gap-3">
          {/* Productos */}
          <div>
            <Button
              variant="ghost"
              className="flex items-center justify-between w-full text-left"
              onClick={() => toggleSection("productos")}
            >
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-green" />
                {!isCollapsed && (
                  <span className="text-sm font-medium">Productos</span>
                )}
              </div>
              {!isCollapsed &&
                (openSection === "productos" ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                ))}
            </Button>

            {/* Submenú */}
            {openSection === "productos" && !isCollapsed && (
              <div className="ml-9 mt-2 flex flex-col gap-2">
                <Link
                  href="/productos"
                  className="text-sm text-gray-600 hover:text-green"
                >
                  Catálogo de Productos
                </Link>
                <Link
                  href="/proveedores"
                  className="text-sm text-gray-600 hover:text-green"
                >
                  Proveedores
                </Link>
                <Link
                  href="/marcas"
                  className="text-sm text-gray-600 hover:text-green"
                >
                  Marcas
                </Link>
                <Link
                  href="/subcategorias"
                  className="text-sm text-gray-600 hover:text-green"
                >
                  Subcategorías
                </Link>
              </div>
            )}
          </div>

          {/* Pedidos */}
          <Link href="/pedidos" passHref>
            <Button
              asChild
              variant="ghost"
              className="flex items-center gap-3 h-10 justify-start w-full"
            >
              <span>
                <ShoppingBag className="h-5 w-5 text-green" />
                {!isCollapsed && <span className="ml-2 text-sm">Pedidos</span>}
              </span>
            </Button>
          </Link>

          {/* Ventas */}
          <Link href="/ventas" passHref>
            <Button
              asChild
              variant="ghost"
              className="flex items-center gap-3 h-10 justify-start w-full"
            >
              <span>
                <Receipt className="h-5 w-5 text-green" />
                {!isCollapsed && <span className="ml-2 text-sm">Ventas</span>}
              </span>
            </Button>
          </Link>
        </nav>
      </div>

      {/* Footer */}
      <div className="space-y-4">
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
                  <div className="text-xs text-gray-500">Administrador</div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <LogOut className="h-4 w-4 text-red" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
