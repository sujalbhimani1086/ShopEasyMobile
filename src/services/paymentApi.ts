import { API_ENDPOINTS } from '../config/api';
import { fetchWithFallback } from './api';
import RazorpayCheckout, {
  type RazorpayCheckoutOptions,
  type RazorpaySuccessResponse,
} from 'react-native-razorpay';
import type {
  RazorpayOrderResponse,
  VerifyPaymentPayload,
  VerifyPaymentResponse,
} from '../types/payment';
import type { Order } from '../types/order';

function buildAuthHeaders(token: string) {
  const clean = token.trim();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Cookie: `token=${clean}`,
    Authorization: `Bearer ${clean}`,
  };
}

export interface ParsedPaymentError {
  isCancelled: boolean;
  title: string;
  message: string;
  code?: number;
  step?: string;
  reason?: string;
}

/**
 * Parses raw Razorpay errors into human-readable user feedback,
 * preventing any raw JSON strings from being exposed to the user.
 */
export function parseRazorpayError(payErr: any): ParsedPaymentError {
  if (!payErr) {
    return {
      isCancelled: false,
      title: 'Payment Failed',
      message: 'Payment could not be processed. Please try again or choose another payment method.',
    };
  }

  const code = typeof payErr.code === 'number' ? payErr.code : undefined;
  const rawDesc = typeof payErr.description === 'string' ? payErr.description : '';
  const rawMsg = typeof payErr.message === 'string' ? payErr.message : '';

  // 1. Detect user cancellation or dismissal
  const isCancelled =
    code === 0 ||
    rawDesc.toLowerCase().includes('cancelled') ||
    rawDesc.toLowerCase().includes('dismissed') ||
    rawMsg.toLowerCase().includes('cancelled') ||
    rawMsg.toLowerCase().includes('dismissed');

  if (isCancelled) {
    return {
      isCancelled: true,
      title: 'Payment Cancelled',
      message: 'Payment was cancelled. Your items remain in your cart so you can retry checkout or choose Cash on Delivery.',
      code: 0,
    };
  }

  // 2. Parse JSON payload if description or error is serialized JSON
  let errorObj: any = null;
  if (rawDesc.trim().startsWith('{') && rawDesc.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(rawDesc.trim());
      errorObj = parsed?.error || parsed;
    } catch {}
  } else if (typeof payErr.error === 'object' && payErr.error !== null) {
    errorObj = payErr.error;
  }

  const step = errorObj?.step || payErr?.step;
  const reason = errorObj?.reason || payErr?.reason;
  const errorCode = errorObj?.code || payErr?.code;
  const parsedDesc = errorObj?.description || errorObj?.message;

  // Network connection error detection
  const isNetworkError =
    rawDesc.toLowerCase().includes('network') ||
    rawMsg.toLowerCase().includes('network') ||
    rawDesc.toLowerCase().includes('connection') ||
    rawMsg.toLowerCase().includes('connection');

  if (isNetworkError) {
    return {
      isCancelled: false,
      title: 'Network Connection Error',
      message: 'Could not connect to payment gateway. Please check your internet connection and retry.',
      code,
      step,
      reason,
    };
  }

  // 3. Known gateway steps & method errors
  if (
    reason === 'no_payment_methods' ||
    errorCode === 'no_payment_methods' ||
    rawDesc.toLowerCase().includes('no appropriate payment method') ||
    rawMsg.toLowerCase().includes('no appropriate payment method') ||
    (typeof parsedDesc === 'string' && parsedDesc.toLowerCase().includes('no appropriate payment method'))
  ) {
    return {
      isCancelled: false,
      title: 'Payment Method Unavailable',
      message: 'No appropriate payment method found for this transaction. Please try another payment method or Cash on Delivery.',
      code,
      step,
      reason,
    };
  }

  if (step === 'payment_authentication' || reason === 'payment_error') {
    return {
      isCancelled: false,
      title: 'Payment Authentication Failed',
      message:
        parsedDesc && !parsedDesc.startsWith('{') && parsedDesc !== 'Payment Failed'
          ? parsedDesc
          : 'Payment authentication could not be completed with your bank (card authentication failed or was declined). Please check your payment details or retry.',
      code,
      step,
      reason,
    };
  }

  if (reason === 'payment_cancelled') {
    return {
      isCancelled: true,
      title: 'Payment Cancelled',
      message: 'Payment was cancelled. Your items remain in your cart so you can retry checkout or choose Cash on Delivery.',
      code: 0,
      step,
      reason,
    };
  }

  if (step === 'payment_authorization') {
    return {
      isCancelled: false,
      title: 'Transaction Declined',
      message: parsedDesc && !parsedDesc.startsWith('{') ? parsedDesc : 'The transaction was declined by the issuing bank. Please try another card or payment method.',
      code,
      step,
      reason,
    };
  }

  // 4. Clean fallback message stripped of raw JSON
  let cleanMessage = 'Payment could not be processed. Please try again or choose another payment method.';
  if (parsedDesc && typeof parsedDesc === 'string' && !parsedDesc.startsWith('{')) {
    cleanMessage = parsedDesc;
  } else if (rawDesc && !rawDesc.startsWith('{')) {
    cleanMessage = rawDesc;
  } else if (rawMsg && !rawMsg.startsWith('{')) {
    cleanMessage = rawMsg;
  }

  return {
    isCancelled: false,
    title: 'Payment Failed',
    message: cleanMessage,
    code,
    step,
    reason,
  };
}

export async function createRazorpayOrder(
  amount: number,
  orderId: number | null,
  token: string
): Promise<RazorpayOrderResponse> {
  if (!token) throw new Error('Authentication required.');

  const res = await fetchWithFallback(API_ENDPOINTS.razorpayCreateOrder, {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body: JSON.stringify({ amount, orderId }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || 'Failed to initialize payment gateway.');
  }

  return data;
}

export async function verifyRazorpayPayment(
  payload: VerifyPaymentPayload,
  token: string
): Promise<VerifyPaymentResponse> {
  if (!token) throw new Error('Authentication required.');

  const res = await fetchWithFallback(API_ENDPOINTS.razorpayVerify, {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || 'Payment signature verification failed.');
  }

  return data;
}

/**
 * Executes full Razorpay payment checkout flow for an existing or new order.
 * Invokes official react-native-razorpay SDK, verifies cryptographically server-side,
 * and handles failures / cancellation gracefully.
 */
export async function executeRazorpayCheckout(params: {
  orderId: number;
  amount: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  token: string;
  preferredMethod?: 'card' | 'netbanking' | 'wallet';
}): Promise<Order> {
  const { orderId, amount, customerName, customerEmail, customerPhone, token, preferredMethod } = params;

  // 1. Initialize server-side Razorpay order
  const rzp = await createRazorpayOrder(amount, orderId, token);

  // 2. Prepare checkout options for official native SDK
  const options: RazorpayCheckoutOptions = {
    description: `Order #${orderId} - ShopEasy`,
    image: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png',
    currency: rzp.currency || 'INR',
    key: rzp.keyId,
    amount: rzp.amount,
    name: 'ShopEasy Store',
    order_id: rzp.orderId,
    prefill: {
      email: (customerEmail || '').trim(),
      contact: (customerPhone || '9876543210').trim(),
      name: (customerName || '').trim(),
      method: preferredMethod,
    },
    theme: {
      color: '#000000',
    },
    modal: {
      confirm_close: true,
      animation: true,
    },
    retry: {
      enabled: true,
      max_count: 3,
    },
    send_sms_hash: true,
  };

  // 3. Open official Razorpay checkout experience
  const data: RazorpaySuccessResponse = await RazorpayCheckout.open(options);

  // 4. Verify cryptographic signature on the server
  const verifyRes = await verifyRazorpayPayment(
    {
      orderId,
      razorpayOrderId: data.razorpay_order_id || rzp.orderId,
      razorpayPaymentId: data.razorpay_payment_id,
      razorpaySignature: data.razorpay_signature || '',
    },
    token
  );

  if (!verifyRes.success || !verifyRes.order) {
    throw new Error(verifyRes.message || 'Payment signature verification failed.');
  }

  return verifyRes.order;
}
