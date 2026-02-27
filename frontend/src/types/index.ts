export type UserRole = "CITIZEN" | "POLICE";

export type RequestStatus =
  | "REPORTED"
  | "UNDER_REVIEW"
  | "SCANNING"
  | "FOUND"
  | "DECLINED"
  | "DISCARDED";

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface LastKnownLocation {
  latitude: number;
  longitude: number;
}

export interface MissingPersonRequest {
  _id: string;
  reporterId: string;
  name?: string;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup: string;
  lastKnownLocation: LastKnownLocation;
  photoUrl: string;
  status: RequestStatus;
  aadhaarNo?: string;
  phoneNumber?: string;
  address?: string;
  bountyAmount?: number;
  bountyStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export type ScanMatchStatus = "found" | "not_found" | "error";

export interface ScanResult {
  _id: string;
  requestId: string;
  cctvId: string;
  bestMatchImageUrl: string;
  confidenceScore: number;
  status: ScanMatchStatus;
  createdAt: string;
}

export interface PoliceNote {
  _id: string;
  requestId: string;
  policeUserId: string;
  note: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Tip {
  _id: string;
  requestId: string;
  message: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  contactInfo?: string;
  createdAt: string;
}

export type CaseEventAction =
  | "REPORT_CREATED"
  | "STATUS_CHANGED"
  | "DISCARDED"
  | "AADHAAR_FETCHED"
  | "SCAN_TRIGGERED"
  | "SCAN_COMPLETED"
  | "NOTE_ADDED"
  | "TIP_RECEIVED"
  | "DUPLICATE_DETECTED"
  | "BOUNTY_PAID"
  | "BOUNTY_AWARDED"
  | "BOUNTY_RELEASED";

export interface CaseEvent {
  _id: string;
  requestId: string;
  action: CaseEventAction;
  actor?: string;
  details?: string;
  createdAt: string;
}

export interface RequestDetail {
  request: MissingPersonRequest;
  notes: PoliceNote[];
  scans: ScanResult[];
  tips: Tip[];
  events: CaseEvent[];
}

// Duplicate detection
export type DuplicateMatchType = "FACE" | "AADHAAR" | "BOTH";
export type DuplicateSeverity = "CRITICAL" | "HIGH" | "MEDIUM";
export type DuplicateAlertStatus = "PENDING" | "DISMISSED" | "LINKED";

export interface DuplicateAlertRequest {
  _id: string;
  name?: string;
  photoUrl: string;
  status: RequestStatus;
  gender?: string;
  bloodGroup?: string;
  createdAt: string;
}

export interface DuplicateAlert {
  _id: string;
  newRequestId: string;
  existingRequestId: string;
  score: number;
  matchType: DuplicateMatchType;
  severity: DuplicateSeverity;
  status: DuplicateAlertStatus;
  newRequest: DuplicateAlertRequest | null;
  existingRequest: DuplicateAlertRequest | null;
  createdAt: string;
  updatedAt: string;
}

// Bounty types
export type BountyStatus =
  | "NONE"
  | "PLEDGED"
  | "PAYMENT_PENDING"
  | "PAYMENT_INITIATED"
  | "PAYMENT_COMPLETED"
  | "PAYMENT_FAILED"
  | "RELEASED_TO_TIPPER"
  | "CANCELLED";

export interface BountyTransaction {
  _id: string;
  requestId: string;
  reporterId: string;
  amount: number;
  status: BountyStatus;
  merchantOrderId?: string;
  phonepeOrderId?: string;
  transactionId?: string;
  awardedTipId?: string;
  awardedTipperContact?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}
