"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  assignWhatsAppNumber,
  setPrimaryWhatsAppNumber,
} from "@/features/whatsapp/api/connection-ops.api";
import { launchEmbeddedSignup } from "@/lib/metaEmbeddedSignup";
import {
  completeEmbeddedSignup,
  getEmbeddedSignupConfig,
  selectEmbeddedSignupPhone,
} from "@/services/crmTeamService";
import { connectCustomWaba } from "@/services/whatsappService";
import {
  type ConnectionMutations,
  type NumberRoleChoice,
  signupUnavailableReason,
} from "./connection-types";

/**
 * SOLO DESARROLLO LOCAL: datos de una WABA de prueba para el botón "Conectar"
 * mientras no exista el Embedded Signup de Meta (C-06). Se leen de .env.local
 * (no se sube a GitHub). Nunca configurar estas variables en producción:
 * todo lo que empieza con NEXT_PUBLIC_ queda visible en el navegador.
 */
const LOCAL_TEST_WABA = {
  wabaId: process.env.NEXT_PUBLIC_WA_TEST_WABA_ID ?? "",
  phoneNumberId: process.env.NEXT_PUBLIC_WA_TEST_PHONE_NUMBER_ID ?? "",
  accessToken: process.env.NEXT_PUBLIC_WA_TEST_ACCESS_TOKEN ?? "",
  businessPhoneNumber: process.env.NEXT_PUBLIC_WA_TEST_BUSINESS_PHONE ?? "",
};

const hasLocalTestWaba = () =>
  !!LOCAL_TEST_WABA.wabaId && !!LOCAL_TEST_WABA.phoneNumberId && !!LOCAL_TEST_WABA.accessToken;

/**
 * Alta de un número con «Conectar con Facebook» (Embedded Signup de Meta), la misma en
 * Configuración > WhatsApp y en CRM > Ajustes: modo (dedicado o coexistencia), tipo de número
 * (principal de la empresa, de la tienda o de una vendedora) y número esperado.
 */
export function useSignupMutations({ onChanged }: { onChanged: () => Promise<void> | void }) {
  const { auth } = useAuth();
  const token = auth?.accessToken || "";
  const signupConfigQuery = useQuery({
    queryKey: ["whatsapp", "embedded-signup-config"],
    queryFn: getEmbeddedSignupConfig,
    retry: false,
    staleTime: 60_000,
  });
  const signupAvailable =
    Boolean(signupConfigQuery.data?.enabled) ||
    (process.env.NODE_ENV !== "production" && hasLocalTestWaba());

  // Tipo de número elegido en el alta: «tienda» lo marca principal de la tienda y
  // «vendedora» se lo asigna. «empresa» ya viaja como asCompanyDefault.
  const applyNumberRole = async (
    accountId: string | undefined,
    { role, seller }: Pick<NumberRoleChoice, "role" | "seller">,
  ) => {
    if (!accountId) return;
    if (role === "store") await setPrimaryWhatsAppNumber(accountId);
    if (role === "seller" && seller) {
      await assignWhatsAppNumber(accountId, { userId: seller.id, userName: seller.name });
    }
  };

  const startSignup: NonNullable<ConnectionMutations["startSignup"]> = async ({
    storeId,
    mode,
    role,
    seller,
    confirmNoCoexistence,
    expectedPhoneNumber,
    keepRole,
  }) => {
    // Embedded Signup de Meta (FB.login con config_id y code).
    // mode "coex": el número sigue en la app WhatsApp Business del celular (coexistencia).
    if (!storeId) throw new Error("Elige una tienda antes de conectar.");
    const config = signupConfigQuery.data;
    const coexistence = mode === "coex";
    if (config?.enabled) {
      const shared = await launchEmbeddedSignup(config, { coexistence });
      const saved = await completeEmbeddedSignup({
        storeId,
        code: shared.code,
        ...(shared.wabaId ? { wabaId: shared.wabaId } : {}),
        ...(shared.wabaIds?.length ? { wabaIds: shared.wabaIds } : {}),
        ...(shared.phoneNumberId ? { phoneNumberId: shared.phoneNumberId } : {}),
        ...(coexistence ? { coexistence: true } : {}),
        ...(role === "company" ? { asCompanyDefault: true } : {}),
        ...(confirmNoCoexistence ? { confirmNoCoexistence: true } : {}),
        ...(expectedPhoneNumber ? { expectedPhoneNumber } : {}),
      });
      if (!keepRole) await applyNumberRole(saved?.data?.id, { role, seller });
      await onChanged();
      return;
    }
    // Sin app de Meta configurada: solo en desarrollo local se conecta con la WABA de prueba de .env.local.
    // La WABA de prueba es otro número: nunca sirve para cambiar el modo de uno conectado.
    if (keepRole || process.env.NODE_ENV === "production" || !hasLocalTestWaba()) {
      throw new Error(
        "La conexión con Meta (Embedded Signup) todavía no está disponible. Configura la WABA de prueba en .env.local para desarrollo.",
      );
    }
    const saved = await connectCustomWaba(token, {
      storeId,
      wabaId: LOCAL_TEST_WABA.wabaId,
      phoneNumberId: LOCAL_TEST_WABA.phoneNumberId,
      accessToken: LOCAL_TEST_WABA.accessToken,
      businessPhoneNumber: LOCAL_TEST_WABA.businessPhoneNumber,
      ...(role === "company" ? { asCompanyDefault: true } : {}),
      ...(confirmNoCoexistence ? { confirmNoCoexistence: true } : {}),
    });
    await applyNumberRole(saved?.data?.id, { role, seller });
    await onChanged();
  };

  // Segundo paso de «Conectar con Facebook»: número elegido o confirmación, sin abrir Meta.
  const selectSignupPhone: NonNullable<ConnectionMutations["selectSignupPhone"]> = async ({
    storeId,
    selectionId,
    phoneNumberId,
    role,
    seller,
    confirmNoCoexistence,
    confirmReassign,
    keepRole,
  }) => {
    const saved = await selectEmbeddedSignupPhone({
      storeId,
      selectionId,
      ...(phoneNumberId ? { phoneNumberId } : {}),
      ...(confirmNoCoexistence ? { confirmNoCoexistence: true } : {}),
      ...(confirmReassign ? { confirmReassign: true } : {}),
    });
    if (!keepRole) await applyNumberRole(saved?.data?.id, { role, seller });
    await onChanged();
  };

  return {
    signupConfig: signupConfigQuery.data ?? null,
    signupConfigError: signupConfigQuery.error,
    signupAvailable,
    signupUnavailableReason: signupUnavailableReason(signupConfigQuery.data?.missing),
    applyNumberRole,
    startSignup,
    selectSignupPhone,
  };
}
