"use client";

import { ReactNode } from "react";

interface InputContainerProps {
  children: ReactNode;
}

export default function FormContainer({ children }: InputContainerProps) {
  return (
    <div className="p-8 border rounded-lg flex flex-col gap-10 border-gray">
      {children}
    </div>
  );
}