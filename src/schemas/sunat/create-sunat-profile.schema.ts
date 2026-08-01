import { z } from "zod";

export const createSunatProfileSchema = z.object({
  razonSocial: z.string().min(1, "La razón social es requerida"),

  description: z.string().optional(),

  ruc: z
    .string()
    .regex(
      /^(10|20)\d{9}$/,
      "El RUC debe tener 11 dígitos"
    ),

  ubigeo: z.string().min(1, "El ubigeo es requerido"),

  address: z.string().min(1, "La dirección es requerida"),

  usuarioSol: z.string().min(1, "El usuario SOL es requerido"),

  claveSol: z.string().min(1, "La clave SOL es requerida"),

  claveCertificado: z
    .string()
    .min(1, "La contraseña del certificado es requerida"),

  certificado: z.instanceof(File, {
    message: "Selecciona un certificado .p12 o .pfx",
  }),
});

export type CreateSunatProfileInput =
  z.infer<typeof createSunatProfileSchema>;
  