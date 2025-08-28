"use client";

import { ReactNode } from "react";

interface FormGridProps {
  children: ReactNode;
  minWidth?: number;
  gap?: number;
}

export default function FormGrid({ children, minWidth = 100, gap = 30 }: FormGridProps) {
  return (
    <div
      className="w-full"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`,
        gap: `${gap}px`,
      }}
    >
      {children}
    </div>
  );
}