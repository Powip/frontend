import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdvertisingModuleShell } from "@/components/advertising/AdvertisingModuleShell";

export const metadata: Metadata = {
  title: "Publicidad | Powip",
  robots: { index: false, follow: false },
};

export default function AdvertisingLayout({ children }: { children: ReactNode }) {
  return <AdvertisingModuleShell>{children}</AdvertisingModuleShell>;
}
