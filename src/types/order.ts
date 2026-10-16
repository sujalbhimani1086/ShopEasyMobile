export interface OrderProduct {
  id?: number;
  name: string;
  image: string;
  price?: number;
  category?: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId?: number | null;
  productName?: string | null;
  productImage?: string | null;
  quantity: number;
  price: number;
  product?: OrderProduct;
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PACKED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | string;

export interface Order {
  id: number;
  userId: number;
  name?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  pincode?: string | null;
  subtotal?: number | null;
  discount: number;
  couponCode?: string | null;
  couponId?: number | null;
  total: number;
  status: OrderStatus;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  paymentId?: string | null;
  createdAt: string;
  items: OrderItem[];
  tracking?: any[];
}

export interface CreateOrderItemPayload {
  productId: number;
  quantity: number;
}

export interface CreateOrderPayload {
  name: string;
  email: string;
  address: string;
  city: string;
  pincode: string;
  items: CreateOrderItemPayload[];
  couponCode?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentId?: string;
}

export interface CreateOrderResponse {
  success: boolean;
  message: string;
  order: Order;
}

export interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CancelOrderResponse {
  success: boolean;
  message: string;
  order?: Order;
}
