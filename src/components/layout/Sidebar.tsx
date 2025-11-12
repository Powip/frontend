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

import { Input } from "@/components/ui/layout/input";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/layout/avatar";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

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
        "flex flex-col p-6 h-full bg-white border-r border-gray-200 transition-all duration-300",
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-hover">
        <nav
          className={cn("flex flex-col gap-3", isCollapsed && "items-center")}
        >
          {/* Productos */}
          <div className={cn("w-full", isCollapsed && "flex justify-center")}>
            <Button
              variant="ghost"
              className={cn(
                "flex items-center",
                isCollapsed ? "justify-center w-10" : "justify-between w-full"
              )}
              onClick={() => toggleSection("productos")}
            >
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-green" />
                {!isCollapsed && (
                  <span className="text-sm font-medium">Productos</span>
                )}
              </div>
            </Button>
          </div>

          {/* Pedidos */}
          <div className={cn("w-full", isCollapsed && "flex justify-center")}>
            <Link
              href="/pedidos"
              className={cn(isCollapsed ? "w-auto" : "w-full")}
            >
              <Button
                variant="ghost"
                className={cn(
                  "flex items-center gap-3 h-10",
                  isCollapsed ? "justify-center w-10" : "justify-start w-full"
                )}
              >
                <ShoppingBag className="h-5 w-5 text-green" />
                {!isCollapsed && <span className="text-sm">Pedidos</span>}
              </Button>
            </Link>
          </div>

          {/* Ventas */}
          <div className={cn("w-full", isCollapsed && "flex justify-center")}>
            <Link
              href="/ventas"
              className={cn(isCollapsed ? "w-auto" : "w-full")}
            >
              <Button
                variant="ghost"
                className={cn(
                  "flex items-center gap-3 h-10",
                  isCollapsed ? "justify-center w-10" : "justify-start w-full"
                )}
              >
                <Receipt className="h-5 w-5 text-green" />
                {!isCollapsed && <span className="text-sm">Ventas</span>}
              </Button>
            </Link>
          </div>
        </nav>
      </div>

      {/* Footer */}
      <div className="space-y-4 mt-4">
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
