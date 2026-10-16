export type PaymentMethod = 'COD' | 'RAZORPAY';

export interface RazorpayOrderResponse {
  success: boolean;
  isMock: boolean;
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  message?: string;
}

export interface VerifyPaymentPayload {
  orderId: number;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  message: string;
  order: any;
}
