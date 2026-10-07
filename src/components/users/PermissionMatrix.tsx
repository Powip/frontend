"use client";

import { Fragment } from "react";
import { MOCKUP_PERMISSION_SECTIONS, PERMISSION_ACTIONS } from "./permissionMatrixPreview";

interface PermissionMatrixProps {
  caption: string;
}

export function PermissionMatrix({ caption }: PermissionMatrixProps) {
  return (
    <section className="min-w-0 overflow-x-auto rounded-md border" aria-label={caption}>
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b bg-muted/60">
            <th
              scope="col"
              className="sticky left-0 z-[1] bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground"
            >
              Ruta o módulo
            </th>
            {PERMISSION_ACTIONS.map((action) => (
              <th key={action} scope="col" className="w-20 px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
                {action}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MOCKUP_PERMISSION_SECTIONS.map((section) => (
            <Fragment key={section.section}>
              <tr className="border-b bg-muted/30">
                <th
                  scope="colgroup"
                  colSpan={PERMISSION_ACTIONS.length + 1}
                  className="px-3 py-1.5 text-xs font-semibold"
                >
                  <label className="sticky left-3 inline-flex items-center gap-2">
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
                <tr key={route} className="border-b last:border-b-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-[1] min-w-44 max-w-56 bg-background px-3 py-1.5 font-mono text-xs font-normal break-words"
                  >
                    {route}
                  </th>
                  {PERMISSION_ACTIONS.map((action) => (
                    <td key={action} className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        disabled
                        aria-label={`${action} en ${route}`}
                        className="h-4 w-4 accent-primary"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </section>
  );
}
