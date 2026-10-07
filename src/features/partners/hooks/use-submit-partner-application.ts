import { useMutation } from "@tanstack/react-query";
import type { SubmittedPartnerApplication } from "../models/submitted-partner-application";
import {
  type SubmitPartnerApplicationInput,
  submitPartnerApplication,
} from "../services/submit-partner-application";

export function useSubmitPartnerApplication() {
  return useMutation<SubmittedPartnerApplication, Error, SubmitPartnerApplicationInput>({
    mutationFn: submitPartnerApplication,
    retry: false,
  });
}
