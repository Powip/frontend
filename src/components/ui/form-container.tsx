"use client";

import { ReactNode } from "react";
import clsx from "clsx";

interface InputContainerProps {
  children: ReactNode;
  className?: string;
}

export default function FormContainer({ children, className }: InputContainerProps) {
  return (
    <div className={clsx("p-8 border rounded-lg flex flex-col gap-10 border-gray", className)}>
      {children}
    </div>
  );
}