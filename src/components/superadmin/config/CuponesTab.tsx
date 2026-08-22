"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, TicketPercent } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCupones, crearCupon, toggleCupon } from "@/services/superadmin/configService";
import { SectionHeader, StatusBadge, TableSkeleton, EmptyBlock } from "@/components/superadmin/shared";
import { formatDate } from "@/components/superadmin/shared/format";

export function CuponesTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [beneficio, setBeneficio] = useState("");
  const [aplicaA, setAplicaA] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "config", "cupones"], queryFn: getCupones });

  const { mutate: toggle } = useMutation({
    mutationFn: toggleCupon,
    onSuccess: (cupon) => {
      if (!cupon) return;
      queryClient.invalidateQueries({ queryKey: ["superadmin", "config", "cupones"] });
      toast.success(`Cupón ${cupon.codigo} ${cupon.activo ? "activado" : "desactivado"}.`);
    },
  });

  const { mutate: crear, isPending } = useMutation({
    mutationFn: crearCupon,
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "config", "cupones"] });
      toast.success(`Cupón ${c.codigo} creado.`);
      setOpen(false);
      setCodigo("");
      setBeneficio("");
      setAplicaA("");
    },
  });

  function handleSubmit() {
    if (!codigo.trim() || !beneficio.trim() || !aplicaA.trim()) {
      toast.error("Código, beneficio y aplica a son obligatorios.");
      return;
    }
    crear({ codigo: codigo.trim().toUpperCase(), beneficio: beneficio.trim(), aplicaA: aplicaA.trim() });
  }

  return (
    <div>
      <SectionHeader
        title="Cupones & promociones"
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Nuevo cupón
          </Button>
        }
      />

      {isLoading || !data ? (
        <TableSkeleton rows={3} cols={5} />
      ) : !data.length ? (
        <EmptyBlock icon={TicketPercent} title="Sin cupones todavía" description="Crea el primer cupón con el botón 'Nuevo cupón'." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Beneficio</TableHead>
                <TableHead>Aplica a</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Vigente hasta</TableHead>
                <TableHead>Activo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs font-mono font-semibold">{c.codigo}</TableCell>
                  <TableCell className="text-xs">{c.beneficio}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.aplicaA}</TableCell>
                  <TableCell>
                    <StatusBadge label={c.estado} tone={c.estado === "activo" ? "green" : "gray"} />
                  </TableCell>
                  <TableCell className="text-xs">{c.vigenteHasta ? formatDate(c.vigenteHasta) : "—"}</TableCell>
                  <TableCell>
                    <Switch checked={c.activo} onCheckedChange={() => toggle(c.id)} />
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
            <DialogTitle>Nuevo cupón</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-1">
            <div>
              <Label className="text-xs font-bold mb-1.5 block">Código *</Label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej. BIENVENIDA20" />
            </div>
            <div>
              <Label className="text-xs font-bold mb-1.5 block">Beneficio *</Label>
              <Input value={beneficio} onChange={(e) => setBeneficio(e.target.value)} placeholder="Ej. 20% dcto. primer mes" />
            </div>
            <div>
              <Label className="text-xs font-bold mb-1.5 block">Aplica a *</Label>
              <Input value={aplicaA} onChange={(e) => setAplicaA(e.target.value)} placeholder="Ej. Todos los planes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Creando…" : "Crear cupón"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
