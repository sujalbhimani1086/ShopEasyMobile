import { API_ENDPOINTS } from '../config/api';
import { fetchWithFallback } from './api';

export interface ServerCartItem {
  id: number;
  productId: number;
  name: string;
  price: number;
  discount: number;
  category: string;
  image: string;
  stock: number;
  quantity: number;
}

export interface ServerCartResponse {
  id?: number;
  items: ServerCartItem[];
}

/**
 * Helper to construct authentication headers (both Cookie and Authorization Bearer)
 */
function getAuthHeaders(token: string): Record<string, string> {
  const clean = token.trim();
  return {
    Accept: 'application/json',
    Cookie: `token=${clean}`,
    Authorization: `Bearer ${clean}`,
  };
}

/**
 * Fetch the current authenticated user's cart items from the SQL Server database.
 */
export async function fetchServerCart(token: string): Promise<ServerCartItem[]> {
  if (!token || !token.trim()) {
    return [];
  }

  const endpoint = API_ENDPOINTS.cart;
  const response = await fetchWithFallback(endpoint, {
    method: 'GET',
    headers: getAuthHeaders(token),
  });

  if (response.status === 401 || response.status === 403) {
    return [];
  }

  if (!response.ok) {
    throw new Error(`Failed to load server cart: HTTP ${response.status}`);
  }

  const text = await response.text();
  const data: ServerCartResponse = text ? JSON.parse(text) : { items: [] };

  return Array.isArray(data?.items) ? data.items : [];
}

/**
 * Synchronize the entire cart to the server-side database.
 */
export async function syncServerCart(
  items: { productId: number; quantity: number }[],
  token: string
): Promise<boolean> {
  if (!token || !token.trim()) {
    return false;
  }

  const endpoint = API_ENDPOINTS.cart;
  const response = await fetchWithFallback(endpoint, {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items }),
  });

  return response.ok;
}

/**
 * Clear the user's cart in the server-side database.
 */
export async function clearServerCart(token: string): Promise<boolean> {
  if (!token || !token.trim()) {
    return false;
  }

  const endpoint = API_ENDPOINTS.cart;
  const response = await fetchWithFallback(endpoint, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });

  return response.ok;
}

/**
 * Remove a specific product from the server-side cart.
 */
export async function removeServerCartItem(
  productId: number,
  token: string
): Promise<boolean> {
  if (!token || !token.trim() || !Number.isInteger(productId) || productId <= 0) {
    return false;
  }

  const endpoint = `${API_ENDPOINTS.cart}?productId=${encodeURIComponent(productId)}`;
  const response = await fetchWithFallback(endpoint, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });

  return response.ok;
}
