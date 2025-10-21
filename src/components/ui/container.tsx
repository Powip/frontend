"use client";

import { ReactNode } from "react";
import clsx from "clsx";

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export default function Container({ children, className }: ContainerProps) {
  return (
    <div
      className={clsx(
        "w-full my-6 flex flex-col gap-10 content-center justify-center max-w-7xl bg-white p-2.5 rounded-lg shadow-sm",
        className
      )}
    >
      {children}
    </div> 
  );
}
