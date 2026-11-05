"use client";

import { Plus, UserRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { OLVA_MAX_SENDER_PROFILES_PER_COMPANY } from "@/features/olva/olva-sender-profile/constants/olva-sender-profile.constants";
import { useOlvaSenderProfiles } from "@/features/olva/olva-sender-profile/hooks/use-olva-sender-profiles";
import type { OlvaSenderProfile } from "@/features/olva/olva-sender-profile/models/olva-sender-profile";
import { ArchiveOlvaSenderProfileDialog } from "./archive-olva-sender-profile-dialog";
import { CreateOlvaSenderProfileDialog } from "./create-olva-sender-profile-dialog";
import { OlvaSenderProfileCard } from "./olva-sender-profile-card";

export function OlvaSenderProfilesSection() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [profileToArchive, setProfileToArchive] = useState<OlvaSenderProfile | null>(null);
  const { data: profiles, isPending, isError, refetch } = useOlvaSenderProfiles();

  const limitReached = (profiles?.length ?? 0) >= OLVA_MAX_SENDER_PROFILES_PER_COMPANY;

  return (
    <section className="space-y-4" aria-labelledby="olva-sender-profiles-title">
      <div className="flex items-center justify-between gap-4">
        <h2 id="olva-sender-profiles-title" className="text-lg font-semibold">
          Remitentes
        </h2>
        <Button onClick={() => setIsCreateOpen(true)} disabled={isPending || limitReached}>
          <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
          Nuevo remitente
        </Button>
      </div>

      {limitReached ? (
        <p className="text-sm text-muted-foreground">
          Alcanzaste el máximo de {OLVA_MAX_SENDER_PROFILES_PER_COMPANY} remitentes activos.
        </p>
      ) : null}

      {isPending ? (
        <Skeleton className="h-20 w-full" />
      ) : isError ? (
        <EmptyState
          title="No pudimos cargar tus remitentes"
          description="Revisa tu conexión e intenta nuevamente."
          actionLabel="Reintentar"
          onAction={() => refetch()}
        />
      ) : profiles.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="Aún no tienes remitentes"
          description="Crea uno para poder generar guías con Olva."
        />
      ) : (
        <ul className="grid gap-3">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <OlvaSenderProfileCard profile={profile} onArchive={setProfileToArchive} />
            </li>
          ))}
        </ul>
      )}

      <CreateOlvaSenderProfileDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <ArchiveOlvaSenderProfileDialog
        profile={profileToArchive}
        onOpenChange={(open) => {
          if (!open) setProfileToArchive(null);
        }}
      />
    </section>
  );
}
