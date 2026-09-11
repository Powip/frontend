"use client";

import { SuperadminSidebar } from "./SuperadminSidebar";
import { SuperadminTopbar } from "./SuperadminTopbar";

export function SuperadminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-muted/20">
      <SuperadminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <SuperadminTopbar />
        <main className="flex-1 px-6 py-5">{children}</main>
      </div>
    </div>
  );
}
