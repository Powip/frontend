"use client";

import { Fragment } from "react";
import { PendingBackendNotice } from "./PendingBackendNotice";
import { MOCKUP_PERMISSION_SECTIONS, PERMISSION_ACTIONS } from "./permissionMatrixPreview";

interface PermissionMatrixProps {
  caption: string;
}

export function PermissionMatrix({ caption }: PermissionMatrixProps) {
  return (
    <div className="space-y-2">
      <PendingBackendNotice title="Matriz en vista previa">
        Las rutas son de ejemplo y los permisos todavía no se pueden configurar. Nada de lo que veas aquí se guarda ni
        se aplica.
      </PendingBackendNotice>
      <div className="overflow-x-auto rounded-[10px] border border-[#e8e4f8] dark:border-border">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-[#f7f6ff] dark:bg-muted">
              <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.05em] text-[#8b87a3]">
                Ruta / Módulo
              </th>
              {PERMISSION_ACTIONS.map((action) => (
                <th
                  key={action}
                  scope="col"
                  className="w-20 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-[0.05em] text-[#8b87a3]"
                >
                  {action}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCKUP_PERMISSION_SECTIONS.map((section) => (
              <Fragment key={section.section}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={PERMISSION_ACTIONS.length + 1}
                    className="bg-[#0e0b1f] px-3 py-[7px] text-[11px] font-bold tracking-[0.04em] text-white"
                  >
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        disabled
                        aria-label={`Seleccionar toda la sección ${section.section}`}
                        className="h-3.5 w-3.5"
                      />
                      {section.section}
                    </label>
                  </th>
                </tr>
                {section.routes.map((route) => (
                  <tr key={route} className="border-b border-[#e8e4f8] last:border-b-0 dark:border-border">
                    <th scope="row" className="px-3 py-[7px] font-mono text-xs font-normal text-[#2D2A45] dark:text-foreground">
                      {route}
                    </th>
                    {PERMISSION_ACTIONS.map((action) => (
                      <td key={action} className="px-2 py-[7px] text-center">
                        <input
                          type="checkbox"
                          disabled
                          aria-label={`${action} en ${route}`}
                          className="h-4 w-4 accent-[#4C2FB5]"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
