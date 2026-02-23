// Path: src/app/types/lease/lease.types.ts
// ============================================================================
// Lease Types (Frontend Mirror) — CANONICAL CONTRACT (FE + BE)
// ----------------------------------------------------------------------------
// PURPOSE
// - Frontend mirror of backend canonical lease contract.
// - Must stay 1:1 with:  src/types/lease/lease.types.ts  (backend).
// - Used for request payloads + responses + notification params typing.
//
// STRICT RULES (PropEase)
// - exactOptionalPropertyTypes-safe:
//   - optional props must be OMITTED when not used (never assign undefined)
// - Network boundary:
//   - Dates are ISODateString (string) on the wire.
//   - UI can build separate ViewModel (VM) types if it needs Date objects.
//
// IMPORTANT (Canonical refactor)
// - LeaseAgreement DOES NOT include paymentMethod anymore.
// - Payment instruments belong to Payment module, not Lease contract.
// ============================================================================

import type { FileMetaPacket, Address, PhoneNumber, ISODateString } from "../common";

// ----------------------------------------------------------------------------
// Validation Status (lease lifecycle / workflow)
// ----------------------------------------------------------------------------
export const VALIDATION_STATUSES = [
  // Drafting / early workflow
  "draft",
  "pending",
  "waiting",
  "hold",
  "under review",
  "processing",

  // Accepted / in-force workflow
  "approved",
  "validated",
  "reviewed",
  "completed",
  "active",

  // Negative outcomes
  "rejected",
  "cancelled",
  "cancel",
  "flagged",

  // Inactive outcomes
  "inactive",
  "deactivated",
  "deactive",
  "suspended",
  "expired",

  // Storage / historical
  "archived",
] as const;

export type LeaseValidationStatus = (typeof VALIDATION_STATUSES)[number];

// ----------------------------------------------------------------------------
// Rent Basis (what rentAmount means)
// ----------------------------------------------------------------------------
export const RENT_BASIS = ["per_day", "per_week", "per_month", "per_quarter", "per_year"] as const;
export type RentBasis = (typeof RENT_BASIS)[number];

// ----------------------------------------------------------------------------
// Payment Frequency (invoice cadence)
// ----------------------------------------------------------------------------
export const PAYMENT_FREQUENCIES = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;
export type PaymentFrequency = (typeof PAYMENT_FREQUENCIES)[number];

// ----------------------------------------------------------------------------
// Rent Due Date Rule (when rent is due inside the cycle)
// ----------------------------------------------------------------------------
export const RENT_DUE_RULES = ["day_of_cycle", "same_as_start_date", "end_of_cycle"] as const;
export type RentDueRule = (typeof RENT_DUE_RULES)[number];

export interface RentDueDate {
  rule: RentDueRule;

  /**
   * Only when rule === "day_of_cycle" (1..31).
   * Omit otherwise.
   */
  dueDayOfCycle?: number;
}

// ----------------------------------------------------------------------------
// OCR / Scanned documents (token grouping of scan sessions)
// ----------------------------------------------------------------------------
export interface TokenWiseData {
  ageInMinutes: number;
  file: FileMetaPacket;
}

export interface ScannedFileRecordJSON {
  date: ISODateString;
  tenant: string;
  token: string;
  files: TokenWiseData[];
}

// ----------------------------------------------------------------------------
// Tenant details
// ----------------------------------------------------------------------------
export interface EmergencyContact {
  fullName: string;
  relationship: string;
  phone: PhoneNumber;
  email?: string; // optional => omit when absent
}

export interface TenantInformation {
  tenantUsername: string;
  fullName: string;
  nicOrPassport: string;
  gender: string;
  nationality: string;
  dateOfBirth: ISODateString;

  phone: PhoneNumber;
  email: string;

  permanentAddress: Address;
  emergencyContact: EmergencyContact;

  scannedDocuments: ScannedFileRecordJSON[];
}

export interface CoTenant {
  fullName: string;
  email: string;
  phone: PhoneNumber;
  gender: string;
  nicOrPassport: string;
  age: number;
  relationship: string;
}

// ----------------------------------------------------------------------------
// Money + policies (canonical)
// ----------------------------------------------------------------------------
export interface CurrencyFormat {
  /**
   * ISO 4217 code (recommended). Example: "LKR", "USD", "AED"
   */
  currency: string;

  /**
   * Symbol used in UI. Example: "Rs", "$"
   */
  symbol: string;
}

export const NOTICE_PERIOD_UNITS = ["days", "weeks", "months"] as const;
export type NoticePeriodUnit = (typeof NOTICE_PERIOD_UNITS)[number];

export interface NoticePeriod {
  value: number;
  unit: NoticePeriodUnit;
}

export const LATE_PENALTY_MODES = ["fixed_amount", "percent_of_rent"] as const;
export type LatePenaltyMode = (typeof LATE_PENALTY_MODES)[number];

export interface LatePaymentPenalty {
  mode: LatePenaltyMode;
  penaltyValue: number;

  /**
   * Only relevant when mode === "fixed_amount".
   * Omit otherwise.
   */
  currencyFormat?: CurrencyFormat;
}

export interface SecurityDeposit {
  amount: number;
  currencyFormat: CurrencyFormat;
}

export interface UtilityResponsibility {
  utilities: string[];
}

// ----------------------------------------------------------------------------
// Agreement + rules + signatures
// ----------------------------------------------------------------------------
export interface RulesAndRegulations {
  title: string;
  description: string;
  isAccepted: boolean;
}

export interface LeaseAgreement {
  rentAmount: number;
  currencyFormat: CurrencyFormat;

  rentBasis: RentBasis;
  paymentFrequency: PaymentFrequency;

  rentDueDate: RentDueDate;

  /**
   * Canonical dates (wire-safe strings)
   */
  leaseStartDate: ISODateString;
  leaseEndDate: ISODateString;

  noticePeriod: NoticePeriod;
  securityDeposit: SecurityDeposit;

  /**
   * Canonical is singular (NOT array).
   * If you previously used an array in UI, keep that in a VM type,
   * not in the canonical DTO.
   */
  latePaymentPenalty: LatePaymentPenalty;

  utilitiesResponsibility: UtilityResponsibility;
}

export interface Signatures {
  tenantSignature?: FileMetaPacket;
  landlordSignature?: FileMetaPacket;
}

export interface SystemMetadata {
  createdByUsername: string;
  createdAt: ISODateString;

  lastUpdatedByUsername: string;
  lastUpdated: ISODateString;

  status: LeaseValidationStatus;
  statusNote?: string;
}

// ----------------------------------------------------------------------------
// Root payload (create/update + responses)
// ----------------------------------------------------------------------------
export interface LeasePayload {
  leaseID: string;

  tenantInformation: TenantInformation;
  coTenant?: CoTenant;

  propertyID: string;

  leaseAgreement: LeaseAgreement;

  rulesAndRegulations: RulesAndRegulations[];

  isReadTheCompanyPolicy: boolean;

  signatures: Signatures;

  systemMetadata: SystemMetadata;
}
