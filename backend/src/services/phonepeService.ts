/**
 * PhonePe Payment Gateway Service
 *
 * Integrates with PhonePe v2 PG Checkout API (sandbox).
 * Handles: initiating payments, verifying payment status.
 */

const PHONEPE_BASE_URL =
  process.env.PHONEPE_BASE_URL || "https://api-preprod.phonepe.com/apis/pg-sandbox";
const PHONEPE_CLIENT_ID = process.env.PHONEPE_CLIENT_ID || "";
const PHONEPE_CLIENT_SECRET = process.env.PHONEPE_CLIENT_SECRET || "";
const PHONEPE_CLIENT_VERSION = process.env.PHONEPE_CLIENT_VERSION || "1";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/** Fetch an OAuth access token from PhonePe */
async function getAccessToken(): Promise<string> {
  const res = await fetch(`${PHONEPE_BASE_URL}/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: PHONEPE_CLIENT_ID,
      client_secret: PHONEPE_CLIENT_SECRET,
      client_version: PHONEPE_CLIENT_VERSION,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PhonePe OAuth failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Initiate a PG Checkout payment and return the redirect URL
 * that the user's browser should be sent to.
 */
export async function initiatePayment(
  merchantOrderId: string,
  amountInRupees: number
): Promise<{ redirectUrl: string }> {
  const accessToken = await getAccessToken();
  const amountPaise = Math.round(amountInRupees * 100);

  const payload = {
    merchantOrderId,
    amount: amountPaise,
    paymentFlow: {
      type: "PG_CHECKOUT",
      message: `Bounty payment for ${merchantOrderId}`,
      merchantUrls: {
        redirectUrl: `${FRONTEND_URL}/bounty/result?orderId=${merchantOrderId}`,
      },
    },
  };

  const res = await fetch(`${PHONEPE_BASE_URL}/checkout/v2/pay`, {
    method: "POST",
    headers: {
      Authorization: `O-Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PhonePe payment init failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { redirectUrl: string };
  console.log(
    `💳 PhonePe payment initiated — Order: ${merchantOrderId}, ₹${amountInRupees}`
  );
  return { redirectUrl: data.redirectUrl };
}

export interface PaymentStatus {
  state: "COMPLETED" | "FAILED" | "PENDING" | string;
  orderId?: string;
  transactionId?: string;
  amount?: number; // paise
}

/** Check payment status for a given merchantOrderId */
export async function checkPaymentStatus(
  merchantOrderId: string
): Promise<PaymentStatus> {
  const accessToken = await getAccessToken();

  const res = await fetch(
    `${PHONEPE_BASE_URL}/checkout/v2/order/${merchantOrderId}/status?details=false&errorContext=false`,
    {
      headers: {
        Authorization: `O-Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PhonePe status check failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    state: string;
    orderId?: string;
    amount?: number;
    paymentDetails?: Array<{ transactionId?: string }>;
  };

  const txnId =
    data.paymentDetails && data.paymentDetails.length > 0
      ? data.paymentDetails[0]?.transactionId
      : undefined;

  return {
    state: data.state || "UNKNOWN",
    orderId: data.orderId,
    transactionId: txnId,
    amount: data.amount,
  };
}
