const messages: Record<string, string> = {
  BILLING_EVIDENCE_CONFLICT: "La evidencia de cobro presenta un conflicto.",
  PROVIDER_CHARGE_NOT_VERIFIED: "El cobro del proveedor no está verificado.",
  VERIFIED_CHARGE_FIELDS_MISSING: "Faltan datos del cobro verificado.",
  UNAMBIGUOUS_ATTRIBUTION_MISSING: "Falta una atribución inequívoca del referido.",
  APPROVED_FINANCIAL_CONTEXT_MISSING: "Falta contexto financiero aprobado.",
  FINANCIAL_CONTEXT_CHANGED_AFTER_CALCULATION: "El contexto financiero cambió después del cálculo.",
  SERVER_CONTEXT_IDENTITY_MISMATCH: "Las identidades del contexto financiero no coinciden.",
  FINANCIAL_POLICY_TEMPORAL_RULE_NOT_SATISFIED:
    "No se cumple la regla temporal de la política aprobada.",
  APPROVED_POLICY_RATES_MISMATCH: "Las tasas no coinciden con la política aprobada.",
  BILLING_PERIOD_ALREADY_COVERED: "El período ya tiene un cálculo registrado.",
  SERVER_CONTEXT_SCHEMA_INVALID: "El contexto del servidor no tiene un formato válido.",
  FINANCIAL_INPUTS_MISSING: "Faltan entradas financieras para el cálculo.",
  UNSUPPORTED_FINANCIAL_CURRENCY: "La moneda no tiene soporte financiero aprobado.",
  APPROVED_RULE_INCOMPLETE: "La regla financiera aprobada está incompleta.",
  ROUNDING_RULE_MISSING: "Falta una regla de redondeo aprobada.",
  SERVER_CONTEXT_EVIDENCE_MISSING: "Falta evidencia del contexto del servidor.",
  BILLING_PERIOD_COVERAGE_MISSING: "Falta cobertura documentada de los períodos.",
  BILLING_PERIOD_COVERAGE_INVALID: "La cobertura de los períodos no es válida.",
  ANNUAL_RENEWAL_RULE_NOT_APPROVED: "La regla de renovación anual no está aprobada.",
  HISTORIC_LEVEL_SNAPSHOT_MISSING: "Falta evidencia histórica del nivel.",
  LEVEL_SNAPSHOT_INCONSISTENT: "La evidencia histórica del nivel es inconsistente.",
  COMMISSION_RATE_OUT_OF_RANGE: "La tasa de comisión está fuera del rango aprobado.",
  COMMISSION_BASE_EXCEEDS_VERIFIED_CHARGE: "La base supera el cobro verificado.",
  PARTNER_FUNDED_GIFT_NOT_PROVEN: "No está probado el descuento financiado por el Partner.",
  NEGATIVE_COMMISSION_RULE_NOT_APPROVED: "No hay una regla aprobada para una comisión negativa.",
  COMMISSION_AMOUNT_OUT_OF_RANGE: "El importe está fuera del rango admitido.",
  APPROVED_ROUNDING_CANNOT_REPRESENT_RESULT:
    "El redondeo aprobado no puede representar el resultado.",
  EXACT_MONETARY_SNAPSHOT_MISSING: "Falta una base monetaria exacta.",
  EXACT_RATE_SNAPSHOT_MISSING: "Falta evidencia de una tasa exacta.",
  INITIAL_BASE_METHOD_NOT_APPROVED: "El método para la base inicial no está aprobado.",
  INITIAL_BASE_VERIFIED_AMOUNT_MISMATCH: "La base inicial no coincide con el importe verificado.",
  INITIAL_ALLOCATION_EVIDENCE_MISSING: "Falta evidencia de la asignación inicial aprobada.",
  INITIAL_ALLOCATION_SOURCE_MISMATCH: "La asignación inicial no coincide con la fuente verificada.",
};

export function commissionEvaluationReasonMessage(code: string) {
  return Object.hasOwn(messages, code)
    ? messages[code]
    : "Motivo de evaluación no disponible. Falta revisar el contexto financiero.";
}
