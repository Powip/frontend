"use client";

import { ReactNode } from "react";
import clsx from "clsx";

interface HeaderProps {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export default function Header({ children, className, action }: HeaderProps) {
  return (
    <div
      className={clsx(
        "flex items-center justify-between p-2.5 border-b border-black",
        className
      )}
    >
      <h1 className="font-bold text-4xl">{children}</h1>
      {action && <div>{action}</div>}
    </div>
  );
}
