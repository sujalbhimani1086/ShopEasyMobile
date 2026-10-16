import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { CheckoutScreen } from '../src/screens/CheckoutScreen';
import RazorpayCheckout from 'react-native-razorpay';
import * as orderApi from '../src/services/orderApi';
import * as paymentApi from '../src/services/paymentApi';
import * as addressApi from '../src/services/addressApi';
import * as couponApi from '../src/services/couponApi';

// Mock data
const mockCartItems = [
  {
    product: {
      id: 1,
      name: 'Wireless Headphones',
      price: 1999,
      discount: 10,
      stock: 10,
      image: 'https://example.com/headphones.jpg',
    },
    quantity: 2,
    isUnavailable: false,
  },
];

const mockUser = {
  id: 101,
  name: 'John Doe',
  email: 'john@example.com',
  phone: '9876543210',
  role: 'CUSTOMER',
  status: 'APPROVED',
};

const mockAddress = {
  id: 1,
  userId: 101,
  name: 'John Doe',
  addressLine1: '123 Baker Street',
  addressLine2: 'Apt 4B',
  landmark: 'City Center',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  phone: '9876543210',
  isDefault: true,
};

const mockCreatedOrder = {
  id: 501,
  userId: 101,
  name: 'John Doe',
  email: 'john@example.com',
  address: '123 Baker Street, Apt 4B (Near City Center)',
  city: 'Mumbai',
  pincode: '400001',
  total: 3598,
  status: 'PENDING',
  paymentMethod: 'RAZORPAY',
  paymentStatus: 'PENDING',
  items: [
    {
      id: 1,
      orderId: 501,
      productId: 1,
      quantity: 2,
      price: 1799,
      product: mockCartItems[0].product,
    },
  ],
};

const mockPaidOrder = {
  ...mockCreatedOrder,
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  paymentId: 'pay_test_9999',
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
    totalItemsCount: 2,
    subtotal: 3998,
    totalDiscount: 400,
    finalTotal: 3598,
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
    token: 'mock-valid-jwt-token',
  }),
}));

describe('Official Razorpay Checkout Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(addressApi, 'getAddresses').mockResolvedValue([mockAddress]);
    jest.spyOn(couponApi, 'getAvailableCoupons').mockResolvedValue([]);
    jest.spyOn(orderApi, 'createOrder').mockResolvedValue({
      success: true,
      message: 'Order placed successfully',
      order: mockCreatedOrder as any,
    });
    jest.spyOn(paymentApi, 'createRazorpayOrder').mockResolvedValue({
      success: true,
      isMock: false,
      keyId: 'rzp_test_ShopeasyTestKey',
      orderId: 'order_rzp_501',
      amount: 359800,
      currency: 'INR',
    });
    jest.spyOn(paymentApi, 'verifyRazorpayPayment').mockResolvedValue({
      success: true,
      message: 'Payment verified successfully.',
      order: mockPaidOrder as any,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. Triggers official Razorpay SDK with genuine configuration options when Razorpay is selected', async () => {
    (RazorpayCheckout.open as jest.Mock).mockResolvedValueOnce({
      razorpay_payment_id: 'pay_test_success_123',
      razorpay_order_id: 'order_rzp_501',
      razorpay_signature: 'sig_test_valid_signature_123',
    });

    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <CheckoutScreen onBack={jest.fn()} onNavigateToLogin={jest.fn()} />
      );
    });

    // Select Razorpay option via testID
    const rzpOption = renderer!.root.findByProps({ testID: 'payment-option-razorpay' });
    expect(rzpOption).toBeDefined();

    await act(async () => {
      rzpOption.props.onPress();
    });

    // Tap Place Order button via testID
    const payBtn = renderer!.root.findByProps({ testID: 'place-order-button' });
    expect(payBtn).toBeDefined();

    await act(async () => {
      await payBtn.props.onPress();
    });

    // Verify backend Razorpay order initialization was called
    expect(paymentApi.createRazorpayOrder).toHaveBeenCalledWith(
      3598,
      501,
      'mock-valid-jwt-token'
    );

    // Verify official RazorpayCheckout.open was invoked with correct SDK options
    expect(RazorpayCheckout.open).toHaveBeenCalledTimes(1);
    const openedOptions = (RazorpayCheckout.open as jest.Mock).mock.calls[0][0];

    expect(openedOptions.key).toBe('rzp_test_ShopeasyTestKey');
    expect(openedOptions.order_id).toBe('order_rzp_501');
    expect(openedOptions.amount).toBe(359800);
    expect(openedOptions.currency).toBe('INR');
    expect(openedOptions.name).toBe('ShopEasy Store');
    expect(openedOptions.theme.color).toBe('#000000');
    expect(openedOptions.prefill.email).toBe('john@example.com');
  });

  it('2. Verifies cryptographic signature with backend before marking order as paid and clearing cart', async () => {
    (RazorpayCheckout.open as jest.Mock).mockResolvedValueOnce({
      razorpay_payment_id: 'pay_test_9999',
      razorpay_order_id: 'order_rzp_501',
      razorpay_signature: 'sig_test_verified_9999',
    });

    const onOrderSuccessMock = jest.fn();

    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <CheckoutScreen
          onBack={jest.fn()}
          onNavigateToLogin={jest.fn()}
          onOrderSuccess={onOrderSuccessMock}
        />
      );
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

    // Verify server-side verification payload
    expect(paymentApi.verifyRazorpayPayment).toHaveBeenCalledWith(
      {
        orderId: 501,
        razorpayOrderId: 'order_rzp_501',
        razorpayPaymentId: 'pay_test_9999',
        razorpaySignature: 'sig_test_verified_9999',
      },
      'mock-valid-jwt-token'
    );

    // Verify cart was cleared ONLY after verification succeeded
    expect(mockClearCart).toHaveBeenCalled();
    expect(onOrderSuccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
      })
    );
  });

  it('3. Handles user cancellation without creating duplicate orders on subsequent payment retry', async () => {
    // User cancels the Razorpay payment modal
    (RazorpayCheckout.open as jest.Mock).mockRejectedValueOnce({
      code: 0,
      description: 'Payment Cancelled by user',
    });

    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <CheckoutScreen onBack={jest.fn()} onNavigateToLogin={jest.fn()} />
      );
    });

    // Switch to Razorpay
    const rzpOption = renderer!.root.findByProps({ testID: 'payment-option-razorpay' });
    await act(async () => {
      rzpOption.props.onPress();
    });

    const payBtn = renderer!.root.findByProps({ testID: 'place-order-button' });

    // First attempt -> user cancels
    await act(async () => {
      await payBtn.props.onPress();
    });

    expect(orderApi.createOrder).toHaveBeenCalledTimes(1);
    expect(paymentApi.verifyRazorpayPayment).not.toHaveBeenCalled();
    expect(mockClearCart).not.toHaveBeenCalled();

    // Second attempt -> retry paying
    (RazorpayCheckout.open as jest.Mock).mockResolvedValueOnce({
      razorpay_payment_id: 'pay_test_retry_ok',
      razorpay_order_id: 'order_rzp_501',
      razorpay_signature: 'sig_test_retry_ok',
    });

    await act(async () => {
      await payBtn.props.onPress();
    });

    // Crucial: createOrder was NOT called again (no duplicate order created!)
    expect(orderApi.createOrder).toHaveBeenCalledTimes(1);
    expect(RazorpayCheckout.open).toHaveBeenCalledTimes(2);
    expect(paymentApi.verifyRazorpayPayment).toHaveBeenCalledTimes(1);
  });

  it('4. Handles gateway failure and displays appropriate error without marking order as paid', async () => {
    (RazorpayCheckout.open as jest.Mock).mockRejectedValueOnce({
      code: 2,
      description: 'Card declined by issuing bank.',
    });

    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <CheckoutScreen onBack={jest.fn()} onNavigateToLogin={jest.fn()} />
      );
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

    // Verification must not be called
    expect(paymentApi.verifyRazorpayPayment).not.toHaveBeenCalled();
    // Cart must not be cleared
    expect(mockClearCart).not.toHaveBeenCalled();
  });

  it('5. Cash on delivery functions independently and does not invoke Razorpay', async () => {
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <CheckoutScreen onBack={jest.fn()} onNavigateToLogin={jest.fn()} />
      );
    });

    // COD is default payment method
    const payBtn = renderer!.root.findByProps({ testID: 'place-order-button' });
    await act(async () => {
      await payBtn.props.onPress();
    });

    expect(orderApi.createOrder).toHaveBeenCalledTimes(1);
    expect(RazorpayCheckout.open).not.toHaveBeenCalled();
    expect(paymentApi.createRazorpayOrder).not.toHaveBeenCalled();
    expect(paymentApi.verifyRazorpayPayment).not.toHaveBeenCalled();
    expect(mockClearCart).toHaveBeenCalled();
  });

  it('6. UPI option is absent from payment selector, while COD and Cards/NetBanking/Wallets remain available', async () => {
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <CheckoutScreen onBack={jest.fn()} onNavigateToLogin={jest.fn()} />
      );
    });

    // Verify payment-option-upi is completely absent
    const upiOption = renderer!.root.findAllByProps({ testID: 'payment-option-upi' });
    expect(upiOption.length).toBe(0);

    // Verify supported options are present
    const codOption = renderer!.root.findByProps({ testID: 'payment-option-cod' });
    expect(codOption).toBeDefined();

    const rzpOption = renderer!.root.findByProps({ testID: 'payment-option-razorpay' });
    expect(rzpOption).toBeDefined();
  });

  it('7. Razorpay checkout opens with valid standard options without UPI method prefill', async () => {
    (RazorpayCheckout.open as jest.Mock).mockResolvedValueOnce({
      razorpay_payment_id: 'pay_rzp_success_888',
      razorpay_order_id: 'order_rzp_501',
      razorpay_signature: 'sig_rzp_valid_888',
    });

    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <CheckoutScreen onBack={jest.fn()} onNavigateToLogin={jest.fn()} />
      );
    });

    // Select Razorpay option
    const rzpOption = renderer!.root.findByProps({ testID: 'payment-option-razorpay' });
    await act(async () => {
      rzpOption.props.onPress();
    });

    // Tap Place Order button
    const payBtn = renderer!.root.findByProps({ testID: 'place-order-button' });
    await act(async () => {
      await payBtn.props.onPress();
    });

    // Verify order was created with paymentMethod: 'RAZORPAY'
    expect(orderApi.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethod: 'RAZORPAY' }),
      'mock-valid-jwt-token'
    );

    // Verify RazorpayCheckout.open was called with standard options without prefill.method: 'upi'
    expect(RazorpayCheckout.open).toHaveBeenCalledTimes(1);
    const openedOptions = (RazorpayCheckout.open as jest.Mock).mock.calls[0][0];
    expect(openedOptions.prefill.method).toBeUndefined();
    expect(openedOptions.order_id).toBe('order_rzp_501');
    expect(openedOptions.amount).toBe(359800);
    expect(openedOptions.currency).toBe('INR');

    // Verify server signature verification
    expect(paymentApi.verifyRazorpayPayment).toHaveBeenCalledWith(
      {
        orderId: 501,
        razorpayOrderId: 'order_rzp_501',
        razorpayPaymentId: 'pay_rzp_success_888',
        razorpaySignature: 'sig_rzp_valid_888',
      },
      'mock-valid-jwt-token'
    );
  });

  it('8. Handles gateway failure and preserves verification security without marking order as paid', async () => {
    (RazorpayCheckout.open as jest.Mock).mockRejectedValueOnce({
      code: 2,
      description: 'Transaction failed',
      reason: 'payment_failed',
    });

    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <CheckoutScreen onBack={jest.fn()} onNavigateToLogin={jest.fn()} />
      );
    });

    const rzpOption = renderer!.root.findByProps({ testID: 'payment-option-razorpay' });
    await act(async () => {
      rzpOption.props.onPress();
    });

    const payBtn = renderer!.root.findByProps({ testID: 'place-order-button' });
    await act(async () => {
      await payBtn.props.onPress();
    });

    // Verification must NOT be called
    expect(paymentApi.verifyRazorpayPayment).not.toHaveBeenCalled();
    // Cart must not be cleared
    expect(mockClearCart).not.toHaveBeenCalled();
  });
});
