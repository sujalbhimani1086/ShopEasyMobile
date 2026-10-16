import { Platform } from 'react-native';

/**
 * ShopEasy API Configuration
 *
 * Android Emulator:
 *   Routes host machine localhost to 10.0.2.2.
 *
 * Physical Android Phone:
 *   - Works over `adb reverse tcp:3000 tcp:3000` (using http://localhost:3000)
 *   - Or over local Wi-Fi (e.g. http://192.168.29.47:3000)
 */
export const DEFAULT_API_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:3000',
  ios: 'http://localhost:3000',
  default: 'http://localhost:3000',
}) as string;

export const CANDIDATE_BASE_URLS: string[] = Platform.OS === 'android'
  ? ['http://localhost:3000', 'http://10.0.2.2:3000', 'http://192.168.29.47:3000']
  : ['http://localhost:3000'];

let activeBaseUrl = DEFAULT_API_BASE_URL;

export function getApiBaseUrl(): string {
  return activeBaseUrl;
}

export function setApiBaseUrl(url: string) {
  activeBaseUrl = url;
}

export const API_BASE_URL = DEFAULT_API_BASE_URL;

export const API_ENDPOINTS = {
  products: (
    pageOrParams:
      | number
      | {
          page?: number;
          limit?: number;
          category?: string;
          search?: string;
          sort?: string;
          minPrice?: number;
          maxPrice?: number;
          inStockOnly?: boolean;
        } = 1,
    limit = 12,
    category = 'all',
    search = '',
    sort = 'default'
  ) => {
    let p = 1;
    let l = 12;
    let c = 'all';
    let s = '';
    let st = 'default';
    let minP: number | undefined;
    let maxP: number | undefined;
    let inStock: boolean | undefined;

    if (typeof pageOrParams === 'object' && pageOrParams !== null) {
      p = pageOrParams.page ?? 1;
      l = pageOrParams.limit ?? 12;
      c = pageOrParams.category ?? 'all';
      s = pageOrParams.search ?? '';
      st = pageOrParams.sort ?? 'default';
      minP = pageOrParams.minPrice;
      maxP = pageOrParams.maxPrice;
      inStock = pageOrParams.inStockOnly;
    } else {
      p = pageOrParams;
      l = limit;
      c = category;
      s = search;
      st = sort;
    }

    const queryParts = [
      `page=${encodeURIComponent(p)}`,
      `limit=${encodeURIComponent(l)}`,
      `category=${encodeURIComponent(c)}`,
    ];
    if (s && s.trim()) {
      queryParts.push(`search=${encodeURIComponent(s.trim())}`);
    }
    if (st && st !== 'default') {
      queryParts.push(`sort=${encodeURIComponent(st)}`);
    }
    if (typeof minP === 'number' && Number.isFinite(minP)) {
      queryParts.push(`minPrice=${encodeURIComponent(minP)}`);
    }
    if (typeof maxP === 'number' && Number.isFinite(maxP)) {
      queryParts.push(`maxPrice=${encodeURIComponent(maxP)}`);
    }
    if (inStock) {
      queryParts.push(`inStockOnly=true`);
    }

    return `/api/products?${queryParts.join('&')}`;
  },
  product: (id: number | string) => `/api/products/${encodeURIComponent(String(id))}`,
  banner: '/api/products?banner=true',
  categories: '/api/categories',
  login: '/api/login',
  register: '/api/register',
  authMe: '/api/auth/me',
  registrationStatus: (email: string) =>
    `/api/auth/registration-status?email=${encodeURIComponent(email)}`,
  orders: (page = 1, limit = 10, status?: string) => {
    let url = `/api/orders?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`;
    if (status && status !== 'ALL') {
      url += `&status=${encodeURIComponent(status)}`;
    }
    return url;
  },
  order: (id: number | string) => `/api/orders/${encodeURIComponent(String(id))}`,
  orderTracking: (id: number | string) => `/api/orders/${encodeURIComponent(String(id))}/tracking`,
  cart: '/api/cart',
  wishlist: '/api/wishlist',
  addresses: '/api/addresses',
  address: (id: number | string) => `/api/addresses/${encodeURIComponent(String(id))}`,
  defaultAddress: (id: number | string) => `/api/addresses/${encodeURIComponent(String(id))}/default`,
  razorpayCreateOrder: '/api/payment/razorpay/create-order',
  razorpayVerify: '/api/payment/razorpay/verify',
  coupons: '/api/coupons',
  validateCoupon: '/api/coupons/validate',
  notifications: (limit = 20) => `/api/notifications?limit=${encodeURIComponent(limit)}`,
  notificationRead: (id: number | string) => `/api/notifications/${encodeURIComponent(String(id))}/read`,
  notificationsReadAll: '/api/notifications/read-all',
  dismissNotification: (id: number | string) => `/api/notifications/${encodeURIComponent(String(id))}`,
  registerPushToken: '/api/notifications/register-token',
  supportFaqs: '/api/support/faqs',
  supportTickets: '/api/support/tickets',
  supportTicket: (id: number | string) => `/api/support/tickets/${encodeURIComponent(String(id))}`,
  supportTicketMessages: (id: number | string) => `/api/support/tickets/${encodeURIComponent(String(id))}/messages`,
  adminProducts: '/api/admin/products',
  adminOrders: '/api/admin/orders',
  adminCategories: '/api/admin/categories',
  adminCategory: (id: number | string) => `/api/admin/categories/${encodeURIComponent(String(id))}`,
  adminCoupons: (search?: string, status?: string) => {
    const params = [];
    if (search && search.trim()) params.push(`search=${encodeURIComponent(search.trim())}`);
    if (status && status !== 'ALL') params.push(`status=${encodeURIComponent(status)}`);
    return `/api/admin/coupons${params.length ? `?${params.join('&')}` : ''}`;
  },
  adminCoupon: (id: number | string) => `/api/admin/coupons/${encodeURIComponent(String(id))}`,
  adminReviews: (page = 1, limit = 10, search = '', rating = 'ALL') => {
    const params = [`page=${encodeURIComponent(page)}`, `limit=${encodeURIComponent(limit)}`];
    if (search && search.trim()) params.push(`search=${encodeURIComponent(search.trim())}`);
    if (rating && rating !== 'ALL') params.push(`rating=${encodeURIComponent(rating)}`);
    return `/api/admin/reviews?${params.join('&')}`;
  },
  adminReview: (id: number | string) => `/api/admin/reviews/${encodeURIComponent(String(id))}`,
  adminAnalytics: (type?: string, statusOrPeriod?: string) => {
    const params = [];
    if (type) params.push(`type=${encodeURIComponent(type)}`);
    if (type === 'status' && statusOrPeriod) params.push(`status=${encodeURIComponent(statusOrPeriod)}`);
    if (type === 'sales' && statusOrPeriod) params.push(`period=${encodeURIComponent(statusOrPeriod)}`);
    return `/api/admin/analytics${params.length ? `?${params.join('&')}` : ''}`;
  },
  adminUsers: (search?: string, role?: string) => {
    const params = [];
    if (search && search.trim()) params.push(`search=${encodeURIComponent(search.trim())}`);
    if (role && role !== 'ALL') params.push(`role=${encodeURIComponent(role)}`);
    return `/api/admin/users${params.length ? `?${params.join('&')}` : ''}`;
  },
  adminUser: (id: number | string) => `/api/admin/users/${encodeURIComponent(String(id))}`,
  adminRegistrations: (search?: string, status?: string) => {
    const params = [];
    if (search && search.trim()) params.push(`search=${encodeURIComponent(search.trim())}`);
    if (status && status !== 'ALL') params.push(`status=${encodeURIComponent(status)}`);
    return `/api/admin/registrations${params.length ? `?${params.join('&')}` : ''}`;
  },
  adminRegistration: (id: number | string) => `/api/admin/registrations/${encodeURIComponent(String(id))}`,
};

/** High-quality placeholder image for missing or failed product images */
export const FALLBACK_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80';

/**
 * Normalizes relative image paths to full absolute URLs required by React Native Image.
 * External URLs (such as Unsplash) are preserved.
 */
export function resolveImageUrl(src?: string | null): string {
  if (!src || !src.trim()) {
    return FALLBACK_PRODUCT_IMAGE;
  }
  const clean = src.trim();
  if (clean.toLowerCase().includes('placeholder.png') || clean.toLowerCase().includes('placeholder.jpg')) {
    return FALLBACK_PRODUCT_IMAGE;
  }
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }
  const path = clean.startsWith('/') ? clean : `/${clean}`;
  return `${getApiBaseUrl()}${path}`;
}

/**
 * Extracts the correct image URL for an order item, checking product.image,
 * productImage, and falling back gracefully.
 */
export function getOrderItemImage(item?: {
  productImage?: string | null;
  product?: { image?: string | null };
  image?: string | null;
}): string {
  if (!item) return FALLBACK_PRODUCT_IMAGE;
  const raw =
    (item.product?.image && item.product.image.trim()) ||
    (item.productImage && item.productImage.trim()) ||
    (item.image && item.image.trim()) ||
    '';
  return resolveImageUrl(raw);
}

