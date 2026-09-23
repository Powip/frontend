"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { UnopenedInvitation } from "@/features/partners/models/unopened-invitation";

interface UnopenedInvitationsTableProps {
  invitations: UnopenedInvitation[] | undefined;
  isLoading: boolean;
}

export function UnopenedInvitationsTable({ invitations, isLoading }: UnopenedInvitationsTableProps) {
  if (isLoading || !invitations) {
    return <Skeleton className="h-10 w-full" />;
  }

  if (invitations.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Sin invitaciones pendientes.</p>;
  }

  return (
    <Table>
      <TableBody>
        {invitations.map((invitation) => (
          <TableRow key={invitation.id}>
            <TableCell>
              <p className="font-medium text-foreground">{invitation.businessName}</p>
              <p className="text-xs text-muted-foreground">
                correo enviado hace {invitation.sentDaysAgo} días
              </p>
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.success("Invitación reenviada")}
              >
                Reenviar
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
