export interface Coupon {
  id: number;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED' | string;
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number | null;
  expiresAt?: string | null;
}

export interface AppliedCouponInfo {
  id: number;
  code: string;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  subtotal: number;
  finalTotal: number;
}

export interface ValidateCouponResponse {
  valid: boolean;
  coupon?: AppliedCouponInfo;
  message: string;
}

export interface AvailableCouponsResponse {
  coupons: Coupon[];
}
