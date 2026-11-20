"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ShalomAgencyOption } from "@/services/shalomService";

export interface ShalomAgencySelectorProps {
  label: string;
  agencyLabel?: string;
  searchPlaceholder: string;
  agencies: ShalomAgencyOption[];
  searchValue: string;
  selectedAgency: string;
  onSearchChange: (val: string) => void;
  onAgencyChange: (id: string) => void;
  isLoadingAgencies?: boolean;
  error?: boolean;
  /** Bloquea búsqueda y selección (por ejemplo mientras se guarda). */
  disabled?: boolean;
}

/** Buscador + selector de agencias Shalom. Presentacional: la búsqueda la hace `useShalomAgencySearch`. */
export const ShalomAgencySelector = ({
  label,
  agencyLabel = "Agencia (Destino)",
  searchPlaceholder,
  agencies,
  searchValue,
  selectedAgency,
  onSearchChange,
  onAgencyChange,
  isLoadingAgencies,
  error,
  disabled,
}: ShalomAgencySelectorProps) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <Label className="text-sm font-bold text-slate-700 dark:text-slate-200">
        {label}
      </Label>
      {error && !selectedAgency && (
        <span className="text-[10px] font-bold text-red-500">FALTANTE</span>
      )}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">
          Buscar distrito / provincia
        </Label>
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={disabled}
          className={cn(
            "h-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-400 focus:ring-blue-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 dark:text-slate-100",
            error &&
              !searchValue &&
              "border-red-200 bg-red-50/10 dark:border-red-800 dark:bg-red-950/20",
          )}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">
          {agencyLabel}
        </Label>
        <Select
          value={selectedAgency}
          onValueChange={onAgencyChange}
          disabled={isLoadingAgencies || disabled}
        >
          <SelectTrigger
            className={cn(
              "h-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-100",
              error &&
                !selectedAgency &&
                "border-red-200 bg-red-50/10 dark:border-red-800 dark:bg-red-950/20",
            )}
          >
            <SelectValue
              placeholder={
                isLoadingAgencies
                  ? "Buscando..."
                  : !searchValue
                    ? "Escribe para buscar..."
                    : "Seleccionar agencia"
              }
            />
          </SelectTrigger>
          <SelectContent className="max-h-[250px] w-full dark:bg-slate-800 dark:border-slate-700 z-50">
            {agencies.length === 0 && searchValue ? (
              <div className="p-3 text-center text-xs text-slate-400 dark:text-slate-500">
                No se encontraron agencias
              </div>
            ) : (
              agencies.map((a) => (
                <SelectItem
                  key={a.id_agencia}
                  value={a.api_name}
                  className="py-1 focus:bg-slate-50 dark:focus:bg-slate-700"
                >
                  <div className="flex items-start gap-2 max-w-none min-w-[300px]">
                    <div className="flex flex-col gap-0 flex-1 min-w-0">
                      <span className="font-normal text-[12px] text-slate-700 dark:text-slate-200 truncate">
                        {a.nombre_agencia}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate italic">
                        {a.direccion}
                      </span>
                    </div>
                    {a.ter_aereo === 1 ? (
                      <span className="shrink-0 mt-0.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                        Terrestre + Aéreo
                      </span>
                    ) : (
                      <span className="shrink-0 mt-0.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700">
                        Solo terrestre
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  </div>
);
