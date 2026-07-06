"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ShieldCheck, Zap, Rocket, Heart, Link2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";

const UPDATE_SEEN_KEY = "powip_update_v1";

export default function UpdateAnnouncementPopup() {
  const { auth } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!auth) return;
    if (!localStorage.getItem(UPDATE_SEEN_KEY)) {
      setOpen(true);
    }
  }, [auth]);

  const handleClose = () => {
    localStorage.setItem(UPDATE_SEEN_KEY, "true");
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="!p-0 !gap-0 !max-w-[70vw] !w-[70vw] !rounded-[20px] overflow-hidden"
      >
        <div
          style={{ background: "#7B2FBE" }}
          className="relative overflow-hidden px-8 pt-5"
        >
          <div
            className="absolute -top-[100px] -right-[80px] w-[280px] h-[280px] rounded-full"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
          <div
            className="absolute -bottom-[40px] left-[20px] w-[160px] h-[160px] rounded-full"
            style={{ background: "rgba(255,255,255,0.07)" }}
          />
          <div className="relative z-10 flex items-center mb-1.5">
            <Image
              src="/logo-powip-text.svg"
              alt="Powip"
              width={88}
              height={82}
              className="brightness-0 invert"
            />
            <span
              className="ml-2.5 text-[11px] font-medium text-white px-2.5 py-[3px] rounded-full border tracking-wide"
              style={{
                background: "rgba(255,255,255,0.18)",
                borderColor: "rgba(255,255,255,0.3)",
              }}
            >
              Nueva actualización
            </span>
          </div>
          <div className="relative z-10 flex justify-between items-stretch">
            <div className="flex-1 flex flex-col justify-center">
              <DialogTitle className="text-white text-[26px] font-bold mb-1.5 leading-tight">
                ¡Seguimos mejorando Powip!
              </DialogTitle>
              <p className="text-white/75 text-[15px] mb-3">
                Trabajamos para darte una plataforma más rápida, estable y
                segura.
              </p>
            </div>
            <Image
              src="/mascota-pc.svg"
              alt=""
              aria-hidden
              width={180}
              height={195}
              className="ml-4 flex-shrink-0 self-end scale-[1.75] origin-bottom translate-y-6"
              style={{ objectFit: "contain", objectPosition: "bottom center" }}
            />
          </div>
        </div>

        <div className="px-8 pt-6 pb-2">
          <div className="flex gap-3.5 py-[13px] border-b border-border">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: "#EDE9FD" }}
            >
              <ShieldCheck
                className="w-[17px] h-[17px]"
                style={{ color: "#7B2FBE" }}
              />
            </div>
            <div>
              <p className="text-[15px] font-medium text-foreground mb-[3px]">
                Sistema de autenticación mejorado
              </p>
              <p className="text-[14px] text-muted-foreground leading-[1.55]">
                Fortalecimos los mecanismos de acceso y protección de cuentas
                para una experiencia más segura.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5 py-[13px] border-b border-border">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: "#E1F5EE" }}
            >
              <Zap className="w-[17px] h-[17px]" style={{ color: "#0F6E56" }} />
            </div>
            <div>
              <p className="text-[15px] font-medium text-foreground mb-[3px]">
                Optimizaciones generales de rendimiento
              </p>
              <p className="text-[14px] text-muted-foreground leading-[1.55]">
                Mejoras en velocidad y estabilidad para que la plataforma
                responda más rápido en todas las secciones.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5 py-[13px] border-b border-border">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: "#FAEEDA" }}
            >
              <Rocket
                className="w-[17px] h-[17px]"
                style={{ color: "#854F0B" }}
              />
            </div>
            <div>
              <p className="text-[15px] font-medium text-foreground mb-[3px]">
                Compromiso de mejora continua
              </p>
              <p className="text-[14px] text-muted-foreground leading-[1.55]">
                Seguimos evolucionando Powip para ofrecerte una plataforma cada
                vez más confiable y potente.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5 py-[13px]">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: "#DBEAFE" }}
            >
              <Link2
                className="w-[17px] h-[17px]"
                style={{ color: "#1D40AF" }}
              />
            </div>
            <div>
              <p className="text-[15px] font-medium text-foreground mb-[3px]">
                Integración con Aliclick
              </p>
              <p className="text-[14px] text-muted-foreground leading-[1.55]">
                Ya podés conectar tu tienda con Aliclick y gestionar tus ventas
                de afiliados directamente desde Powip.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-8 py-4 border-t border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Heart className="w-3 h-3" style={{ color: "#7B2FBE" }} />
            Gracias por usar Powip
          </p>
          <button
            onClick={handleClose}
            className="h-9 px-5 rounded-[var(--radius)] text-sm font-medium text-white hover:opacity-90 transition-opacity"
            style={{ background: "#7B2FBE" }}
          >
            Entendido
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
