"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  /**
   * Cupo dado de baja o vencido que se quiere volver a pagar: el modal sale con sus datos ya cargados y, al
   * confirmar, siempre se paga (no se usa un cupo libre: el cupo es de ese RUC).
   */
  repay?: AddIssuerValues & { paidUntil?: string | null };
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
  repay,
}: AddIssuerFlowProps) {
  const router = useRouter();
  const { data: summary } = useExtraRucSummary();
  const buyExtraRuc = useBuyExtraRuc();
  const activateProfile = useActivateSunatProfile();
  const [step, setStep] = useState<Step>("form");
  const [identity, setIdentity] = useState<AddIssuerValues | undefined>(undefined);
  const handledReturn = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const activateRef = useRef(activateProfile.mutate);
  activateRef.current = activateProfile.mutate;

  // Al volver de la pasarela por un RUC que ya está conectado (reactivar o renovar) no se pide otra vez el
  // certificado: si está apagado se activa con el cupo recién pagado; si ya está activo, solo se avisa.
  const returningProfile = paidIdentity
    ? profiles.find((profile) => profile.ruc === paidIdentity.ruc)
    : undefined;

  useEffect(() => {
    if (!isOpen) {
      handledReturn.current = null;
      return;
    }

    if (paidIdentity && !returningProfile) {
      setIdentity(paidIdentity);
      setStep("certificate");
      return;
    }

    setIdentity(undefined);
    setStep("form");
  }, [isOpen, paidIdentity, returningProfile]);

  useEffect(() => {
    if (!isOpen || !paidIdentity || !returningProfile) {
      return;
    }
    if (handledReturn.current === paidIdentity.ruc) {
      return;
    }
    handledReturn.current = paidIdentity.ruc;

    if (returningProfile.isActive) {
      toast.success("Pago recibido. El RUC sigue activo.");
      onCloseRef.current();
      return;
    }

    activateRef.current(returningProfile.id, {
      onSuccess: () => onCloseRef.current(),
      onError: () => {
        toast.info("Tu pago se está confirmando. Activa el RUC desde Emisores en un momento.");
        onCloseRef.current();
      },
    });
  }, [isOpen, paidIdentity, returningProfile]);

  const freeSlot = hasFreeRucSlot(summary, profiles);
  const pricePerRuc = summary?.pricePerRuc ?? DEFAULT_EXTRA_RUC_PRICE;

  function handleConfirm(values: AddIssuerValues) {
    if (repay) {
      buy(values);
      return;
    }

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

    buy(values);
  }

  function buy(values: AddIssuerValues) {
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
        isOpen={isOpen && step === "form" && !(paidIdentity && returningProfile)}
        onClose={onClose}
        onConfirm={handleConfirm}
        pricePerRuc={pricePerRuc}
        requiresPayment={repay ? true : freeSlot === null ? null : !freeSlot}
        renewingRucs={summary?.renewingRucs ?? 0}
        existingRucs={profiles.map((profile) => profile.ruc)}
        isSubmitting={buyExtraRuc.isPending || activateProfile.isPending}
        initialValues={repay ?? reactivate}
        paidUntil={repay?.paidUntil ?? null}
      />

      <CertificadoUploadModal
        isOpen={isOpen && step === "certificate"}
        onClose={onClose}
        initialIdentity={identity}
      />
    </>
  );
}
