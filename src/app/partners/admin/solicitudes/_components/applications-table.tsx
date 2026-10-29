import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ApplicationDecisionAction } from "@/features/partners/models/application-decision";
import type { PartnerApplication } from "@/features/partners/models/partner-application";
import { ApplicationStatusBadge } from "./application-status-badge";

const SKELETON_ROWS = ["row-1", "row-2", "row-3", "row-4", "row-5"];

interface ApplicationsTableProps {
  applications: PartnerApplication[] | undefined;
  isLoading: boolean;
  canDecide: boolean;
  isDecisionPending: boolean;
  onDecide: (application: PartnerApplication, action: ApplicationDecisionAction) => void;
}

export function ApplicationsTable({
  applications,
  isLoading,
  canDecide,
  isDecisionPending,
  onDecide,
}: ApplicationsTableProps) {
  if (isLoading || !applications) {
    return (
      <div className="space-y-2" role="status" aria-label="Cargando solicitudes">
        {SKELETON_ROWS.map((row) => (
          <Skeleton key={row} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No hay solicitudes"
        description="Cuando alguien solicite ser partner, la vas a ver acá."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Solicitante</TableHead>
          <TableHead>Referencia</TableHead>
          <TableHead>País</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Estado</TableHead>
          {canDecide && <TableHead className="text-right">Acción</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((application) => (
          <TableRow key={application.id}>
            <TableCell>
              <div className="font-medium text-foreground">{application.displayName}</div>
              <div className="text-xs text-muted-foreground">{application.email}</div>
            </TableCell>
            <TableCell className="font-mono text-xs">{application.reference}</TableCell>
            <TableCell>{application.country}</TableCell>
            <TableCell className="whitespace-nowrap">
              {format(new Date(application.appliedAt), "dd MMM yyyy", { locale: es })}
            </TableCell>
            <TableCell>
              <ApplicationStatusBadge application={application} />
            </TableCell>
            {canDecide && (
              <TableCell className="text-right">
                {application.status === "applied" && (
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isDecisionPending}
                      onClick={() => onDecide(application, "reject")}
                      aria-label={`Rechazar solicitud de ${application.displayName}`}
                    >
                      Rechazar
                    </Button>
                    <Button
                      size="sm"
                      disabled={isDecisionPending}
                      onClick={() => onDecide(application, "approve")}
                      aria-label={`Aprobar solicitud de ${application.displayName}`}
                    >
                      Aprobar
                    </Button>
                  </div>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
