"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Megaphone } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAnunciosConfig, useCrearAnuncio } from "@/hooks/superadmin/useConfig";
import { SectionHeader, StatusBadge, TableSkeleton, EmptyBlock, SimuladoBadge } from "@/components/superadmin/shared";
import { formatDate } from "@/components/superadmin/shared/format";

export function AnunciosTab() {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");

  const { data, isLoading, isSimulado } = useAnunciosConfig();

  const { mutate: crear, isPending } = useCrearAnuncio();

  function onCrearSuccess(a: { titulo: string }) {
    toast.success(`Anuncio "${a.titulo}" creado como borrador.`);
    setOpen(false);
    setTitulo("");
    setCuerpo("");
  }

  function handleSubmit() {
    if (!titulo.trim() || !cuerpo.trim()) {
      toast.error("Título y cuerpo son obligatorios.");
      return;
    }
    crear({ titulo: titulo.trim(), cuerpo: cuerpo.trim() }, { onSuccess: onCrearSuccess });
  }

  return (
    <div>
      <SectionHeader
        title="Anuncios & changelog"
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Nuevo anuncio
          </Button>
        }
      />

      {isSimulado && (
        <div className="text-[11px] text-muted-foreground mb-3">
          <SimuladoBadge /> No existe sistema de anuncios en el backend todavía — ver docs/superadmin/config-endpoints.md.
        </div>
      )}

      {isLoading || !data ? (
        <TableSkeleton rows={3} cols={3} />
      ) : !data.length ? (
        <EmptyBlock icon={Megaphone} title="Sin anuncios todavía" description="Crea el primero con el botón 'Nuevo anuncio'." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs font-semibold">{a.titulo}</TableCell>
                  <TableCell className="text-xs">{formatDate(a.fecha)}</TableCell>
                  <TableCell>
                    <StatusBadge label={a.estado} tone={a.estado === "publicado" ? "green" : "gray"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo anuncio</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-1">
            <div>
              <Label className="text-xs font-bold mb-1.5 block">Título *</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-bold mb-1.5 block">Cuerpo *</Label>
              <Textarea rows={4} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Creando…" : "Crear anuncio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
