// Path (Frontend): src/app/services/auth/user.contract.ts
// ─────────────────────────────────────────────────────────────────────────────
//  USER CONTRACT (Frontend-safe)
// ─────────────────────────────────────────────────────────────────────────────
//  PURPOSE
//    • Single source of truth for the “User” domain contracts (BE + FE mirror).
//    • MUST remain framework-agnostic: NO Mongoose Document types here.
//    • Dates are represented as ISO strings in DTOs (safe for FE transport).
//    • No secrets/tokens are included in “Safe” DTOs.
//
//  RULES
//    • DB layer may use Date, ObjectId, enums, etc.
//    • API layer (DTOs) uses JSON-safe primitives: string, number, boolean, arrays.
//    • Keep this file stable: changes affect BOTH backend & frontend.
// ─────────────────────────────────────────────────────────────────────────────



/* ========================================================================== *
 *  PRIMITIVES
 * ========================================================================== */

/**
 * ISO 8601 Date string, used across all DTOs.
 *
 * Example:
 *   "2026-01-28T09:30:00.000Z"
 *
 * Why string?
 *   - JSON transports dates as strings anyway.
 *   - Avoids timezone / serialization bugs on FE.
 */
export type ISODateString = string;



/* ========================================================================== *
 *  ROLE DEFINITIONS
 * ========================================================================== */

/**
 * Role
 * ----
 * A strict union of all supported user roles in PropEase.
 *
 * Notes:
 *   - Use snake_case for machine keys (storage + API).
 *   - Convert to UI label using `UserRoleLabelHelper.toHuman()`.
 */
export type Role =
  | "executive"
  | "board"
  | "director"
  | "ceo"
  | "cfo"
  | "coo"
  | "cto"
  | "cio"
  | "admin"
  | "system"
  | "user"
  | "owner"
  | "tenant"
  | "agent"
  | "broker"
  | "landlord"
  | "leasing"
  | "leasing_manager"
  | "property_manager"
  | "facility_manager"
  | "estate_manager"
  | "operator"
  | "manager"
  | "lead"
  | "supervisor"
  | "captain"
  | "member"
  | "observer"
  | "finance"
  | "accountant"
  | "accounts_payable"
  | "accounts_receivable"
  | "billing"
  | "payroll"
  | "procurement"
  | "legal"
  | "compliance"
  | "auditor"
  | "hr"
  | "reception"
  | "customer_support"
  | "call_center"
  | "developer"
  | "qa"
  | "devops"
  | "it_support"
  | "data_analyst"
  | "mechanic"
  | "carpenter"
  | "electrician"
  | "plumber"
  | "technician"
  | "welder"
  | "driver"
  | "cleaner"
  | "security"
  | "gardener"
  | "painter"
  | "mason"
  | "helper"
  | "inspector"
  | "surveyor"
  | "visitor";



/**
 * DEFAULT_ROLES
 * -------------
 * Canonical role list used for dropdowns / validation / defaults.
 *
 * Notes:
 *   - This array is readonly and should match the Role union exactly.
 *   - Keep ordering intentional (leadership → system → operational → trades).
 */
export const DEFAULT_ROLES: readonly Role[] = [
  "executive",
  "board",
  "director",
  "ceo",
  "cfo",
  "coo",
  "cto",
  "cio",

  "admin",
  "system",
  "user",

  "owner",
  "tenant",
  "agent",
  "broker",
  "landlord",

  "leasing",
  "leasing_manager",
  "property_manager",
  "facility_manager",
  "estate_manager",

  "operator",
  "manager",
  "lead",
  "supervisor",
  "captain",
  "member",
  "observer",

  "finance",
  "accountant",
  "accounts_payable",
  "accounts_receivable",
  "billing",
  "payroll",
  "procurement",

  "legal",
  "compliance",
  "auditor",
  "hr",
  "reception",
  "customer_support",
  "call_center",

  "developer",
  "qa",
  "devops",
  "it_support",
  "data_analyst",

  "mechanic",
  "carpenter",
  "electrician",
  "plumber",
  "technician",
  "welder",
  "driver",
  "cleaner",
  "security",
  "gardener",
  "painter",
  "mason",
  "helper",
  "inspector",
  "surveyor",
  "visitor",
] as const;



/* ========================================================================== *
 *  ROLE LABELING (Human Readable)
 * ========================================================================== */

/**
 * RoleLabelDto
 * ------------
 * UI-friendly representation of roles (dropdowns etc.)
 */
export interface RoleLabelDto {
  /** Machine role key stored in DB / API (snake_case) */
  key: Role;

  /** Human readable label for UI ("Leasing Manager") */
  label: string;
}



/**
 * UserRoleLabelHelper
 * -------------------
 * Converts machine role keys into human readable labels.
 *
 * Features:
 *   1) Converts snake_case / kebab-case / mixed separators into spaces.
 *   2) Removes extra symbols safely.
 *   3) Title Cases each word ("accounts_payable" -> "Accounts Payable").
 *   4) Applies spelling + formatting corrections (acronyms, special phrases).
 *
 * This is intentionally PURE (no Angular / browser APIs).
 */
export class UserRoleLabelHelper {

  /**
   * WORD_FIXES
   * ----------
   * A normalization dictionary for:
   *   - common spelling mistakes
   *   - acronyms
   *   - preferred brand formatting
   *
   * Keys:
   *   - MUST be lowercase
   *   - MUST represent the normalized spaced string
   *
   * Examples:
   *   "devops"      -> "DevOps"
   *   "it support"  -> "IT Support"
   */
  private static readonly WORD_FIXES: Record<string, string> = {

    // ── Acronyms / casing ───────────────────────────────────────────────────
    "qa": "QA",
    "ui": "UI",
    "ux": "UX",
    "mfa": "MFA",
    "cio": "CIO",
    "cto": "CTO",
    "cfo": "CFO",
    "coo": "COO",
    "ceo": "CEO",
    "hr": "HR",
    "it": "IT",
    "devops": "DevOps",

    // ── Common spelling mistakes / variants ────────────────────────────────
    "superadmin": "Super Admin",
    "super admin": "Super Admin",
    "adminstrator": "Administrator",
    "administrater": "Administrator",

    // ── Preferred phrases ──────────────────────────────────────────────────
    "it support": "IT Support",
    "call center": "Call Center",
    "customer support": "Customer Support",
    "accounts payable": "Accounts Payable",
    "accounts receivable": "Accounts Receivable",
  };



  /**
   * generate()
   * ----------
   * Builds the dropdown list of roles with human readable labels.
   */
  public static generate(): RoleLabelDto[] {
    return DEFAULT_ROLES.map( ( role ) => ( {
      key: role,
      label: this.toHuman( role ),
    } ) );
  }



  /**
   * toHuman()
   * ---------
   * Converts a machine role key to a UI label.
   *
   * Input examples:
   *   "accounts_payable"   -> "Accounts Payable"
   *   "devops"             -> "DevOps"
   *   "it-support"         -> "IT Support"
   */
  public static toHuman( role: Role | string | null | undefined ): string {

    const raw = String( role ?? "" ).trim();
    if ( !raw ) return "";

    // Step 1:
    //   Normalize all separators and symbols into spaces, keep only letters/numbers.
    //
    //   Examples:
    //     "accounts_payable"   -> "accounts payable"
    //     "it-support"         -> "it support"
    //     "finance@admin!!"    -> "finance admin"
    const normalized = raw
      .replace( /[^a-zA-Z0-9]+/g, " " )
      .replace( /\s+/g, " " )
      .trim()
      .toLowerCase();

    if ( !normalized ) return "";

    // Step 2:
    //   If the whole phrase has a special formatting rule, apply it directly.
    const directFix = this.WORD_FIXES[ normalized ];
    if ( directFix ) return directFix;

    // Step 3:
    //   Title Case each word, applying per-word fixes when available.
    const words = normalized.split( " " );

    const titled = words
      .map( ( word ) => {

        // word-level acronym / formatting (e.g., "qa" -> "QA")
        const fixedWord = this.WORD_FIXES[ word ];
        if ( fixedWord ) return fixedWord;

        // default Title Case for normal words
        return word.charAt( 0 ).toUpperCase() + word.slice( 1 );

      } )
      .join( " " );

    // Step 4:
    //   Optional second pass for multi-word phrases after title casing.
    //   (Allows us to map "It Support" -> "IT Support", etc.)
    const titledLower = titled.toLowerCase();
    return this.WORD_FIXES[ titledLower ] ?? titled;
  }



  /**
   * normalizeKey()
   * --------------
   * Optional helper:
   * Converts a human label back into a safe snake_case key.
   *
   * Example:
   *   "Accounts Payable" -> "accounts_payable"
   */
  public static normalizeKey( label: string ): string {
    return String( label ?? "" )
      .trim()
      .toLowerCase()
      .replace( /[^a-z0-9]+/g, "_" )
      .replace( /_+/g, "_" )
      .replace( /^_+|_+$/g, "" );
  }
}



/* ========================================================================== *
 *  ADDRESS
 * ========================================================================== */

/**
 * UserCountryDto
 * --------------
 * Country object used in User address.
 *
 * Notes:
 *   - Keep this aligned with your country provider structure.
 *   - `image` is typically a local / CDN flag image path.
 */
export interface UserCountryDto {
  name: string;
  code: string;
  emoji: string;
  unicode: string;
  image: string;
}



/**
 * AddressDto
 * ----------
 * User address structure.
 *
 * Notes:
 *   - `country` can be omitted in older records, so it is optional.
 *   - `stateOrProvince` is optional for countries without states/provinces.
 */
export interface AddressDto {
  street: string;
  houseNumber: string;
  city: string;
  postcode: string;

  country?: UserCountryDto;

  stateOrProvince?: string;
}



/* ========================================================================== *
 *  ACCESS MAP
 * ========================================================================== */

/**
 * AccessModuleKey / AccessActionKey
 * --------------------------------
 * These are kept as string here to avoid coupling FE contracts to runtime lists.
 *
 * If you want strict typing:
 *   - Create FE mirror unions generated from ACCESS_OPTIONS.
 */
export type AccessModuleKey = string;
export type AccessActionKey = string;



/**
 * PermissionEntryDto
 * ------------------
 * Represents one module and its allowed action ids.
 *
 * Example:
 *   {
 *     module: "User Management",
 *     actions: ["create", "read", "update", "delete"]
 *   }
 */
export interface PermissionEntryDto {
  module: AccessModuleKey;
  actions: AccessActionKey[];
}



/**
 * RoleAccessMapDto
 * ----------------
 * Final access object stored against a user.
 */
export interface RoleAccessMapDto {
  role: Role;
  permissions: PermissionEntryDto[];
}



/* ========================================================================== *
 *  PHONE
 * ========================================================================== */

/**
 * CountryCodesDto
 * --------------
 * Country telephone code metadata.
 * Used inside PhoneNumberDto.
 */
export interface CountryCodesDto {
  name: string;
  code: string;

  flags: {
    png: string;
    svg: string;
    alt?: string;
  };
}



/**
 * PhoneNumberDto
 * --------------
 * Stored phone number shape.
 */
export interface PhoneNumberDto {
  code: CountryCodesDto;
  number: string;
}



/* ========================================================================== *
 *  SECURITY / PREFERENCES
 * ========================================================================== */

/**
 * UserLoginMetadataDto
 * --------------------
 * Login-related security metadata.
 *
 * Notes:
 *   - Safe for FE because it contains no secrets.
 *   - Helps UI show “account locked until …” style messages.
 */
export interface UserLoginMetadataDto {
  failedLoginAttempts: number;

  lastLoginAt?: ISODateString | null;
  lastFailedLoginAt?: ISODateString | null;
  lockedUntil?: ISODateString | null;
}



/**
 * UiTheme
 * -------
 * FE theme preference.
 */
export type UiTheme = "light" | "dark" | "system";



/**
 * UserPreferencesDto
 * ------------------
 * User’s UI/UX preferences.
 */
export interface UserPreferencesDto {
  theme: UiTheme;
  language: string;

  timeZone?: string | null;
  dateFormat?: string | null;

  // Messaging UX preferences
  autoDownloadMedia?: boolean;
  enterToSend?: boolean;

  lastSeenVisibility?: "everyone" | "contacts" | "nobody";
  profilePhotoVisibility?: "everyone" | "contacts" | "nobody";
  aboutVisibility?: "everyone" | "contacts" | "nobody";

  readReceiptsEnabled?: boolean;
}



/**
 * UserNotificationPreferencesDto
 * ------------------------------
 * Notification channel preferences.
 */
export interface UserNotificationPreferencesDto {
  email: boolean;
  inApp: boolean;
  push?: boolean;
}



/* ========================================================================== *
 *  PAYMENTS (References only)
 * ========================================================================== */

/**
 * PaymentCustomerProvider
 * -----------------------
 * External provider mapping (only references stored here).
 */
export type PaymentCustomerProvider =
  | "stripe"
  | "paypal"
  | "adyen"
  | "braintree"
  | "custom";



/**
 * UserPaymentProfileDto
 * ---------------------
 * Stores references to payment provider customer profiles.
 */
export interface UserPaymentProfileDto {
  provider: PaymentCustomerProvider;
  customerId: string;

  defaultCurrency: string;

  billingEmail?: string | null;

  defaultPaymentMethodRef?: string | null;
  paymentMethodRefs: string[];
}



/**
 * WalletBalanceDto
 * ----------------
 * Wallet balance by currency.
 */
export interface WalletBalanceDto {
  currency: string;
  available: number;
  pending: number;

  updatedAt?: ISODateString | null;
}



/**
 * UserWalletDto
 * -------------
 * Wallet capability state.
 */
export interface UserWalletDto {
  enabled: boolean;
  balances: WalletBalanceDto[];
}



/* ========================================================================== *
 *  CHAT / SOCIAL (Optional future-facing)
 * ========================================================================== */

/**
 * DevicePlatform
 * --------------
 * Which client platform the user device belongs to.
 */
export type DevicePlatform = "web" | "desktop" | "android" | "ios" | "other";



/**
 * UserDeviceDto
 * -------------
 * Known device entry (safe metadata only).
 */
export interface UserDeviceDto {
  deviceId: string;
  name: string;
  platform: DevicePlatform;

  appVersion?: string | null;

  lastSeenAt?: ISODateString | null;
  lastIp?: string | null;
  revokedAt?: ISODateString | null;
}



/**
 * RoomRole
 * --------
 * Membership role inside a chat room / group.
 */
export type RoomRole = "owner" | "admin" | "member" | "viewer";



/**
 * UserRoomMembershipDto
 * ---------------------
 * Room membership with local settings.
 */
export interface UserRoomMembershipDto {
  roomId: string;
  role: RoomRole;

  mutedUntil?: ISODateString | null;

  pinned: boolean;
  archived: boolean;

  nickname?: string | null;
  lastReadAt?: ISODateString | null;
}



/**
 * UserPrivacyDto
 * --------------
 * Privacy rules (safe preferences).
 */
export interface UserPrivacyDto {
  blockedUserIds: string[];

  allowMessagesFrom: "everyone" | "contacts" | "nobody";
  allowCallsFrom: "everyone" | "contacts" | "nobody";
  allowGroupAddsFrom: "everyone" | "contacts" | "nobody";
}



/**
 * PresenceState
 * -------------
 * Presence status values.
 */
export type PresenceState = "online" | "offline" | "away" | "dnd";



/**
 * UserPresenceDto
 * --------------
 * Presence state metadata.
 */
export interface UserPresenceDto {
  state: PresenceState;
  lastActiveAt?: ISODateString | null;
}



/**
 * UserSocialProfileDto
 * --------------------
 * Public profile details (safe).
 */
export interface UserSocialProfileDto {
  handle: string;
  displayName: string;

  about?: string | null;

  avatarUrl?: string | null;
  coverUrl?: string | null;

  isCreator: boolean;
  isPublicProfile: boolean;
}



/* ========================================================================== *
 *  USER DTOs
 * ========================================================================== */

/**
 * UserSafeDto
 * ----------
 * The SAFE user object that FE should receive.
 *
 * MUST NOT INCLUDE:
 *   - password hashes
 *   - OTP tokens
 *   - email verification tokens
 *   - MFA secrets
 *   - reset tokens
 */
export interface UserSafeDto {
  _id: string;

  // ── Identity ──────────────────────────────────────────────────────────────
  name: string;
  username: string;
  email: string;

  // ── Personal ──────────────────────────────────────────────────────────────
  dateOfBirth: ISODateString;
  age: number;
  gender: string;

  image?: string;
  phoneNumber?: PhoneNumberDto;

  bio: string;
  nationality: string;
  nicOrPassport: string;

  // ── Role & access ─────────────────────────────────────────────────────────
  role: Role;
  access: RoleAccessMapDto;

  // ── Address ───────────────────────────────────────────────────────────────
  address: AddressDto;

  // ── Status ────────────────────────────────────────────────────────────────
  isActive: boolean;

  // ── Verification states (safe) ────────────────────────────────────────────
  otpVerification: boolean;          // ✅ corrected spelling (was otpVerifycation)
  emailVerified: boolean;

  // ── MFA state (safe) ──────────────────────────────────────────────────────
  multiAuthEnabled: boolean;
  multiAuthActivatedAt?: ISODateString | null;

  // ── Admin fields (safe) ───────────────────────────────────────────────────
  autoDelete: boolean;
  creator: string;
  updator?: string;

  // ── Security metadata (safe) ──────────────────────────────────────────────
  loginMeta: UserLoginMetadataDto;

  // ── Preferences ───────────────────────────────────────────────────────────
  preferences: UserPreferencesDto;
  notificationPreferences: UserNotificationPreferencesDto;

  // ── Payments (refs only) ──────────────────────────────────────────────────
  paymentProfile: UserPaymentProfileDto;
  wallet: UserWalletDto;

  // ── Social / comms (optional) ─────────────────────────────────────────────
  devices: UserDeviceDto[];
  rooms: UserRoomMembershipDto[];
  privacy: UserPrivacyDto;
  presence: UserPresenceDto;
  socialProfile: UserSocialProfileDto;

  // ── Audit dates ───────────────────────────────────────────────────────────
  createdAt: ISODateString;
  updatedAt: ISODateString;
}



/**
 * UserMiniDto
 * -----------
 * Minimal user shape for:
 *   - chat lists
 *   - mentions
 *   - team member lists
 *
 * Keeps payload small vs UserSafeDto.
 */
export interface UserMiniDto {
  _id: string;

  name: string;
  username: string;

  image?: string;

  role: Role;

  presence?: UserPresenceDto;

  socialHandle?: string;
}
