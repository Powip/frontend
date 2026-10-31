"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getUsersByCompany } from "@/services/userService";
import type { LiveConfig } from "./types";
import { liveError } from "./liveService";
export default function LiveAdvisors({
  config,
  disabled,
  onSave,
  catalogUrl,
}: {
  config: LiveConfig;
  disabled: boolean;
  onSave: (config: LiveConfig) => void;
  catalogUrl: string;
}) {
  const { auth } = useAuth(),
    [users, setUsers] = useState<{ id: string; name: string; surname?: string }[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let canceled = false;
    if (!auth?.company?.id || !auth.accessToken || disabled) return;
    void getUsersByCompany(auth.company.id, auth.accessToken)
      .then((list) => {
        if (!canceled) setUsers(list.filter((u) => u.isActive !== false && u.is_active !== false));
      })
      .catch((e) => {
        if (!canceled) setError(liveError(e));
      });
    return () => {
      canceled = true;
    };
  }, [auth?.company?.id, auth?.accessToken, disabled]);
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <h2 className="font-semibold">Asesora del live</h2>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <select
        aria-label="Asesora del live"
        className="min-h-11 w-full rounded-xl border bg-background p-3"
        disabled={disabled}
        value={config.advisorId || ""}
        onChange={(e) => {
          const user = users.find((u) => u.id === e.target.value);
          if (!user) return;
          const name = [user.name, user.surname].filter(Boolean).join(" ");
          const exists = config.advisors?.some((a) => a.id === user.id);
          const code = `${user.name
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .slice(0, 24)}-${user.id.slice(0, 6)}`;
          onSave({
            ...config,
            advisorId: user.id,
            advisorName: name,
            advisors: exists
              ? config.advisors
              : [...(config.advisors || []), { id: user.id, name, code }],
          });
        }}
      >
        <option value="">Selecciona una asesora</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} {u.surname}
          </option>
        ))}
      </select>
      <h3 className="pt-2 text-sm font-semibold">¿Vendes por WhatsApp?</h3>
      <p className="text-sm text-muted-foreground">
        Comparte el link de la asesora. El catálogo usa precios normales y sigue abierto cuando
        termina el live.
      </p>
      {(config.advisors || []).map((a) => (
        <div
          key={a.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
        >
          <div>
            <p className="text-sm font-medium">{a.name}</p>
            <a
              className="break-all text-xs text-teal-700"
              target="_blank"
              rel="noopener noreferrer"
              href={`${catalogUrl}?a=${encodeURIComponent(a.code)}`}
            >
              {catalogUrl}?a={a.code}
            </a>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!a.commission}
              disabled={disabled}
              onChange={(e) =>
                onSave({
                  ...config,
                  advisors: config.advisors?.map((row) =>
                    row.id === a.id ? { ...row, commission: e.target.checked } : row,
                  ),
                })
              }
            />
            Vendedor por comisión
          </label>
          {a.commission ? (
            <a
              className="break-all text-xs text-teal-700"
              href={`${catalogUrl.replace(/\/catalogo(?=\/|$)/, "/live")}?v=${encodeURIComponent(a.code)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Link del vendedor: {catalogUrl.replace(/\/catalogo(?=\/|$)/, "/live")}?v={a.code}
            </a>
          ) : null}
          <button
            className="min-h-11 rounded-xl border px-3 text-sm"
            onClick={() =>
              void navigator.clipboard
                .writeText(`${catalogUrl}?a=${encodeURIComponent(a.code)}`)
                .catch(() => setError("No se pudo copiar. Selecciona el enlace."))
            }
          >
            Copiar link
          </button>
        </div>
      ))}
    </section>
  );
}
