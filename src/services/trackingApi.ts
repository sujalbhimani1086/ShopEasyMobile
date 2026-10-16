import { API_ENDPOINTS } from '../config/api';
import { fetchWithFallback } from './api';
import type { OrderTrackingResponse } from '../types/tracking';

function buildAuthHeaders(token: string) {
  const clean = token.trim();
  return {
    Accept: 'application/json',
    Cookie: `token=${clean}`,
    Authorization: `Bearer ${clean}`,
  };
}

export async function getOrderTracking(
  orderId: number,
  token: string
): Promise<OrderTrackingResponse> {
  if (!token) throw new Error('Authentication required.');

  const res = await fetchWithFallback(API_ENDPOINTS.orderTracking(orderId), {
    method: 'GET',
    headers: buildAuthHeaders(token),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || `Failed to load tracking: HTTP ${res.status}`);
  }

  return await res.json();
}
