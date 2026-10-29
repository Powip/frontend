import type { Metadata } from "next";
import { InvitationAcceptanceContent } from "./_components/invitation-acceptance-content";
export const metadata: Metadata = {
  title: "Aceptar invitación",
  robots: { index: false, follow: false },
};
export default function InvitationAcceptancePage() {
  return <InvitationAcceptanceContent />;
}
