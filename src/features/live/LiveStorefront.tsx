"use client";
import axios from "axios";
import { useEffect, useState } from "react";
import { GATEWAY } from "@/lib/gateway";
import PublicLivePage from "./PublicLivePage";
import { liveError } from "./liveService";
export default function LiveStorefront({ slug }: { slug: string }) {
  const uuid = /^[0-9a-f-]{36}$/i.test(slug);
  const [storeId, setStoreId] = useState(uuid ? slug : ""),
    [error, setError] = useState("");
  useEffect(() => {
    let canceled = false;
    if (uuid) return;
    void axios
      .get<{ storeId: string }>(`${GATEWAY.ventas}/live/catalogs/${encodeURIComponent(slug)}`, {
        withCredentials: false,
      })
      .then((r) => {
        if (!canceled) setStoreId(r.data.storeId);
      })
      .catch((e) => {
        if (!canceled) setError(liveError(e));
      });
    return () => {
      canceled = true;
    };
  }, [slug, uuid]);
  if (!storeId)
    return (
      <main className="min-h-dvh bg-[#100e1d] p-8 text-white">
        <p role={error ? "alert" : "status"}>{error || "Abriendo catálogo…"}</p>
      </main>
    );
  return <PublicLivePage key={storeId} storeId={storeId} />;
}
