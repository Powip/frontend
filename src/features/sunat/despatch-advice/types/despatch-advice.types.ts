// FEAT-24 H12 — guía de remisión electrónica remitente (GRE, tipo 09) de
// ms-sunat (contrato en docs/gre-remitente.md de ese repo). Los nombres de los
// campos son los del backend; las fechas llegan como texto ISO.

export type DespatchTransferReason = "01" | "04";
export type DespatchTransportMode = "01" | "02";
/** Catálogo 06: 1 DNI, 4 carné de extranjería, 6 RUC, 7 pasaporte. */
export type DespatchIdentityDocumentType = "1" | "4" | "6" | "7";
export type DespatchUnitCode = "NIU" | "KGM" | "LTR";
export type DespatchRelatedDocumentType = "01" | "03";

export type DespatchAdviceStatus = "PENDING" | "SENT" | "ACCEPTED" | "ACCEPTED_WITH_OBSERVATION" | "REJECTED";

export interface DespatchAdviceParty {
  identityDocumentType: DespatchIdentityDocumentType;
  identityDocumentNumber: string;
  name: string;
}

export interface DespatchAdviceAddress {
  ubigeo: string;
  address: string;
  establishmentCode?: string | null;
}

export interface DespatchAdviceDriver {
  identityDocumentType: DespatchIdentityDocumentType;
  identityDocumentNumber: string;
  firstName: string;
  familyName: string;
  licenseNumber: string;
}

export interface DespatchAdviceItem {
  description: string;
  quantity: number;
  unitCode: DespatchUnitCode;
  code?: string | null;
}

export interface DespatchAdvicePayload {
  transferReason: DespatchTransferReason;
  transportMode: DespatchTransportMode;
  /** yyyy-mm-dd; nunca antes de la emisión. */
  transferStartDate: string;
  grossWeightKg: number;
  packageCount: number;
  note?: string | null;
  /** Con 04 el backend lo completa con el emisor. */
  recipient?: DespatchAdviceParty | null;
  origin: DespatchAdviceAddress;
  destination: DespatchAdviceAddress;
  carrier?: { ruc: string; name: string; mtcRegistrationNumber?: string | null } | null;
  vehicle?: { plate: string } | null;
  drivers?: DespatchAdviceDriver[] | null;
  relatedDocuments?: Array<{ documentType: DespatchRelatedDocumentType; number: string; issuerRuc?: string | null }> | null;
  items: DespatchAdviceItem[];
}

export interface IssueDespatchAdviceRequest extends DespatchAdvicePayload {
  sunatProfileId?: string | null;
  /** Número del pedido o del traslado: con él se encuentra la guía después. */
  externalReference?: string | null;
}

export interface DespatchAdvice {
  id: string;
  sunatProfileId: string;
  rucIssuer: string;
  documentType: "09";
  series: string;
  correlative: string;
  /** T001-00000001 */
  number: string;
  issueDate: string;
  issueTime: string;
  transferReason: DespatchTransferReason;
  transportMode: DespatchTransportMode;
  externalReference: string | null;
  status: DespatchAdviceStatus;
  ticket: string | null;
  ticketReceivedAt: string | null;
  sunatCode: string | null;
  sunatDescription: string | null;
  observations: string[];
  qrUrl: string | null;
  hasSignedXml: boolean;
  hasCdr: boolean;
  sendAttempts: number;
  lastError: string | null;
  payload: DespatchAdvicePayload;
  createdAt: string;
  updatedAt: string;
}

export interface DespatchAdvicePage {
  items: DespatchAdvice[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListDespatchAdvicesQuery {
  status?: DespatchAdviceStatus;
  transferReason?: DespatchTransferReason;
  dateFrom?: string;
  dateTo?: string;
  externalReference?: string;
  page?: number;
  pageSize?: number;
}

/**
 * A dónde manda ms-sunat las guías: NOT_CONFIGURED = a ningún lado (quedan
 * pendientes), SUNAT_PRODUCTION = SUNAT de verdad, OTHER = un simulador o un
 * entorno de pruebas de terceros (SUNAT no tiene beta REST para la GRE).
 */
export type SunatGreConnection = "NOT_CONFIGURED" | "SUNAT_PRODUCTION" | "OTHER";

export interface GreProfileSettings {
  sunatProfileId: string;
  ruc: string;
  razonSocial: string;
  isDefault: boolean;
  isActive: boolean;
  configured: boolean;
  clientId: string | null;
  series: string | null;
  nextCorrelative: number | null;
  updatedAt: string | null;
  /**
   * No nulo cuando la serie está frenada: SUNAT respondió 1033 (número ya
   * usado fuera de Powip). No se numera ni envía ninguna guía de la serie hasta
   * volver a guardar las credenciales con otra serie o el próximo número libre.
   * Opcional para tolerar un ms-sunat anterior al freno.
   */
  seriesBrake?: GreSeriesBrake | null;
}

export interface GreSeriesBrake {
  series: string;
  correlative: number;
  sunatCode: string;
  sunatDescription: string | null;
  blockedAt: string;
}

export interface GreSettings {
  sunatConnection: SunatGreConnection;
  /**
   * false si las guías van a SUNAT producción y la empresa no está habilitada:
   * no está en SUNAT_GRE_ALLOWED_COMPANY_IDS y (con autoEnableByCredentials)
   * ningún perfil activo tiene credenciales GRE completas. Siempre true contra
   * un simulador o sin conexión.
   */
  enabledForCompany: boolean;
  /**
   * SUNAT_GRE_AUTO_ENABLE de ms-sunat. true: las credenciales completas
   * habilitan a la empresa, así que si no está habilitada solo le faltan
   * credenciales (409 GRE_CREDENTIALS_NOT_CONFIGURED). false o ausente: solo
   * la lista habilita (403 GRE_NO_HABILITADA).
   */
  autoEnableByCredentials?: boolean;
  profiles: GreProfileSettings[];
}

export interface UpsertGreCredentialRequest {
  clientId: string;
  clientSecret: string;
  series?: string;
  /** Obligatorio: el primer número libre de la serie en SUNAT. Guardarlo libera el freno. */
  nextCorrelative: number;
}

export interface GreCredential {
  sunatProfileId: string;
  clientId: string;
  hasClientSecret: boolean;
  series: string;
  nextCorrelative: number;
  updatedAt: string;
}

export type UbigeoLevel = "DEPARTMENT" | "PROVINCE" | "DISTRICT";

export interface UbigeoOption {
  code: string;
  name: string;
}

export interface UbigeoOptions {
  parent: string | null;
  level: UbigeoLevel;
  items: UbigeoOption[];
}

export interface UbigeoDistrict {
  ubigeo: string;
  department: string;
  province: string;
  district: string;
}

export interface UbigeoResolution {
  resolved: boolean;
  ubigeo?: string;
  department: string | null;
  province: string | null;
  district?: string;
  matchedByAlias?: boolean;
  reason?: "MISSING_NAMES" | "DEPARTMENT_NOT_FOUND" | "PROVINCE_NOT_FOUND" | "DISTRICT_NOT_FOUND";
}
