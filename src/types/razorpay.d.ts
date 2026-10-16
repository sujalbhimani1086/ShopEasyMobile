declare module 'react-native-razorpay' {
  export interface RazorpayCheckoutOptions {
    description?: string;
    image?: string;
    currency: string;
    key: string;
    amount: number | string;
    name: string;
    order_id: string;
    prefill?: {
      email?: string;
      contact?: string;
      name?: string;
      method?: string;
      [key: string]: any;
    };
    theme?: {
      color?: string;
      backdrop_color?: string;
    };
    modal?: {
      backdropclose?: boolean;
      escape?: boolean;
      handleback?: boolean;
      confirm_close?: boolean;
      animation?: boolean;
      ondismiss?: () => void;
    };
    retry?: {
      enabled?: boolean;
      max_count?: number;
    };
    send_sms_hash?: boolean;
    notes?: Record<string, string>;
    [key: string]: any;
  }

  export interface RazorpaySuccessResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }

  export interface RazorpayErrorResponse {
    code: number;
    description: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: {
      order_id?: string;
      payment_id?: string;
    };
  }

  export default class RazorpayCheckout {
    static open(
      options: RazorpayCheckoutOptions,
      successCallback?: (data: RazorpaySuccessResponse) => void,
      errorCallback?: (data: RazorpayErrorResponse) => void
    ): Promise<RazorpaySuccessResponse>;
    static onExternalWalletSelection(
      externalWalletCallback: (data: any) => void
    ): void;
  }
}
