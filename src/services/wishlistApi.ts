import { fetchWithFallback } from './api';
import { API_ENDPOINTS } from '../config/api';
import type { Product } from '../types/product';

export interface WishlistItemResponse {
  id: number;
  userId: number;
  productId: number;
  createdAt: string;
  product: Product;
}

export interface ToggleWishlistResponse {
  success: boolean;
  wishlisted: boolean;
  message: string;
}

function getAuthHeaders(token: string): Record<string, string> {
  const clean = token.trim();
  return {
    Accept: 'application/json',
    Cookie: `token=${clean}`,
    Authorization: `Bearer ${clean}`,
  };
}

/**
 * Fetch wishlisted products from the backend SQL Server database
 */
export async function fetchServerWishlist(token: string): Promise<Product[]> {
  if (!token || !token.trim()) {
    return [];
  }

  const response = await fetchWithFallback(API_ENDPOINTS.wishlist, {
    method: 'GET',
    headers: getAuthHeaders(token),
  });

  if (response.status === 401 || response.status === 403) {
    return [];
  }

  if (!response.ok) {
    throw new Error(`Failed to load server wishlist: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (Array.isArray(data)) {
    return data
      .map((item: any) => item.product)
      .filter((p: any): p is Product => p && typeof p.id === 'number');
  }

  return [];
}

/**
 * Toggle wishlist state on the backend SQL Server database
 */
export async function toggleServerWishlist(
  productId: number,
  token: string
): Promise<ToggleWishlistResponse | null> {
  if (!token || !token.trim() || !Number.isInteger(productId) || productId <= 0) {
    return null;
  }

  const response = await fetchWithFallback(API_ENDPOINTS.wishlist, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ productId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to toggle wishlist: HTTP ${response.status}`);
  }

  return await response.json();
}
