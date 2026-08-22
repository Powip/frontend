"use client";

import { SuperadminRoleProvider } from "./SuperadminRoleContext";
import { SuperadminSidebar } from "./SuperadminSidebar";
import { SuperadminTopbar } from "./SuperadminTopbar";
import { RolePreviewBanner } from "./RolePreviewBanner";

export function SuperadminShell({ children }: { children: React.ReactNode }) {
  return (
    <SuperadminRoleProvider>
      <div className="flex min-h-screen w-full bg-muted/20">
        <SuperadminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <SuperadminTopbar />
          <RolePreviewBanner />
          <main className="flex-1 px-6 py-5">{children}</main>
        </div>
      </div>
    </SuperadminRoleProvider>
  );
}
