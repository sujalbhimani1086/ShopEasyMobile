import { API_ENDPOINTS } from '../config/api';
import { fetchWithFallback } from './api';
import type {
  AdminProduct,
  AdminOrder,
  AdminCoupon,
  AdminReview,
  AdminUser,
  AdminUserDetail,
  AdminCategory,
  AdminRegistration,
  OrderStatusChartPoint,
  SalesChartPoint,
  OrderStatusFilter,
  SalesPeriodFilter,
} from '../types/admin';

/**
 * Builds standard secure headers with Bearer and Cookie token verification.
 */
function buildAdminHeaders(token: string, contentType = 'application/json'): Record<string, string> {
  const cleanToken = (token || '').trim();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${cleanToken}`,
    Cookie: `token=${cleanToken}`,
  };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  return headers;
}

/**
 * Safely parses response JSON or throws an explanatory Error.
 */
async function handleResponse<T>(res: Response, fallbackError: string): Promise<T> {
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text || fallbackError };
  }

  if (!res.ok) {
    const errorMsg =
      json?.message ||
      json?.error ||
      (res.status === 401
        ? 'Admin authentication required. Please sign in.'
        : res.status === 403
        ? 'Access forbidden. You do not have administrator permissions.'
        : `${fallbackError} (HTTP ${res.status})`);
    throw new Error(errorMsg);
  }

  return json as T;
}

// ============================================================================
// 1. PRODUCTS
// ============================================================================

export async function getAdminProducts(token: string): Promise<AdminProduct[]> {
  const res = await fetchWithFallback(API_ENDPOINTS.adminProducts, {
    method: 'GET',
    headers: buildAdminHeaders(token),
  });
  return handleResponse<AdminProduct[]>(res, 'Failed to fetch products');
}

export async function createAdminProduct(
  token: string,
  payload: {
    name: string;
    category: string;
    price: number;
    discount: number;
    stock: number;
    imageUrl?: string;
  }
): Promise<{ success: boolean; message?: string; product?: AdminProduct }> {
  // Website POST /api/admin/products expects multipart/form-data
  const formData = new FormData();
  formData.append('name', payload.name);
  formData.append('category', payload.category);
  formData.append('price', String(payload.price));
  formData.append('discount', String(payload.discount));
  formData.append('stock', String(payload.stock));
  if (payload.imageUrl) {
    formData.append('imageUrl', payload.imageUrl);
  }

  const cleanToken = (token || '').trim();
  const res = await fetchWithFallback(API_ENDPOINTS.adminProducts, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${cleanToken}`,
      Cookie: `token=${cleanToken}`,
      // Note: do not manually set Content-Type for FormData so fetch adds multipart boundary
    },
    body: formData as any,
  });
  return handleResponse(res, 'Failed to create product');
}

export async function updateAdminProduct(
  token: string,
  payload: {
    id: number;
    name: string;
    category: string;
    price: number;
    discount: number;
    stock: number;
    imageUrl?: string;
  }
): Promise<{ success: boolean; message?: string; product?: AdminProduct }> {
  const res = await fetchWithFallback(API_ENDPOINTS.adminProducts, {
    method: 'PUT',
    headers: buildAdminHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse(res, 'Failed to update product');
}

export async function updateAdminProductStock(
  token: string,
  product: AdminProduct,
  newStock: number
): Promise<{ success: boolean; message?: string }> {
  // Only forward imageUrl if it starts with http:// or https://.
  // Relative paths like '/uploads/...' fail backend URL validation with 'Image URL must start with http:// or https://'.
  // Omitting imageUrl preserves the existing image without error.
  const isHttpUrl =
    typeof product.image === 'string' &&
    (product.image.startsWith('http://') || product.image.startsWith('https://'));

  return updateAdminProduct(token, {
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.price,
    discount: product.discount,
    stock: newStock,
    ...(isHttpUrl ? { imageUrl: product.image } : {}),
  });
}


export async function deleteAdminProduct(
  token: string,
  id: number
): Promise<{ success: boolean; message?: string }> {
  const res = await fetchWithFallback(API_ENDPOINTS.adminProducts, {
    method: 'DELETE',
    headers: buildAdminHeaders(token),
    body: JSON.stringify({ id }),
  });
  return handleResponse(res, 'Failed to delete product');
}

// ============================================================================
// 2. ORDERS
// ============================================================================

export async function getAdminOrders(token: string): Promise<AdminOrder[]> {
  const res = await fetchWithFallback(API_ENDPOINTS.adminOrders, {
    method: 'GET',
    headers: buildAdminHeaders(token),
  });
  return handleResponse<AdminOrder[]>(res, 'Failed to fetch orders');
}

export async function updateAdminOrderStatus(
  token: string,
  orderId: number,
  status: string
): Promise<{ success: boolean; message?: string; order?: AdminOrder }> {
  const res = await fetchWithFallback(API_ENDPOINTS.adminOrders, {
    method: 'PUT',
    headers: buildAdminHeaders(token),
    body: JSON.stringify({ orderId, status }),
  });
  return handleResponse(res, 'Failed to update order status');
}

export async function deleteAdminOrder(
  token: string,
  orderId: number
): Promise<{ success: boolean; message?: string }> {
  const res = await fetchWithFallback(API_ENDPOINTS.adminOrders, {
    method: 'DELETE',
    headers: buildAdminHeaders(token),
    body: JSON.stringify({ orderId }),
  });
  return handleResponse(res, 'Failed to delete order');
}

// ============================================================================
// 3. COUPONS
// ============================================================================

export async function getAdminCoupons(
  token: string,
  search?: string,
  status?: string
): Promise<AdminCoupon[]> {
  const endpoint = API_ENDPOINTS.adminCoupons(search, status);
  const res = await fetchWithFallback(endpoint, {
    method: 'GET',
    headers: buildAdminHeaders(token),
  });
  return handleResponse<AdminCoupon[]>(res, 'Failed to fetch coupons');
}

export async function createAdminCoupon(
  token: string,
  payload: {
    code: string;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountValue: number;
    minOrderAmount: number;
    maxDiscount?: number | null;
    usageLimit?: number | null;
    expiresAt?: string | null;
    isActive: boolean;
  }
): Promise<{ success: boolean; message?: string; coupon?: AdminCoupon }> {
  const res = await fetchWithFallback(API_ENDPOINTS.adminCoupons(), {
    method: 'POST',
    headers: buildAdminHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse(res, 'Failed to create coupon');
}

export async function updateAdminCoupon(
  token: string,
  id: number,
  payload: Partial<AdminCoupon>
): Promise<{ success: boolean; message?: string; coupon?: AdminCoupon }> {
  const endpoint = API_ENDPOINTS.adminCoupon(id);
  const res = await fetchWithFallback(endpoint, {
    method: 'PATCH',
    headers: buildAdminHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse(res, 'Failed to update coupon');
}

export async function deleteAdminCoupon(
  token: string,
  id: number
): Promise<{ success: boolean; message?: string }> {
  const endpoint = API_ENDPOINTS.adminCoupon(id);
  const res = await fetchWithFallback(endpoint, {
    method: 'DELETE',
    headers: buildAdminHeaders(token),
  });
  return handleResponse(res, 'Failed to delete coupon');
}

// ============================================================================
// 4. REVIEWS
// ============================================================================

export async function getAdminReviews(
  token: string,
  page = 1,
  limit = 10,
  search = '',
  rating = 'ALL'
): Promise<{ reviews: AdminReview[]; totalPages: number; total: number }> {
  const endpoint = API_ENDPOINTS.adminReviews(page, limit, search, rating);
  const res = await fetchWithFallback(endpoint, {
    method: 'GET',
    headers: buildAdminHeaders(token),
  });
  return handleResponse(res, 'Failed to fetch reviews');
}

export async function deleteAdminReview(
  token: string,
  id: number
): Promise<{ success: boolean; message?: string }> {
  const endpoint = API_ENDPOINTS.adminReview(id);
  const res = await fetchWithFallback(endpoint, {
    method: 'DELETE',
    headers: buildAdminHeaders(token),
  });
  return handleResponse(res, 'Failed to delete review');
}

// ============================================================================
// 5. ANALYTICS
// ============================================================================

export async function getAdminAnalyticsStatus(
  token: string,
  statusFilter: OrderStatusFilter = 'ALL'
): Promise<OrderStatusChartPoint[]> {
  const endpoint = API_ENDPOINTS.adminAnalytics('status', statusFilter);
  const res = await fetchWithFallback(endpoint, {
    method: 'GET',
    headers: buildAdminHeaders(token),
  });
  return handleResponse<OrderStatusChartPoint[]>(res, 'Failed to fetch order status statistics');
}

export async function getAdminAnalyticsSales(
  token: string,
  periodFilter: SalesPeriodFilter = 'date'
): Promise<SalesChartPoint[]> {
  const endpoint = API_ENDPOINTS.adminAnalytics('sales', periodFilter);
  const res = await fetchWithFallback(endpoint, {
    method: 'GET',
    headers: buildAdminHeaders(token),
  });
  return handleResponse<SalesChartPoint[]>(res, 'Failed to fetch sales analytics');
}

// ============================================================================
// 6. USERS
// ============================================================================

export async function getAdminUsers(
  token: string,
  search?: string,
  role?: string
): Promise<AdminUser[]> {
  const endpoint = API_ENDPOINTS.adminUsers(search, role);
  const res = await fetchWithFallback(endpoint, {
    method: 'GET',
    headers: buildAdminHeaders(token),
  });
  return handleResponse<AdminUser[]>(res, 'Failed to fetch users');
}

export async function getAdminUserDetail(
  token: string,
  id: number
): Promise<AdminUserDetail> {
  const endpoint = API_ENDPOINTS.adminUser(id);
  const res = await fetchWithFallback(endpoint, {
    method: 'GET',
    headers: buildAdminHeaders(token),
  });
  return handleResponse<AdminUserDetail>(res, 'Failed to fetch user details');
}

export async function updateAdminUserRole(
  token: string,
  id: number,
  role: 'CUSTOMER' | 'ADMIN'
): Promise<{ success: boolean; message?: string; user?: AdminUser }> {
  const endpoint = API_ENDPOINTS.adminUser(id);
  const res = await fetchWithFallback(endpoint, {
    method: 'PATCH',
    headers: buildAdminHeaders(token),
    body: JSON.stringify({ role }),
  });
  return handleResponse(res, 'Failed to update user role');
}

export async function deleteAdminUser(
  token: string,
  id: number
): Promise<{ success: boolean; message?: string }> {
  const endpoint = API_ENDPOINTS.adminUser(id);
  const res = await fetchWithFallback(endpoint, {
    method: 'DELETE',
    headers: buildAdminHeaders(token),
  });
  return handleResponse(res, 'Failed to delete user');
}


// ============================================================================
// 7. CATEGORIES
// ============================================================================

export async function getAdminCategories(token: string): Promise<AdminCategory[]> {
  const res = await fetchWithFallback(API_ENDPOINTS.adminCategories, {
    method: 'GET',
    headers: buildAdminHeaders(token),
  });
  return handleResponse<AdminCategory[]>(res, 'Failed to fetch categories');
}

export async function createAdminCategory(
  token: string,
  name: string
): Promise<{ success: boolean; message?: string; category?: AdminCategory }> {
  const res = await fetchWithFallback(API_ENDPOINTS.adminCategories, {
    method: 'POST',
    headers: buildAdminHeaders(token),
    body: JSON.stringify({ name }),
  });
  return handleResponse(res, 'Failed to create category');
}

export async function updateAdminCategory(
  token: string,
  id: number,
  name: string
): Promise<{ success: boolean; message?: string; category?: AdminCategory }> {
  const endpoint = API_ENDPOINTS.adminCategory(id);
  const res = await fetchWithFallback(endpoint, {
    method: 'PATCH',
    headers: buildAdminHeaders(token),
    body: JSON.stringify({ name }),
  });
  return handleResponse(res, 'Failed to update category');
}

export async function deleteAdminCategory(
  token: string,
  id: number
): Promise<{ success: boolean; message?: string }> {
  const endpoint = API_ENDPOINTS.adminCategory(id);
  const res = await fetchWithFallback(endpoint, {
    method: 'DELETE',
    headers: buildAdminHeaders(token),
  });
  return handleResponse(res, 'Failed to delete category');
}

// ============================================================================
// 8. REGISTRATIONS
// ============================================================================

export async function getAdminRegistrations(
  token: string,
  search?: string,
  status?: string
): Promise<{ registrations: AdminRegistration[]; pendingCount: number }> {
  const endpoint = API_ENDPOINTS.adminRegistrations(search, status);
  const res = await fetchWithFallback(endpoint, {
    method: 'GET',
    headers: buildAdminHeaders(token),
  });
  return handleResponse(res, 'Failed to fetch registrations');
}

export async function updateAdminRegistrationStatus(
  token: string,
  id: number,
  status: 'APPROVED' | 'DECLINED'
): Promise<{ success: boolean; message?: string; user?: AdminRegistration }> {
  const endpoint = API_ENDPOINTS.adminRegistration(id);
  const res = await fetchWithFallback(endpoint, {
    method: 'PATCH',
    headers: buildAdminHeaders(token),
    body: JSON.stringify({ status }),
  });
  return handleResponse(res, 'Failed to update registration status');
}
