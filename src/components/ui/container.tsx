"use client";

import { ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
}

export default function Container({ children }: ContainerProps) {
  return (
    <div className="w-full my-6 flex flex-col gap-10 content-center justify-center max-w-7xl bg-white p-2.5 rounded-lg shadow-sm">
      {children}
    </div>
  );
}
