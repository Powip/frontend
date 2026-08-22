import { SuperadminShell } from "@/components/superadmin/shell/SuperadminShell";

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return <SuperadminShell>{children}</SuperadminShell>;
}
