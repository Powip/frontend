"use client";
import axios from "axios";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { adsOptions, adsUrl } from "@/services/advertisingV22Service";
import { useAdsQuery } from "./context";

/** Only request visible covers. Credentials stay in headers, never in image URLs. */
export function AdThumbnail({
  adId,
  accountId,
  source,
  name,
  className = "size-12",
}: {
  adId: string;
  accountId: string;
  source?: string | null;
  name: string;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const query = useAdsQuery(
    ["thumbnail", accountId, adId],
    async (identity, signal) =>
      (
        await axios.get<Blob>(
          `${adsUrl(identity.companyId)}/meta/v22/ads/${encodeURIComponent(adId)}/thumbnail`,
          { ...adsOptions(identity.token, signal), params: { accountId }, responseType: "blob" },
        )
      ).data,
    visible,
  );
  useEffect(() => {
    if (!query.data) return;
    const next = URL.createObjectURL(query.data);
    setUrl(next);
    setBroken(false);
    return () => URL.revokeObjectURL(next);
  }, [query.data]);
  const display = url ?? source;
  return (
    <div
      ref={container}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded bg-muted ${className}`}
    >
      {display && !broken ? (
        <Image
          src={display}
          alt={name}
          width={48}
          height={48}
          unoptimized
          loading="lazy"
          className="size-full object-contain"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="px-2 text-center text-xs text-muted-foreground">Sin portada</span>
      )}
    </div>
  );
}
