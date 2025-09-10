"use client";

import { ReactNode } from "react";
import clsx from "clsx";

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export default function ModalContainer({ children, className }: ContainerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        className={clsx(
          "w-full my-6 flex flex-col gap-10 content-center justify-center max-w-3xl bg-white p-2.5 rounded-lg shadow-sm",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
