const baseUrl = (process.env.PLATEGA_BASE_URL || "https://app.platega.io").replace(/\/+$/, "");

export type PlategaPaymentStatus = "PENDING" | "CONFIRMED" | "CANCELED" | "CHARGEBACK";

export type PlategaCreateTransactionRequest = {
  paymentMethod: number;
  paymentDetails: {
    amount: number;
    currency: "RUB";
  };
  description: string;
  return: string;
  failedUrl: string;
  payload: string;
};

export type PlategaCreateTransactionResponse = {
  paymentMethod: string | null;
  transactionId: string;
  redirect: string;
  return: string;
  paymentDetails: string;
  status: "PENDING";
  expiresIn: string;
  merchantId: string;
  usdtRate: number;
};

export type PlategaTransactionStatusResponse = {
  id: string;
  status: PlategaPaymentStatus;
  paymentDetails: {
    amount: number;
    currency: string;
  };
  merchantName?: string;
  mechantId?: string;
  comission?: number;
  paymentMethod?: string;
  expiresIn?: string;
  return?: string;
  comissionUsdt?: number;
  amountUsdt?: number;
  qr?: string;
  payformSuccessUrl?: string;
  payload?: string;
  comissionType?: number;
  externalId?: string;
  description?: string;
};

export type PlategaCallbackPayload = {
  id: string;
  amount: number;
  currency: string;
  status: PlategaPaymentStatus;
  paymentMethod: number;
};

function getHeaders() {
  const merchantId = process.env.PLATEGA_MERCHANT_ID;
  const secret = process.env.PLATEGA_SECRET_KEY;

  if (!merchantId || !secret) {
    throw new Error("PLATEGA_CONFIG_MISSING");
  }

  return {
    "Content-Type": "application/json",
    "X-MerchantId": merchantId,
    "X-Secret": secret
  };
}

export function isPlategaConfigured() {
  return Boolean(process.env.PLATEGA_MERCHANT_ID && process.env.PLATEGA_SECRET_KEY);
}

export function verifyPlategaCallbackHeaders(headers: Headers) {
  const merchantId = process.env.PLATEGA_MERCHANT_ID;
  const secret = process.env.PLATEGA_SECRET_KEY;

  if (!merchantId || !secret) {
    throw new Error("PLATEGA_CONFIG_MISSING");
  }

  return headers.get("X-MerchantId") === merchantId && headers.get("X-Secret") === secret;
}

export async function createPlategaTransaction(payload: PlategaCreateTransactionRequest) {
  const response = await fetch(`${baseUrl}/transaction/process`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PLATEGA_CREATE_FAILED: ${response.status} ${text}`);
  }

  return (await response.json()) as PlategaCreateTransactionResponse;
}

export async function fetchPlategaTransactionStatus(transactionId: string) {
  const response = await fetch(`${baseUrl}/transaction/${transactionId}`, {
    headers: getHeaders(),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PLATEGA_STATUS_FAILED: ${response.status} ${text}`);
  }

  return (await response.json()) as PlategaTransactionStatusResponse;
}
