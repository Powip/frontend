import type { PanelPeriodSelection } from "../models/panel-filters.model";
import { PANEL_TIME_ZONE, type PanelPeriod } from "../models/panel-period.model";
import {
  addDays,
  addMonthsToMonthStart,
  diffDays,
  endOfMonthKey,
  isValidDayKey,
  maxDayKey,
  minDayKey,
  startOfMonthKey,
  toLimaDayKey,
} from "./lima-time";

interface RangeKeys {
  desde: string;
  hasta: string;
  anteriorDesde: string;
  anteriorHasta: string;
}

function resolveCustomRange(selection: PanelPeriodSelection, hoy: string): RangeKeys {
  const custom = selection.personalizado;
  const rawDesde = isValidDayKey(custom?.desde) ? custom.desde : startOfMonthKey(hoy);
  const rawHasta = isValidDayKey(custom?.hasta) ? custom.hasta : hoy;
  const ordenadoDesde = minDayKey(rawDesde, rawHasta);
  const ordenadoHasta = maxDayKey(rawDesde, rawHasta);
  const hasta = minDayKey(ordenadoHasta, hoy);
  const desde = minDayKey(ordenadoDesde, hasta);
  const largo = diffDays(desde, hasta) + 1;
  return {
    desde,
    hasta,
    anteriorDesde: addDays(desde, -largo),
    anteriorHasta: addDays(desde, -1),
  };
}

function resolveRange(selection: PanelPeriodSelection, hoy: string): RangeKeys {
  switch (selection.preset) {
    case "hoy":
      return {
        desde: hoy,
        hasta: hoy,
        anteriorDesde: addDays(hoy, -7),
        anteriorHasta: addDays(hoy, -7),
      };
    case "ayer": {
      const ayer = addDays(hoy, -1);
      return {
        desde: ayer,
        hasta: ayer,
        anteriorDesde: addDays(ayer, -7),
        anteriorHasta: addDays(ayer, -7),
      };
    }
    case "7d": {
      const desde = addDays(hoy, -6);
      return {
        desde,
        hasta: hoy,
        anteriorDesde: addDays(desde, -7),
        anteriorHasta: addDays(desde, -1),
      };
    }
    case "mes_anterior": {
      const desde = addMonthsToMonthStart(hoy, -1);
      return {
        desde,
        hasta: endOfMonthKey(desde),
        anteriorDesde: addMonthsToMonthStart(hoy, -2),
        anteriorHasta: addDays(desde, -1),
      };
    }
    case "personalizado":
      return resolveCustomRange(selection, hoy);
    default: {
      const desde = startOfMonthKey(hoy);
      const anteriorDesde = addMonthsToMonthStart(hoy, -1);
      const mismoTramo = addDays(anteriorDesde, diffDays(desde, hoy));
      return {
        desde,
        hasta: hoy,
        anteriorDesde,
        anteriorHasta: minDayKey(mismoTramo, endOfMonthKey(anteriorDesde)),
      };
    }
  }
}

export function resolvePeriod(selection: PanelPeriodSelection, now: number): PanelPeriod {
  const hoy = toLimaDayKey(now);
  const range = resolveRange(selection, hoy);
  const hastaEfectivo = minDayKey(range.hasta, hoy);
  return {
    preset: selection.preset,
    ...range,
    desfaseDias: diffDays(range.anteriorDesde, range.desde),
    dias: diffDays(range.desde, range.hasta) + 1,
    diasTranscurridos: diffDays(range.desde, hastaEfectivo) + 1,
    incluyeHoy: range.hasta >= hoy,
    hoy,
    zonaHoraria: PANEL_TIME_ZONE,
  };
}

export function prorratearMetaMensual(metaMensual: number, dias: number): number {
  return (metaMensual * dias) / 30;
}
