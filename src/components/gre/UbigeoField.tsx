"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useUbigeoLookup, useUbigeoOptions, useUbigeoResolve } from "@/features/sunat/despatch-advice/hooks/use-despatch-advices";
import { greErrorStatus, type GreAddressNames } from "@/features/sunat/despatch-advice/utils/gre-form";

// FEAT-24 H12-D5 — ubigeo INEI de un punto de la guía. Con un código (ficha del
// almacén) muestra sus nombres; con los nombres de la dirección del pedido los
// cruza con el catálogo de ms-sunat. Si no cruza (o el código no es un distrito
// INEI), el usuario elige departamento, provincia y distrito: el formulario solo
// recibe códigos válidos, así que nunca se emite sin ubigeo.

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50";

interface Props {
  id: string;
  label: string;
  /** Código de 6 dígitos confirmado, o "" si falta. */
  value: string;
  onChange: (ubigeo: string) => void;
  /** Nombres de la dirección a cruzar cuando todavía no hay código. */
  names?: GreAddressNames | null;
  error?: string;
}

const sameName = (a: string, b: string) =>
  a.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase() === b.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export function UbigeoField({ id, label, value, onChange, names, error }: Props) {
  const [picking, setPicking] = useState(false);
  const [department, setDepartment] = useState("");
  const [province, setProvince] = useState("");
  const [badCode, setBadCode] = useState<string | null>(null);
  /** El código salió de cruzar la dirección (una sola vez): `alias` si fue por una grafía alternativa. */
  const [autoApplied, setAutoApplied] = useState<{ alias: boolean } | null>(null);
  const [presetApplied, setPresetApplied] = useState(false);
  const [provincePresetApplied, setProvincePresetApplied] = useState(false);

  const lookup = useUbigeoLookup(value);
  const hasNames = Boolean(names && (names.department || names.province || names.district));
  const resolve = useUbigeoResolve(!value && !picking && !autoApplied && hasNames ? (names ?? null) : null);

  // Un código que no es distrito INEI (la ficha del almacén tiene uno viejo): se descarta y se elige.
  const lookupNotFound = Boolean(value) && lookup.isError && greErrorStatus(lookup.error) === 404;
  useEffect(() => {
    if (lookupNotFound) {
      setBadCode(value);
      setPicking(true);
      onChange("");
    }
  }, [lookupNotFound, value, onChange]);

  // La dirección cruzó: se usa ese código sin preguntar (se puede cambiar).
  useEffect(() => {
    const result = resolve.data;
    if (!value && !autoApplied && result?.resolved && result.ubigeo) {
      setAutoApplied({ alias: Boolean(result.matchedByAlias) });
      onChange(result.ubigeo);
    }
  }, [resolve.data, value, autoApplied, onChange]);

  const unresolved = !value && resolve.data && !resolve.data.resolved;
  const showPicker = picking || Boolean(unresolved) || (!value && !hasNames) || (!value && resolve.isError);

  const departments = useUbigeoOptions("", showPicker);
  // "-" = nivel sin padre elegido: nunca se pide (y no comparte caché con los departamentos).
  const provinces = useUbigeoOptions(department.length === 2 ? department : "-", showPicker && department.length === 2);
  const districts = useUbigeoOptions(province.length === 4 ? province : "-", showPicker && province.length === 4);

  // Si cruzó hasta el departamento o la provincia, se preseleccionan.
  useEffect(() => {
    if (presetApplied || !unresolved || !departments.data) return;
    setPresetApplied(true);
    const match = resolve.data?.department ? departments.data.items.find((item) => sameName(item.name, resolve.data?.department ?? "")) : undefined;
    if (match) setDepartment(match.code);
  }, [presetApplied, unresolved, departments.data, resolve.data]);

  useEffect(() => {
    if (provincePresetApplied || !unresolved || !provinces.data) return;
    setProvincePresetApplied(true);
    const match = resolve.data?.province ? provinces.data.items.find((item) => sameName(item.name, resolve.data?.province ?? "")) : undefined;
    if (match) setProvince(match.code);
  }, [provincePresetApplied, unresolved, provinces.data, resolve.data]);

  const errorId = error ? `${id}-error` : undefined;

  if (value && !picking) {
    return (
      <div className="grid gap-1.5" data-testid={`${id}-ubigeo`}>
        <Label>{label}</Label>
        <div className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {lookup.isPending ? (
            <span className="text-muted-foreground">Ubigeo {value}…</span>
          ) : lookup.data ? (
            <span>
              {lookup.data.department} / {lookup.data.province} / <b>{lookup.data.district}</b> <span className="font-mono text-muted-foreground">({value})</span>
            </span>
          ) : (
            <span className="font-mono">{value}</span>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto h-7"
            onClick={() => {
              setPicking(true);
              setDepartment(value.slice(0, 2));
              setProvince(value.slice(0, 4));
            }}
          >
            Cambiar
          </Button>
        </div>
        {autoApplied?.alias ? <p className="text-xs text-muted-foreground">Se reconoció la dirección por una grafía alternativa: confírmala.</p> : null}
      </div>
    );
  }

  return (
    <fieldset className="grid gap-1.5" data-testid={`${id}-ubigeo`} aria-describedby={errorId}>
      <legend className="text-sm font-medium">{label}</legend>
      {!value && !picking && hasNames && resolve.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Buscando el ubigeo de la dirección…
        </p>
      ) : null}
      {badCode ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">El ubigeo {badCode} no es un distrito INEI: elige el correcto (y corrígelo en la ficha del almacén).</p>
      ) : null}
      {unresolved && names ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          La dirección dice «{[names.department, names.province, names.district].filter(Boolean).join(" / ") || "sin datos"}» y no cruza con el catálogo INEI: elige
          departamento, provincia y distrito.
        </p>
      ) : null}
      {showPicker ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <select
            id={`${id}-department`}
            aria-label={`${label}: departamento`}
            className={SELECT_CLASS}
            value={department}
            disabled={!departments.data}
            onChange={(event) => {
              setDepartment(event.target.value);
              setProvince("");
              onChange("");
            }}
          >
            <option value="">{departments.isPending ? "Cargando…" : "Departamento"}</option>
            {departments.data?.items.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            aria-label={`${label}: provincia`}
            className={SELECT_CLASS}
            value={province}
            disabled={!department || !provinces.data}
            onChange={(event) => {
              setProvince(event.target.value);
              onChange("");
            }}
          >
            <option value="">Provincia</option>
            {provinces.data?.items.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            aria-label={`${label}: distrito`}
            className={SELECT_CLASS}
            value={value}
            disabled={!province || !districts.data}
            onChange={(event) => {
              onChange(event.target.value);
              if (event.target.value) {
                setPicking(false);
                setBadCode(null);
              }
            }}
          >
            <option value="">Distrito</option>
            {districts.data?.items.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {departments.isError ? <p className="text-xs text-destructive">No se pudo cargar el catálogo de ubigeos. Cierra y vuelve a abrir la guía.</p> : null}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
