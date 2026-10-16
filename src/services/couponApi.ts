import { API_ENDPOINTS } from '../config/api';
import { fetchWithFallback } from './api';
import type { Coupon, ValidateCouponResponse } from '../types/coupon';

function buildAuthHeaders(token: string) {
  const clean = token.trim();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Cookie: `token=${clean}`,
    Authorization: `Bearer ${clean}`,
  };
}

export async function getAvailableCoupons(token: string): Promise<Coupon[]> {
  if (!token) return [];

  try {
    const res = await fetchWithFallback(API_ENDPOINTS.coupons, {
      method: 'GET',
      headers: buildAuthHeaders(token),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.coupons) ? data.coupons : [];
  } catch {
    return [];
  }
}

export async function validateCoupon(
  code: string,
  subtotal: number,
  token: string
): Promise<ValidateCouponResponse> {
  if (!token) throw new Error('Authentication required.');

  const res = await fetchWithFallback(API_ENDPOINTS.validateCoupon, {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body: JSON.stringify({ code: code.trim(), subtotal }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || 'Invalid coupon code.');
  }

  return data;
}
