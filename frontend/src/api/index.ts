import type {
  AuthResponse,
  MissingPersonRequest,
  PoliceNote,
  RequestDetail,
  ScanResult,
  RequestStatus,
  DuplicateAlert,
  BountyTransaction,
} from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function getHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data as T;
}

// Auth
export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<AuthResponse>(res);
}

export async function register(
  name: string,
  email: string,
  password: string,
  role: "CITIZEN" | "POLICE"
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, role }),
  });
  return handleResponse<AuthResponse>(res);
}

// Citizen
export async function createRequest(data: {
  name?: string;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup: string;
  lastKnownLocation: { latitude: number; longitude: number };
  photo: File;
  aadhaarNo?: string;
  bountyAmount?: number;
}): Promise<MissingPersonRequest> {
  const token = localStorage.getItem("token");
  const formData = new FormData();
  if (data.name) formData.append("name", data.name);
  if (data.gender) formData.append("gender", data.gender);
  if (data.dateOfBirth) formData.append("dateOfBirth", data.dateOfBirth);
  formData.append("bloodGroup", data.bloodGroup);
  formData.append(
    "lastKnownLocation",
    JSON.stringify(data.lastKnownLocation)
  );
  formData.append("photo", data.photo);
  if (data.aadhaarNo) formData.append("aadhaarNo", data.aadhaarNo);
  if (data.bountyAmount && data.bountyAmount > 0) {
    formData.append("bountyAmount", String(data.bountyAmount));
  }

  const res = await fetch(`${API_BASE}/requests`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  return handleResponse<MissingPersonRequest>(res);
}

export async function getMyRequests(): Promise<MissingPersonRequest[]> {
  const res = await fetch(`${API_BASE}/requests/me`, {
    headers: getHeaders(),
  });
  return handleResponse<MissingPersonRequest[]>(res);
}

// Police
export async function getAllRequests(
  status?: string
): Promise<MissingPersonRequest[]> {
  const url = status
    ? `${API_BASE}/police/requests?status=${status}`
    : `${API_BASE}/police/requests`;
  const res = await fetch(url, { headers: getHeaders() });
  return handleResponse<MissingPersonRequest[]>(res);
}

export async function getRequestById(id: string): Promise<RequestDetail> {
  const res = await fetch(`${API_BASE}/police/requests/${id}`, {
    headers: getHeaders(),
  });
  return handleResponse<RequestDetail>(res);
}

export async function updateRequestStatus(
  id: string,
  status: RequestStatus
): Promise<MissingPersonRequest> {
  const res = await fetch(`${API_BASE}/police/requests/${id}/status`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ status }),
  });
  return handleResponse<MissingPersonRequest>(res);
}

export async function discardRequest(
  id: string
): Promise<MissingPersonRequest> {
  const res = await fetch(`${API_BASE}/police/requests/${id}/discard`, {
    method: "PATCH",
    headers: getHeaders(),
  });
  return handleResponse<MissingPersonRequest>(res);
}

export async function triggerScan(id: string): Promise<ScanResult[]> {
  const res = await fetch(`${API_BASE}/police/requests/${id}/scan`, {
    method: "POST",
    headers: getHeaders(),
  });
  return handleResponse<ScanResult[]>(res);
}

export async function addNote(id: string, note: string): Promise<PoliceNote> {
  const res = await fetch(`${API_BASE}/police/requests/${id}/note`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ note }),
  });
  return handleResponse<PoliceNote>(res);
}

export async function getScanResults(id: string): Promise<ScanResult[]> {
  const res = await fetch(`${API_BASE}/police/requests/${id}/scans`, {
    headers: getHeaders(),
  });
  return handleResponse<ScanResult[]>(res);
}

export async function fetchAadhaarInfo(
  id: string
): Promise<MissingPersonRequest> {
  const res = await fetch(`${API_BASE}/police/requests/${id}/fetch-aadhaar`, {
    method: "POST",
    headers: getHeaders(),
  });
  return handleResponse<MissingPersonRequest>(res);
}

// Public
export interface PublicCase {
  _id: string;
  lastKnownLocation: { latitude: number; longitude: number };
  status: string;
  name?: string;
  gender?: string;
  bloodGroup?: string;
  createdAt: string;
}

export async function getPublicCases(): Promise<PublicCase[]> {
  const res = await fetch(`${API_BASE}/public/cases`);
  return handleResponse<PublicCase[]>(res);
}

// Public tip-off
export interface PublicCaseDetail {
  case: {
    _id: string;
    name?: string;
    gender?: string;
    bloodGroup?: string;
    photoUrl: string;
    lastKnownLocation: { latitude: number; longitude: number };
    status: string;
    bountyAmount?: number;
    createdAt: string;
  };
  resolved: boolean;
  tipCount: number;
  bountyAmount: number;
}

export async function getPublicCaseById(id: string): Promise<PublicCaseDetail> {
  const res = await fetch(`${API_BASE}/public/cases/${id}`);
  return handleResponse<PublicCaseDetail>(res);
}

export async function submitTip(
  caseId: string,
  data: {
    message: string;
    location?: { latitude: number; longitude: number };
    contactInfo?: string;
  }
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/public/cases/${caseId}/tip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

// Duplicate alerts
export async function getDuplicateAlerts(): Promise<DuplicateAlert[]> {
  const res = await fetch(`${API_BASE}/police/alerts/duplicates`, {
    headers: getHeaders(),
  });
  return handleResponse<DuplicateAlert[]>(res);
}

export async function getRequestDuplicates(
  id: string
): Promise<DuplicateAlert[]> {
  const res = await fetch(`${API_BASE}/police/requests/${id}/duplicates`, {
    headers: getHeaders(),
  });
  return handleResponse<DuplicateAlert[]>(res);
}

export async function dismissDuplicate(alertId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/police/alerts/duplicates/${alertId}/dismiss`,
    { method: "PATCH", headers: getHeaders() }
  );
  return handleResponse<void>(res);
}

export async function linkDuplicate(alertId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/police/alerts/duplicates/${alertId}/link`,
    { method: "PATCH", headers: getHeaders() }
  );
  return handleResponse<void>(res);
}

// ─── AI Chat ────────────────────────────────────────────
export async function sendChatMessage(
  messages: { role: string; content: string }[],
  location?: { latitude: number; longitude: number },
  onChunk?: (fullText: string) => void
): Promise<string> {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages, location }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Chat failed" }));
    throw new Error((err as any).error || "Chat request failed");
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullText += parsed.content;
              onChunk?.(fullText);
            }
          } catch {}
        }
      }
    }
  }

  return fullText;
}

// ─── Bounty ─────────────────────────────────────────────
export async function getBounty(
  requestId: string
): Promise<BountyTransaction | null> {
  const res = await fetch(`${API_BASE}/bounty/${requestId}`, {
    headers: getHeaders(),
  });
  return handleResponse<BountyTransaction | null>(res);
}

export async function initiateBountyPayment(
  requestId: string
): Promise<{ redirectUrl: string; merchantOrderId: string }> {
  const res = await fetch(`${API_BASE}/bounty/${requestId}/pay`, {
    method: "POST",
    headers: getHeaders(),
  });
  return handleResponse<{ redirectUrl: string; merchantOrderId: string }>(res);
}

export async function verifyBountyPayment(
  requestId: string,
  orderId: string
): Promise<{ success: boolean; state: string; amount?: number; transactionId?: string }> {
  const res = await fetch(
    `${API_BASE}/bounty/${requestId}/verify?orderId=${encodeURIComponent(orderId)}`,
    { headers: getHeaders() }
  );
  return handleResponse<{ success: boolean; state: string; amount?: number; transactionId?: string }>(res);
}

export async function awardBounty(
  requestId: string,
  tipId: string
): Promise<BountyTransaction> {
  const res = await fetch(`${API_BASE}/bounty/${requestId}/award`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ tipId }),
  });
  return handleResponse<BountyTransaction>(res);
}

export async function releaseBounty(
  requestId: string
): Promise<BountyTransaction> {
  const res = await fetch(`${API_BASE}/bounty/${requestId}/release`, {
    method: "PATCH",
    headers: getHeaders(),
  });
  return handleResponse<BountyTransaction>(res);
}

export async function cancelBounty(
  requestId: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/bounty/${requestId}/cancel`, {
    method: "PATCH",
    headers: getHeaders(),
  });
  return handleResponse<{ success: boolean }>(res);
}
