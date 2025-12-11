// Path: src/app/types/common.ts

import type { MultiAuthData, User } from "../services/APIs/apis.service";

/** Standard ISO timestamp used across the system */
export type ISODateString = string;

/** Generic entity ID string */
export type EntityId = string;

/** Mongo ID string reference */
export type MongoIdString = string;

/** User-friendly display string */
export type DisplayText = string;


type MultiAuthDialogReason =
  | 'confirmed'          // backend polling confirmed
  | 'expired'
  | 'not_found'
  | 'activated_via_code' // user entered valid code
  | 'user_cancelled';

export interface MultiAuthDialogResult {
  success: boolean;
  reason: MultiAuthDialogReason;
  authData: MultiAuthData | null;
}


