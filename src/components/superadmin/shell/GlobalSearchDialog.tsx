"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Building2, UserCircle2, Link2, Target, type LucideIcon } from "lucide-react";
import { empresasMock, leadsMock, partnersMock, usuariosEmpresaMock } from "@/mocks/superadmin";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: Props) {
  const [q, setQ] = useState("");
  const router = useRouter();

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return null;
    return {
      empresas: empresasMock.filter((e) => e.nombre.toLowerCase().includes(query)).slice(0, 4),
      leads: leadsMock.filter((l) => (l.negocio || l.nombre).toLowerCase().includes(query)).slice(0, 4),
      partners: partnersMock.filter((p) => p.nombre.toLowerCase().includes(query)).slice(0, 3),
      usuarios: usuariosEmpresaMock.filter((u) => u.nombre.toLowerCase().includes(query) || u.email.toLowerCase().includes(query)).slice(0, 3),
    };
  }, [q]);

  function go(href: string) {
    onOpenChange(false);
    setQ("");
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[18%] translate-y-0 max-w-xl p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Búsqueda global</DialogTitle>
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar empresas, leads, partners, usuarios…"
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-auto text-sm"
          />
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {!results && <p className="px-3 py-8 text-center text-xs text-muted-foreground">Escribe para buscar en toda la plataforma.</p>}
          {results && (
            <>
              <SearchGroup title="Empresas" icon={Building2}>
                {results.empresas.map((e) => (
                  <SearchRow key={e.id} label={e.nombre} sub={e.dominio} onClick={() => go(`/superadmin/empresas/${e.id}`)} />
                ))}
              </SearchGroup>
              <SearchGroup title="Leads" icon={Target}>
                {results.leads.map((l) => (
                  <SearchRow key={l.id} label={l.negocio || l.nombre} sub={l.whatsapp} onClick={() => go(`/superadmin/adquisicion?lead=${l.id}`)} />
                ))}
              </SearchGroup>
              <SearchGroup title="Partners" icon={Link2}>
                {results.partners.map((p) => (
                  <SearchRow key={p.id} label={p.nombre} sub={p.handle} onClick={() => go(`/superadmin/partners?partner=${p.id}`)} />
                ))}
              </SearchGroup>
              <SearchGroup title="Usuarios" icon={UserCircle2}>
                {results.usuarios.map((u) => (
                  <SearchRow key={u.id} label={u.nombre} sub={u.email} onClick={() => go(`/superadmin/usuarios?usuario=${u.id}`)} />
                ))}
              </SearchGroup>
              {!results.empresas.length && !results.leads.length && !results.partners.length && !results.usuarios.length && (
                <p className="px-3 py-8 text-center text-xs text-muted-foreground">Sin resultados.</p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SearchGroup({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  if (Array.isArray(items) && items.length === 0) return null;
  return (
    <div className="mb-1">
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      {children}
    </div>
  );
}

function SearchRow({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs hover:bg-muted transition-colors"
    >
      <span className="font-medium">{label}</span>
      {sub && <span className="text-muted-foreground">{sub}</span>}
    </button>
  );
}
