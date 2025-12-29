"use client";
import { useEffect, useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { ChevronDown, Store, Check } from "lucide-react";
import {
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@radix-ui/react-dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface Store {
  id: string;
  name: string;
  logo?: string | null;
}

export function StoreSwitcher() {
  const { auth, selectedStoreId, setSelectedStore } = useAuth();

  const stores = useMemo(
    () => auth?.company?.stores ?? [],
    [auth?.company?.stores]
  );

  const currentStore =
    stores.find((s) => s.id === selectedStoreId) || stores[0];

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!selectedStoreId && stores.length > 0) {
      setSelectedStore(stores[0].id);
    }
  }, [stores, selectedStoreId, setSelectedStore]);

  if (stores.length === 0) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex h-11 items-center gap-3 px-4 py-2 rounded-xl",
            "bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900",
            "border border-slate-200 dark:border-slate-700",
            "hover:border-teal-500 dark:hover:border-teal-400",
            "hover:shadow-md hover:shadow-teal-500/10",
            "transition-all duration-200 ease-out",
            "focus:outline-none focus:ring-2 focus:ring-teal-500/50"
          )}
        >
          {/* Store Icon */}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white shadow-sm">
            <Store className="h-4 w-4" />
          </div>

          {/* Store Info */}
          <div className="flex flex-col items-start leading-tight">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 max-w-[150px] truncate">
              {currentStore.name}
            </span>
            <span className="text-[11px] font-medium text-teal-600 dark:text-teal-400 flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
              Tienda activa
            </span>
          </div>

          {/* Chevron */}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-slate-400 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-80 rounded-xl p-2 shadow-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      >
        <DropdownMenuLabel className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 py-2">
          Cambiar tienda
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="my-1 h-px bg-slate-200 dark:bg-slate-700" />

        {stores.map((store) => {
          const isSelected = currentStore.id === store.id;
          return (
            <DropdownMenuItem
              key={store.id}
              onClick={() => {
                setSelectedStore(store.id);
                setIsOpen(false);
              }}
              className={cn(
                "flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-lg my-0.5",
                "transition-colors duration-150",
                isSelected
                  ? "bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {/* Store icon in list */}
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm",
                  isSelected ? "bg-teal-600" : "bg-slate-400 dark:bg-slate-600"
                )}
              >
                <Store className="h-4 w-4" />
              </div>

              {/* Store name */}
              <div className="flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isSelected
                      ? "text-teal-700 dark:text-teal-300"
                      : "text-slate-700 dark:text-slate-200"
                  )}
                >
                  {store.name}
                </p>
              </div>

              {/* Check mark for selected */}
              {isSelected && (
                <Check className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
