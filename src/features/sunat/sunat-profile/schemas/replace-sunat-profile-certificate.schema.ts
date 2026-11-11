import { z } from "zod";

export const replaceSunatProfileCertificateSchema = z.object({
  certificatePassword: z
    .string({
      error: "Ingresa la contraseña del certificado",
    })
    .min(1, "Ingresa la contraseña del certificado"),

  certificate: z.instanceof(File, {
    error: "Selecciona el archivo del certificado (.p12 o .pfx)",
  }),
});

export type ReplaceSunatProfileCertificateFormValues = z.infer<
  typeof replaceSunatProfileCertificateSchema
>;
