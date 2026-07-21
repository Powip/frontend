"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LayoutGrid, ScanLine, Truck, PackageCheck } from "lucide-react";

const STORAGE_KEY = "centro-envios-intro-seen";

const HIGHLIGHTS = [
  {
    icon: LayoutGrid,
    title: "Bandeja de Atención",
    text: "Accesos rápidos a lo que necesita tu atención hoy: por despachar, en tránsito, fallidos y más.",
  },
  {
    icon: ScanLine,
    title: "Escáner de despacho",
    text: "Despacha y confirma entregas escaneando la guía con lectora, cámara o el teclado.",
  },
  {
    icon: Truck,
    title: "Seguimiento por courier",
    text: "Estado de cada guía en Shalom y demás couriers, con exportación a Excel.",
  },
  {
    icon: PackageCheck,
    title: "Todo en un solo lugar",
    text: "Crea guías, reprograma, anula y reasigna sin salir de esta pantalla.",
  },
];

export default function IntroModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) setOpen(true);
  }, []);

  const handleClose = () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-3xl overflow-hidden p-0 gap-0">
        <div className="relative bg-gradient-to-br from-violet-600 to-purple-700 px-8 pt-8 pb-28 sm:pb-8 text-white overflow-hidden">
          <div
            className="absolute -bottom-16 -right-10 w-64 h-64 rounded-full opacity-10 pointer-events-none"
            style={{ background: "rgba(255,255,255,0.4)" }}
          />

          <Image
            src="/logo-powip-text.svg"
            alt="Powip"
            width={110}
            height={32}
            priority
            className="h-7 w-auto brightness-0 invert mb-5 relative z-10"
          />

          <div className="flex items-center gap-4 relative z-10">
            <DialogHeader className="text-left flex-1">
              <DialogTitle className="text-white text-2xl sm:text-3xl font-black leading-tight">
                ¡Bienvenido al Centro de Envíos!
              </DialogTitle>
              <DialogDescription className="text-white/80 text-sm sm:text-base mt-1">
                Tu nuevo panel para gestionar despachos, guías y seguimiento de
                envíos en un solo lugar.
              </DialogDescription>
            </DialogHeader>

            <Image
              src="/mascota-indicando.svg"
              alt=""
              aria-hidden="true"
              width={800}
              height={800}
              priority
              className="hidden sm:block pointer-events-none select-none shrink-0 w-100 h-auto drop-shadow-2xl"
            />
          </div>

          <Image
            src="/mascota-saludando.svg"
            alt=""
            aria-hidden="true"
            width={400}
            height={400}
            priority
            className="sm:hidden pointer-events-none select-none absolute -bottom-3 right-2 z-10 w-40 h-auto drop-shadow-2xl"
          />
        </div>

        <div className="px-8 py-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-950 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-xs text-muted-foreground">{text}</div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="px-8 pb-8">
          <Button
            size="lg"
            className="w-full sm:w-auto sm:ml-auto bg-gradient-to-r from-violet-600 to-purple-700 text-white font-semibold shadow-lg shadow-purple-500/30 hover:from-violet-500 hover:to-purple-600 px-8"
            onClick={handleClose}
          >
            Entendido, empezar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
