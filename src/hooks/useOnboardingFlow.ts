"use client";

import { useReducer, useCallback, useRef, useEffect } from "react";
import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { toast } from "sonner";
import { GATEWAY } from "@/lib/gateway";
import {
  Invoice,
  OnboardingState,
  OnboardingStep,
  StoredOnboardingState,
} from "@/types/onboarding";
import {
  saveOnboardingState,
  clearOnboardingState,
} from "@/lib/onboardingStorage";

type OnboardingAction =
  | { type: "SET_LOADING"; isLoading: boolean }
  | { type: "SET_STEP"; step: OnboardingStep }
  | { type: "SET_ADD_ONS"; addOnIds: string[] }
  | { type: "SET_AUTH"; userId: string; accessToken: string }
  | { type: "SET_CARD_TOKEN"; cardToken: string }
  | { type: "SET_SUBSCRIPTION_ID"; subscriptionId: string }
  | { type: "SET_INVOICES"; invoices: Invoice[] }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_INLINE_ERROR"; error: string }
  | { type: "RESTORE"; state: Partial<OnboardingState> };

interface RegisterData {
  name: string;
  surname: string;
  email: string;
  password: string;
  phone: string;
}

/**
 * ms-auth puebla el app_metadata (rol del usuario) de forma asíncrona luego
 * del registro. Este delay evita que el login automático post-registro
 * ocurra antes de que ese app_metadata esté disponibl.
 */
export const APP_METADATA_PROPAGATION_DELAY_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface UseOnboardingFlowReturn {
  state: OnboardingState;
  selectAddOns: (ids: string[]) => void;
  register: (data: RegisterData) => Promise<void>;
  initiateCardRegistration: () => Promise<void>;
  verifyCard: () => Promise<void>;
  subscribe: () => Promise<void>;
  restoreFromStorage: (stored: StoredOnboardingState) => void;
  retry: () => void;
  goBack: () => void;
  setError: (error: string) => void;
}

function reducer(
  state: OnboardingState,
  action: OnboardingAction,
): OnboardingState {
  let newState: OnboardingState;

  switch (action.type) {
    case "SET_LOADING":
      newState = {
        ...state,
        isLoading: action.isLoading,
        error: action.isLoading ? null : state.error,
      };
      break;
    case "SET_STEP":
      newState = { ...state, step: action.step, isLoading: false, error: null };
      break;
    case "SET_ADD_ONS":
      newState = { ...state, addOnIds: action.addOnIds };
      break;
    case "SET_AUTH":
      newState = {
        ...state,
        userId: action.userId,
        accessToken: action.accessToken,
      };
      break;
    case "SET_CARD_TOKEN":
      newState = { ...state, cardToken: action.cardToken };
      break;
    case "SET_SUBSCRIPTION_ID":
      newState = { ...state, subscriptionId: action.subscriptionId };
      break;
    case "SET_INVOICES":
      newState = { ...state, invoices: action.invoices };
      break;
    case "SET_ERROR":
      newState = {
        ...state,
        step: "ERROR",
        isLoading: false,
        error: action.error,
      };
      break;
    case "SET_INLINE_ERROR":
      newState = { ...state, isLoading: false, error: action.error };
      break;
    case "RESTORE":
      newState = { ...state, ...action.state };
      break;
    default:
      newState = state;
  }

  return newState;
}

export function useOnboardingFlow(
  initial: {
    planId: string;
    planName: string;
    price: number;
    isAnnual: boolean;
    initialAuth?: { accessToken: string; userId: string };
  },
  loginFn: (tokens: { accessToken: string }) => Promise<unknown>,
): UseOnboardingFlowReturn {
  const initialState: OnboardingState = {
    step: initial.initialAuth ? "ADDONS" : "REGISTRATION",
    planId: initial.planId,
    planName: initial.planName,
    price: initial.price,
    isAnnual: initial.isAnnual,
    addOnIds: [],
    userId: initial.initialAuth?.userId ?? null,
    accessToken: initial.initialAuth?.accessToken ?? null,
    cardToken: null,
    subscriptionId: null,
    invoices: null,
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

  const selectAddOns = useCallback((ids: string[]) => {
    dispatch({ type: "SET_ADD_ONS", addOnIds: ids });
    dispatch({ type: "SET_STEP", step: "CARD_REDIRECT" });
  }, []);

  const register = useCallback(
    async (data: RegisterData) => {
      dispatch({ type: "SET_LOADING", isLoading: true });

      let userId: string;
      try {
        const registerRes = await axios.post<{ userId: string }>(
          `${GATEWAY.auth}/api/v1/auth/register`,
          {
            name: data.name,
            surname: data.surname,
            email: data.email,
            password: data.password,
            phoneNumber: `+51${data.phone}`,
            username: data.email,
          },
        );
        userId = registerRes.data.userId;
      } catch (err: unknown) {
        let message = "No pudimos crear tu cuenta. Intenta nuevamente.";
        if (axios.isAxiosError(err)) {
          const serverMsg = (err.response?.data as { message?: string })
            ?.message;
          if (err.response?.status === 409) {
            message =
              "Este email ya está registrado. ¿Ya tenés cuenta? Iniciá sesión.";
          } else if (err.response?.status === 400) {
            message =
              serverMsg ??
              "Datos inválidos. Revisá los campos e intentá nuevamente.";
          } else if (serverMsg) {
            message = serverMsg;
          }
        }
        toast.error(message);
        dispatch({ type: "SET_INLINE_ERROR", error: message });
        return;
      }

      try {
        // Wait for ms-auth events to populate app_metadata
        await sleep(APP_METADATA_PROPAGATION_DELAY_MS);
        const loginRes = await axios.post<{
          accessToken: string;
          expiresIn: number;
        }>(
          `${GATEWAY.auth}/api/v1/auth/login`,
          { email: data.email, password: data.password },
          { withCredentials: true },
        );
        const accessToken = loginRes.data.accessToken;

        if (!mountedRef.current) return;

        await loginFn({ accessToken });

        dispatch({ type: "SET_AUTH", userId, accessToken });
        dispatch({ type: "SET_STEP", step: "ADDONS" });

        axiosAuth
          .post(`${GATEWAY.subscriptionFlow}/api/v1/customers`, {
            name: `${data.name} ${data.surname}`,
            email: data.email,
          })
          .catch(() => {
            // Si falla, initiateCardRegistration mostrará un error 404 claro al usuario.
          });
      } catch {
        const message =
          "Tu cuenta fue creada. Por favor iniciá sesión para continuar con tu suscripción.";
        toast.error(message);
        dispatch({ type: "SET_INLINE_ERROR", error: message });
      }
    },
    [loginFn],
  );

  const initiateCardRegistration = useCallback(async () => {
    dispatch({ type: "SET_LOADING", isLoading: true });

    try {
      const { data } = await axiosAuth.post<{ url: string; token: string }>(
        `${GATEWAY.subscriptionFlow}/api/v1/customers/register/card`,
      );

      if (!data.url || !data.token) {
        throw new Error(
          "Respuesta inesperada del servidor. Intenta nuevamente.",
        );
      }

      const stored: StoredOnboardingState = {
        planId: state.planId,
        planName: state.planName,
        price: state.price,
        isAnnual: state.isAnnual,
        addOnIds: state.addOnIds,
        userId: state.userId ?? "",
        cardToken: data.token,
      };

      saveOnboardingState(stored);
      dispatch({ type: "SET_CARD_TOKEN", cardToken: data.token });
      dispatch({ type: "SET_STEP", step: "CARD_WIDGET" });
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.status === 404
          ? "No encontramos tu perfil de cliente. Contactá a soporte."
          : err instanceof Error
            ? err.message
            : "No pudimos iniciar el registro de tarjeta. Intenta nuevamente.";
      toast.error(message);
      dispatch({ type: "SET_ERROR", error: message });
    }
  }, [
    state.userId,
    state.planId,
    state.planName,
    state.price,
    state.isAnnual,
    state.addOnIds,
  ]);

  const verifyCard = useCallback(async () => {
    dispatch({ type: "SET_LOADING", isLoading: true });

    const maxAttempts = 10;
    const delayMs = 3000;
    const userId = state.userId;
    const token = state.cardToken;

    if (!userId || !token) {
      dispatch({ type: "SET_ERROR", error: "Datos de sesión incompletos" });
      return;
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (!mountedRef.current) return;

      try {
        const { data } = await axiosAuth.get<{ status: string }>(
          `${GATEWAY.subscriptionFlow}/api/v1/customers/register/card/status?token=${encodeURIComponent(token)}`,
        );

        if (data.status === "REGISTERED") {
          if (mountedRef.current)
            dispatch({ type: "SET_STEP", step: "SUBSCRIBE" });
          return;
        }
      } catch {
        // continuar polling
      }

      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    if (mountedRef.current) {
      const timeoutMsg =
        "No pudimos confirmar el registro de tu tarjeta. Volvé a intentarlo o contactá a soporte.";
      toast.error(timeoutMsg);
      dispatch({ type: "SET_ERROR", error: timeoutMsg });
    }
  }, [state.userId, state.cardToken]);

  const subscribe = useCallback(async () => {
    dispatch({ type: "SET_LOADING", isLoading: true });

    try {
      const { data: subData } = await axiosAuth.post<{
        subscriptionId?: string;
        id?: string;
      }>(`${GATEWAY.subscriptionFlow}/api/v1/subscriptions`, {
        planId: state.planId,
        planAdditionalList: state.addOnIds,
        trial_period_days: 0,
        periods_number: state.isAnnual ? 12 : 1,
      });

      const subscriptionId = subData.subscriptionId ?? subData.id ?? "";
      dispatch({ type: "SET_SUBSCRIPTION_ID", subscriptionId });

      if (subscriptionId) {
        try {
          const { data: invoices } = await axiosAuth.get<Invoice[]>(
            `${GATEWAY.subscriptionFlow}/api/v1/subscriptions/${encodeURIComponent(subscriptionId)}/invoices`,
          );
          dispatch({ type: "SET_INVOICES", invoices });
        } catch {
          // best effort — no bloquea el flujo si falla
        }
      }

      clearOnboardingState();
      dispatch({ type: "SET_STEP", step: "DONE" });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "No pudimos activar tu suscripción. Intentá nuevamente.";
      toast.error(message);
      dispatch({ type: "SET_ERROR", error: message });
    }
  }, [state.planId, state.addOnIds, state.isAnnual]);

  const restoreFromStorage = useCallback((stored: StoredOnboardingState) => {
    dispatch({
      type: "RESTORE",
      state: {
        planId: stored.planId,
        planName: stored.planName,
        price: stored.price,
        isAnnual: stored.isAnnual,
        addOnIds: stored.addOnIds,
        userId: stored.userId,
        cardToken: stored.cardToken,
        step: "CARD_VERIFY",
      },
    });
  }, []);

  const retry = useCallback(() => {
    dispatch({ type: "SET_STEP", step: "CARD_REDIRECT" });
  }, []);

  const goBack = useCallback(() => {
    dispatch({ type: "SET_STEP", step: "ADDONS" });
  }, []);

  const setError = useCallback((error: string) => {
    dispatch({ type: "SET_ERROR", error });
  }, []);

  return {
    state,
    selectAddOns,
    register,
    initiateCardRegistration,
    verifyCard,
    subscribe,
    restoreFromStorage,
    retry,
    goBack,
    setError,
  };
}
