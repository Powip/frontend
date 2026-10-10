"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function EmailTemplatesCard() {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Plantillas de correo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p role="alert" className="text-sm text-muted-foreground">
          Las plantillas de correo todavía no están implementadas. No se envían correos ni se
          guardan cambios.
        </p>
        <Button disabled>Guardar</Button>
      </CardContent>
    </Card>
  );
}
