"use client";

import { Loader2, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSetDefaultOlvaSenderProfile } from "@/features/olva/olva-sender-profile/hooks/use-set-default-olva-sender-profile";
import type { OlvaSenderProfile } from "@/features/olva/olva-sender-profile/models/olva-sender-profile";
import { isOlvaSenderProfileComplete } from "@/features/olva/olva-sender-profile/utils/is-olva-sender-profile-complete";
import {
  canArchiveOlvaSenderProfile,
  canSetDefaultOlvaSenderProfile,
} from "@/features/olva/olva-sender-profile/utils/olva-sender-profile-permissions";

interface OlvaSenderProfileCardProps {
  profile: OlvaSenderProfile;
  /** Asks the parent to confirm and archive; the card never deletes on its own. */
  onArchive: (profile: OlvaSenderProfile) => void;
}

export function OlvaSenderProfileCard({ profile, onArchive }: OlvaSenderProfileCardProps) {
  const setDefault = useSetDefaultOlvaSenderProfile();

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-medium">{profile.label}</p>
          <p className="truncate text-sm text-muted-foreground">
            RUC {profile.ruc}
            {profile.businessName ? ` · ${profile.businessName}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {profile.isDefault ? <Badge>Predeterminado</Badge> : null}
          {isOlvaSenderProfileComplete(profile) ? null : (
            <Badge variant="outline">Incompleto</Badge>
          )}

          {canSetDefaultOlvaSenderProfile(profile) ? (
            <Button
              size="sm"
              variant="outline"
              aria-label={`Hacer predeterminado: ${profile.label}`}
              disabled={setDefault.isPending}
              onClick={() => setDefault.mutate(profile.id)}
            >
              {setDefault.isPending ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <Star aria-hidden="true" />
              )}
              Hacer predeterminado
            </Button>
          ) : null}

          {canArchiveOlvaSenderProfile(profile) ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              aria-label={`Eliminar: ${profile.label}`}
              disabled={setDefault.isPending}
              onClick={() => onArchive(profile)}
            >
              <Trash2 aria-hidden="true" />
              Eliminar
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
