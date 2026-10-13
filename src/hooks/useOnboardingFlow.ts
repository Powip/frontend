"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { toast } from "sonner";
import { registrationErrorMessage } from "@/lib/authErrors";
import { notifyAuthError } from "@/lib/authToast";
import {
  clearOnboardingState,
  getStoredOnboardingState,
  saveOnboardingState,
  validateStoredOnboardingState,
} from "@/lib/onboardingStorage";
import {
  apiErrorCode,
  confirmFlowCheckout,
  fetchMySubscription,
  loginAccount,
  registerAccount,
  startFlowCheckout,
} from "@/services/onboardingService";
import type {
  OnboardingState,
  OnboardingStep,
  StoredOnboardingState,
  SubscriptionMe,
} from "@/types/onboarding";

type OnboardingAction =
  | { type: "SET_LOADING"; isLoading: boolean }
  | { type: "SET_STEP"; step: OnboardingStep }
  | { type: "SET_PLAN"; planId: string; planName: string; price: number }
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
  setPlan: (plan: { id: string; name: string; price: number }) => void;
  selectAddOns: (ids: string[]) => void;
  register: (data: RegisterData) => Promise<void>;
  resumeSession: (userId: string) => void;
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
      return {
        ...state,
        isLoading: action.isLoading,
        error: action.isLoading ? null : state.error,
      };
    case "SET_STEP":
      return { ...state, step: action.step, isLoading: false, error: null };
    case "SET_PLAN":
      return { ...state, planId: action.planId, planName: action.planName, price: action.price };
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
  onActivated?: () => Promise<boolean> | Promise<void> | boolean | void,
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

  const [state, dispatch] = useReducer(reducer, initialState, (value) => {
    const stored = value.userId ? getStoredOnboardingState(value.userId) : null;
    return stored ? { ...value, ...stored, step: "CARD_WIDGET" as const } : value;
  });

  const mountedRef = useRef(true);
  const stateRef = useRef(state);
  const onActivatedRef = useRef(onActivated);
  const ownerRef = useRef(initial.initialUserId ?? null);
  const registrationRevisionRef = useRef(0);
  const paymentRevisionRef = useRef(0);
  const paymentInFlightRef = useRef<number | null>(null);
  const verifyExistingPaymentRef = useRef(false);
  const registeredAccountsRef = useRef(new Map<string, string>());
  const registrationInFlightRef = useRef(false);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    onActivatedRef.current = onActivated;
  }, [onActivated]);
  const invalidatePayment = useCallback(() => {
    paymentRevisionRef.current += 1;
    paymentInFlightRef.current = null;
  }, []);
  const isCurrentPayment = useCallback(
    (revision: number) => mountedRef.current && paymentRevisionRef.current === revision,
    [],
  );
  const beginPayment = useCallback(() => {
    if (!mountedRef.current || paymentInFlightRef.current !== null) return null;
    const revision = ++paymentRevisionRef.current;
    paymentInFlightRef.current = revision;
    return revision;
  }, []);
  const endPayment = useCallback((revision: number) => {
    if (paymentInFlightRef.current === revision) paymentInFlightRef.current = null;
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const nextOwner = initial.initialUserId ?? null;
    const previousOwner = ownerRef.current;
    ownerRef.current = nextOwner;
    if (!previousOwner || previousOwner === nextOwner) return;
    registrationRevisionRef.current += 1;
    registrationInFlightRef.current = false;
    registeredAccountsRef.current.clear();
    invalidatePayment();
    verifyExistingPaymentRef.current = false;
    clearOnboardingState(previousOwner);
    dispatch({
      type: "RESTORE",
      state: {
        step: nextOwner ? "ADDONS" : "REGISTRATION",
        userId: nextOwner,
        cardToken: null,
        redirectUrl: null,
        subscription: null,
        addOnIds: [],
        error: null,
        isLoading: false,
      },
    });
  }, [initial.initialUserId, invalidatePayment]);

  const setPlan = useCallback(
    (plan: { id: string; name: string; price: number }) => {
      if (stateRef.current.planId !== plan.id) {
        invalidatePayment();
        verifyExistingPaymentRef.current = false;
        clearOnboardingState(stateRef.current.userId ?? undefined);
        dispatch({
          type: "RESTORE",
          state: { cardToken: null, redirectUrl: null, subscription: null, isLoading: false },
        });
      }
      dispatch({ type: "SET_PLAN", planId: plan.id, planName: plan.name, price: plan.price });
    },
    [invalidatePayment],
  );

  const selectAddOns = useCallback(
    (ids: string[]) => {
      invalidatePayment();
      verifyExistingPaymentRef.current = false;
      clearOnboardingState(stateRef.current.userId ?? undefined);
      dispatch({
        type: "RESTORE",
        state: { cardToken: null, redirectUrl: null, subscription: null },
      });
      dispatch({ type: "SET_ADD_ONS", addOnIds: ids });
      dispatch({ type: "SET_STEP", step: "CARD_REDIRECT" });
    },
    [invalidatePayment],
  );

  const register = useCallback(
    async (data: RegisterData) => {
      if (!mountedRef.current || registrationInFlightRef.current) return;
      registrationInFlightRef.current = true;
      const revision = registrationRevisionRef.current;
      const isCurrent = () => mountedRef.current && registrationRevisionRef.current === revision;
      dispatch({ type: "SET_LOADING", isLoading: true });
      const email = data.email.trim().toLowerCase();

      try {
        let userId = registeredAccountsRef.current.get(email);
        if (!userId) {
          try {
            const res = await registerAccount({
              name: data.name.trim(),
              surname: data.surname.trim(),
              email,
              password: data.password,
              phoneNumber: `+51${data.phone}`,
              identityDocument: data.identityDocument.trim(),
              address: data.address.trim(),
              district: data.district.trim(),
            });
            if (!isCurrent()) return;
            userId = res.userId;
            // Only remember successful account creation in this mounted flow.
            // Credentials and tokens remain outside this ref and browser storage.
            registeredAccountsRef.current.set(email, userId);
          } catch (err: unknown) {
            if (!isCurrent()) return;
            const message = registrationErrorMessage(err);
            notifyAuthError("No pudimos completar el registro", message);
            dispatch({ type: "SET_INLINE_ERROR", error: message });
            return;
          }
        }

        try {
          // Login establishes the refresh cookie on the auth service's domain.
          // A retry for an account created here only retries this session step.
          const { accessToken } = await loginAccount(email, data.password);
          if (!isCurrent()) return;
          const session = await loginFn({ accessToken });
          if (!isCurrent()) return;
          if (session == null) {
            throw new Error("No se pudo cargar la sesión de la cuenta creada.");
          }
          dispatch({ type: "SET_USER", userId });
          dispatch({ type: "SET_STEP", step: "ADDONS" });
        } catch {
          if (!isCurrent()) return;
          const message =
            "Tu cuenta fue creada, pero no pudimos iniciar la sesión. Reintenta o inicia sesión para continuar.";
          notifyAuthError("Tu cuenta ya fue creada", message);
          dispatch({ type: "SET_INLINE_ERROR", error: message });
        }
      } finally {
        if (registrationRevisionRef.current === revision) registrationInFlightRef.current = false;
      }
    },
    [loginFn],
  );

  const resumeSession = useCallback(
    (userId: string) => {
      if (state.step !== "REGISTRATION" || state.isLoading || state.userId) return;
      const stored = getStoredOnboardingState(userId);
      dispatch({
        type: "RESTORE",
        state: stored
          ? { ...stored, step: "CARD_WIDGET", error: null }
          : { step: "ADDONS", userId, error: null },
      });
    },
    [state.step, state.isLoading, state.userId],
  );

  /** Espera a que el primer cobro quede aplicado (ACTIVE). Devuelve true si se activó. */
  const waitForActivation = useCallback(
    async (first: SubscriptionMe | null, revision: number): Promise<boolean> => {
      let current = first;
      for (let attempt = 0; attempt <= PAYMENT_MAX_ATTEMPTS; attempt++) {
        if (!isCurrentPayment(revision)) return false;
        if (current && HAS_PLAN.has(current.status)) {
          dispatch({ type: "SET_SUBSCRIPTION", subscription: current });
          try {
            const refreshed = await onActivatedRef.current?.();
            if (refreshed === false) throw new Error("No se pudo actualizar la sesión.");
          } catch {
            if (isCurrentPayment(revision)) {
              const error =
                "Tu plan está activo, pero no pudimos actualizar tu sesión. Vuelve a verificar o inicia sesión nuevamente.";
              toast.error(error);
              dispatch({ type: "SET_ERROR", error });
            }
            return true;
          }
          if (isCurrentPayment(revision)) {
            clearOnboardingState(stateRef.current.userId ?? undefined);
            dispatch({ type: "SET_STEP", step: "DONE" });
          }
          return true;
        }
        if (attempt === PAYMENT_MAX_ATTEMPTS) break;
        await sleep(POLL_DELAY_MS);
        if (!isCurrentPayment(revision)) return false;
        current = await fetchMySubscription().catch(() => current);
      }
      if (current && isCurrentPayment(revision))
        dispatch({ type: "SET_SUBSCRIPTION", subscription: current });
      return false;
    },
    [isCurrentPayment],
  );

  const initiateCardRegistration = useCallback(async () => {
    const revision = beginPayment();
    if (revision === null) return;
    const snapshot = stateRef.current;
    dispatch({ type: "SET_LOADING", isLoading: true });
    try {
      if (!snapshot.userId || !snapshot.planId) {
        dispatch({ type: "SET_ERROR", error: "Inicia sesión y elige un plan para continuar." });
        return;
      }
      if (verifyExistingPaymentRef.current) {
        dispatch({ type: "SET_STEP", step: "PAYMENT_PENDING" });
        return;
      }
      if (snapshot.cardToken) {
        dispatch({ type: "SET_STEP", step: "CARD_WIDGET" });
        return;
      }
      const checkout = await startFlowCheckout(snapshot.planId, snapshot.addOnIds);
      if (!isCurrentPayment(revision)) return;
      if (!checkout.cardToken || typeof checkout.cardToken !== "string") {
        throw new Error("Checkout sin registro de tarjeta.");
      }
      saveOnboardingState({
        planId: snapshot.planId,
        planName: snapshot.planName,
        price: snapshot.price,
        addOnIds: snapshot.addOnIds,
        userId: snapshot.userId,
        cardToken: checkout.cardToken,
      });
      dispatch({
        type: "SET_CHECKOUT",
        cardToken: checkout.cardToken,
        redirectUrl: checkout.redirectUrl,
      });
      dispatch({ type: "SET_STEP", step: "CARD_WIDGET" });
    } catch (err: unknown) {
      if (!isCurrentPayment(revision)) return;
      const code = apiErrorCode(err);
      if (code === "ALREADY_SUBSCRIBED" || code === "PAYMENT_IN_PROGRESS") {
        verifyExistingPaymentRef.current = true;
        const subscription = await fetchMySubscription().catch(() => null);
        if (!isCurrentPayment(revision)) return;
        if (subscription && HAS_PLAN.has(subscription.status)) {
          await waitForActivation(subscription, revision);
          return;
        }
        if (subscription?.status === "PENDING_PAYMENT") {
          dispatch({ type: "SET_SUBSCRIPTION", subscription });
          dispatch({ type: "SET_STEP", step: "PAYMENT_PENDING" });
          return;
        }
      }
      const message =
        code === "PAYMENT_IN_PROGRESS"
          ? "Ya hay un pago en proceso para tu cuenta. Espera unos minutos y vuelve a verificar."
          : code === "PLAN_NOT_AVAILABLE_IN_FLOW"
            ? "Este plan todavía no está disponible para pago online. Contacta a soporte."
            : code === "INVALID_EMAIL"
              ? "Flow no aceptó el email de tu cuenta: tiene que ser un email real que recibas. Contacta a soporte para corregirlo."
              : "No pudimos iniciar el registro de tarjeta. Intenta nuevamente.";
      toast.error(message);
      dispatch({ type: "SET_ERROR", error: message });
    } finally {
      endPayment(revision);
    }
  }, [beginPayment, endPayment, isCurrentPayment, waitForActivation]);

  const confirmPayment = useCallback(async () => {
    const revision = beginPayment();
    if (revision === null) return;
    const token = stateRef.current.cardToken;
    if (!token) {
      dispatch({
        type: "SET_ERROR",
        error: "No encontramos el registro de tu tarjeta. Volvé a intentarlo.",
      });
      endPayment(revision);
      return;
    }
    dispatch({ type: "SET_STEP", step: "CONFIRMING" });
    dispatch({ type: "SET_LOADING", isLoading: true });

    try {
      for (let attempt = 0; attempt < CONFIRM_MAX_ATTEMPTS; attempt++) {
        if (!isCurrentPayment(revision)) return;
        try {
          const result = await confirmFlowCheckout(token);
          if (!isCurrentPayment(revision)) return;
          if (!result.pending) {
            const activated = await waitForActivation(result.subscription, revision);
            if (!activated && isCurrentPayment(revision))
              dispatch({ type: "SET_STEP", step: "PAYMENT_PENDING" });
            return;
          }
        } catch (err: unknown) {
          if (!isCurrentPayment(revision)) return;
          const code = apiErrorCode(err);
          if (
            code === "CARD_REJECTED" ||
            code === "SUBSCRIPTION_NOT_FOUND" ||
            code === "CHECKOUT_NOT_PENDING"
          ) {
            if (code !== "CARD_REJECTED") {
              // A successful first confirm can lose its response, then return 404 on retry.
              const subscription = await fetchMySubscription().catch(() => null);
              if (!isCurrentPayment(revision)) return;
              if (subscription && HAS_PLAN.has(subscription.status)) {
                await waitForActivation(subscription, revision);
                return;
              }
              if (subscription?.status === "PENDING_PAYMENT") {
                dispatch({ type: "SET_SUBSCRIPTION", subscription });
                dispatch({ type: "SET_STEP", step: "PAYMENT_PENDING" });
                return;
              }
            }
            clearOnboardingState(stateRef.current.userId ?? undefined);
            dispatch({ type: "RESTORE", state: { cardToken: null, redirectUrl: null } });
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

      if (isCurrentPayment(revision)) {
        const message =
          "No pudimos confirmar el registro de tu tarjeta. Volvé a intentarlo o contactá a soporte.";
        toast.error(message);
        dispatch({ type: "SET_ERROR", error: message });
      }
    } finally {
      endPayment(revision);
    }
  }, [beginPayment, endPayment, isCurrentPayment, waitForActivation]);

  /** Desde PAYMENT_PENDING: vuelve a consultar si el cobro ya se aplicó. */
  const checkPaymentAgain = useCallback(async () => {
    const revision = beginPayment();
    if (revision === null) return;
    dispatch({ type: "SET_LOADING", isLoading: true });
    try {
      const current = await fetchMySubscription().catch(() => null);
      if (!isCurrentPayment(revision)) return;
      const activated = await waitForActivation(current, revision);
      if (!activated && isCurrentPayment(revision)) {
        dispatch({ type: "SET_STEP", step: "PAYMENT_PENDING" });
      }
    } finally {
      endPayment(revision);
    }
  }, [beginPayment, endPayment, isCurrentPayment, waitForActivation]);

  const restoreFromStorage = useCallback(
    (stored: StoredOnboardingState) => {
      const safe = validateStoredOnboardingState(stored);
      const owner = ownerRef.current ?? stateRef.current.userId;
      if (!safe || !owner || safe.userId !== owner) return;
      invalidatePayment();
      verifyExistingPaymentRef.current = false;
      dispatch({
        type: "RESTORE",
        state: {
          ...safe,
          step: "CARD_WIDGET",
          error: null,
          isLoading: false,
        },
      });
    },
    [invalidatePayment],
  );

  const retry = useCallback(() => {
    invalidatePayment();
    dispatch({
      type: "SET_STEP",
      step:
        verifyExistingPaymentRef.current ||
        (stateRef.current.subscription &&
          (HAS_PLAN.has(stateRef.current.subscription.status) ||
            stateRef.current.subscription.status === "PENDING_PAYMENT"))
          ? "PAYMENT_PENDING"
          : stateRef.current.cardToken
            ? "CARD_WIDGET"
            : "CARD_REDIRECT",
    });
  }, [invalidatePayment]);
  const goBack = useCallback(() => {
    invalidatePayment();
    verifyExistingPaymentRef.current = false;
    clearOnboardingState(stateRef.current.userId ?? undefined);
    dispatch({
      type: "RESTORE",
      state: { cardToken: null, redirectUrl: null, subscription: null },
    });
    dispatch({ type: "SET_STEP", step: "ADDONS" });
  }, [invalidatePayment]);
  const setError = useCallback(
    (error: string) => {
      invalidatePayment();
      dispatch({ type: "SET_ERROR", error });
    },
    [invalidatePayment],
  );

  return {
    state,
    setPlan,
    selectAddOns,
    register,
    resumeSession,
    initiateCardRegistration,
    confirmPayment,
    checkPaymentAgain,
    restoreFromStorage,
    retry,
    goBack,
    setError,
  };
}
