/**
 * ShopEasy Admin Types
 * Definitions for all 8 Admin modules:
 * 1. Products
 * 2. Orders
 * 3. Coupons
 * 4. Reviews
 * 5. Analytics
 * 6. Users
 * 7. Categories
 * 8. Registrations
 */

export type AdminSection =
  | 'overview'
  | 'products'
  | 'orders'
  | 'coupons'
  | 'reviews'
  | 'analytics'
  | 'users'
  | 'categories'
  | 'registrations';

export interface AdminProduct {
  id: number;
  name: string;
  price: number;
  discount: number;
  category: string;
  image: string;
  stock: number;
  averageRating?: number;
  reviewCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminOrderItem {
  id: number;
  productId?: number | null;
  productName?: string | null;
  productImage?: string | null;
  quantity: number;
  price: number;
  product: {
    id?: number | null;
    name: string;
    image: string;
    price?: number;
  };
}

export interface AdminOrder {
  id: number;
  name: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  pincode: string | null;
  subtotal?: number | null;
  discount?: number;
  couponCode?: string | null;
  total: number;
  status: string;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  createdAt: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
  items: AdminOrderItem[];
}

export const ADMIN_ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
] as const;

export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUSES)[number];

export interface AdminCoupon {
  id: number;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  usedCount: number;
  expiresAt?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminReview {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  productId: number;
  productName: string;
  productImage: string;
  rating: number;
  comment: string;
  isVerifiedBuyer: boolean;
  createdAt: string;
}

export interface OrderStatusChartPoint {
  label: string;
  count: number;
}

export interface SalesChartPoint {
  label: string;
  sales: number;
}

export type OrderStatusFilter = 'ALL' | 'PENDING' | 'COMPLETED' | 'DELIVERED';
export type SalesPeriodFilter = 'date' | 'month' | 'year';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN' | string;
  status?: string;
  createdAt: string;
  orderCount: number;
  wishlistCount: number;
  cartItemCount: number;
}

export interface AdminUserDetail {
  id: number;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN' | string;
  status?: string;
  createdAt: string;
  orderCount: number;
  wishlistCount: number;
  cartItemCount: number;
  orders: {
    id: number;
    total: number;
    status: string;
    createdAt: string;
    itemCount: number;
  }[];
  wishlists?: {
    id: number;
    product: {
      id: number;
      name: string;
      price: number;
      image: string;
      category: string;
    };
  }[];
  cartItems?: {
    id: number;
    quantity: number;
    product: {
      id: number;
      name: string;
      price: number;
      image: string;
    };
  }[];
}

export interface AdminCategory {
  id: number;
  name: string;
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminRegistration {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | string;
  createdAt: string;
}
