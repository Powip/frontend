import { zodResolver } from "@hookform/resolvers/zod";
import type { BaseSyntheticEvent } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { toCreateOlvaSenderProfileRequestDto } from "../mappers/to-create-olva-sender-profile-request.dto";
import type { OlvaSenderProfile } from "../models/olva-sender-profile";
import { createOlvaSenderProfileDefaultValues } from "../schemas/olva-sender-profile.defaults";
import {
  type CreateOlvaSenderProfileFormValues,
  createOlvaSenderProfileSchema,
} from "../schemas/olva-sender-profile.schema";
import { applyOlvaSenderProfileServerErrors } from "../utils/apply-olva-sender-profile-server-errors";
import { useCreateOlvaSenderProfile } from "./use-create-olva-sender-profile";

interface UseCreateOlvaSenderProfileFormOptions {
  /** Called once the backend confirmed the profile (the mutation already toasts and refetches). */
  onSuccess?: (profile: OlvaSenderProfile) => void;
  /** Sends `isDefault: true` whatever the switch says (the company's first profile). */
  forceDefault?: boolean;
}

export interface UseCreateOlvaSenderProfileFormResult {
  form: UseFormReturn<CreateOlvaSenderProfileFormValues>;
  /** Ready for `<form onSubmit>`: validates, maps to the DTO and sends. */
  submit: (event?: BaseSyntheticEvent) => Promise<void>;
  /** Clears values, validation errors and any stale mutation state. */
  reset: () => void;
  isSubmitting: boolean;
}

/**
 * Owns everything about the "create sender profile" form that is not markup: validation, the
 * form -> DTO mapping, the request, and pinning backend errors to their inputs.
 */
export function useCreateOlvaSenderProfileForm({
  onSuccess,
  forceDefault = false,
}: UseCreateOlvaSenderProfileFormOptions = {}): UseCreateOlvaSenderProfileFormResult {
  const form = useForm<CreateOlvaSenderProfileFormValues>({
    resolver: zodResolver(createOlvaSenderProfileSchema),
    defaultValues: createOlvaSenderProfileDefaultValues,
    mode: "onTouched",
  });

  const { mutate, reset: resetMutation, isPending } = useCreateOlvaSenderProfile();

  const submit = form.handleSubmit((values) => {
    mutate(
      toCreateOlvaSenderProfileRequestDto({
        ...values,
        isDefault: forceDefault || values.isDefault,
      }),
      {
        onSuccess: (profile) => {
          form.reset(createOlvaSenderProfileDefaultValues);
          onSuccess?.(profile);
        },
        onError: (error) => {
          applyOlvaSenderProfileServerErrors(form.setError, error);
        },
      },
    );
  });

  const reset = () => {
    form.reset(createOlvaSenderProfileDefaultValues);
    resetMutation();
  };

  return { form, submit, reset, isSubmitting: isPending };
}
