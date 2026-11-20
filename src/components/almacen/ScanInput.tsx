"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Keyboard, ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeScannedCode } from "@/lib/barcodeScanner";
import CameraScanner from "./CameraScanner";

// FEAT-24 H6-D (H6-D2) — campo de escaneo del modo almacén. El lector
// USB/Bluetooth escribe como un teclado y manda Enter, así que el campo
// recupera el foco solo cada vez que lo pierde (salvo que el usuario esté en
// otro campo). Por defecto no abre el teclado del celular (`inputMode="none"`);
// «Teclado» lo habilita para escribir un código a mano. «Cámara» abre el
// escáner con la cámara.

interface Props {
  onCode: (code: string) => void;
  id?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

const OTHER_FIELD = "input, textarea, select, [contenteditable='true']";

export default function ScanInput({
  onCode,
  id = "almacen-scan",
  label = "Escanear código",
  placeholder = "Escanea con el lector o la cámara",
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [typing, setTyping] = useState(false);
  const [camera, setCamera] = useState(false);

  const focus = () => {
    if (!disabled) inputRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    focus();
    const refocus = () => {
      if (document.visibilityState === "visible") focus();
    };
    window.addEventListener("focus", refocus);
    document.addEventListener("visibilitychange", refocus);
    return () => {
      window.removeEventListener("focus", refocus);
      document.removeEventListener("visibilitychange", refocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  const submit = (raw: string) => {
    const code = normalizeScannedCode(raw);
    setValue("");
    if (code) onCode(code);
  };

  return (
    <div className="space-y-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
        className="space-y-1"
      >
        <Label htmlFor={id} className="flex items-center gap-2">
          <ScanBarcode className="h-4 w-4" aria-hidden="true" />
          {label}
        </Label>
        <div className="flex gap-2">
          <Input
            id={id}
            ref={inputRef}
            value={value}
            disabled={disabled}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            inputMode={typing ? "text" : "none"}
            placeholder={placeholder}
            className="h-11 text-base"
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => {
              // Foco permanente: si nadie más lo tomó (otro campo), vuelve al escáner.
              window.setTimeout(() => {
                const active = document.activeElement;
                if (!active || active === document.body || !(active as Element).matches?.(OTHER_FIELD)) focus();
              }, 80);
            }}
          />
          <Button
            type="button"
            variant={typing ? "default" : "outline"}
            className="h-11"
            aria-pressed={typing}
            aria-label={typing ? "Ocultar el teclado" : "Escribir el código con el teclado"}
            onClick={() => {
              setTyping((current) => !current);
              window.setTimeout(focus, 0);
            }}
          >
            <Keyboard className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant={camera ? "default" : "outline"}
            className="h-11"
            aria-pressed={camera}
            aria-label={camera ? "Cerrar la cámara" : "Escanear con la cámara"}
            disabled={disabled}
            onClick={() => setCamera((current) => !current)}
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </form>
      {camera ? (
        <CameraScanner
          onCode={(code) => submit(code)}
          onClose={() => {
            setCamera(false);
            focus();
          }}
        />
      ) : null}
    </div>
  );
}
