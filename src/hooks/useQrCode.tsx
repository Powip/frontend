import QRCode from "qrcode";
import { useState, useEffect } from "react";

export function useQRCode(value: string) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;

    QRCode.toDataURL(value, { width: 150, margin: 2 })
      .then((url) => setQrUrl(url))
      .catch((err) => {
        console.error("Error generando QR:", err);
        setQrUrl(null);
      });
  }, [value]);

  return qrUrl;
}
