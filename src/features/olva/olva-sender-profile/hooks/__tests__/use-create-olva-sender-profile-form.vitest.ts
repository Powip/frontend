import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toOlvaSenderProfile } from "../../mappers/to-olva-sender-profile";
import { buildBusinessError } from "../../test-utils/axios-error";
import { useCreateOlvaSenderProfileForm } from "../use-create-olva-sender-profile-form";

const { createOlvaSenderProfile, toastSuccess, toastError } = vi.hoisted(() => ({
  createOlvaSenderProfile: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../../services/olva-sender-profile.service", () => ({ createOlvaSenderProfile }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

const profile = toOlvaSenderProfile({
  id: "sender-profile-001",
  label: "Almacén principal",
  ruc: "20616141971",
  email: "remitente@empresa.com",
  firstNames: "Maria Fernanda",
  lastName: "Quispe Rojas",
  phone: null,
  businessName: "Comercial Los Andes S.A.C.",
  isDefault: false,
  createdAt: "2026-10-01T15:00:00.000Z",
  updatedAt: "2026-10-01T15:00:00.000Z",
});

function renderForm(onSuccess = vi.fn(), options: { forceDefault?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const rendered = renderHook(
    () => {
      const hook = useCreateOlvaSenderProfileForm({ onSuccess, ...options });

      // react-hook-form only tracks the formState keys read while rendering
      void hook.form.formState.errors;

      return hook;
    },
    { wrapper },
  );

  return { onSuccess, ...rendered };
}

function fillValidValues(form: ReturnType<typeof renderForm>["result"]["current"]["form"]) {
  form.setValue("label", " Almacén principal ");
  form.setValue("ruc", "20616141971");
  form.setValue("email", "remitente@empresa.com");
  form.setValue("firstNames", "Maria Fernanda");
  form.setValue("lastName", "Quispe Rojas");
}

describe("useCreateOlvaSenderProfileForm", () => {
  beforeEach(() => {
    createOlvaSenderProfile.mockResolvedValue(profile);
  });

  it("does not call the API while the form is invalid", async () => {
    const { result } = renderForm();

    await act(() => result.current.submit());

    expect(createOlvaSenderProfile).not.toHaveBeenCalled();
    expect(result.current.form.formState.errors.ruc?.message).toBe("El RUC es obligatorio");
  });

  it("sends the mapped DTO, then resets and notifies on success", async () => {
    const { result, onSuccess } = renderForm();
    fillValidValues(result.current.form);

    await act(() => result.current.submit());

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(profile));
    // React Query passes extra context after the variables, so only the first argument matters
    expect(createOlvaSenderProfile).toHaveBeenCalledOnce();
    expect(createOlvaSenderProfile.mock.calls[0][0]).toEqual({
      label: "Almacén principal",
      ruc: "20616141971",
      email: "remitente@empresa.com",
      firstNames: "Maria Fernanda",
      lastName: "Quispe Rojas",
      phone: undefined,
      isDefault: false,
    });
    expect(result.current.form.getValues("label")).toBe("");
    expect(toastSuccess).toHaveBeenCalledOnce();
  });

  it("sends isDefault: true when forceDefault is set, even if the switch is off", async () => {
    const { result } = renderForm(vi.fn(), { forceDefault: true });
    fillValidValues(result.current.form);

    await act(() => result.current.submit());

    await waitFor(() => expect(createOlvaSenderProfile).toHaveBeenCalledOnce());
    expect(createOlvaSenderProfile.mock.calls[0][0]).toMatchObject({ isDefault: true });
  });

  it("respects the switch when forceDefault is not set", async () => {
    const { result } = renderForm();
    fillValidValues(result.current.form);

    await act(() => result.current.submit());

    await waitFor(() => expect(createOlvaSenderProfile).toHaveBeenCalledOnce());
    expect(createOlvaSenderProfile.mock.calls[0][0]).toMatchObject({ isDefault: false });
  });

  it("pins a duplicate RUC to the ruc field and keeps the user's input", async () => {
    createOlvaSenderProfile.mockRejectedValue(
      buildBusinessError(409, "SENDER_PROFILE_DUPLICATE_RUC"),
    );
    const { result, onSuccess } = renderForm();
    fillValidValues(result.current.form);

    await act(() => result.current.submit());

    await waitFor(() =>
      expect(result.current.form.formState.errors.ruc?.message).toBe(
        "Ya tienes un remitente registrado con ese RUC.",
      ),
    );
    expect(result.current.form.getValues("ruc")).toBe("20616141971");
    expect(onSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledOnce();
  });

  it("reset() clears values and errors", async () => {
    const { result } = renderForm();

    await act(() => result.current.submit());
    expect(result.current.form.formState.errors.label).toBeDefined();

    act(() => {
      result.current.form.setValue("label", "algo");
      result.current.reset();
    });

    expect(result.current.form.getValues("label")).toBe("");
    expect(result.current.form.formState.errors.label).toBeUndefined();
  });
});
