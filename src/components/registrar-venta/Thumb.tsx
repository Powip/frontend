"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { initials } from "@/utils/productGrouping";

export default function Thumb({
  imageUrl,
  name,
  size = 40,
  className,
}: {
  imageUrl?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={name}
        width={size}
        height={size}
        className={cn("rounded-xl object-cover shrink-0 border", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={cn(
        "rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold shrink-0",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials(name) || "?"}
    </div>
  );
}
