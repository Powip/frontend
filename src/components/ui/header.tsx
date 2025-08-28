"use client";

import { ReactNode } from "react";

interface HeaderProps {
  children: ReactNode;
}

export default function Header({ children }: HeaderProps) {
  return (
    <div className="flex items-center justify-between p-2.5 border-b border-black">
      <h1 className="font-bold text-4xl">{children}</h1>
    </div>
  );
}
