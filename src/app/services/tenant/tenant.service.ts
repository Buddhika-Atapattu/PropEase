// Path: src/app/services/tenant/tenant.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// TenantService
// Role
//   Single source of truth for Tenant, Lease & Complaint HTTP calls.
//   - URLs centralized as readonly builders (change in one place).
//   - SSR/Electron safe (no window.location usage).
//   - Beginner-friendly comments for fast onboarding.
//   - Class-based helpers only (no free functions, no "any" except MSG.data).
//
// Conventions
//   - All methods return Promises for async/await.
//   - Normalize BE responses into a unified {status, message, data} (MSG).
//   - Encode & trim URL segments via safeSeg().
//   - Query strings via toParams().
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BackEndPropertyData, Property } from '../property/property.service';
import { environment } from '../../../environments/environment';
import { MSG } from '../../types/api-message.types';



// ─────────────────────────────────────────────────────────────────────────────
// View helpers (as in your original service)
// ─────────────────────────────────────────────────────────────────────────────
export interface TenantTableElement {
  username?: string;
  name: string;
  image: string | File | undefined;
  contactNumber: string | undefined;
  email: string;
  gender: string;
  addedBy?: string;
}

export interface Tenant {
  username: string;      // Unique username (used for tenant login or linking)
  image: string;         // Path or URL to tenant’s profile image
  name: string;          // Full name of the tenant
  contactNumber: string; // Tenant’s phone or mobile number
  email: string;         // Tenant’s email address
  gender: string;        // Gender ("Male", "Female", "Other", etc.)
  addedBy: string;       // Username or ID of the admin/agent who added the tenant
  createdAt: Date;       // via timestamps
  updatedAt: Date;       // via timestamps
}

export interface ActionButtonType { type: 'add' | 'delete' | 'remove' | 'view'; }
export interface CustomTableColumn { key: string; label: string; }

export interface CountryDetails {
  name: string; code: string; emoji: string; unicode: string; image: string;
}
export interface Address {
  houseNumber: string; street: string; city: string;
  stateOrProvince: string; postalCode: string; country: CountryDetails;
}
export interface PropertyInformation {
  propertyId: string;
  address: Address;
  propertyType: 'Apartment' | 'House' | 'Commercial' | 'Studio' | string;
  furnishingStatus: 'Furnished' | 'Unfurnished' | 'Semi-Furnished' | string;
  includedAmenities: string[];
  parkingSpots: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// File upload / scan records
// ─────────────────────────────────────────────────────────────────────────────
export interface FILE {
  fieldname: string; originalname: string; mimetype: string; size: number;
  filename: string; URL: string;
}
export interface TokenViceData {
  ageInMinutes: number; date: string; file: FILE; token: string; folder: string;
}
export interface ScannedFileRecordJSON {
  date: string; tenant: string; token: string; files: TokenViceData[]; folder: string;
}
export interface TenantScannedFilesDataJSON {
  [ tenantUsername: string ]: ScannedFileRecordJSON[];
}

// ─────────────────────────────────────────────────────────────────────────────
// System & Lease models
// ─────────────────────────────────────────────────────────────────────────────
export interface SystemMetadata {
  ocrAutoFillStatus: boolean;
  validationStatus:
  | 'pending' | 'approved' | 'rejected' | 'active' | 'inactive' | 'deactivated'
  | 'deactive' | 'cancelled' | 'cancel' | 'draft' | 'waiting' | 'hold'
  | 'expired' | 'completed' | 'processing' | 'under review' | 'flagged'
  | 'suspended' | 'archived' | 'reviewed' | string;
  language: string;
  leaseTemplateVersion: string;
  pdfDownloadUrl?: string;
  lastUpdated: string;
}
export interface AddedBy {
  username: string; name: string; email: string;
  role: 'admin' | 'agent' | 'owner' | string;
  contactNumber?: string; addedAt: Date | string | null;
}
export interface Signatures {
  tenantSignature: FILE | File;
  landlordSignature: FILE | File;
  signedAt: Date;
  ipAddress: string;
  userAgent: AddedBy;
}
export interface RulesAndRegulations { rule: string; description: string; isEditable?: boolean; }
export interface NoticePeriod { id: string; label: string; days: number; description: string; isEditable?: boolean; }
export interface UtilityResponsibility { id: string; utility: string; paidBy: 'landlord' | 'tenant' | 'shared' | string; description: string; isEditable?: boolean; }
export interface LatePaymentPenalty { label: string; type: 'fixed' | 'percentage' | 'per-day' | string; value: number; description: string; isEditable?: boolean; }
export interface RentDueDate { id: string; label: string; day?: number; offsetDays?: number; description?: string; isEditable?: boolean; }
export interface SecurityDeposit { id: string; name: string; description: string; refundable: boolean; isEditable?: boolean; }
export interface PaymentMethod { id: string; name: string; category: string; region?: string; supported?: boolean; isEditable?: boolean; description?: string; }
export interface PaymentFrequency { id: string; name: string; duration: string; unit: string; isEditable?: boolean; }
export interface CurrencyFormat { country: string; symbol: string; flags: { png: string; svg: string; alt?: string; }; currency: string; }

export interface LeaseAgreement {
  startDate: Date; endDate: Date; durationMonths: number; monthlyRent: number;
  currency: CurrencyFormat; paymentFrequency: PaymentFrequency; paymentMethod: PaymentMethod;
  securityDeposit: SecurityDeposit; rentDueDate: RentDueDate;
  latePaymentPenalties: LatePaymentPenalty[]; utilityResponsibilities: UtilityResponsibility[];
  noticePeriodDays: NoticePeriod;
}
export interface CoTenant {
  fullName: string; email: string; phoneCodeDetails: CountryCodeFormat; phoneNumber: string;
  gender: string; nicOrPassport: string; age: number; relationship: string;
}
export interface EmergencyContact { name: string; relationship: string; contact: string; }
export interface CountryCodeFormat { name: string; code: string; flags: { png: string; svg: string; alt?: string; }; }
export interface TenantInformation {
  tenantUsername: string; fullName: string; nicOrPassport: string; gender: string;
  nationality: string; dateOfBirth: Date; phoneCodeDetails: CountryCodeFormat;
  phoneNumber: string; email: string; permanentAddress: Address;
  emergencyContact: EmergencyContact; scannedDocuments: ScannedFileRecordJSON[] | File[];
}
export interface LeaseWithProperty {
  leaseID: string; tenantInformation: TenantInformation; coTenant?: CoTenant;
  property?: BackEndPropertyData; leaseAgreement: LeaseAgreement;
  rulesAndRegulations: RulesAndRegulations[]; isReadTheCompanyPolicy: boolean;
  signatures: Signatures; systemMetadata: SystemMetadata;
}
export interface Lease {
  leaseID: string; tenantInformation: TenantInformation; coTenant?: CoTenant;
  propertyID?: Property[ 'id' ]; leaseAgreement: LeaseAgreement;
  rulesAndRegulations: RulesAndRegulations[]; isReadTheCompanyPolicy: boolean;
  signatures: Signatures; systemMetadata: SystemMetadata;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants (kept intact)
// ─────────────────────────────────────────────────────────────────────────────
export const SWITCH_ON_ARRAY: string[] = [ 'approved', 'active', 'completed', 'reviewed' ];
export const SWITCH_OFF_ARRAY: string[] = [
  'pending', 'rejected', 'reject', 'cancelled', 'cancel', 'deactivated', 'deactive', 'inactive',
  'flagged', 'suspended', 'draft', 'waiting', 'hold', 'expired', 'processing', 'under review', 'archived'
];

export const DEFAULT_RULES_AND_REGULATIONS: RulesAndRegulations[] = [ { rule: 'Timely Rent Payment', description: 'The tenant must pay the rent on or before the due date each month. Late payments may incur penalties as outlined in the lease agreement.', }, { rule: 'Property Maintenance', description: 'The tenant shall keep the premises clean and in good condition, and shall promptly notify the landlord of any damage or maintenance issues.', }, { rule: 'No Unauthorized Alterations', description: 'The tenant shall not make any structural changes, paint, or install fixtures without prior written consent from the landlord.', }, { rule: 'Occupancy Limit', description: 'Only the individuals listed in the lease agreement may reside on the property. Subleasing or allowing additional occupants without approval is prohibited.', }, { rule: 'Noise and Disturbance', description: 'The tenant shall not cause or permit any nuisance or disturbance that interferes with the peaceful enjoyment of neighbors or other tenants.', }, { rule: 'Pets Policy', description: 'No pets are allowed on the premises unless explicitly permitted in the lease agreement. If allowed, pets must not cause damage or disturbances.', }, { rule: 'Use of Premises', description: 'The property shall be used solely for residential purposes. Commercial or illegal activities are strictly prohibited.', }, { rule: 'End of Lease Condition', description: 'The tenant must return the property in the same condition as it was at the start of the lease, minus normal wear and tear.', }, { rule: 'Utilities Responsibility', description: 'The tenant is responsible for paying all utility bills unless otherwise stated in the lease agreement.', }, { rule: 'Entry by Landlord', description: 'The landlord may enter the premises for inspections, repairs, or emergencies with proper notice, typically 24 hours in advance unless in emergencies.', }, ];

// Large HTML kept as-is from your earlier code
export const DEFAULT_COMPANY_POLICY: string = `<div class="company-policy"> <h2>PropEase – Company Policies</h2> <ol> <li> <strong>Professional Conduct</strong> <p> All PropEase employees, partners, tenants, and landlords are expected to maintain professional behavior and communicate respectfully. Discrimination, harassment, or abusive language of any kind will not be tolerated. </p> </li> <li> <strong>Fair Housing Compliance</strong> <p> PropEase is committed to upholding equal opportunity housing practices. We strictly follow all local and international housing laws and do not discriminate based on race, religion, gender, age, marital status, disability, or nationality. </p> </li> <li> <strong>Tenant Screening & Verification</strong> <p> All prospective tenants will undergo standard verification, including background, credit, employment, and reference checks to ensure a secure and trustworthy rental environment for all parties. </p> </li> <li> <strong>Property Maintenance Policy</strong> <p> Landlords are responsible for major property repairs, while tenants must handle basic cleanliness and minor upkeep. Emergency repairs must be reported immediately via the PropEase platform or hotline. </p> </li> <li> <strong>Late Payment & Penalties</strong> <p> Rent is due on the specified date in the lease agreement. Late payments may incur a penalty fee based on predefined lease terms. Continuous defaults may lead to legal action or lease termination. </p> </li> <li> <strong>Use of Premises</strong> <p> Properties listed through PropEase must be used for residential or commercial purposes only, as stated in the lease. Illegal activities or unauthorized subletting are grounds for immediate action. </p> </li> <li> <strong>Privacy & Data Protection</strong> <p> PropEase values user privacy. All data shared on our platform is protected under our privacy policy and will not be shared without consent, except where legally required. </p> </li> <li> <strong>Inspection & Entry</strong> <p> Landlords must provide at least 24 hours' notice before entering a rented property unless there is an emergency. Inspections will be documented and scheduled through PropEase. </p> </li> <li> <strong>Termination & Eviction Policy</strong> <p> Lease termination must follow proper notice periods as outlined in the lease. In case of violations (e.g., unpaid rent, property damage), PropEase reserves the right to initiate legal eviction processes in accordance with governing laws. </p> </li> <li> <strong>Customer Support</strong> <p> Our support team is available 24/7 to address complaints, resolve disputes, and ensure fair practices are upheld. Users can contact us via the PropEase platform, email, or hotline. </p> </li> </ol> </div> `;

export const PAYMENT_METHODS: PaymentMethod[] = [
  // Credit & Debit Cards
  { id: 'visa', name: 'Visa', category: 'card' },
  { id: 'mastercard', name: 'MasterCard', category: 'card' },
  { id: 'amex', name: 'American Express', category: 'card' },
  { id: 'discover', name: 'Discover', category: 'card' },
  { id: 'jcb', name: 'JCB', category: 'card' },
  { id: 'unionpay', name: 'UnionPay', category: 'card' },
  { id: 'diners', name: 'Diners Club', category: 'card' },
  // Digital Wallets
  { id: 'paypal', name: 'PayPal', category: 'wallet' },
  { id: 'applepay', name: 'Apple Pay', category: 'wallet' },
  { id: 'googlepay', name: 'Google Pay', category: 'wallet' },
  { id: 'samsungpay', name: 'Samsung Pay', category: 'wallet' },
  { id: 'amazonpay', name: 'Amazon Pay', category: 'wallet' },
  { id: 'alipay', name: 'Alipay', category: 'wallet', region: 'China' },
  { id: 'wechatpay', name: 'WeChat Pay', category: 'wallet', region: 'China' },
  { id: 'paytm', name: 'Paytm', category: 'wallet', region: 'India' },
  { id: 'grabpay', name: 'GrabPay', category: 'wallet', region: 'Southeast Asia' },
  { id: 'linepay', name: 'LINE Pay', category: 'wallet', region: 'Japan/Taiwan' },
  { id: 'momo', name: 'MoMo', category: 'wallet', region: 'Vietnam' },
  { id: 'blik', name: 'BLIK', category: 'wallet', region: 'Poland' },
  { id: 'gcash', name: 'GCash', category: 'wallet', region: 'Philippines' },
  { id: 'tngwallet', name: 'TNG Wallet', category: 'wallet', region: 'Hong Kong' },
  { id: 'touchngo', name: 'Touch ‘n Go eWallet', category: 'wallet', region: 'Malaysia' },
  { id: 'kakaopay', name: 'KakaoPay', category: 'wallet', region: 'South Korea' },
  { id: 'mpesa', name: 'M-Pesa', category: 'wallet', region: 'Africa/India' },
  { id: 'yandexmoney', name: 'YooMoney (Yandex Money)', category: 'wallet', region: 'Russia' },
  { id: 'qiwi', name: 'QIWI Wallet', category: 'wallet', region: 'Russia' },
  // Bank Transfers
  { id: 'swift', name: 'SWIFT / IBAN Transfer', category: 'bank' },
  { id: 'sepa', name: 'SEPA Transfer', category: 'bank', region: 'EU' },
  { id: 'ach', name: 'ACH Transfer', category: 'bank', region: 'US' },
  { id: 'fps', name: 'Faster Payments (FPS)', category: 'bank', region: 'UK' },
  { id: 'neft', name: 'NEFT / RTGS', category: 'bank', region: 'India' },
  { id: 'interac', name: 'Interac e-Transfer', category: 'bank', region: 'Canada' },
  { id: 'bacs', name: 'BACS Transfer', category: 'bank', region: 'UK' },
  { id: 'bank', name: 'Bank Transfer', category: 'bank', region: 'International' },
  // International Payment Gateways
  { id: 'stripe', name: 'Stripe', category: 'gateway' },
  { id: 'wise', name: 'Wise (TransferWise)', category: 'gateway' },
  { id: 'payoneer', name: 'Payoneer', category: 'gateway' },
  { id: 'revolut', name: 'Revolut', category: 'gateway' },
  { id: 'worldremit', name: 'WorldRemit', category: 'gateway' },
  { id: 'ofx', name: 'OFX', category: 'gateway' },
  { id: 'remitly', name: 'Remitly', category: 'gateway' },
  { id: 'skrill', name: 'Skrill', category: 'gateway' },
  { id: 'neteller', name: 'Neteller', category: 'gateway' },
  { id: 'adyen', name: 'Adyen', category: 'gateway' },
  { id: 'checkout', name: 'Checkout.com', category: 'gateway' },
  { id: '2checkout', name: '2Checkout', category: 'gateway' },
  { id: 'authorize', name: 'Authorize.Net', category: 'gateway', region: 'US' },
  { id: 'razorpay', name: 'Razorpay', category: 'gateway', region: 'India' },
  { id: 'flutterwave', name: 'Flutterwave', category: 'gateway', region: 'Africa' },
  // Cash-Based / Vouchers
  { id: 'westernunion', name: 'Western Union', category: 'cash' },
  { id: 'moneygram', name: 'MoneyGram', category: 'cash' },
  { id: 'ria', name: 'Ria', category: 'cash' },
  { id: 'paysafecard', name: 'Paysafecard', category: 'cash' },
  { id: 'cod', name: 'Cash on Delivery (COD)', category: 'cash' },
  // Cryptocurrencies
  { id: 'bitcoin', name: 'Bitcoin (BTC)', category: 'crypto' },
  { id: 'ethereum', name: 'Ethereum (ETH)', category: 'crypto' },
  { id: 'usdt', name: 'Tether (USDT)', category: 'crypto' },
  { id: 'bnb', name: 'Binance Coin (BNB)', category: 'crypto' },
  { id: 'litecoin', name: 'Litecoin (LTC)', category: 'crypto' },
  { id: 'xrp', name: 'Ripple (XRP)', category: 'crypto' },
  { id: 'dogecoin', name: 'Dogecoin (DOGE)', category: 'crypto' },
  { id: 'cardano', name: 'Cardano (ADA)', category: 'crypto' },
  // Buy Now, Pay Later (BNPL)
  { id: 'klarna', name: 'Klarna', category: 'bnpl' },
  { id: 'afterpay', name: 'Afterpay', category: 'bnpl' },
  { id: 'affirm', name: 'Affirm', category: 'bnpl' },
  { id: 'zippay', name: 'Zip Pay', category: 'bnpl' },
  { id: 'tabby', name: 'Tabby', category: 'bnpl', region: 'Middle East' },
  { id: 'tamara', name: 'Tamara', category: 'bnpl', region: 'Middle East' },
  { id: 'hoolah', name: 'Hoolah', category: 'bnpl', region: 'Southeast Asia' },
  // Other
  { id: 'boleto', name: 'Boleto Bancário', category: 'bank', region: 'Brazil' },
  { id: 'konbini', name: 'Konbini', category: 'cash', region: 'Japan' },
  // Local / Manual Methods
  { id: 'handcash', name: 'Cash (In Person)', category: 'cash', region: 'Local', isEditable: false, description: 'Direct cash payment to landlord or office' },
  { id: 'cheque', name: 'Cheque Payment', category: 'cash', region: 'Local/Bank', isEditable: false, description: 'Paper cheque issued to payee' },
  { id: 'bankdeposit', name: 'Manual Bank Deposit', category: 'cash', region: 'Local', isEditable: false, description: 'Deposit cash at a local bank branch' },
  { id: 'mobilebanking', name: 'Local Mobile Banking', category: 'bank', region: 'Domestic', isEditable: false, description: 'Bank-owned mobile app transaction' },
  { id: 'localwallet', name: 'Local Digital Wallet', category: 'wallet', region: 'Domestic', isEditable: false, description: 'Region-specific digital wallet for transfers' },
  { id: 'moneyorder', name: 'Money Order', category: 'cash', region: 'International Postal', isEditable: false, description: 'Prepaid paper instrument for sending money' }
];

export const PAYMENT_FREQUENCIES: PaymentFrequency[] = [ { id: 'one-time', name: 'One-Time', duration: 'P0D', unit: 'one-time', isEditable: false }, { id: 'daily', name: 'Daily', duration: 'P1D', unit: 'day', isEditable: false }, { id: 'weekly', name: 'Weekly', duration: 'P1W', unit: 'week', isEditable: false }, { id: 'biweekly', name: 'Bi-Weekly', duration: 'P2W', unit: 'week', isEditable: false }, { id: 'monthly', name: 'Monthly', duration: 'P1M', unit: 'month', isEditable: false }, { id: 'bimonthly', name: 'Bi-Monthly', duration: 'P2M', unit: 'month', isEditable: false }, { id: 'quarterly', name: 'Quarterly', duration: 'P3M', unit: 'month', isEditable: false }, { id: 'semiannually', name: 'Semi-Annually', duration: 'P6M', unit: 'month', isEditable: false }, { id: 'annually', name: 'Annually', duration: 'P1Y', unit: 'year', isEditable: false }, ];
export const NOTICE_PERIOD_OPTIONS: NoticePeriod[] = [ { id: '7-days', label: '7 Days Notice', days: 7, description: 'Either party must give at least 7 days’ written notice before termination.', isEditable: false }, { id: '14-days', label: '14 Days Notice', days: 14, description: 'Either party must give at least 14 days’ written notice before ending the lease.', isEditable: false }, { id: '30-days', label: '30 Days Notice', days: 30, description: 'Standard notice period; required for most monthly rental agreements.', isEditable: false }, { id: '60-days', label: '60 Days Notice', days: 60, description: 'Typically used for longer-term leases; gives more time to find a new tenant or move out.', isEditable: false }, { id: '90-days', label: '90 Days Notice', days: 90, description: 'Applies to long-term or commercial leases; offers extended preparation period.', isEditable: false }, { id: 'no-notice', label: 'No Notice Required', days: 0, description: 'Immediate termination allowed without any advance notice (not recommended for standard leases).', isEditable: false } ];
export const BASE_SECURITY_DEPOSIT_OPTIONS: SecurityDeposit[] = [ { id: 'one-month', name: 'One Month Deposit', description: 'Equivalent to one month of rent, refundable upon lease end.', refundable: true, isEditable: false }, { id: 'two-months', name: 'Two Months Deposit', description: 'Equivalent to two months of rent, refundable upon lease end.', refundable: true, isEditable: false }, { id: 'percentage-10', name: '10% of Total Lease Amount', description: '10% of the lease total as a refundable deposit.', refundable: true, isEditable: false }, { id: 'fixed-1000', name: 'Fixed Amount: 1000', description: 'A fixed refundable deposit of 1000.', refundable: true, isEditable: false }, { id: 'fixed-500-nonrefundable', name: 'Fixed Non-Refundable: 500', description: 'A fixed non-refundable deposit of 500.', refundable: false, isEditable: false }, { id: 'no-deposit', name: 'No Deposit', description: 'No security deposit required.', refundable: false, isEditable: false }, ];
export const RENT_DUE_DATE_OPTIONS: RentDueDate[] = [ { id: 'first-of-month', label: '1st of Every Month', day: 1, description: 'Rent is due on the 1st day of each month.', offsetDays: 0, isEditable: false }, { id: 'fifth-of-month', label: '5th of Every Month', day: 5, description: 'Rent is due on the 5th day of each month.', offsetDays: 0, isEditable: false }, { id: 'mid-month', label: '15th of Every Month', day: 15, description: 'Rent is due on the 15th of each month.', offsetDays: 0, isEditable: false }, { id: 'end-of-month', label: 'End of Month', day: 31, description: 'Rent is due on the last day of each month.', offsetDays: 0, isEditable: false }, { id: 'after-invoice-5', label: '5 Days After Invoice', day: 0, offsetDays: 5, description: 'Rent is due 5 days after the invoice is generated.', isEditable: false }, { id: 'after-invoice-10', label: '10 Days After Invoice', offsetDays: 10, description: 'Rent is due 10 days after the invoice is generated.', day: 0, isEditable: false }, ];
export const LATE_PAYMENT_PENALTY_OPTIONS: LatePaymentPenalty[] = [ { label: 'Fixed Fee - LKR 1,000', type: 'fixed', value: 1000, description: 'A fixed penalty of LKR 1,000 will be charged for any late payment, regardless of the overdue amount or duration.', isEditable: false }, { label: 'Fixed Fee - LKR 5,000', type: 'fixed', value: 5000, description: 'A fixed penalty of LKR 5,000 will be applied for each late payment instance.', isEditable: false }, { label: 'Percentage - 5% of Due Amount', type: 'percentage', value: 5, description: 'A penalty equal to 5% of the overdue payment amount will be charged.', isEditable: false }, { label: 'Percentage - 10% of Due Amount', type: 'percentage', value: 10, description: 'A penalty of 10% of the outstanding amount will be applied for late payments.', isEditable: false }, { label: 'Per Day - LKR 200/day', type: 'per-day', value: 200, description: 'A penalty of LKR 200 will be charged for each day the payment remains overdue.', isEditable: false }, { label: 'Per Day - LKR 500/day', type: 'per-day', value: 500, description: 'A fee of LKR 500 will be applied for every day the payment is late.', isEditable: false }, ];

// ─────────────────────────────────────────────────────────────────────────────
// Complaints: literals & interfaces
// ─────────────────────────────────────────────────────────────────────────────
export type ComplaintStatus =
  | 'new' | 'triaged' | 'in_progress' | 'awaiting_tenant'
  | 'resolved' | 'closed' | 'reopened' | 'cancelled';
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ComplaintAudience = 'admin' | 'agent' | 'tenant' | 'owner'
  | 'operator' | 'manager' | 'developer' | 'user' | 'system' | 'all';
export type AttachmentSource = 'camera' | 'filesystem' | 'paste' | 'dragdrop';
export type ComplaintsCategory =
  | 'Plumbing' | 'Electrical' | 'Hvac' | 'Appliances' | 'Structural'
  | 'Doors Windows' | 'Security Safety' | 'Water Leak Damp' | 'Sanitation'
  | 'Internet Telecom' | 'Elevator Lift' | 'Pests Vermin' | 'Landscaping Garden'
  | 'Parking Garage' | 'Common Areas' | 'Access Keys Locks' | 'Cleaning Housekeeping'
  | 'Waste Management' | 'Painting Decor' | 'Gas Supply' | 'Noise Nuisance'
  | 'Renovation Work' | 'Other';

export const COMPLAINT_CATEGORIES: readonly ComplaintsCategory[] = [
  'Plumbing', 'Electrical', 'Hvac', 'Appliances', 'Structural', 'Doors Windows', 'Security Safety',
  'Water Leak Damp', 'Sanitation', 'Internet Telecom', 'Elevator Lift', 'Pests Vermin', 'Landscaping Garden',
  'Parking Garage', 'Common Areas', 'Access Keys Locks', 'Cleaning Housekeeping', 'Waste Management',
  'Painting Decor', 'Gas Supply', 'Noise Nuisance', 'Renovation Work', 'Other'
] as const;
export const COMPLAINT_PRIORITIES: readonly ComplaintPriority[] = [ 'high', 'low', 'medium', 'urgent' ];
export const COMPLAINT_STATUS: readonly ComplaintStatus[] = [ 'new', 'triaged', 'in_progress', 'awaiting_tenant', 'resolved', 'closed', 'reopened', 'cancelled' ] as const;

export interface ComplaintAttachmentClient {
  _id?: string; name: string; mimetype: string; size: number; url: string; width?: number; height?: number;
}
export interface PendingAttachmentClient { source: AttachmentSource; file: File; previewDataUrl?: string; }
export interface ComplaintCommentClient {
  _id?: string; byUserId: string; byName: string; image: string; audience: ComplaintAudience; message: string;
  createdAt: string; attachments?: ComplaintAttachmentClient[];
}
export interface ComplaintTimelineEventClient {
  _id?: string;
  at: string; // ID
  fromStatus?: ComplaintStatus; // OLD STATUS
  toStatus: ComplaintStatus; // NEW STATUS
  byUserId: string; // WHO DID
  note?: string; // NOTE
}
export interface ComplaintClient {
  _id?: string;
  code: string;
  tenantId: string;
  tenantName?: string;
  propertyId?: string;
  propertyName?: string;
  leaseId?: string;
  title: string;
  description: string;
  category: ComplaintsCategory;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  assigneeId?: string;
  assigneeName?: string;
  createdAt: string;
  updatedAt: string;
  dueAt?: string;
  attachments?: ComplaintAttachmentClient[];
  comments?: ComplaintCommentClient[];
  timeline?: ComplaintTimelineEventClient[];
}
export interface CreateComplaintPayload {
  tenantId: string; propertyId: string; leaseId: string; title: string; description: string;
  category: ComplaintsCategory; priority: ComplaintPriority;
  status?: ComplaintStatus; assigneeId?: string; dueAt?: string; code?: string;
  tenantName?: string; propertyName?: string; assigneeName?: string;
}

export type ComplaintSection = keyof ComplaintClient;

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────
@Injectable( { providedIn: 'root' } )
export class TenantService {
  /** Is the current platform a browser? (guards SSR/Electron) */
  private readonly isBrowser: boolean;

  // public variable
  public static readonly ONE_DAY_MS: number = 24 * 60 * 60 * 1000;

  /**
   * API roots (readonly):
   *  - `environment.apiOrigin`: '' (same-origin/proxy) or absolute origin (http/https).
   *  - Change once in environments; all endpoints update automatically.
   */
  private readonly API_LEASE_ROOT: string;
  private readonly API_TENANT_ROOT: string;
  private readonly API_FILE_TRANSFER_ROOT: string;

  /** Lease endpoints registry (readonly) */
  private readonly URLS_LEASE = {
    registerLease: ( leaseID: string ) => `${ this.API_LEASE_ROOT }/register/${ this.safeSeg( leaseID ) }`,
    leaseAgreementsByUser: ( username: string ) => `${ this.API_LEASE_ROOT }/lease-agreements/${ this.safeSeg( username ) }`,
    leaseAgreementById: ( leaseID: string ) => `${ this.API_LEASE_ROOT }/lease-agreement/${ this.safeSeg( leaseID ) }`,
    updateLeaseValidation: ( leaseID: string ) => `${ this.API_LEASE_ROOT }/lease-status-updated/${ this.safeSeg( leaseID ) }`,
    previewLease: ( leaseID: string ) => `${ this.API_LEASE_ROOT }/preview-lease-agreement/${ this.safeSeg( leaseID ) }`,
    leasePdf: ( leaseID: string, type: 'download' | 'view', generator: string ) =>
      `${ this.API_LEASE_ROOT }/lease-agreement-pdf/${ this.safeSeg( leaseID ) }/${ this.safeSeg( type ) }/${ this.safeSeg( generator ) }`,
    allLeases: () => `${ this.API_LEASE_ROOT }/all-leases`,
    updateLease: ( leaseID: string ) => `${ this.API_LEASE_ROOT }/update-lease-agreement/${ this.safeSeg( leaseID ) }`,
    leaseCount: () => `${ this.API_LEASE_ROOT }/get-lease-count `,
    tenantByUsername: ( username: string ) => `${ this.API_LEASE_ROOT }/get-tenant-by-username/${ this.safeSeg( username ) }`,
    propertiesWithoutLease: () => `${ this.API_LEASE_ROOT }/get-properties-that-does-not-have-lease`,
    propertiesCountWithoutLease: () => `${ this.API_LEASE_ROOT }/get-all-properties-count-without-leases`,
  } as const;

  /** Tenant endpoints registry (readonly) */
  private readonly URLS_TENANT = {
    insertTenant: () => `${ this.API_TENANT_ROOT }/insertTenant`,
    allTenants: () => `${ this.API_TENANT_ROOT }/get-all-tenants`,
    allTenantsWithPagination: () => `${ this.API_TENANT_ROOT }/get-all-tenants-with-pagination`,
    allTenantsCount: () => `${ this.API_TENANT_ROOT }/get-all-tenants-count`,
    allNoneTenantsWithPagination: () => `${ this.API_TENANT_ROOT }/get-all-none-tenants-with-pagination`,
    allNoneTenantsCount: () => `${ this.API_TENANT_ROOT }/get-all-none-tenants-count`,
    deleteTenant: ( username: string, deletor: string ) =>
      `${ this.API_TENANT_ROOT }/delete-tenant/${ this.safeSeg( username ) }/${ this.safeSeg( deletor ) }`
  } as const;

  /** File-transfer endpoints registry (readonly) */
  private readonly URLS_FILE = {
    tenantMobileUpload: ( token: string ) =>
      `${ this.API_FILE_TRANSFER_ROOT }/get-tenant-mobile-file-upload/${ this.safeSeg( token ) }`
  } as const;

  /** Complaint endpoints registry (readonly) */
  private readonly URLS_COMPLAINT = {
    create: () => `${ this.API_TENANT_ROOT }/create-complaint`,
    byId: ( complaintID: string ) => `${ this.API_TENANT_ROOT }/complaint/${ this.safeSeg( complaintID ) }`,
    byTenant: ( username: string ) => `${ this.API_TENANT_ROOT }/complaints/tenant/${ this.safeSeg( username ) }`,
    countByTenant: ( username: string ) => `${ this.API_TENANT_ROOT }/complaints-count/tenant/${ this.safeSeg( username ) }`,
    allComplaints: () => `${ this.API_TENANT_ROOT }/complaints/all`,
    allComplaintsCount: () => `${ this.API_TENANT_ROOT }/complaints-count/all`,
    allComplaintsBySection: ( section: ComplaintSection ) => `${ this.API_TENANT_ROOT }/complaints-by-section/all/${ section }`,
    postComment: () => `${ this.API_TENANT_ROOT }/complaints/post-comments`,
  } as const;

  constructor (
    @Inject( PLATFORM_ID ) platformId: Object,
    private readonly http: HttpClient
  ) {
    this.isBrowser = isPlatformBrowser( platformId );

    // IMPORTANT:
    // environment.apiOrigin examples:
    //   ''                         -> same-origin (or via Angular dev proxy)
    //   'http://localhost:3000'    -> talk directly to local backend
    //   'https://api.propease.app' -> production API
    const ORIGIN = ( environment.apiOrigin ?? 'http://localhost:3000' ).replace( /\/+$/, '' );;

    this.API_LEASE_ROOT = `${ ORIGIN }/api-lease`;
    this.API_TENANT_ROOT = `${ ORIGIN }/api-tenant`;
    this.API_FILE_TRANSFER_ROOT = `${ ORIGIN }/api-file-transfer`;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Type guards & helpers
  // ───────────────────────────────────────────────────────────────────────────
  public isTenantArray( data: unknown ): data is TenantTableElement[] {
    if ( !Array.isArray( data ) ) return false;
    return data.every( ( item ) => {
      const i = item as Partial<TenantTableElement>;
      const imgOk =
        typeof i.image === 'string' ||
        ( typeof File !== 'undefined' && i.image instanceof File ) ||
        typeof i.image === 'undefined';
      return (
        typeof i.name === 'string' &&
        typeof i.email === 'string' &&
        typeof i.gender === 'string' &&
        imgOk &&
        ( typeof i.username === 'string' || typeof i.username === 'undefined' ) &&
        ( typeof i.contactNumber === 'string' || typeof i.contactNumber === 'undefined' ) &&
        ( typeof i.addedBy === 'string' || typeof i.addedBy === 'undefined' )
      );
    } );
  }
  public formatRentDueDateFormat( option: RentDueDate ): string {
    if ( typeof option.day === 'number' && option.day > 0 ) {
      return `Due on the ${ option.day }${ this.ordinalSuffix( option.day ) } of every month`;
    }
    if ( typeof option.offsetDays === 'number' ) {
      return `Due ${ option.offsetDays } day(s) after invoice`;
    }
    return 'Custom due date';
  }
  private ordinalSuffix( n: number ): string {
    if ( n > 3 && n < 21 ) return 'th';
    switch ( n % 10 ) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
  }
  public isValidComplaintCategory( category: string ): category is ComplaintsCategory {
    return ( COMPLAINT_CATEGORIES as readonly string[] ).includes( category );
  }
  public isValidComplaintPriority( priority: string ): priority is ComplaintPriority {
    return [ 'low', 'medium', 'high', 'urgent' ].includes( priority );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private utils
  // ───────────────────────────────────────────────────────────────────────────
  private safeSeg( value: string ): string { return encodeURIComponent( ( value || '' ).trim() ); }

  private toParams( record: Record<string, string | number | boolean | undefined | null> ): HttpParams {
    let p = new HttpParams();
    Object.entries( record ).forEach( ( [ k, v ] ) => { if ( v != null ) p = p.set( k, String( v ) ); } );
    return p;
  }

  private mapError( e: unknown ): MSG {
    const fallback: MSG = { success: false, status: 'error', message: 'Unexpected error', data: e as any };
    if ( typeof e === 'string' ) return { success: false, status: 'error', message: e, data: null };
    if ( e && typeof e === 'object' ) {
      const anyE = e as { error?: any; message?: string; };
      if ( anyE?.error && typeof anyE.error === 'object' ) {
        const emsg = ( anyE.error as any ).message || anyE.message || 'Request failed';
        return { success: false, status: 'error', message: emsg, data: anyE.error };
      }
      if ( anyE?.message ) return { success: false, status: 'error', message: anyE.message, data: null };
    }
    return fallback;
  }

  private normalizeToMSG( raw: unknown ): MSG {
    const r = raw as { success?: boolean; status?: string; message?: string; data?: unknown; };
    if ( typeof r?.message === 'string' ) {
      const status = typeof r.success === 'boolean'
        ? ( r.success ? 'success' : 'error' )
        : ( typeof r.status === 'string' ? r.status : 'success' );
      return { success: r.success ?? false, status: r.status?.toLowerCase() === 'success' ? 'success' : 'error', message: r.message, data: ( r.data ?? null ) as any };
    }
    return { success: true, status: 'success', message: 'OK', data: raw as any };
  }
  public asDate( value: string | Date | null | undefined ): Date | null {
    if ( !value ) {
      return null;
    }
    if ( value instanceof Date ) {
      return value;
    }
    const parsed: Date = new Date( value );
    return Number.isNaN( parsed.getTime() ) ? null : parsed;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lease API
  // ───────────────────────────────────────────────────────────────────────────
  public async registerLeaseAgreement( data: FormData, leaseID: string ): Promise<MSG> {
    try { return await firstValueFrom( this.http.post<MSG>( this.URLS_LEASE.registerLease( leaseID ), data ) ); }
    catch ( e ) { return this.mapError( e ); }
  }
  public async getAllLeaseAgreementsByUsername( username: string ): Promise<MSG> {
    try { return await firstValueFrom( this.http.get<MSG>( this.URLS_LEASE.leaseAgreementsByUser( username ) ) ); }
    catch ( e ) { return this.mapError( e ); }
  }
  public async getLeaseAgreementByLeaseID( leaseID: string ): Promise<MSG> {
    try { return await firstValueFrom( this.http.get<MSG>( this.URLS_LEASE.leaseAgreementById( leaseID ) ) ); }
    catch ( e ) { return this.mapError( e ); }
  }
  public async getLeaseAgreementByIDAndUpdateValidationStatus( formData: FormData, leaseID: string ): Promise<MSG> {
    try { return await firstValueFrom( this.http.put<MSG>( this.URLS_LEASE.updateLeaseValidation( leaseID ), formData ) ); }
    catch ( e ) { return this.mapError( e ); }
  }
  public async setupEjsPreview( leaseID: string ): Promise<MSG> {
    try { return await firstValueFrom( this.http.get<MSG>( this.URLS_LEASE.previewLease( leaseID ) ) ); }
    catch ( e ) { return this.mapError( e ); }
  }
  public async downloadLeaseAgreement( leaseID: string, type: 'download' | 'view', generator: string ): Promise<Blob> {
    return await firstValueFrom( this.http.get( this.URLS_LEASE.leasePdf( leaseID, type, generator ), { responseType: 'blob' } ) );
  }
  public async getTenantByUsername( username: string ): Promise<MSG> {
    try { return await firstValueFrom( this.http.get<MSG>( this.URLS_LEASE.tenantByUsername( username ) ) ); }
    catch ( e ) { return this.mapError( e ); }
  }
  public async getAllLeases( start: number, limit: number, search?: string ): Promise<MSG> {
    try {
      const params: HttpParams = this.toParams( { start, limit, search } );

      const result: MSG = await firstValueFrom(
        this.http.get<MSG>( this.URLS_LEASE.allLeases(), { params } )
      );

      return result;
    } catch ( error: unknown ) {
      return this.mapError( error );
    }
  }
  public async getLeaseCount(): Promise<MSG> {
    try {

      const result: MSG = await firstValueFrom(
        this.http.get<MSG>( this.URLS_LEASE.leaseCount() )
      );

      return result;
    } catch ( error: unknown ) {
      return this.mapError( error );
    }
  }
  public async updateLeaseAgreement( formData: FormData, leaseID: string ): Promise<MSG> {
    try { return await firstValueFrom( this.http.put<MSG>( this.URLS_LEASE.updateLease( leaseID ), formData ) ); }
    catch ( e ) { return this.mapError( e ); }
  }

  public async getAllPropertiesWithoutLeases( start: number, limit: number, search?: string ): Promise<MSG> {
    try {
      const params: HttpParams = this.toParams( { start, limit, search } );

      const result: MSG = await firstValueFrom(
        this.http.get<MSG>( this.URLS_LEASE.propertiesWithoutLease(), { params } )
      );

      return result;
    } catch ( error: unknown ) {
      return this.mapError( error );
    }
  }

  public async getAllPropertiesCountWithoutLeases(): Promise<MSG> {
    try {
      const result: MSG = await firstValueFrom(
        this.http.get<MSG>( this.URLS_LEASE.propertiesCountWithoutLease() )
      );

      return result;
    } catch ( error: unknown ) {
      return this.mapError( error );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Tenants API (refactored: no hard-coded localhost)
  // ───────────────────────────────────────────────────────────────────────────
  public async insertTenant( data: FormData ): Promise<MSG> {
    try { return await firstValueFrom( this.http.post<MSG>( this.URLS_TENANT.insertTenant(), data ) ); }
    catch ( e ) { return this.mapError( e ); }
  }
  public async getAllTenants(): Promise<MSG> {
    try { return await firstValueFrom( this.http.get<MSG>( this.URLS_TENANT.allTenants() ) ); }
    catch ( e ) { return this.mapError( e ); }
  }
  public async getAllTenantsCount(): Promise<MSG> {
    try { return await firstValueFrom( this.http.get<MSG>( this.URLS_TENANT.allTenantsCount() ) ); }
    catch ( e ) { return this.mapError( e ); }
  }
  public async getAllTenantsWithPagination( start: number, limit: number, search?: string ): Promise<MSG> {
    try {
      const params: HttpParams = this.toParams( { start, limit, search } );
      return await firstValueFrom( this.http.get<MSG>( this.URLS_TENANT.allTenantsWithPagination(), { params } ) );
    }
    catch ( e ) { return this.mapError( e ); }
  }
  public async getAllNoneTenantsWithPagination( start: number, limit: number, search?: string ): Promise<MSG> {
    try {
      const params: HttpParams = this.toParams( { start, limit, search } );
      return await firstValueFrom( this.http.get<MSG>( this.URLS_TENANT.allNoneTenantsWithPagination(), { params } ) );
    }
    catch ( e ) { return this.mapError( e ); }
  }
  public async getAllNoneTenantsCount(): Promise<MSG> {
    try { return await firstValueFrom( this.http.get<MSG>( this.URLS_TENANT.allNoneTenantsCount() ) ); }
    catch ( e ) { return this.mapError( e ); }
  }
  public async deleteTenant( username: string, deletor: string ): Promise<MSG> {
    try { return await firstValueFrom( this.http.delete<MSG>( this.URLS_TENANT.deleteTenant( username, deletor ) ) ); }
    catch ( e ) { return this.mapError( e ); }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // File Transfer API (refactored)
  // ───────────────────────────────────────────────────────────────────────────
  public async getTenantMobileFileUpload( token: string, data: FormData ): Promise<MSG> {
    try { return await firstValueFrom( this.http.post<MSG>( this.URLS_FILE.tenantMobileUpload( token ), data ) ); }
    catch ( e ) { return this.mapError( e ); }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Complaints API
  // ───────────────────────────────────────────────────────────────────────────
  private buildCreateComplaintFormData( payload: CreateComplaintPayload, attachments: File[] ): FormData {
    const normalized: CreateComplaintPayload = {
      ...payload,
      tenantId: ( payload.tenantId || '' ).trim(),
      propertyId: ( payload.propertyId || '' ).trim(),
      leaseId: ( payload.leaseId || '' ).trim(),
      title: ( payload.title || '' ).trim(),
      description: ( payload.description || '' ).trim(),
      category: payload.category,
      priority: payload.priority,
      status: payload.status || undefined,
      assigneeId: payload.assigneeId?.trim() || undefined,
      dueAt: payload.dueAt?.trim() || undefined,
      code: payload.code?.trim() || undefined,
      tenantName: payload.tenantName?.trim() || undefined,
      propertyName: payload.propertyName?.trim() || undefined,
      assigneeName: payload.assigneeName?.trim() || undefined,
    };
    const form = new FormData();
    form.set( 'data', JSON.stringify( normalized ) );
    form.set( 'attachmentCount', String( attachments.length ) );
    for ( const f of attachments ) form.append( 'attachments', f, f.name );
    return form;
  }
  public async createComplaint( payload: CreateComplaintPayload, attachments: File[] = [] ): Promise<MSG> {
    try {
      if ( !payload.tenantId?.trim() ) return { success: false, status: 'error', message: 'tenantId is required', data: null };
      if ( !payload.propertyId?.trim() ) return { success: false, status: 'error', message: 'propertyId is required', data: null };
      if ( !payload.leaseId?.trim() ) return { success: false, status: 'error', message: 'leaseId is required', data: null };
      if ( !payload.title?.trim() ) return { success: false, status: 'error', message: 'title is required', data: null };
      if ( !payload.description?.trim() ) return { success: false, status: 'error', message: 'description is required', data: null };
      if ( !this.isValidComplaintCategory( payload.category ) ) return { success: false, status: 'error', message: 'Invalid category', data: null };
      if ( !this.isValidComplaintPriority( payload.priority ) ) return { success: false, status: 'error', message: 'Invalid priority', data: null };

      const resp = await firstValueFrom( this.http.post<MSG>( this.URLS_COMPLAINT.create(), this.buildCreateComplaintFormData( payload, attachments ) ) );
      return this.normalizeToMSG( resp );
    } catch ( e ) {
      return this.mapError( e );
    }
  }
  public async getComplaintById( complaintID: string ): Promise<MSG> {
    try { return this.normalizeToMSG( await firstValueFrom( this.http.get<MSG>( this.URLS_COMPLAINT.byId( complaintID ) ) ) ); }
    catch ( e ) { return this.mapError( e ); }
  }

  public async getTotalCountOfComplaintsByTenant( username: string ): Promise<MSG> {
    try {
      return this.normalizeToMSG( await firstValueFrom( this.http.get<MSG>( this.URLS_COMPLAINT.countByTenant( username ) ) ) );
    }
    catch ( e ) { return this.mapError( e ); }
  }
  public async getAllComplaintsByTenant( username: string, start: number, limit: number, search?: string ): Promise<MSG> {
    try {
      const params = this.toParams( { start, limit, search } );
      return this.normalizeToMSG( await firstValueFrom( this.http.get<MSG>( this.URLS_COMPLAINT.byTenant( username ), { params } ) ) );
    }
    catch ( e ) { return this.mapError( e ); }
  }
  public async getAllComplaints( start: number, limit: number, search?: string ): Promise<MSG> {
    const params = this.toParams( { start, limit, search } );
    try { return this.normalizeToMSG( await firstValueFrom( this.http.get<MSG>( this.URLS_COMPLAINT.allComplaints(), { params } ) ) ); }
    catch ( e ) { return this.mapError( e ); }
  }
  public async getAllComplaintsCount(): Promise<MSG> {
    try { return this.normalizeToMSG( await firstValueFrom( this.http.get<MSG>( this.URLS_COMPLAINT.allComplaintsCount() ) ) ); }
    catch ( e ) { return this.mapError( e ); }
  }
  public async getAllComplaintsBySection( section: ComplaintSection ): Promise<MSG> {
    try { return this.normalizeToMSG( await firstValueFrom( this.http.get<MSG>( this.URLS_COMPLAINT.allComplaintsBySection( section ) ) ) ); }
    catch ( e ) { return this.mapError( e ); }
  }
  public async postComment( data: FormData ): Promise<MSG> {
    try { return this.normalizeToMSG( await firstValueFrom( this.http.post<MSG>( this.URLS_COMPLAINT.postComment(), data ) ) ); }
    catch ( e ) { return this.mapError( e ); }
  }
}
