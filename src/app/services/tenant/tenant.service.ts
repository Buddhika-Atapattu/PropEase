import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';

export interface MSG {
  status: string;
  message: string;
  data: any;
}

export interface TenantTableElement {
  username?: string;
  name: string;
  image: string | File | undefined;
  contactNumber: string | undefined;
  email: string;
  gender: string;
  addedBy?: string;
}

export interface ActionButtonType {
  type: 'add' | 'delete' | 'remove' | 'view';
}

export interface CustomTableColumn {
  key: string;
  label: string;
}

export interface Address {
  houseNumber: string;
  street?: string;
  city: string;
  stateOrProvince?: string;
  postalCode: string;
  country: string;
}

export interface EmergencyContact {
  name: string;
  relationship?: string;
  contact: string;
}

export interface CoTenant {
  fullName: string;
  email: string;
  phoneNumber: string;
  gender: string;
  nicOrPassport: string;
  age: number;
  relationship: string;
  idDocumentUrl: string;
}

export interface TenantInformation {
  fullName: string;
  nicOrPassport: string;
  gender: string;
  nationality: string;
  dateOfBirth: string; // ISO format: YYYY-MM-DD
  phoneNumber: string;
  email: string;
  permanentAddress: Address;
  emergencyContact: EmergencyContact;
  idDocumentUrl?: string;
  uploadedIdDocumentUrl?: string;
}

export interface PropertyInformation {
  propertyId: string;
  address: Address;
  propertyType: 'Apartment' | 'House' | 'Commercial' | 'Studio' | string;
  furnishingStatus: 'Furnished' | 'Unfurnished' | 'Semi-Furnished' | string;
  includedAmenities: string[];
  parkingSpots: number;
}


export interface CurrencyFormat {
  country: string;
  symbol: any;
  flags: {
    png: string; // PNG flag image URL
    svg: string; // SVG flag image URL
    alt?: string; // Description of the flag
  };
  currency: string;
}

export interface LeaseAgreement {
  startDate: Date; // ISO format
  endDate: Date;
  durationMonths: number;
  monthlyRent: number;
  currency: CurrencyFormat;
  paymentFrequency: PaymentMethodFormat;
  paymentMethod: PaymentMethodFormat;
  securityDeposit: SecurityDepositFormat;
  rentDueDate: RentDueDateFormat; // e.g., 5th of each month
  latePaymentPenalty: LatePaymentPenaltyFormat; // e.g., "LKR 500 per day"
  utilityResponsibilities: UtilityResponsibilityFormat;
  noticePeriodDays: NoticePeriodFormat;
}

export interface RulesAndRegulations {
  rule: string;
  description: string;
  isEditable?: boolean;
}

export const DEFAULT_RULES_AND_REGULATIONS: RulesAndRegulations[] = [
  {
    rule: 'Timely Rent Payment',
    description:
      'The tenant must pay the rent on or before the due date each month. Late payments may incur penalties as outlined in the lease agreement.',
  },
  {
    rule: 'Property Maintenance',
    description:
      'The tenant shall keep the premises clean and in good condition, and shall promptly notify the landlord of any damage or maintenance issues.',
  },
  {
    rule: 'No Unauthorized Alterations',
    description:
      'The tenant shall not make any structural changes, paint, or install fixtures without prior written consent from the landlord.',
  },
  {
    rule: 'Occupancy Limit',
    description:
      'Only the individuals listed in the lease agreement may reside on the property. Subleasing or allowing additional occupants without approval is prohibited.',
  },
  {
    rule: 'Noise and Disturbance',
    description:
      'The tenant shall not cause or permit any nuisance or disturbance that interferes with the peaceful enjoyment of neighbors or other tenants.',
  },
  {
    rule: 'Pets Policy',
    description:
      'No pets are allowed on the premises unless explicitly permitted in the lease agreement. If allowed, pets must not cause damage or disturbances.',
  },
  {
    rule: 'Use of Premises',
    description:
      'The property shall be used solely for residential purposes. Commercial or illegal activities are strictly prohibited.',
  },
  {
    rule: 'End of Lease Condition',
    description:
      'The tenant must return the property in the same condition as it was at the start of the lease, minus normal wear and tear.',
  },
  {
    rule: 'Utilities Responsibility',
    description:
      'The tenant is responsible for paying all utility bills unless otherwise stated in the lease agreement.',
  },
  {
    rule: 'Entry by Landlord',
    description:
      'The landlord may enter the premises for inspections, repairs, or emergencies with proper notice, typically 24 hours in advance unless in emergencies.',
  },
];


export const DEFAULT_COMPANY_POLICY: string = `
<div class="company-policy">
  <h2>PropEase – Company Policies</h2>

  <ol>
    <li>
      <strong>Professional Conduct</strong>
      <p>
        All PropEase employees, partners, tenants, and landlords are expected to maintain professional behavior and communicate respectfully. Discrimination, harassment, or abusive language of any kind will not be tolerated.
      </p>
    </li>
    <li>
      <strong>Fair Housing Compliance</strong>
      <p>
        PropEase is committed to upholding equal opportunity housing practices. We strictly follow all local and international housing laws and do not discriminate based on race, religion, gender, age, marital status, disability, or nationality.
      </p>
    </li>
    <li>
      <strong>Tenant Screening & Verification</strong>
      <p>
        All prospective tenants will undergo standard verification, including background, credit, employment, and reference checks to ensure a secure and trustworthy rental environment for all parties.
      </p>
    </li>
    <li>
      <strong>Property Maintenance Policy</strong>
      <p>
        Landlords are responsible for major property repairs, while tenants must handle basic cleanliness and minor upkeep. Emergency repairs must be reported immediately via the PropEase platform or hotline.
      </p>
    </li>
    <li>
      <strong>Late Payment & Penalties</strong>
      <p>
        Rent is due on the specified date in the lease agreement. Late payments may incur a penalty fee based on predefined lease terms. Continuous defaults may lead to legal action or lease termination.
      </p>
    </li>
    <li>
      <strong>Use of Premises</strong>
      <p>
        Properties listed through PropEase must be used for residential or commercial purposes only, as stated in the lease. Illegal activities or unauthorized subletting are grounds for immediate action.
      </p>
    </li>
    <li>
      <strong>Privacy & Data Protection</strong>
      <p>
        PropEase values user privacy. All data shared on our platform is protected under our privacy policy and will not be shared without consent, except where legally required.
      </p>
    </li>
    <li>
      <strong>Inspection & Entry</strong>
      <p>
        Landlords must provide at least 24 hours' notice before entering a rented property unless there is an emergency. Inspections will be documented and scheduled through PropEase.
      </p>
    </li>
    <li>
      <strong>Termination & Eviction Policy</strong>
      <p>
        Lease termination must follow proper notice periods as outlined in the lease. In case of violations (e.g., unpaid rent, property damage), PropEase reserves the right to initiate legal eviction processes in accordance with governing laws.
      </p>
    </li>
    <li>
      <strong>Customer Support</strong>
      <p>
        Our support team is available 24/7 to address complaints, resolve disputes, and ensure fair practices are upheld. Users can contact us via the PropEase platform, email, or hotline.
      </p>
    </li>
  </ol>
</div>
`;

export interface Signatures {
  tenantSignature: File;
  landlordSignature: File;
  signedAt: Date; // ISO timestamp
  ipAddress: string;
  userAgent: string;
}

export interface SystemMetadata {
  ocrAutoFillStatus: boolean;
  validationStatus: 'Pending' | 'Validated' | 'Rejected' | string;
  language: string;
  leaseTemplateVersion: string;
  pdfDownloadUrl?: string;
  lastUpdated: string; // ISO timestamp
}

export interface PaymentMethodFormat {
  id: string; // Unique identifier
  name: string; // Display name
  category: 'card' | 'wallet' | 'bank' | 'gateway' | 'cash' | 'crypto' | 'bnpl';
  region?: string; // Optional region or origin (e.g., EU, US, Asia)
  supported?: boolean; // Can be used to toggle availability
  isEditable?: boolean; // Optional flag to indicate if this method can be edited
  description?: string; // Optional description for additional context
}

export const PAYMENT_METHODS: PaymentMethodFormat[] = [
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

export interface PaymentFrequencyFormat {
  id: string; // Unique identifier
  name: string; // Human-readable label
  duration: string; // ISO-like duration string (e.g., "P1M" = 1 month)
  unit: string;
  isEditable?: boolean; // Optional flag to indicate if this frequency can be edited
}

export const PAYMENT_FREQUENCIES: PaymentFrequencyFormat[] = [
  {
    id: 'one-time',
    name: 'One-Time',
    duration: 'P0D',
    unit: 'one-time',
    isEditable: false,
  },
  {
    id: 'daily',
    name: 'Daily',
    duration: 'P1D',
    unit: 'day',
    isEditable: false,
  },
  {
    id: 'weekly',
    name: 'Weekly',
    duration: 'P1W',
    unit: 'week',
    isEditable: false,
  },
  {
    id: 'biweekly',
    name: 'Bi-Weekly',
    duration: 'P2W',
    unit: 'week',
    isEditable: false,
  },
  {
    id: 'monthly',
    name: 'Monthly',
    duration: 'P1M',
    unit: 'month',
    isEditable: false,
  },
  {
    id: 'bimonthly',
    name: 'Bi-Monthly',
    duration: 'P2M',
    unit: 'month',
    isEditable: false,
  },
  {
    id: 'quarterly',
    name: 'Quarterly',
    duration: 'P3M',
    unit: 'month',
    isEditable: false,
  },
  {
    id: 'semiannually',
    name: 'Semi-Annually',
    duration: 'P6M',
    unit: 'month',
    isEditable: false,
  },
  {
    id: 'annually',
    name: 'Annually',
    duration: 'P1Y',
    unit: 'year',
    isEditable: false,
  },
];


export interface SecurityDepositFormat {
  id: string;
  name: string;
  description: string;
  refundable: boolean;
  isEditable?: boolean;
}

export const BASE_SECURITY_DEPOSIT_OPTIONS: SecurityDepositFormat[] = [
  {
    id: 'one-month',
    name: 'One Month Deposit',
    description: 'Equivalent to one month of rent, refundable upon lease end.',
    refundable: true,
    isEditable: false,
  },
  {
    id: 'two-months',
    name: 'Two Months Deposit',
    description: 'Equivalent to two months of rent, refundable upon lease end.',
    refundable: true,
    isEditable: false,
  },
  {
    id: 'percentage-10',
    name: '10% of Total Lease Amount',
    description: '10% of the lease total as a refundable deposit.',
    refundable: true,
    isEditable: false,
  },
  {
    id: 'fixed-1000',
    name: 'Fixed Amount: 1000',
    description: 'A fixed refundable deposit of 1000.',
    refundable: true,
    isEditable: false,
  },
  {
    id: 'fixed-500-nonrefundable',
    name: 'Fixed Non-Refundable: 500',
    description: 'A fixed non-refundable deposit of 500.',
    refundable: false,
    isEditable: false,
  },
  {
    id: 'no-deposit',
    name: 'No Deposit',
    description: 'No security deposit required.',
    refundable: false,
    isEditable: false,
  },
];

export interface RentDueDateFormat {
  id: string;
  label: string;
  day?: number; // e.g., 1 for 1st of the month
  offsetDays?: number; // e.g., 5 for "5 days after invoice"
  description?: string;
  isEditable?: boolean; // Optional flag to indicate if this due date can be edited
}

export const RENT_DUE_DATE_OPTIONS: RentDueDateFormat[] = [
  {
    id: 'first-of-month',
    label: '1st of Every Month',
    day: 1,
    description: 'Rent is due on the 1st day of each month.',
    offsetDays: 0,
    isEditable: false,
  },
  {
    id: 'fifth-of-month',
    label: '5th of Every Month',
    day: 5,
    description: 'Rent is due on the 5th day of each month.',
    offsetDays: 0,
    isEditable: false,
  },
  {
    id: 'mid-month',
    label: '15th of Every Month',
    day: 15,
    description: 'Rent is due on the 15th of each month.',
    offsetDays: 0,
    isEditable: false,
  },
  {
    id: 'end-of-month',
    label: 'End of Month',
    day: 31,
    description: 'Rent is due on the last day of each month.',
    offsetDays: 0,
    isEditable: false,
  },
  {
    id: 'after-invoice-5',
    label: '5 Days After Invoice',
    day: 0,
    offsetDays: 5,
    description: 'Rent is due 5 days after the invoice is generated.',
    isEditable: false,
  },
  {
    id: 'after-invoice-10',
    label: '10 Days After Invoice',
    offsetDays: 10,
    description: 'Rent is due 10 days after the invoice is generated.',
    day: 0,
    isEditable: false,
  },
];

export interface LatePaymentPenaltyFormat {
  label: string; // Displayed label in UI
  type: 'fixed' | 'percentage' | 'per-day'; // Type of penalty calculation
  value: number; // Amount, %, or per-day fee
  description: string; // Explanation for user/admin
  isEditable?: boolean;
}

export const LATE_PAYMENT_PENALTY_OPTIONS: LatePaymentPenaltyFormat[] = [
  {
    label: 'Fixed Fee - LKR 1,000',
    type: 'fixed',
    value: 1000,
    description:
      'A fixed penalty of LKR 1,000 will be charged for any late payment, regardless of the overdue amount or duration.',
  },
  {
    label: 'Fixed Fee - LKR 5,000',
    type: 'fixed',
    value: 5000,
    description:
      'A fixed penalty of LKR 5,000 will be applied for each late payment instance.',
  },
  {
    label: 'Percentage - 5% of Due Amount',
    type: 'percentage',
    value: 5,
    description:
      'A penalty equal to 5% of the overdue payment amount will be charged.',
  },
  {
    label: 'Percentage - 10% of Due Amount',
    type: 'percentage',
    value: 10,
    description:
      'A penalty of 10% of the outstanding amount will be applied for late payments.',
  },
  {
    label: 'Per Day - LKR 200/day',
    type: 'per-day',
    value: 200,
    description:
      'A penalty of LKR 200 will be charged for each day the payment remains overdue.',
  },
  {
    label: 'Per Day - LKR 500/day',
    type: 'per-day',
    value: 500,
    description:
      'A fee of LKR 500 will be applied for every day the payment is late.',
  },
];

export interface UtilityResponsibilityFormat {
  id: string;
  utility: string; // e.g., "Electricity", "Water"
  paidBy: 'landlord' | 'tenant' | 'shared' | 'real estate company';
  description: string;
  isEditable?: boolean;
}

export interface NoticePeriodFormat {
  id: string;
  label: string;
  days: number; // Number of days required to give notice
  description: string;
}

export const NOTICE_PERIOD_OPTIONS: NoticePeriodFormat[] = [
  {
    id: '7-days',
    label: '7 Days Notice',
    days: 7,
    description:
      'Either party must give at least 7 days’ written notice before termination.',
  },
  {
    id: '14-days',
    label: '14 Days Notice',
    days: 14,
    description:
      'Either party must give at least 14 days’ written notice before ending the lease.',
  },
  {
    id: '30-days',
    label: '30 Days Notice',
    days: 30,
    description:
      'Standard notice period; required for most monthly rental agreements.',
  },
  {
    id: '60-days',
    label: '60 Days Notice',
    days: 60,
    description:
      'Typically used for longer-term leases; gives more time to find a new tenant or move out.',
  },
  {
    id: '90-days',
    label: '90 Days Notice',
    days: 90,
    description:
      'Applies to long-term or commercial leases; offers extended preparation period.',
  },
  {
    id: 'no-notice',
    label: 'No Notice Required',
    days: 0,
    description:
      'Immediate termination allowed without any advance notice (not recommended for standard leases).',
  },
];

export interface Lease {
  tenantInformation: TenantInformation;
  coTenants?: CoTenant[]; // Optional: empty if none
  propertyInformation: PropertyInformation;
  leaseAgreement: LeaseAgreement;
  rulesAndRegulations: RulesAndRegulations[];
  companyPolicy: string;
  signatures: Signatures;
  systemMetadata: SystemMetadata;
}

@Injectable({
  providedIn: 'root',
})
export class TenantService {
  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private http: HttpClient
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  public isTenantArray(
    data: TenantTableElement[]
  ): data is TenantTableElement[] {
    return (
      Array.isArray(data) &&
      data.every(
        (item) =>
          typeof item.username === 'string' &&
          typeof item.name === 'string' &&
          typeof item.email === 'string' &&
          typeof item.image === 'string' &&
          typeof item.contactNumber === 'string' &&
          typeof item.gender === 'string' &&
          typeof item.addedBy === 'string'
      )
    );
  }



  public formatRentDueDateFormat(option: RentDueDateFormat): string {
    if (option.day) {
      return `Due on the ${option.day}${this.ordinalSuffix(
        option.day
      )} of every month`;
    } else if (option.offsetDays !== undefined) {
      return `Due ${option.offsetDays} day(s) after invoice`;
    } else {
      return 'Custom due date';
    }
  }

  private ordinalSuffix(n: number): string {
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  }

  //<================================================= API =================================================>
  public async registerLeaseAgreement(
    data: FormData,
    leaseID: string
  ): Promise<MSG> {
    return await firstValueFrom(
      this.http.post<MSG>(
        `http://localhost:3000/api-lease/register/${leaseID}`,
        data
      )
    );
  }
}
