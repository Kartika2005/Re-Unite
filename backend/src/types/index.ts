export type UserRole = "CITIZEN" | "POLICE";

export type RequestStatus =
  | "REPORTED"
  | "UNDER_REVIEW"
  | "SCANNING"
  | "FOUND"
  | "DECLINED"
  | "DISCARDED";

export interface IUser {
  _id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
}

export interface ILastKnownLocation {
  latitude: number;
  longitude: number;
}

export interface IMissingPersonRequest {
  _id: string;
  reporterId: string;
  name?: string;
  gender?: string;
  dateOfBirth?: Date;
  bloodGroup: string;
  lastKnownLocation: ILastKnownLocation;
  photoUrl: string;
  status: RequestStatus;
  aadhaarNo?: string;
  phoneNumber?: string;
  address?: string;
  faceEmbedding?: number[];
  bountyAmount?: number;
  bountyStatus?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ScanMatchStatus = "found" | "not_found" | "error";

export interface IScanResult {
  _id: string;
  requestId: string;
  cctvId: string;
  bestMatchImageUrl: string;
  confidenceScore: number;
  status: ScanMatchStatus;
  createdAt: Date;
}

export interface IPoliceNote {
  _id: string;
  requestId: string;
  policeUserId: string;
  note: string;
  createdAt: Date;
}

// Request/Response DTOs
export interface CreateMissingPersonDTO {
  name?: string;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup: string;
  lastKnownLocation: ILastKnownLocation;
  photoUrl: string;
  aadhaarNo?: string;
}

export interface UpdateRequestStatusDTO {
  status: RequestStatus;
}

export interface AddPoliceNoteDTO {
  note: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface AuthPayload {
  userId: string;
  role: UserRole;
}

export interface ITip {
  _id: string;
  requestId: string;
  message: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  contactInfo?: string;
  createdAt: Date;
}

export interface SubmitTipDTO {
  message: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  contactInfo?: string;
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

export interface ICaseEvent {
  _id: string;
  requestId: string;
  action: CaseEventAction;
  actor?: string;
  details?: string;
  createdAt: Date;
}

// Duplicate detection types
export type DuplicateMatchType = "FACE" | "AADHAAR" | "BOTH";
export type DuplicateSeverity = "CRITICAL" | "HIGH" | "MEDIUM";
export type DuplicateAlertStatus = "PENDING" | "DISMISSED" | "LINKED";

export interface IDuplicateAlert {
  _id: string;
  newRequestId: string;
  existingRequestId: string;
  score: number;
  matchType: DuplicateMatchType;
  severity: DuplicateSeverity;
  status: DuplicateAlertStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Valid state transitions
export const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  REPORTED: ["UNDER_REVIEW", "DISCARDED"],
  UNDER_REVIEW: ["SCANNING"],
  SCANNING: ["FOUND", "DECLINED"],
  FOUND: [],
  DECLINED: [],
  DISCARDED: [],
};
