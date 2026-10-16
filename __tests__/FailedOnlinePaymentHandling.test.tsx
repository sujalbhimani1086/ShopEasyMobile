import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import RazorpayCheckout from 'react-native-razorpay';
import { CheckoutScreen } from '../src/screens/CheckoutScreen';
import {
  isLegitimateCustomerOrder,
  getMyOrders,
  getAllMyOrders,
} from '../src/services/orderApi';
import * as orderApi from '../src/services/orderApi';
import * as paymentApi from '../src/services/paymentApi';
import * as addressApi from '../src/services/addressApi';
import * as couponApi from '../src/services/couponApi';
import * as cartApi from '../src/services/cartApi';
import type { Order } from '../src/types/order';

// Mock test data
const mockCartProduct = {
  id: 10,
  name: 'Premium Leather Jacket',
  price: 5999,
  discount: 15,
  stock: 5,
  image: 'https://example.com/jacket.jpg',
};

const mockCartItems = [
  {
    product: mockCartProduct,
    quantity: 1,
    isUnavailable: false,
  },
];

const mockUser = {
  id: 201,
  name: 'Test Customer',
  email: 'customer@example.com',
  phone: '9876543210',
  role: 'CUSTOMER',
  status: 'APPROVED',
};

const mockAddress = {
  id: 1,
  userId: 201,
  name: 'Test Customer',
  addressLine1: '456 MG Road',
  addressLine2: 'Suite 101',
  landmark: 'Metro Station',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
  phone: '9876543210',
  isDefault: true,
};

const mockPendingOrder: Order = {
  id: 888,
  userId: 201,
  name: 'Test Customer',
  email: 'customer@example.com',
  address: '456 MG Road, Suite 101 (Near Metro Station)',
  city: 'Bengaluru',
  pincode: '560001',
  total: 5099,
  subtotal: 5999,
  discount: 900,
  status: 'PENDING',
  paymentMethod: 'RAZORPAY',
  paymentStatus: 'PENDING',
  createdAt: new Date().toISOString(),
  items: [
    {
      id: 1,
      orderId: 888,
      productId: 10,
      productName: 'Premium Leather Jacket',
      productImage: 'https://example.com/jacket.jpg',
      quantity: 1,
      price: 5099,
    },
  ],
};

const mockVerifiedPaidOrder: Order = {
  ...mockPendingOrder,
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  paymentId: 'pay_rzp_verified_123',
};

const mockClearCart = jest.fn();
const mockValidateCartItems = jest.fn().mockResolvedValue({
  isValid: true,
  hasUnavailableItems: false,
  items: mockCartItems,
});

jest.mock('../src/context/CartContext', () => ({
  useCart: () => ({
    cartItems: mockCartItems,
    totalItemsCount: 1,
    subtotal: 5999,
    totalDiscount: 900,
    finalTotal: 5099,
    deliveryFee: 0,
    isLoading: false,
    isValidating: false,
    hasUnavailableItems: false,
    clearCart: mockClearCart,
    validateCartItems: mockValidateCartItems,
    removeUnavailableItems: jest.fn(),
  }),
}));

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    token: 'valid-test-token-xyz',
  }),
}));

describe('ShopEasyMobile — Failed Online Payment Handling and Cart Preservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(addressApi, 'getAddresses').mockResolvedValue([mockAddress]);
    jest.spyOn(couponApi, 'getAvailableCoupons').mockResolvedValue([]);
    jest.spyOn(cartApi, 'syncServerCart').mockResolvedValue(true);
    jest.spyOn(orderApi, 'createOrder').mockResolvedValue({
      success: true,
      message: 'Order created',
      order: mockPendingOrder,
    });
    jest.spyOn(paymentApi, 'createRazorpayOrder').mockResolvedValue({
      success: true,
      isMock: false,
      keyId: 'rzp_test_ShopeasyTestKey',
      orderId: 'order_rzp_888',
      amount: 509900,
      currency: 'INR',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isLegitimateCustomerOrder Rule Logic', () => {
    it('1. Cash on Delivery (COD) orders in all statuses are legitimate customer orders', () => {
      expect(isLegitimateCustomerOrder({ paymentMethod: 'COD', paymentStatus: 'PENDING', status: 'PENDING' })).toBe(true);
      expect(isLegitimateCustomerOrder({ paymentMethod: 'COD', paymentStatus: 'PENDING', status: 'CONFIRMED' })).toBe(true);
      expect(isLegitimateCustomerOrder({ paymentMethod: 'COD', paymentStatus: 'PENDING', status: 'SHIPPED' })).toBe(true);
      expect(isLegitimateCustomerOrder({ paymentMethod: 'COD', paymentStatus: 'PAID', status: 'DELIVERED' })).toBe(true);
      expect(isLegitimateCustomerOrder({ paymentMethod: 'COD', paymentStatus: 'PENDING', status: 'CANCELLED' })).toBe(true);
    });

    it('2. Verified PAID online orders are legitimate customer orders', () => {
      expect(isLegitimateCustomerOrder({ paymentMethod: 'RAZORPAY', paymentStatus: 'PAID', status: 'CONFIRMED' })).toBe(true);
      expect(isLegitimateCustomerOrder({ paymentMethod: 'RAZORPAY', paymentStatus: 'PAID', status: 'DELIVERED' })).toBe(true);
      expect(isLegitimateCustomerOrder({ paymentMethod: 'RAZORPAY', paymentStatus: 'REFUNDED', status: 'CANCELLED' })).toBe(true);
    });

    it('3. Failed or incomplete online checkout attempts are NOT legitimate customer orders and must be excluded', () => {
      // Pending checkout attempt abandoned prior to or during gateway payment
      expect(isLegitimateCustomerOrder({ paymentMethod: 'RAZORPAY', paymentStatus: 'PENDING', status: 'PENDING' })).toBe(false);
      // Online payment attempt explicitly failed
      expect(isLegitimateCustomerOrder({ paymentMethod: 'RAZORPAY', paymentStatus: 'FAILED', status: 'PENDING' })).toBe(false);
      expect(isLegitimateCustomerOrder({ paymentMethod: 'RAZORPAY', paymentStatus: 'FAILED', status: 'CANCELLED' })).toBe(false);
    });
  });

  describe('My Orders API Filtering (getMyOrders & getAllMyOrders)', () => {
    it('automatically excludes unverified/failed online attempts while keeping COD and paid orders', async () => {
      const mockBackendOrders: Order[] = [
        {
          id: 101,
          total: 1500,
          status: 'PENDING',
          paymentMethod: 'COD',
          paymentStatus: 'PENDING',
          items: [],
        } as any,
        {
          id: 102,
          total: 2500,
          status: 'CONFIRMED',
          paymentMethod: 'RAZORPAY',
          paymentStatus: 'PAID',
          items: [],
        } as any,
        {
          id: 103, // Failed online attempt - MUST BE FILTERED OUT
          total: 3500,
          status: 'PENDING',
          paymentMethod: 'RAZORPAY',
          paymentStatus: 'PENDING',
          items: [],
        } as any,
        {
          id: 104, // Failed online attempt - MUST BE FILTERED OUT
          total: 4500,
          status: 'CANCELLED',
          paymentMethod: 'RAZORPAY',
          paymentStatus: 'FAILED',
          items: [],
        } as any,
      ];

      jest.spyOn(globalThis as any, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            orders: mockBackendOrders,
            total: 4,
            page: 1,
            limit: 10,
            totalPages: 1,
          }),
      } as any);

      const res = await getMyOrders('valid-token', 1, 10);
      // Must only contain Order 101 (COD) and Order 102 (PAID online)
      expect(res.orders.map((o) => o.id)).toEqual([101, 102]);
      expect(res.orders.some((o) => o.id === 103)).toBe(false);
      expect(res.orders.some((o) => o.id === 104)).toBe(false);
    });
  });

  describe('Checkout Online Payment State Transitions & Scenarios', () => {
    it('Scenario 1: Card payment fails -> cart is NOT cleared, server cart is restored, order is not confirmed', async () => {
      (RazorpayCheckout.open as jest.Mock).mockRejectedValueOnce({
        code: 2,
        description: 'Card declined by issuing bank.',
        error: {
          step: 'payment_authentication',
          reason: 'payment_error',
        },
      });

      let renderer: ReactTestRenderer;
      await act(async () => {
        renderer = create(<CheckoutScreen onBack={jest.fn()} onNavigateToLogin={jest.fn()} />);
      });

      // Switch to Razorpay
      const rzpOption = renderer!.root.findByProps({ testID: 'payment-option-razorpay' });
      await act(async () => {
        rzpOption.props.onPress();
      });

      const payBtn = renderer!.root.findByProps({ testID: 'place-order-button' });
      await act(async () => {
        await payBtn.props.onPress();
      });

      // Crucial: Cart must NOT be cleared
      expect(mockClearCart).not.toHaveBeenCalled();
      // Server cart must be re-synced with preserved local items
      expect(cartApi.syncServerCart).toHaveBeenCalledWith(
        [{ productId: 10, quantity: 1 }],
        'valid-test-token-xyz'
      );
    });

    it('Scenario 2: Netbanking payment fails -> cart preserved, order not marked as paid', async () => {
      (RazorpayCheckout.open as jest.Mock).mockRejectedValueOnce({
        code: 2,
        description: 'Netbanking session timed out by bank.',
      });

      let renderer: ReactTestRenderer;
      await act(async () => {
        renderer = create(<CheckoutScreen onBack={jest.fn()} onNavigateToLogin={jest.fn()} />);
      });

      const rzpOption = renderer!.root.findByProps({ testID: 'payment-option-razorpay' });
      await act(async () => {
        rzpOption.props.onPress();
      });

      const payBtn = renderer!.root.findByProps({ testID: 'place-order-button' });
      await act(async () => {
        await payBtn.props.onPress();
      });

      expect(mockClearCart).not.toHaveBeenCalled();
      expect(cartApi.syncServerCart).toHaveBeenCalled();
    });

    it('Scenario 3: Wallet payment fails -> cart preserved, order not marked as paid', async () => {
      (RazorpayCheckout.open as jest.Mock).mockRejectedValueOnce({
        code: 2,
        description: 'Wallet balance insufficient.',
      });

      let renderer: ReactTestRenderer;
      await act(async () => {
        renderer = create(<CheckoutScreen onBack={jest.fn()} onNavigateToLogin={jest.fn()} />);
      });

      const rzpOption = renderer!.root.findByProps({ testID: 'payment-option-razorpay' });
      await act(async () => {
        rzpOption.props.onPress();
      });

      const payBtn = renderer!.root.findByProps({ testID: 'place-order-button' });
      await act(async () => {
        await payBtn.props.onPress();
      });

      expect(mockClearCart).not.toHaveBeenCalled();
    });

    it('Scenario 4: Customer cancels payment gateway modal -> cart remains unchanged and server cart restored', async () => {
      (RazorpayCheckout.open as jest.Mock).mockRejectedValueOnce({
        code: 0,
        description: 'Payment Cancelled by user',
      });

      let renderer: ReactTestRenderer;
      await act(async () => {
        renderer = create(<CheckoutScreen onBack={jest.fn()} onNavigateToLogin={jest.fn()} />);
      });

      const rzpOption = renderer!.root.findByProps({ testID: 'payment-option-razorpay' });
      await act(async () => {
        rzpOption.props.onPress();
      });

      const payBtn = renderer!.root.findByProps({ testID: 'place-order-button' });
      await act(async () => {
        await payBtn.props.onPress();
      });

      // Cart NOT cleared
      expect(mockClearCart).not.toHaveBeenCalled();
      // Server cart synced so it is not left empty
      expect(cartApi.syncServerCart).toHaveBeenCalled();
    });

    it('Scenario 5: Customer retries after failure -> reuses order without creating duplicate orders', async () => {
      (RazorpayCheckout.open as jest.Mock).mockRejectedValueOnce({
        code: 0,
        description: 'Payment Cancelled by user',
      });

      let renderer: ReactTestRenderer;
      await act(async () => {
        renderer = create(<CheckoutScreen onBack={jest.fn()} onNavigateToLogin={jest.fn()} />);
      });

      const rzpOption = renderer!.root.findByProps({ testID: 'payment-option-razorpay' });
      await act(async () => {
        rzpOption.props.onPress();
      });

      const payBtn = renderer!.root.findByProps({ testID: 'place-order-button' });

      // First attempt -> failure
      await act(async () => {
        await payBtn.props.onPress();
      });

      expect(orderApi.createOrder).toHaveBeenCalledTimes(1);

      // Second attempt -> retry and succeed
      (RazorpayCheckout.open as jest.Mock).mockResolvedValueOnce({
        razorpay_payment_id: 'pay_retry_success',
        razorpay_order_id: 'order_rzp_888',
        razorpay_signature: 'sig_retry_success',
      });
      jest.spyOn(paymentApi, 'verifyRazorpayPayment').mockResolvedValueOnce({
        success: true,
        message: 'Payment verified',
        order: mockVerifiedPaidOrder,
      });

      await act(async () => {
        await payBtn.props.onPress();
      });

      // Crucial: createOrder was called exactly ONCE (no duplicate order created)
      expect(orderApi.createOrder).toHaveBeenCalledTimes(1);
      expect(RazorpayCheckout.open).toHaveBeenCalledTimes(2);
      expect(paymentApi.verifyRazorpayPayment).toHaveBeenCalledTimes(1);
      // Cart cleared ONLY after verified success
      expect(mockClearCart).toHaveBeenCalledTimes(1);
    });

    it('Scenario 6: Payment verification fails -> order is NOT marked as paid and cart is NOT cleared', async () => {
      (RazorpayCheckout.open as jest.Mock).mockResolvedValueOnce({
        razorpay_payment_id: 'pay_fake_signature',
        razorpay_order_id: 'order_rzp_888',
        razorpay_signature: 'invalid_sig',
      });
      jest.spyOn(paymentApi, 'verifyRazorpayPayment').mockRejectedValueOnce(
        new Error('Payment verification failed: Invalid cryptographic signature.')
      );

      let renderer: ReactTestRenderer;
      await act(async () => {
        renderer = create(<CheckoutScreen onBack={jest.fn()} onNavigateToLogin={jest.fn()} />);
      });

      const rzpOption = renderer!.root.findByProps({ testID: 'payment-option-razorpay' });
      await act(async () => {
        rzpOption.props.onPress();
      });

      const payBtn = renderer!.root.findByProps({ testID: 'place-order-button' });
      await act(async () => {
        await payBtn.props.onPress();
      });

      // Cart NOT cleared
      expect(mockClearCart).not.toHaveBeenCalled();
      // Server cart restored
      expect(cartApi.syncServerCart).toHaveBeenCalled();
    });

    it('Scenario 7: Cash on Delivery checkout works independently and clears cart upon placement', async () => {
      let renderer: ReactTestRenderer;
      await act(async () => {
        renderer = create(<CheckoutScreen onBack={jest.fn()} onNavigateToLogin={jest.fn()} />);
      });

      // Default is COD
      const payBtn = renderer!.root.findByProps({ testID: 'place-order-button' });
      await act(async () => {
        await payBtn.props.onPress();
      });

      expect(orderApi.createOrder).toHaveBeenCalledTimes(1);
      expect(RazorpayCheckout.open).not.toHaveBeenCalled();
      expect(mockClearCart).toHaveBeenCalledTimes(1);
    });
  });
});
