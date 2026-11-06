"use client";

import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type CanalFicha,
  FAMILIAS_CANAL,
} from "@/features/panel-control/canales/models/canal-ficha.model";
import { putFichaCanal } from "@/features/panel-control/configuracion/api/config.api";
import {
  cuerpoDeFicha,
  valoresDeFicha,
} from "@/features/panel-control/configuracion/api/config-cuerpos";
import { TIPOS_BLOQUE_CANAL } from "@/features/panel-control/configuracion/models/configuracion.model";
import {
  CampoNumero,
  ErroresDelServidor,
  errorNumero,
  type ReglaNumero,
  useGuardarConfig,
} from "./config-form";

const TIPO_LABEL: Record<(typeof TIPOS_BLOQUE_CANAL)[number], string> = {
  lead: "Lead",
  live: "Live",
  presencial: "Presencial",
  marketplace: "Marketplace",
  prepago: "Prepago",
  conversacional: "Conversacional",
};

const REGLA_PCT: ReglaNumero = { max: 100, opcional: true };
const REGLA_PLAZO: ReglaNumero = { entero: true, max: 3650, opcional: true };

function Selector({
  etiqueta,
  valor,
  opciones,
  onChange,
}: {
  etiqueta: string;
  valor: string;
  opciones: { valor: string; texto: string }[];
  onChange: (valor: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <label htmlFor={id} className="font-medium">
        {etiqueta}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-48 dark:[color-scheme:dark] rounded-md border border-pc-border bg-pc-card px-2 text-xs text-pc-text outline-none focus-visible:ring-2 focus-visible:ring-pc-primary"
      >
        <option value="">Sin cargar</option>
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>
    </div>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="font-medium">{etiqueta}</span>
      {children}
    </div>
  );
}

function Formulario({ ficha, onGuardado }: { ficha: CanalFicha; onGuardado: () => void }) {
  const iniciales = useMemo(() => valoresDeFicha(ficha), [ficha]);
  const [valores, setValores] = useState(iniciales);
  const { guardar, guardando, errores } = useGuardarConfig(
    (cuerpo: ReturnType<typeof cuerpoDeFicha>) => putFichaCanal(ficha.id, cuerpo),
    `Ficha de ${ficha.nombre}`,
    onGuardado,
  );
  const cuerpo = cuerpoDeFicha(valores, iniciales);
  const cambios = Object.keys(cuerpo).length;
  const invalido =
    errorNumero(valores.comision, REGLA_PCT) !== null ||
    errorNumero(valores.pasarela, REGLA_PCT) !== null ||
    errorNumero(valores.plazoDeposito, REGLA_PLAZO) !== null;
  const con = (campo: string) => (valor: string) => setValores((a) => ({ ...a, [campo]: valor }));
  // Las comisiones solo viajan con la capacidad ver_comisiones (Dueño): si no vinieron, no se editan.
  const conComisiones = ficha.comisionPct !== undefined || ficha.pasarelaPct !== undefined;

  return (
    <div className="space-y-3">
      <ErroresDelServidor errores={errores} />
      <Selector
        etiqueta="Familia"
        valor={valores.familia}
        opciones={FAMILIAS_CANAL.map((f) => ({ valor: f, texto: f }))}
        onChange={con("familia")}
      />
      <Selector
        etiqueta="Tipo de bloque"
        valor={valores.tipo}
        opciones={TIPOS_BLOQUE_CANAL.map((t) => ({ valor: t, texto: TIPO_LABEL[t] }))}
        onChange={con("tipo")}
      />
      {conComisiones && (
        <>
          <Fila etiqueta="Comisión de la plataforma">
            <CampoNumero
              etiqueta="Comisión de la plataforma"
              valor={valores.comision}
              sufijo="%"
              regla={REGLA_PCT}
              editable
              onChange={con("comision")}
            />
          </Fila>
          <Fila etiqueta="Comisión de la pasarela">
            <CampoNumero
              etiqueta="Comisión de la pasarela"
              valor={valores.pasarela}
              sufijo="%"
              regla={REGLA_PCT}
              editable
              onChange={con("pasarela")}
            />
          </Fila>
        </>
      )}
      <Fila etiqueta="Días hasta el depósito">
        <CampoNumero
          etiqueta="Días hasta el depósito"
          valor={valores.plazoDeposito}
          sufijo="días"
          regla={REGLA_PLAZO}
          editable
          onChange={con("plazoDeposito")}
        />
      </Fila>
      <p className="text-[11px] text-pc-text-muted">
        Vaciar un dato ya cargado lo borra. Entrada, cobro y courier no se editan aquí.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onGuardado}>
          Cerrar
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!cambios || invalido || guardando}
          onClick={() => guardar(cuerpo)}
          className="bg-pc-primary text-pc-on-fill hover:bg-pc-primary-strong"
        >
          {guardando ? "Guardando…" : `Guardar ficha ${cambios ? `(${cambios})` : ""}`}
        </Button>
      </div>
    </div>
  );
}

export function ConfigFichaDialog({
  ficha,
  onCerrar,
}: {
  ficha: CanalFicha | null;
  onCerrar: () => void;
}) {
  return (
    <Dialog open={ficha !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-auto border-pc-border bg-pc-card text-pc-text sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ficha de {ficha?.nombre}</DialogTitle>
          <DialogDescription>
            Familia, comisiones y plazo de depósito del canal. Los porcentajes van de 0 a 100.
          </DialogDescription>
        </DialogHeader>
        {ficha && <Formulario key={ficha.id} ficha={ficha} onGuardado={onCerrar} />}
      </DialogContent>
    </Dialog>
  );
}
