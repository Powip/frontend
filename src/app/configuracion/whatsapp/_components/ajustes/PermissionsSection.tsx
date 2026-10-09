"use client";

import { Check, HelpCircle, Lock, Minus, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { SettingsDraftFooter } from "./SettingsDraftFooter";

function EffectivePermissions({ effective }: { effective: WhatsAppEffectivePermissions }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Tus permisos en este módulo</h4>
      <p className="text-xs text-muted-foreground">
        Son los que POWIP aplica a tu usuario. Mientras no estén confirmados, las acciones que los
        requieren quedan bloqueadas.
      </p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {PERMISSION_DEFINITIONS.map((definition) => {
          const value = effective[definition.code];
          return (
            <li
              key={definition.code}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <span>{definition.label}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs">
                {value === true ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    Permitido
                  </>
                ) : value === false ? (
                  <>
                    <X className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                    No permitido
                  </>
                ) : (
                  <>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
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
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Puede…</TableHead>
            {PERMISSION_ROLE_ORDER.map((role) => (
              <TableHead key={role} className="text-center">
                {PERMISSION_ROLE_LABELS[role]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {PERMISSION_DEFINITIONS.map((definition) => (
            <TableRow key={definition.code}>
              <TableCell className="min-w-48">{definition.label}</TableCell>
              {PERMISSION_ROLE_ORDER.map((role) => {
                const value = matrix[definition.code][role];
                const label = `${definition.label} · ${PERMISSION_ROLE_LABELS[role]}`;
                const isAdmin = role === WHATSAPP_PERMISSION_ROLES.ADMIN;
                return (
                  <TableCell key={role} className="text-center">
                    {editable ? (
                      <span className="inline-flex items-center gap-1">
                        <Checkbox
                          checked={isAdmin ? true : value}
                          disabled={isAdmin}
                          aria-label={
                            isAdmin ? `${label}: siempre permitido, no se puede quitar` : label
                          }
                          onCheckedChange={(checked) =>
                            onToggle?.(definition.code, role, checked === true)
                          }
                        />
                        {isAdmin && (
                          <Lock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm">
                        {value ? (
                          <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                        ) : (
                          <Minus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        )}
                        <span className="sr-only">{`${label}: ${value ? "sí" : "no"}`}</span>
                      </span>
                    )}
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
    <div className="space-y-3">
      <MatrixTable
        matrix={draft}
        editable
        onToggle={(code, role, value) => {
          const key = code as keyof WhatsAppPermissionMatrix;
          setDraft(withAdminLocked({ ...draft, [key]: { ...draft[key], [role]: value } }));
        }}
      />
      <p className="text-xs text-muted-foreground">
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
    <section aria-labelledby="permissions-title" className="space-y-4 rounded-xl border p-4">
      <div>
        <h3 id="permissions-title" className="font-semibold">
          Permisos
        </h3>
        <p className="text-sm text-muted-foreground">
          Qué puede hacer cada rol en este módulo. Los permisos del Administrador no se pueden
          quitar.
        </p>
      </div>
      <EffectivePermissions effective={effective} />
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Permisos por rol</h4>
        {matrix.kind === "pending-integration" ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
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
    </section>
  );
}
