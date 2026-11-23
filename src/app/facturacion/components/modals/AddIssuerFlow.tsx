"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AddIssuerModal,
  type AddIssuerValues,
} from "@/app/facturacion/components/modals/AddIssuerModal";
import CertificadoUploadModal from "@/app/facturacion/components/modals/CertificadoUploadModal";
import { useBuyExtraRuc } from "@/features/sunat/extra-ruc/hooks/use-buy-extra-ruc";
import { useExtraRucSummary } from "@/features/sunat/extra-ruc/hooks/use-extra-ruc-summary";
import {
  getExtraRucErrorMessage,
  needsFlowPlan,
} from "@/features/sunat/extra-ruc/utils/extra-ruc-error.util";
import {
  DEFAULT_EXTRA_RUC_PRICE,
  hasFreeRucSlot,
} from "@/features/sunat/extra-ruc/utils/ruc-slots";
import { useActivateSunatProfile } from "@/features/sunat/sunat-profile/hooks/use-activate-sunat-profile";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";
import { goToExternalPage } from "@/lib/browserNavigation";

type Step = "form" | "certificate";

interface AddIssuerFlowProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: SunatProfile[];
  /**
   * RUC cuyo cupo ya está pagado: se va directo a subir el certificado con su RUC y razón social.
   * Es lo que pasa al volver de la pasarela.
   */
  paidIdentity?: AddIssuerValues;
  /**
   * RUC desactivado que se quiere volver a usar y no tiene cupo libre: el modal sale con sus datos ya
   * cargados y, al confirmar, se paga el cupo.
   */
  reactivate?: AddIssuerValues & { profileId: string };
}

/**
 * Agregar un RUC emisor. Un solo flujo para el chip, el botón de Emisores y el de Certificado Digital:
 * - hay un RUC libre (1 incluido + los extra pagados): modal del mockup → certificado y credenciales SOL;
 * - no hay: modal del mockup → pasarela de pago (por adelantado) → al volver y confirmarse el pago → certificado.
 * Si la cuenta no está en Flow se manda a /pasate-a-flow.
 */
export function AddIssuerFlow({
  isOpen,
  onClose,
  profiles,
  paidIdentity,
  reactivate,
}: AddIssuerFlowProps) {
  const router = useRouter();
  const { data: summary } = useExtraRucSummary();
  const buyExtraRuc = useBuyExtraRuc();
  const activateProfile = useActivateSunatProfile();
  const [step, setStep] = useState<Step>("form");
  const [identity, setIdentity] = useState<AddIssuerValues | undefined>(undefined);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (paidIdentity) {
      setIdentity(paidIdentity);
      setStep("certificate");
      return;
    }

    setIdentity(undefined);
    setStep("form");
  }, [isOpen, paidIdentity]);

  const freeSlot = hasFreeRucSlot(summary, profiles);
  const pricePerRuc = summary?.pricePerRuc ?? DEFAULT_EXTRA_RUC_PRICE;

  function handleConfirm(values: AddIssuerValues) {
    if (reactivate && freeSlot !== false) {
      // El RUC ya existe y ahora hay cupo: solo se activa.
      activateProfile.mutate(reactivate.profileId, { onSuccess: onClose });
      return;
    }

    if (freeSlot !== false) {
      // Hay cupo (o no se sabe: el servidor lo confirma al crear el RUC).
      setIdentity(values);
      setStep("certificate");
      return;
    }

    buyExtraRuc.mutate(values, {
      onSuccess: (purchase) => {
        if (!purchase.redirectUrl) {
          toast.error("No recibimos la página de pago. Intenta de nuevo.");
          return;
        }

        goToExternalPage(purchase.redirectUrl);
      },
      onError: (error) => {
        if (needsFlowPlan(error)) {
          toast.info("Para agregar RUC extra pásate a un plan con cobro automático.");
          onClose();
          router.push("/pasate-a-flow");
          return;
        }

        toast.error(getExtraRucErrorMessage(error));
      },
    });
  }

  return (
    <>
      <AddIssuerModal
        isOpen={isOpen && step === "form"}
        onClose={onClose}
        onConfirm={handleConfirm}
        pricePerRuc={pricePerRuc}
        requiresPayment={freeSlot === null ? null : !freeSlot}
        renewingRucs={summary?.renewingRucs ?? 0}
        existingRucs={profiles.map((profile) => profile.ruc)}
        isSubmitting={buyExtraRuc.isPending || activateProfile.isPending}
        initialValues={reactivate}
      />

      <CertificadoUploadModal
        isOpen={isOpen && step === "certificate"}
        onClose={onClose}
        initialIdentity={identity}
      />
    </>
  );
}
