import { API_ENDPOINTS } from '../config/api';
import { fetchWithFallback } from './api';
import type {
  CreateOrderPayload,
  CreateOrderResponse,
  OrdersResponse,
  Order,
  CancelOrderResponse,
} from '../types/order';

/**
 * Places a new order against the existing Next.js backend (POST /api/orders).
 * Requires an approved customer session token passed via Cookie header.
 */
export async function createOrder(
  payload: CreateOrderPayload,
  token: string
): Promise<CreateOrderResponse> {
  if (!token || !token.trim()) {
    throw new Error('Authentication required. Please sign in to place your order.');
  }

  // Validate items on client before sending
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error('Your cart is empty. Please add products to your cart.');
  }

  const endpoint = '/api/orders';
  const response = await fetchWithFallback(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Cookie: `token=${token.trim()}`,
      Authorization: `Bearer ${token.trim()}`,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let data: any = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { message: responseText || 'Invalid server response' };
  }

  if (!response.ok) {
    const errorMsg =
      data?.message ||
      (response.status === 401
        ? 'Login session expired. Please sign in again.'
        : response.status === 403
        ? 'Account approval pending. Only approved accounts can place orders.'
        : `Could not place order (HTTP ${response.status}).`);
    throw new Error(errorMsg);
  }

  return {
    success: true,
    message: data?.message || 'Order placed successfully.',
    order: data?.order,
  };
}

/**
 * Determines whether an order record represents a legitimate customer order
 * that should be displayed in the customer's "My Orders" screen.
 *
 * Rules:
 * 1. Cash on Delivery (COD) orders are confirmed upon placement and valid across
 *    all order lifecycle statuses (PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED).
 * 2. Online payment orders (Razorpay: Cards, NetBanking, Wallets) are conditional on payment.
 *    They are only confirmed customer orders once payment is successfully verified
 *    (paymentStatus='PAID', or 'REFUNDED' if cancelled after payment).
 *    Incomplete checkout attempts or failed online payments (paymentStatus='PENDING' or 'FAILED' without verification)
 *    must NOT appear as normal customer orders in My Orders.
 */
export function isLegitimateCustomerOrder(order?: {
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  status?: string | null;
}): boolean {
  if (!order) return false;
  const methodUpper = (order.paymentMethod || 'COD').trim().toUpperCase();
  const payStatusUpper = (order.paymentStatus || 'PENDING').trim().toUpperCase();

  const isCod =
    methodUpper === 'COD' ||
    methodUpper === 'CASH_ON_DELIVERY' ||
    methodUpper === 'CASH ON DELIVERY';

  // COD orders are legitimate customer orders across all statuses
  if (isCod) {
    return true;
  }

  // Online orders must be verified as PAID (or REFUNDED if cancelled post-payment)
  if (payStatusUpper === 'PAID' || payStatusUpper === 'REFUNDED') {
    return true;
  }

  // Any online order that is still PENDING or FAILED is an unverified / failed checkout attempt
  return false;
}

/**
 * Fetches the authenticated user's order history (GET /api/orders).
 * Automatically excludes unverified or failed online payment attempts.
 */
export async function getMyOrders(
  token: string,
  page = 1,
  limit = 10,
  status?: string
): Promise<OrdersResponse> {
  if (!token || !token.trim()) {
    throw new Error('Authentication required.');
  }

  const endpoint = API_ENDPOINTS.orders(page, limit, status);
  const response = await fetchWithFallback(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Cookie: `token=${token.trim()}`,
      Authorization: `Bearer ${token.trim()}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Session expired. Please sign in again.');
    }
    if (response.status === 403) {
      throw new Error('Your registration is waiting for admin approval.');
    }
    throw new Error(`Failed to load orders: HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawOrders: Order[] = Array.isArray(data?.orders) ? data.orders : [];
  const validOrders = rawOrders.filter(isLegitimateCustomerOrder);

  return {
    orders: validOrders,
    total: typeof data?.total === 'number' ? data.total : validOrders.length,
    page: typeof data?.page === 'number' ? data.page : page,
    limit: typeof data?.limit === 'number' ? data.limit : limit,
    totalPages: typeof data?.totalPages === 'number' ? data.totalPages : 1,
  };
}

/**
 * Fetches all orders belonging to the customer across all pages so that line items
 * can be accurately expanded, filtered, and paginated on the client.
 */
export async function getAllMyOrders(token: string): Promise<Order[]> {
  const first = await getMyOrders(token, 1, 50);
  let allOrders = [...first.orders];

  if (first.totalPages > 1) {
    const promises: Promise<OrdersResponse>[] = [];
    for (let p = 2; p <= first.totalPages; p++) {
      promises.push(getMyOrders(token, p, 50));
    }
    const results = await Promise.all(promises);
    for (const res of results) {
      allOrders = allOrders.concat(res.orders);
    }
  }

  return allOrders.filter(isLegitimateCustomerOrder);
}

/**
 * Fetches details for a single order by ID (GET /api/orders/[id]).
 */
export async function getOrderDetails(
  orderId: number,
  token: string
): Promise<Order | null> {
  if (!token || !token.trim()) {
    throw new Error('Authentication required.');
  }

  const endpoint = API_ENDPOINTS.order(orderId);
  const response = await fetchWithFallback(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Cookie: `token=${token.trim()}`,
      Authorization: `Bearer ${token.trim()}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load order details: HTTP ${response.status}`);
  }

  const data = await response.json();
  return data?.order ?? null;
}

/**
 * Statuses that customers can cancel directly without requiring admin approval.
 */
export const CANCELLABLE_STATUSES: readonly string[] = [
  'PENDING',
  'CONFIRMED',
  'PACKED',
  'SHIPPED',
];

/**
 * Checks whether an order is eligible for cancellation by the customer.
 * Directly cancellable in PENDING, CONFIRMED, PACKED, and SHIPPED statuses.
 * Delivered or already cancelled orders cannot be cancelled.
 */
export function isOrderCancellable(status?: string | null): boolean {
  if (!status) return false;
  const upper = status.trim().toUpperCase();
  return CANCELLABLE_STATUSES.includes(upper);
}

export interface OrderPaymentDisplay {
  label: string;
  isPaid: boolean;
  method: string;
  statusText?: string;
  isPayable?: boolean;
  actionLabel?: string;
}

/**
 * Checks whether an order is eligible for online payment or payment retry.
 * Eligible if not already paid, not cancelled/refunded, and total > 0.
 */
export function isOrderPayable(order?: {
  status?: string | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  total?: number | null;
}): boolean {
  if (!order) return false;
  const statusUpper = (order.status || '').trim().toUpperCase();
  const payStatusUpper = (order.paymentStatus || 'PENDING').trim().toUpperCase();
  const total = Number(order.total) || 0;

  if (payStatusUpper === 'PAID') return false;
  if (statusUpper === 'CANCELLED' || statusUpper === 'REFUNDED') return false;
  if (total <= 0) return false;

  return true;
}

/**
 * Computes the normalized payment badge label and state.
 *
 * Exact condition:
 * If order status is DELIVERED or COMPLETED AND payment method is COD, display 'COD • PAID'.
 * For all other orders, preserve the existing payment-status display logic.
 *
 * Rules:
 * 1. Delivered + COD -> COD • PAID
 * 2. Completed + COD -> COD • PAID
 * 3. Pending + COD -> Keep existing payment status.
 * 4. Confirmed + COD -> Keep existing payment status.
 * 5. Packed + COD -> Keep existing payment status.
 * 6. Shipped + COD -> Keep existing payment status.
 * 7. Any online payment method -> Keep existing payment status, regardless of order status.
 */
export function getOrderPaymentDisplay(
  paymentMethod?: string | null,
  paymentStatus?: string | null,
  orderStatus?: string | null,
  total?: number | null
): OrderPaymentDisplay {
  const methodUpper = (paymentMethod || 'COD').trim().toUpperCase();
  const paymentStatusUpper = (paymentStatus || 'PENDING').trim().toUpperCase();
  const orderStatusUpper = (orderStatus || '').trim().toUpperCase();

  const isCod =
    methodUpper === 'COD' ||
    methodUpper === 'CASH_ON_DELIVERY' ||
    methodUpper === 'CASH ON DELIVERY';
  const isDeliveredOrCompleted =
    orderStatusUpper === 'DELIVERED' || orderStatusUpper === 'COMPLETED';

  // Rule 1 & 2: Delivered or Completed COD orders automatically display COD • PAID
  if (isCod && isDeliveredOrCompleted) {
    return {
      label: 'COD • PAID',
      isPaid: true,
      method: 'COD',
      statusText: 'Paid',
      isPayable: false,
    };
  }

  // All other orders: preserve existing payment-status display logic
  const isPaid = paymentStatusUpper === 'PAID';
  const methodLabel =
    methodUpper === 'RAZORPAY' || methodUpper === 'ONLINE' ? 'Online' : 'COD';
  const statusLabel = isPaid
    ? 'PAID'
    : paymentStatusUpper === 'FAILED'
    ? 'FAILED'
    : 'PENDING';

  let statusText = 'Pending';
  if (isPaid) {
    statusText = 'Paid';
  } else if (paymentStatusUpper === 'FAILED') {
    statusText = 'Failed';
  } else if (paymentStatusUpper === 'AWAITING_PAYMENT') {
    statusText = 'Awaiting Payment';
  }

  const isCancelled = orderStatusUpper === 'CANCELLED' || orderStatusUpper === 'REFUNDED';
  const isPayable = !isPaid && !isCancelled && (Number(total ?? 1) > 0);

  let actionLabel = 'Pay Now';
  if (paymentStatusUpper === 'FAILED') {
    actionLabel = 'Retry Payment';
  } else if (isCod) {
    actionLabel = 'Pay Online';
  }

  return {
    label: `${methodLabel} • ${statusLabel}`,
    isPaid,
    method: methodLabel,
    statusText,
    isPayable,
    actionLabel,
  };
}

/**
 * Returns tracking timeline metadata for an order status.
 * Stages: Order Placed (0) -> Processing (1) -> Shipped (2) -> Delivered (3)
 */
export function getOrderTrackingStep(status?: string | null): {
  stepIndex: number;
  isCancelled: boolean;
  statusLabel: string;
} {
  const upper = (status || 'PENDING').trim().toUpperCase();
  if (upper === 'CANCELLED') {
    return { stepIndex: -1, isCancelled: true, statusLabel: 'Cancelled' };
  }
  if (upper === 'DELIVERED' || upper === 'COMPLETED') {
    return { stepIndex: 3, isCancelled: false, statusLabel: 'Delivered' };
  }
  if (upper === 'SHIPPED') {
    return { stepIndex: 2, isCancelled: false, statusLabel: 'Shipped' };
  }
  if (upper === 'CONFIRMED' || upper === 'PACKED') {
    return { stepIndex: 1, isCancelled: false, statusLabel: 'Processing' };
  }
  return { stepIndex: 0, isCancelled: false, statusLabel: 'Order Placed' };
}

/**
 * Directly cancels an eligible customer order (POST /api/orders/[id]/cancel).
 * Does not require admin approval.
 */
export async function cancelOrder(
  orderId: number,
  token: string
): Promise<CancelOrderResponse> {
  if (!token || !token.trim()) {
    throw new Error('Authentication required. Please sign in to cancel your order.');
  }

  const endpoint = `/api/orders/${orderId}/cancel`;
  const response = await fetchWithFallback(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Cookie: `token=${token.trim()}`,
      Authorization: `Bearer ${token.trim()}`,
    },
  });

  const responseText = await response.text();
  let data: any = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { message: responseText || 'Invalid server response' };
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session has expired. Please sign in again.');
    }
    if (response.status === 403) {
      throw new Error(data?.message || 'You are not authorized to cancel this order.');
    }
    throw new Error(
      data?.message || `Could not cancel order #${orderId} (HTTP ${response.status}).`
    );
  }

  return {
    success: true,
    message: data?.message || `Order #${orderId} has been successfully cancelled.`,
    order: data?.order,
  };
}

/**
 * Updates an eligible order's payment method (e.g. switching between COD and RAZORPAY).
 */
export async function updateOrderPaymentMethod(
  orderId: number,
  paymentMethod: 'COD' | 'RAZORPAY',
  token: string
): Promise<{ success: boolean; message: string; order: Order }> {
  if (!token || !token.trim()) {
    throw new Error('Authentication required.');
  }

  const endpoint = `/api/orders/${orderId}`;
  const response = await fetchWithFallback(endpoint, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Cookie: `token=${token.trim()}`,
      Authorization: `Bearer ${token.trim()}`,
    },
    body: JSON.stringify({ paymentMethod }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || 'Could not update payment method.');
  }

  return data;
}


