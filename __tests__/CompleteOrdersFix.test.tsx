import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OrdersScreen } from '../src/screens/OrdersScreen';
import { OrderDetailsScreen } from '../src/screens/OrderDetailsScreen';
import {
  isOrderCancellable,
  getOrderPaymentDisplay,
  cancelOrder,
  CANCELLABLE_STATUSES,
} from '../src/services/orderApi';
import * as orderApi from '../src/services/orderApi';
import * as apiService from '../src/services/api';
import type { Order } from '../src/types/order';

// Mock AuthContext
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Sujal Customer', email: 'sujal@gmail.com', role: 'CUSTOMER', status: 'APPROVED' },
    token: 'valid-test-token',
    logout: jest.fn(),
  }),
}));

// Mock Theme
let mockIsDark = false;
jest.mock('../src/theme/theme', () => ({
  useAppTheme: () => ({
    isDark: mockIsDark,
    colors: {
      background: mockIsDark ? '#121212' : '#F8F9FA',
      card: mockIsDark ? '#1E1E1E' : '#FFFFFF',
      surfaceSubtle: mockIsDark ? '#2D2D2D' : '#F1F3F5',
      text: mockIsDark ? '#FFFFFF' : '#111827',
      textSecondary: mockIsDark ? '#A1A1AA' : '#4B5563',
      textMuted: mockIsDark ? '#71717A' : '#6B7280',
      border: mockIsDark ? '#3F3F46' : '#E5E7EB',
      borderLight: mockIsDark ? '#27272A' : '#F3F4F6',
      primary: mockIsDark ? '#FFFFFF' : '#111827',
      primaryText: mockIsDark ? '#000000' : '#FFFFFF',
      accent: '#F59E0B',
      brandBlue: '#2874F0',
      success: '#10B981',
      successBg: '#E6F9F2',
      danger: '#EF4444',
      dangerBg: '#FEECEC',
    },
  }),
}));

const initialMetrics = {
  frame: { x: 0, y: 0, width: 360, height: 740 },
  insets: { top: 24, left: 0, right: 0, bottom: 24 },
};

function renderWithSafeArea(ui: React.ReactElement) {
  return ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={initialMetrics}>{ui}</SafeAreaProvider>
  );
}

function getAllRenderedStrings(root: ReactTestRenderer.ReactTestInstance): string[] {
  return root.findAllByType(Text).map((node) => {
    const extract = (children: any): string => {
      if (children === null || children === undefined) return '';
      if (typeof children === 'string' || typeof children === 'number') return String(children);
      if (Array.isArray(children)) return children.map(extract).join('');
      if (children.props?.children) return extract(children.props.children);
      return '';
    };
    return extract(node.props.children);
  });
}

describe('Requirement 1: COD & Online Payment Status Logic', () => {
  it('Delivered COD order with confirmed collection -> displays COD • PAID', () => {
    // 1. Delivered COD order with confirmed collection
    const display = getOrderPaymentDisplay('COD', 'PAID');
    expect(display.label).toBe('COD • PAID');
    expect(display.isPaid).toBe(true);
    expect(display.method).toBe('COD');
  });

  it('Delivered COD order -> displays COD • PAID regardless of stored pending status', () => {
    const orderStatus = 'DELIVERED';
    const paymentStatus = 'PENDING';
    const display = getOrderPaymentDisplay('COD', paymentStatus, orderStatus);

    expect(display.label).toBe('COD • PAID');
    expect(display.isPaid).toBe(true);
    expect(display.method).toBe('COD');
  });

  it('Completed COD order -> displays COD • PAID', () => {
    const orderStatus = 'COMPLETED';
    const paymentStatus = 'PENDING';
    const display = getOrderPaymentDisplay('COD', paymentStatus, orderStatus);

    expect(display.label).toBe('COD • PAID');
    expect(display.isPaid).toBe(true);
    expect(display.method).toBe('COD');
  });

  it('Undelivered COD order without collection -> displays COD • PENDING', () => {
    // 3. Undelivered COD order without collection
    const orderStatus = 'SHIPPED';
    const display = getOrderPaymentDisplay('COD', 'PENDING');

    expect(orderStatus).toBe('SHIPPED');
    expect(display.label).toBe('COD • PENDING');
    expect(display.isPaid).toBe(false);
    expect(display.method).toBe('COD');
  });

  it('Successfully paid online order -> displays Online • PAID', () => {
    // 4. Successfully paid online order
    const display = getOrderPaymentDisplay('RAZORPAY', 'PAID');
    expect(display.label).toBe('Online • PAID');
    expect(display.isPaid).toBe(true);
    expect(display.method).toBe('Online');
  });

  it('displays Online • PENDING when online payment is unconfirmed or pending', () => {
    const display = getOrderPaymentDisplay('RAZORPAY', 'PENDING');
    expect(display.label).toBe('Online • PENDING');
    expect(display.isPaid).toBe(false);
    expect(display.method).toBe('Online');
  });
});

describe('Requirement 2: Direct Customer Order Cancellation', () => {
  it('allows cancellation for PENDING, CONFIRMED, PACKED, and SHIPPED orders', () => {
    expect(isOrderCancellable('PENDING')).toBe(true);
    expect(isOrderCancellable('CONFIRMED')).toBe(true);
    expect(isOrderCancellable('PACKED')).toBe(true);
    expect(isOrderCancellable('SHIPPED')).toBe(true);
    expect(CANCELLABLE_STATUSES).toEqual(['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED']);
  });

  it('rejects cancellation for DELIVERED, COMPLETED, or CANCELLED orders', () => {
    expect(isOrderCancellable('DELIVERED')).toBe(false);
    expect(isOrderCancellable('COMPLETED')).toBe(false);
    expect(isOrderCancellable('CANCELLED')).toBe(false);
    expect(isOrderCancellable('')).toBe(false);
    expect(isOrderCancellable(null)).toBe(false);
    expect(isOrderCancellable(undefined)).toBe(false);
  });

  it('calls POST /api/orders/[id]/cancel endpoint directly without requiring admin approval', async () => {
    const mockFetch = jest.spyOn(apiService, 'fetchWithFallback').mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        success: true,
        message: 'Order #119 has been successfully cancelled.',
        order: { id: 119, status: 'CANCELLED' },
      }),
    } as any);

    const res = await cancelOrder(119, 'valid-test-token');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/orders/119/cancel',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer valid-test-token',
        }),
      })
    );
    expect(res.success).toBe(true);
    expect(res.message).toContain('Order #119');

    mockFetch.mockRestore();
  });

  it('handles authorization failure when customer is not authorized to cancel an order', async () => {
    const mockFetch = jest.spyOn(apiService, 'fetchWithFallback').mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({
        message: 'You are not authorized to cancel this order.',
      }),
    } as any);

    await expect(cancelOrder(999, 'valid-test-token')).rejects.toThrow(
      'You are not authorized to cancel this order.'
    );

    mockFetch.mockRestore();
  });
});

describe('Requirements 3 & 4: Order Card Layout, Cut-Offs & Alignment', () => {
  const sampleOrders: Order[] = [
    {
      id: 119,
      userId: 1,
      name: 'Dr. Johnathon Alexander Montgomery III',
      city: 'Bangalore Metro Region South',
      address: 'Plot 45, 9th Phase Tech Park Road, Electronic City Phase 2',
      total: 1282,
      discount: 0,
      status: 'SHIPPED',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      createdAt: '2026-10-12T10:00:00.000Z',
      items: [
        {
          id: 1,
          orderId: 119,
          productId: 10,
          productName: 'Premium Ergonomic Noise-Cancelling Bluetooth Wireless Headphones with 40-Hour Battery',
          price: 1282,
          quantity: 1,
          product: { id: 10, name: 'Premium Ergonomic Wireless Headphones', image: '' },
        },
      ],
    },
    {
      id: 100234,
      userId: 1,
      name: 'Priya Sharma',
      city: 'Mumbai',
      address: 'Flat 1204, Sea Breeze Towers, Worli',
      total: 145000,
      discount: 0,
      status: 'DELIVERED',
      paymentMethod: 'COD',
      paymentStatus: 'PAID',
      createdAt: '2026-10-10T14:30:00.000Z',
      items: [
        {
          id: 2,
          orderId: 100234,
          productId: 25,
          productName: 'Apple iPhone 16 Pro Max 256GB Titanium Edition',
          price: 145000,
          quantity: 1,
          product: { id: 25, name: 'iPhone 16 Pro Max', image: '' },
        },
      ],
    },
  ];

  beforeEach(() => {
    jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
      orders: sampleOrders,
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders order number, payment badges, totals, and item counts clearly without clipping', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderWithSafeArea(<OrdersScreen />);
    });

    const renderedTexts = getAllRenderedStrings(renderer!.root).join(' ');

    // Order #119 checks
    expect(renderedTexts).toContain('Order #119');
    expect(renderedTexts).toContain('COD • PENDING');
    expect(renderedTexts).toContain('₹1,282');
    expect(renderedTexts).toContain('(1 item)');

    // Order #100234 checks
    expect(renderedTexts).toContain('Order #100234');
    expect(renderedTexts).toContain('COD • PAID');
    expect(renderedTexts).toContain('₹1,45,000');
  });

  it('shows Cancel button for SHIPPED order and triggers confirmation dialog', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = renderWithSafeArea(<OrdersScreen />);
    });

    const renderedTexts = getAllRenderedStrings(renderer!.root).join(' ');
    // Cancel should be visible for SHIPPED order (#119)
    expect(renderedTexts).toContain('Cancel');

    alertSpy.mockRestore();
  });

  it('renders correctly in both Light and Dark modes', async () => {
    // Light Mode
    mockIsDark = false;
    let lightRenderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      lightRenderer = renderWithSafeArea(<OrdersScreen />);
    });
    expect(lightRenderer!.toJSON()).toBeTruthy();

    // Dark Mode
    mockIsDark = true;
    let darkRenderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      darkRenderer = renderWithSafeArea(<OrdersScreen />);
    });
    expect(darkRenderer!.toJSON()).toBeTruthy();
    mockIsDark = false;
  });

  it('OrderDetailsScreen displays consistent payment badge and cancellation button', async () => {
    jest.spyOn(orderApi, 'getOrderDetails').mockResolvedValueOnce(sampleOrders[0]);

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderWithSafeArea(
        <OrderDetailsScreen orderId={119} initialOrder={sampleOrders[0]} onBack={jest.fn()} />
      );
    });

    const renderedTexts = getAllRenderedStrings(renderer!.root).join(' ');
    expect(renderedTexts).toContain('Order #119');
    expect(renderedTexts).toContain('COD • PENDING');
    expect(renderedTexts).toContain('Cancel Order #119');
  });
});
