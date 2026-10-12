"use client";

import { Check, HelpCircle, Lock, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import {
  waCaps,
  waTable,
  waTableWrap,
  waTd,
  waTh,
  waTr,
} from "@/components/whatsapp/ui/wa-classes";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import {
  PERMISSION_DEFINITIONS,
  PERMISSION_ROLE_LABELS,
  PERMISSION_ROLE_ORDER,
} from "@/features/whatsapp/constants/whatsapp-settings-catalog";
import { WHATSAPP_PERMISSION_ROLES } from "@/features/whatsapp/enums/whatsapp.enums";
import { useSettingsDraft } from "@/features/whatsapp/hooks/use-settings-draft";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type {
  WhatsAppEffectivePermissions,
  WhatsAppPermissionMatrix,
  WhatsAppPermissionSettings,
} from "@/features/whatsapp/models/settings-tab.model";
import {
  countMatrixDifferences,
  getDocumentedPermissionMatrix,
  withAdminLocked,
} from "@/features/whatsapp/utils/whatsapp-permissions.util";
import { cn } from "@/lib/utils";
import { SettingsDraftFooter } from "./SettingsDraftFooter";

function EffectivePermissions({ effective }: { effective: WhatsAppEffectivePermissions }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className={cn(waCaps, "m-0")}>Tus permisos en este módulo</h3>
      <p className="m-0 text-xs text-wa-muted">
        Son los que POWIP aplica a tu usuario. Mientras no estén confirmados, las acciones que los
        requieren quedan bloqueadas.
      </p>
      <ul className="m-0 grid list-none grid-cols-1 gap-1.5 p-0 sm:grid-cols-2">
        {PERMISSION_DEFINITIONS.map((definition) => {
          const value = effective[definition.code];
          return (
            <li
              key={definition.code}
              className="flex items-center justify-between gap-2 rounded-[10px] border border-wa-border px-3 py-2 text-[13px]"
            >
              <span>{definition.label}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs">
                {value === true ? (
                  <>
                    <Check className="size-3.5 text-wa-green" aria-hidden="true" />
                    Permitido
                  </>
                ) : value === false ? (
                  <>
                    <X className="size-3.5 text-wa-red" aria-hidden="true" />
                    No permitido
                  </>
                ) : (
                  <>
                    <HelpCircle className="size-3.5 text-wa-muted" aria-hidden="true" />
                    Sin confirmar
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MatrixTable({
  matrix,
  editable,
  onToggle,
}: {
  matrix: WhatsAppPermissionMatrix;
  editable: boolean;
  onToggle?: (code: string, role: string, value: boolean) => void;
}) {
  return (
    <div className={waTableWrap}>
      <Table className={waTable}>
        <TableHeader>
          <TableRow className={waTr}>
            <TableHead className={waTh}>Puede…</TableHead>
            {PERMISSION_ROLE_ORDER.map((role) => (
              <TableHead key={role} className={cn(waTh, "text-center")}>
                {PERMISSION_ROLE_LABELS[role]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {PERMISSION_DEFINITIONS.map((definition) => (
            <TableRow key={definition.code} className={waTr}>
              <TableCell className={cn(waTd, "min-w-48")}>{definition.label}</TableCell>
              {PERMISSION_ROLE_ORDER.map((role) => {
                const value = matrix[definition.code][role];
                const label = `${definition.label} · ${PERMISSION_ROLE_LABELS[role]}`;
                const isAdmin = role === WHATSAPP_PERMISSION_ROLES.ADMIN;
                return (
                  <TableCell key={role} className={cn(waTd, "text-center")}>
                    <span className="inline-flex items-center gap-1">
                      <Checkbox
                        className="size-4 rounded-[4px] border-wa-border-strong shadow-none disabled:opacity-70 data-[state=checked]:border-wa-teal data-[state=checked]:bg-wa-teal data-[state=checked]:text-white"
                        checked={isAdmin ? true : value}
                        disabled={isAdmin || !editable}
                        aria-label={
                          isAdmin ? `${label}: siempre permitido, no se puede quitar` : label
                        }
                        onCheckedChange={(checked) =>
                          onToggle?.(definition.code, role, checked === true)
                        }
                      />
                      {isAdmin && <Lock className="size-3 text-wa-muted" aria-hidden="true" />}
                    </span>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EditableMatrix({
  settings,
  blockedReason,
  onSave,
}: {
  settings: WhatsAppPermissionSettings;
  blockedReason: string | null;
  onSave?: (matrix: WhatsAppPermissionMatrix) => Promise<void>;
}) {
  const base = withAdminLocked(settings.matrix);
  const { draft, setDraft, isDirty, discard } = useSettingsDraft(base);
  const differences = countMatrixDifferences(draft, base);
  return (
    <div className="flex flex-col gap-3">
      <MatrixTable
        matrix={draft}
        editable
        onToggle={(code, role, value) => {
          const key = code as keyof WhatsAppPermissionMatrix;
          setDraft(withAdminLocked({ ...draft, [key]: { ...draft[key], [role]: value } }));
        }}
      />
      <p className="m-0 text-xs text-wa-muted">
        Cambiar una casilla no da ni quita permisos: solo se aplican cuando POWIP los guarda.
        {differences > 0 && ` ${differences} cambio${differences === 1 ? "" : "s"} sin guardar.`}
      </p>
      <SettingsDraftFooter
        isDirty={isDirty}
        blockedReason={blockedReason}
        saveLabel="Guardar permisos"
        discardTitle="¿Descartar los cambios en los permisos?"
        onDiscard={discard}
        onSave={onSave ? () => onSave(draft) : undefined}
      />
    </div>
  );
}

interface PermissionsSectionProps {
  effective: WhatsAppEffectivePermissions;
  matrix: ResourceState<WhatsAppPermissionSettings>;
  canEdit: boolean;
  blockedReason: string | null;
  onSave?: (matrix: WhatsAppPermissionMatrix) => Promise<void>;
  onRetry?: () => void;
}

export function PermissionsSection({
  effective,
  matrix,
  canEdit,
  blockedReason,
  onSave,
  onRetry,
}: PermissionsSectionProps) {
  return (
    <WaCard aria-labelledby="permissions-title" className="flex flex-col gap-5">
      <WaCardHeader
        className="mb-0"
        titleId="permissions-title"
        title="Permisos"
        description="Qué puede hacer cada rol en este módulo. Los permisos del Administrador no se pueden quitar."
      />
      <div className="flex flex-col gap-2">
        <h3 className="sr-only">Permisos por rol</h3>
        {matrix.kind === "pending-integration" ? (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-xs text-wa-muted">
              Matriz propuesta en el documento, solo como referencia: no está guardada ni se aplica.
              Supervisor CC y Asesora todavía no existen como roles de POWIP.
            </p>
            <MatrixTable matrix={getDocumentedPermissionMatrix()} editable={false} />
          </div>
        ) : (
          <WhatsAppResourceState
            state={matrix}
            pendingTitle=""
            loadingLabel="Cargando permisos"
            errorTitle="No se pudieron cargar los permisos"
            onRetry={onRetry}
          >
            {(data) =>
              canEdit ? (
                <EditableMatrix settings={data} blockedReason={blockedReason} onSave={onSave} />
              ) : (
                <MatrixTable matrix={withAdminLocked(data.matrix)} editable={false} />
              )
            }
          </WhatsAppResourceState>
        )}
      </div>
      <EffectivePermissions effective={effective} />
    </WaCard>
  );
}
