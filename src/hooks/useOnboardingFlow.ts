"use client";

import { useReducer, useCallback, useRef, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import type {
  OnboardingState,
  OnboardingStep,
  StoredOnboardingState,
  SubscriptionMe,
} from "@/types/onboarding";
import { saveOnboardingState, clearOnboardingState } from "@/lib/onboardingStorage";
import {
  apiErrorCode,
  confirmFlowCheckout,
  fetchMySubscription,
  loginAccount,
  registerAccount,
  startFlowCheckout,
} from "@/services/onboardingService";

type OnboardingAction =
  | { type: "SET_LOADING"; isLoading: boolean }
  | { type: "SET_STEP"; step: OnboardingStep }
  | { type: "SET_PLAN"; planId: string }
  | { type: "SET_ADD_ONS"; addOnIds: string[] }
  | { type: "SET_USER"; userId: string }
  | { type: "SET_CHECKOUT"; cardToken: string; redirectUrl: string }
  | { type: "SET_SUBSCRIPTION"; subscription: SubscriptionMe }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_INLINE_ERROR"; error: string }
  | { type: "RESTORE"; state: Partial<OnboardingState> };

export interface RegisterData {
  name: string;
  surname: string;
  email: string;
  password: string;
  phone: string;
  identityDocument: string;
  address: string;
  district: string;
}

/** Reintentos de /flow/confirm mientras Flow asienta la tarjeta (202). */
export const CONFIRM_MAX_ATTEMPTS = 10;
/** Reintentos de /subscriptions/me esperando que el primer cobro quede aplicado. */
export const PAYMENT_MAX_ATTEMPTS = 10;
export const POLL_DELAY_MS = 3000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const HAS_PLAN = new Set(["ACTIVE", "PENDING_RENEWAL"]);

export interface UseOnboardingFlowReturn {
  state: OnboardingState;
  setPlan: (planId: string) => void;
  selectAddOns: (ids: string[]) => void;
  register: (data: RegisterData) => Promise<void>;
  initiateCardRegistration: () => Promise<void>;
  confirmPayment: () => Promise<void>;
  checkPaymentAgain: () => Promise<void>;
  restoreFromStorage: (stored: StoredOnboardingState) => void;
  retry: () => void;
  goBack: () => void;
  setError: (error: string) => void;
}

function reducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.isLoading, error: action.isLoading ? null : state.error };
    case "SET_STEP":
      return { ...state, step: action.step, isLoading: false, error: null };
    case "SET_PLAN":
      return { ...state, planId: action.planId };
    case "SET_ADD_ONS":
      return { ...state, addOnIds: action.addOnIds };
    case "SET_USER":
      return { ...state, userId: action.userId };
    case "SET_CHECKOUT":
      return { ...state, cardToken: action.cardToken, redirectUrl: action.redirectUrl };
    case "SET_SUBSCRIPTION":
      return { ...state, subscription: action.subscription };
    case "SET_ERROR":
      return { ...state, step: "ERROR", isLoading: false, error: action.error };
    case "SET_INLINE_ERROR":
      return { ...state, isLoading: false, error: action.error };
    case "RESTORE":
      return { ...state, ...action.state };
    default:
      return state;
  }
}

/**
 * Flujo del onboarding (FEAT-11):
 * REGISTRATION → ADDONS → CARD_REDIRECT → CARD_WIDGET → CONFIRMING → DONE.
 *
 * La cuenta se crea primero en ms-auth; el acceso al sistema lo habilita recién
 * la suscripción ACTIVE (AuthGuard). ms-subscription orquesta el cobro con Flow.
 *
 * @param loginFn   AuthContext.login: carga la sesión (y la suscripción) en el contexto.
 * @param onActivated se llama cuando la suscripción queda ACTIVE, para refrescar el contexto.
 */
export function useOnboardingFlow(
  initial: {
    planId: string;
    planName: string;
    price: number;
    initialUserId?: string | null;
  },
  loginFn: (tokens: { accessToken: string }) => Promise<unknown>,
  onActivated?: () => Promise<void> | void,
): UseOnboardingFlowReturn {
  const initialState: OnboardingState = {
    step: initial.initialUserId ? "ADDONS" : "REGISTRATION",
    planId: initial.planId,
    planName: initial.planName,
    price: initial.price,
    addOnIds: [],
    userId: initial.initialUserId ?? null,
    cardToken: null,
    redirectUrl: null,
    subscription: null,
    error: null,
    isLoading: false,
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setPlan = useCallback((planId: string) => dispatch({ type: "SET_PLAN", planId }), []);

  const selectAddOns = useCallback((ids: string[]) => {
    dispatch({ type: "SET_ADD_ONS", addOnIds: ids });
    dispatch({ type: "SET_STEP", step: "CARD_REDIRECT" });
  }, []);

  const register = useCallback(
    async (data: RegisterData) => {
      dispatch({ type: "SET_LOADING", isLoading: true });

      let userId: string;
      try {
        const res = await registerAccount({
          name: data.name.trim(),
          surname: data.surname.trim(),
          email: data.email.trim().toLowerCase(),
          password: data.password,
          phoneNumber: `+51${data.phone}`,
          identityDocument: data.identityDocument.trim(),
          address: data.address.trim(),
          district: data.district.trim(),
        });
        userId = res.userId;
      } catch (err: unknown) {
        let message = "No pudimos crear tu cuenta. Intenta nuevamente.";
        if (axios.isAxiosError(err)) {
          const serverMsg = (err.response?.data as { message?: string; error?: string }) ?? {};
          if (err.response?.status === 409) {
            message = "Este email ya está registrado. Iniciá sesión para continuar con tu suscripción.";
          } else if (err.response?.status === 400) {
            message = serverMsg.message ?? serverMsg.error ?? "Datos inválidos. Revisá los campos e intentá nuevamente.";
          } else if (serverMsg.message) {
            message = serverMsg.message;
          }
        }
        toast.error(message);
        dispatch({ type: "SET_INLINE_ERROR", error: message });
        return;
      }

      try {
        // Login (no el token del registro) para que ms-auth deje la cookie de
        // refresh: la sesión tiene que sobrevivir a la redirección a Flow.
        const { accessToken } = await loginAccount(data.email.trim().toLowerCase(), data.password);
        if (!mountedRef.current) return;
        await loginFn({ accessToken });
        dispatch({ type: "SET_USER", userId });
        dispatch({ type: "SET_STEP", step: "ADDONS" });
      } catch {
        const message = "Tu cuenta fue creada. Iniciá sesión para continuar con tu suscripción.";
        toast.error(message);
        dispatch({ type: "SET_INLINE_ERROR", error: message });
      }
    },
    [loginFn],
  );

  const initiateCardRegistration = useCallback(async () => {
    dispatch({ type: "SET_LOADING", isLoading: true });
    try {
      const checkout = await startFlowCheckout(state.planId, state.addOnIds);
      saveOnboardingState({
        planId: state.planId,
        planName: state.planName,
        price: state.price,
        addOnIds: state.addOnIds,
        userId: state.userId ?? "",
        cardToken: checkout.cardToken,
      });
      dispatch({ type: "SET_CHECKOUT", cardToken: checkout.cardToken, redirectUrl: checkout.redirectUrl });
      dispatch({ type: "SET_STEP", step: "CARD_WIDGET" });
    } catch (err: unknown) {
      const code = apiErrorCode(err);
      if (code === "ALREADY_SUBSCRIBED") {
        const subscription = await fetchMySubscription().catch(() => null);
        if (subscription) dispatch({ type: "SET_SUBSCRIPTION", subscription });
        await onActivated?.();
        dispatch({ type: "SET_STEP", step: "DONE" });
        return;
      }
      const message =
        code === "PAYMENT_IN_PROGRESS"
          ? "Ya hay un pago en proceso para tu cuenta. Esperá unos minutos y volvé a ingresar."
          : code === "PLAN_NOT_AVAILABLE_IN_FLOW"
            ? "Este plan todavía no está disponible para pago online. Contactá a soporte."
            : code === "INVALID_EMAIL"
              ? "Flow no aceptó el email de tu cuenta: tiene que ser un email real que recibas. Contactá a soporte para corregirlo."
              : "No pudimos iniciar el registro de tarjeta. Intenta nuevamente.";
      toast.error(message);
      dispatch({ type: "SET_ERROR", error: message });
    }
  }, [state.planId, state.planName, state.price, state.addOnIds, state.userId, onActivated]);

  /** Espera a que el primer cobro quede aplicado (ACTIVE). Devuelve true si se activó. */
  const waitForActivation = useCallback(
    async (first: SubscriptionMe | null): Promise<boolean> => {
      let current = first;
      for (let attempt = 0; attempt < PAYMENT_MAX_ATTEMPTS; attempt++) {
        if (!mountedRef.current) return false;
        if (current && HAS_PLAN.has(current.status)) {
          dispatch({ type: "SET_SUBSCRIPTION", subscription: current });
          clearOnboardingState();
          await onActivated?.();
          if (mountedRef.current) dispatch({ type: "SET_STEP", step: "DONE" });
          return true;
        }
        await sleep(POLL_DELAY_MS);
        current = await fetchMySubscription().catch(() => current);
      }
      if (current) dispatch({ type: "SET_SUBSCRIPTION", subscription: current });
      return false;
    },
    [onActivated],
  );

  const confirmPayment = useCallback(async () => {
    const token = state.cardToken;
    if (!token) {
      dispatch({ type: "SET_ERROR", error: "No encontramos el registro de tu tarjeta. Volvé a intentarlo." });
      return;
    }
    dispatch({ type: "SET_STEP", step: "CONFIRMING" });
    dispatch({ type: "SET_LOADING", isLoading: true });

    for (let attempt = 0; attempt < CONFIRM_MAX_ATTEMPTS; attempt++) {
      if (!mountedRef.current) return;
      try {
        const result = await confirmFlowCheckout(token);
        if (!result.pending) {
          const activated = await waitForActivation(result.subscription);
          if (!activated && mountedRef.current) dispatch({ type: "SET_STEP", step: "PAYMENT_PENDING" });
          return;
        }
      } catch (err: unknown) {
        const code = apiErrorCode(err);
        if (code === "CARD_REJECTED" || code === "SUBSCRIPTION_NOT_FOUND" || code === "CHECKOUT_NOT_PENDING") {
          const message =
            code === "CARD_REJECTED"
              ? "Flow no pudo registrar tu tarjeta. Probá con otra tarjeta."
              : "Este registro de tarjeta ya no es válido. Volvé a intentarlo.";
          toast.error(message);
          dispatch({ type: "SET_ERROR", error: message });
          return;
        }
        // Otros errores (red, 5xx): se reintenta.
      }
      if (attempt < CONFIRM_MAX_ATTEMPTS - 1) await sleep(POLL_DELAY_MS);
    }

    if (mountedRef.current) {
      const message = "No pudimos confirmar el registro de tu tarjeta. Volvé a intentarlo o contactá a soporte.";
      toast.error(message);
      dispatch({ type: "SET_ERROR", error: message });
    }
  }, [state.cardToken, waitForActivation]);

  /** Desde PAYMENT_PENDING: vuelve a consultar si el cobro ya se aplicó. */
  const checkPaymentAgain = useCallback(async () => {
    dispatch({ type: "SET_LOADING", isLoading: true });
    const current = await fetchMySubscription().catch(() => null);
    const activated = await waitForActivation(current);
    if (!activated && mountedRef.current) {
      dispatch({ type: "SET_STEP", step: "PAYMENT_PENDING" });
    }
  }, [waitForActivation]);

  const restoreFromStorage = useCallback((stored: StoredOnboardingState) => {
    dispatch({
      type: "RESTORE",
      state: {
        planId: stored.planId,
        planName: stored.planName,
        price: stored.price,
        addOnIds: stored.addOnIds,
        userId: stored.userId,
        cardToken: stored.cardToken,
      },
    });
  }, []);

  const retry = useCallback(() => dispatch({ type: "SET_STEP", step: "CARD_REDIRECT" }), []);
  const goBack = useCallback(() => dispatch({ type: "SET_STEP", step: "ADDONS" }), []);
  const setError = useCallback((error: string) => dispatch({ type: "SET_ERROR", error }), []);

  return {
    state,
    setPlan,
    selectAddOns,
    register,
    initiateCardRegistration,
    confirmPayment,
    checkPaymentAgain,
    restoreFromStorage,
    retry,
    goBack,
    setError,
  };
}
