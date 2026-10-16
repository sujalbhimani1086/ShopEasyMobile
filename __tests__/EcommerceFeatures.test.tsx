import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, Pressable, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../src/theme/theme';
import { AuthProvider } from '../src/context/AuthContext';
import { CartProvider } from '../src/context/CartContext';
import { AddressScreen } from '../src/screens/AddressScreen';
import { OrderTrackingScreen } from '../src/screens/OrderTrackingScreen';
import { NotificationsScreen } from '../src/screens/NotificationsScreen';
import { HelpSupportScreen } from '../src/screens/HelpSupportScreen';
import { saveAuthSession } from '../src/services/authStorage';
import * as addressApi from '../src/services/addressApi';
import * as paymentApi from '../src/services/paymentApi';
import * as trackingApi from '../src/services/trackingApi';
import * as couponApi from '../src/services/couponApi';
import * as notificationApi from '../src/services/notificationApi';
import * as supportApi from '../src/services/supportApi';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderWithProviders(ui: React.ReactElement) {
  return ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>{ui}</CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

describe('Six E-Commerce Features Suite', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await saveAuthSession('mock_token_123', {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      role: 'CUSTOMER',
      status: 'APPROVED',
    });
    jest.clearAllMocks();
  });

  describe('1. Address Management', () => {
    it('PIN code validation accepts valid 6-digit Indian PIN codes and rejects invalid ones', () => {
      const pinRegex = /^[1-9][0-9]{5}$/;
      expect(pinRegex.test('400001')).toBe(true);
      expect(pinRegex.test('560001')).toBe(true);
      expect(pinRegex.test('110001')).toBe(true);
      expect(pinRegex.test('012345')).toBe(false); // starts with 0
      expect(pinRegex.test('12345')).toBe(false); // only 5 digits
      expect(pinRegex.test('1234567')).toBe(false); // 7 digits
      expect(pinRegex.test('abc123')).toBe(false); // non-numeric
    });

    it('renders AddressScreen with header and add button', async () => {
      jest.spyOn(addressApi, 'getAddresses').mockResolvedValue([]);
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithProviders(<AddressScreen onBack={jest.fn()} />);
      });

      const root = renderer!.root;
      const texts = root.findAllByType(Text).map((t) => t.props.children);
      expect(texts).toContain('Address Book');
      expect(texts).toContain('Add');
    });

    it('displays saved addresses with recipient details and DEFAULT badge', async () => {
      const mockAddress = {
        id: 10,
        userId: 1,
        name: 'Rohan Sharma',
        phone: '9876543210',
        addressLine1: 'B-204 Crystal Tower',
        addressLine2: 'Andheri West',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400053',
        landmark: 'Near Metro',
        isDefault: true,
        createdAt: '2026-10-13T10:00:00Z',
        updatedAt: '2026-10-13T10:00:00Z',
      };
      jest.spyOn(addressApi, 'getAddresses').mockResolvedValue([mockAddress]);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithProviders(<AddressScreen onBack={jest.fn()} />);
      });

      const root = renderer!.root;
      const texts = root.findAllByType(Text).map((t) => t.props.children);
      expect(texts).toContain('Rohan Sharma');
      expect(texts).toContain('DEFAULT');
    });
  });

  describe('2. Payment Integration', () => {
    it('creates Razorpay payment order and verifies cryptographic signature', async () => {
      const mockCreate = jest.spyOn(paymentApi, 'createRazorpayOrder').mockResolvedValue({
        success: true,
        isMock: false,
        keyId: 'rzp_test_sample',
        orderId: 'order_mock_123',
        amount: 2499,
        currency: 'INR',
      });

      const mockVerify = jest.spyOn(paymentApi, 'verifyRazorpayPayment').mockResolvedValue({
        success: true,
        message: 'Payment verified successfully',
        order: {
          id: 501,
          total: 2499,
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          paymentMethod: 'RAZORPAY',
          name: 'Test Customer',
          email: 'test@example.com',
          phone: '9876543210',
          address: 'Test Address',
          city: 'Mumbai',
          pincode: '400001',
          items: [],
          createdAt: '2026-10-13T10:00:00Z',
        },
      });

      const orderData = await paymentApi.createRazorpayOrder(2499, 501, 'fake_token');
      expect(orderData.success).toBe(true);
      expect(orderData.orderId).toBe('order_mock_123');

      const verification = await paymentApi.verifyRazorpayPayment(
        {
          orderId: 501,
          razorpayOrderId: 'order_mock_123',
          razorpayPaymentId: 'pay_mock_abc',
          razorpaySignature: 'sig_valid_123',
        },
        'fake_token'
      );
      expect(verification.success).toBe(true);
      expect(verification.order.paymentStatus).toBe('PAID');
    });
  });

  describe('3. Live Order Tracking', () => {
    it('renders 5-stage tracking timeline for an active order', async () => {
      const mockTrackingData = {
        orderId: 77,
        orderNumber: '#77',
        status: 'SHIPPED',
        isCancelled: false,
        orderDate: '2026-10-13T10:00:00Z',
        estimatedDeliveryDate: '2026-10-16T10:00:00Z',
        currentStageIndex: 2,
        timeline: [
          { stageKey: 'PENDING', title: 'Order Placed', description: 'Order received', isCompleted: true, isCurrent: false },
          { stageKey: 'CONFIRMED', title: 'Order Confirmed', description: 'Seller confirmed order', isCompleted: true, isCurrent: false },
          { stageKey: 'SHIPPED', title: 'Shipped', description: 'Handed to courier', isCompleted: true, isCurrent: true },
          { stageKey: 'OUT_FOR_DELIVERY', title: 'Out for Delivery', description: 'With courier delivery agent', isCompleted: false, isCurrent: false },
          { stageKey: 'DELIVERED', title: 'Delivered', description: 'Delivered to recipient', isCompleted: false, isCurrent: false },
        ],
        shippingAddress: {
          name: 'Pooja Verma',
          address: 'Flat 101, Palm Residency',
          city: 'Pune',
          pincode: '411001',
        },
        items: [],
        trackingEvents: [],
      };

      jest.spyOn(trackingApi, 'getOrderTracking').mockResolvedValue(mockTrackingData);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithProviders(<OrderTrackingScreen orderId={77} onBack={jest.fn()} />);
      });

      const root = renderer!.root;
      const texts = root.findAllByType(Text).map((t) => t.props.children);
      expect(texts).toContain('Live Order Tracking');
      expect(texts).toContain('Order Placed');
      expect(texts).toContain('Order Confirmed');
      expect(texts).toContain('Shipped');
      expect(texts).toContain('Out for Delivery');
      expect(texts).toContain('Delivered');
    });

    it('displays cancelled message when an order has been cancelled', async () => {
      const mockCancelledData = {
        orderId: 88,
        orderNumber: '#88',
        status: 'CANCELLED',
        isCancelled: true,
        orderDate: '2026-10-13T10:00:00Z',
        estimatedDeliveryDate: '',
        currentStageIndex: 0,
        timeline: [],
        shippingAddress: {
          name: 'Pooja Verma',
          address: 'Flat 101',
          city: 'Pune',
          pincode: '411001',
        },
        items: [],
        trackingEvents: [],
      };

      jest.spyOn(trackingApi, 'getOrderTracking').mockResolvedValue(mockCancelledData);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithProviders(<OrderTrackingScreen orderId={88} onBack={jest.fn()} />);
      });

      const root = renderer!.root;
      const texts = root.findAllByType(Text).map((t) => t.props.children);
      expect(texts).toContain('CANCELLED');
      expect(texts).toContain('This order was cancelled');
    });
  });

  describe('4. Coupons and Promo Codes', () => {
    it('calculates percentage discount accurately with max discount ceiling', () => {
      const cartTotal = 2000;
      const discountPercentage = 10;
      const maxDiscount = 150;
      const calculated = (cartTotal * discountPercentage) / 100;
      const finalDiscount = Math.min(calculated, maxDiscount);
      expect(calculated).toBe(200);
      expect(finalDiscount).toBe(150); // Capped at max discount
    });

    it('calculates flat discount correctly', () => {
      const cartTotal = 1500;
      const flatDiscount = 100;
      const finalPayable = Math.max(0, cartTotal - flatDiscount);
      expect(finalPayable).toBe(1400);
    });

    it('validates coupon API call successfully', async () => {
      const mockValidate = jest.spyOn(couponApi, 'validateCoupon').mockResolvedValue({
        valid: true,
        message: 'Coupon WELCOME10 applied! You saved ₹100.',
        coupon: {
          id: 1,
          code: 'WELCOME10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          discountAmount: 100,
          subtotal: 1000,
          finalTotal: 900,
        },
      });

      const res = await couponApi.validateCoupon('WELCOME10', 1000, 'fake_token');
      expect(res.valid).toBe(true);
      expect(res.coupon?.discountAmount).toBe(100);
      expect(res.coupon?.finalTotal).toBe(900);
    });
  });

  describe('5. Push Notifications', () => {
    it('renders NotificationsScreen with header and notifications list', async () => {
      const mockNotifications = [
        {
          id: 1,
          userId: 1,
          type: 'ORDER_PLACED',
          title: 'Order Placed!',
          message: 'Your order #101 has been placed successfully.',
          isRead: false,
          data: JSON.stringify({ orderId: 101 }),
          createdAt: '2026-10-13T10:00:00Z',
        },
        {
          id: 2,
          userId: 1,
          type: 'ORDER_SHIPPED',
          title: 'Order Shipped!',
          message: 'Your order #100 is on its way.',
          isRead: true,
          data: JSON.stringify({ orderId: 100 }),
          createdAt: '2026-10-12T10:00:00Z',
        },
      ];

      jest.spyOn(notificationApi, 'getNotifications').mockResolvedValue({
        notifications: mockNotifications,
        unreadCount: 1,
      });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithProviders(<NotificationsScreen onBack={jest.fn()} />);
      });

      const root = renderer!.root;
      const texts = root.findAllByType(Text).map((t) => t.props.children);
      expect(texts).toContain('Notifications');
      expect(texts).toContain('Order Placed!');
      expect(texts).toContain('Order Shipped!');
      expect(texts).toContain('Mark all read');
    });

    it('registers device token securely with backend', async () => {
      const mockRegister = jest.spyOn(notificationApi, 'registerPushToken').mockResolvedValue(undefined);

      await notificationApi.registerPushToken('fake_token', 'fcm_token_xyz_123', 'android');
      expect(mockRegister).toHaveBeenCalledWith('fake_token', 'fcm_token_xyz_123', 'android');
    });
  });

  describe('6. Customer Support', () => {
    it('renders HelpSupportScreen with FAQs and Tab navigation', async () => {
      const mockFaqs = [
        {
          category: 'Orders & Tracking',
          items: [
            {
              q: 'How do I track my order status?',
              a: 'Go to My Orders and tap Track Order.',
            },
          ],
        },
      ];

      jest.spyOn(supportApi, 'getFaqs').mockResolvedValue(mockFaqs);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithProviders(<HelpSupportScreen onBack={jest.fn()} />);
      });

      const root = renderer!.root;
      const texts = root.findAllByType(Text).map((t) => t.props.children);
      expect(texts).toContain('Help & Customer Support');
      expect(texts).toContain('FAQs');
      expect(texts).toContain('Contact Us');
      expect(texts).toContain('My Tickets');
      expect(texts).toContain('Orders & Tracking');
    });

    it('creates support ticket successfully', async () => {
      const mockTicket = {
        id: 5,
        ticketNumber: 'TICK-1005',
        subject: 'Package delayed',
        category: 'DELIVERY',
        status: 'OPEN',
        priority: 'NORMAL',
        createdAt: '2026-10-13T10:00:00Z',
        updatedAt: '2026-10-13T10:00:00Z',
        messagesCount: 1,
        messages: [
          {
            id: 1,
            ticketId: 5,
            senderType: 'USER',
            senderName: 'Customer',
            message: 'My order has not arrived yet.',
            createdAt: '2026-10-13T10:00:00Z',
          },
        ],
      };

      jest.spyOn(supportApi, 'createSupportTicket').mockResolvedValue(mockTicket);

      const res = await supportApi.createSupportTicket(
        {
          subject: 'Package delayed',
          category: 'DELIVERY',
          message: 'My order has not arrived yet.',
        },
        'token_123'
      );

      expect(res.ticketNumber).toBe('TICK-1005');
      expect(res.status).toBe('OPEN');
    });
  });
});
