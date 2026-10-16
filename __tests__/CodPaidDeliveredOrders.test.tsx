import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OrdersScreen } from '../src/screens/OrdersScreen';
import { OrderDetailsScreen } from '../src/screens/OrderDetailsScreen';
import { getOrderPaymentDisplay } from '../src/services/orderApi';
import * as orderApi from '../src/services/orderApi';
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
jest.mock('../src/theme/theme', () => ({
  useAppTheme: () => ({
    isDark: false,
    colors: {
      background: '#F8F9FA',
      card: '#FFFFFF',
      surfaceSubtle: '#F1F3F5',
      text: '#111827',
      textSecondary: '#4B5563',
      textMuted: '#6B7280',
      border: '#E5E7EB',
      borderLight: '#F3F4F6',
      primary: '#111827',
      primaryText: '#FFFFFF',
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

describe('Automatically Display COD PAID for Delivered Orders', () => {
  describe('getOrderPaymentDisplay helper rules', () => {
    it('Rule 1: Delivered + COD -> COD • PAID', () => {
      const display = getOrderPaymentDisplay('COD', 'PENDING', 'DELIVERED');
      expect(display.label).toBe('COD • PAID');
      expect(display.isPaid).toBe(true);
      expect(display.method).toBe('COD');
    });

    it('Rule 2: Completed + COD -> COD • PAID', () => {
      const display = getOrderPaymentDisplay('COD', 'PENDING', 'COMPLETED');
      expect(display.label).toBe('COD • PAID');
      expect(display.isPaid).toBe(true);
      expect(display.method).toBe('COD');
    });

    it('Handles case-insensitivity: delivered/completed and cod', () => {
      expect(getOrderPaymentDisplay('cod', 'pending', 'delivered').label).toBe('COD • PAID');
      expect(getOrderPaymentDisplay('Cod', 'pending', 'completed').label).toBe('COD • PAID');
      expect(getOrderPaymentDisplay('CASH_ON_DELIVERY', 'pending', 'Delivered').label).toBe('COD • PAID');
      expect(getOrderPaymentDisplay('CASH ON DELIVERY', 'pending', 'Completed').label).toBe('COD • PAID');
    });

    it('Rule 3: Pending + COD -> Keep existing payment status (COD • PENDING)', () => {
      const display = getOrderPaymentDisplay('COD', 'PENDING', 'PENDING');
      expect(display.label).toBe('COD • PENDING');
      expect(display.isPaid).toBe(false);
      expect(display.method).toBe('COD');
    });

    it('Rule 4: Confirmed + COD -> Keep existing payment status (COD • PENDING)', () => {
      const display = getOrderPaymentDisplay('COD', 'PENDING', 'CONFIRMED');
      expect(display.label).toBe('COD • PENDING');
      expect(display.isPaid).toBe(false);
      expect(display.method).toBe('COD');
    });

    it('Rule 5: Packed + COD -> Keep existing payment status (COD • PENDING)', () => {
      const display = getOrderPaymentDisplay('COD', 'PENDING', 'PACKED');
      expect(display.label).toBe('COD • PENDING');
      expect(display.isPaid).toBe(false);
      expect(display.method).toBe('COD');
    });

    it('Rule 6: Shipped + COD -> Keep existing payment status (COD • PENDING)', () => {
      const display = getOrderPaymentDisplay('COD', 'PENDING', 'SHIPPED');
      expect(display.label).toBe('COD • PENDING');
      expect(display.isPaid).toBe(false);
      expect(display.method).toBe('COD');
    });

    it('Rule 7: Any online payment method -> Keep existing payment status regardless of order status', () => {
      // Delivered + Razorpay PAID -> Online • PAID
      expect(getOrderPaymentDisplay('RAZORPAY', 'PAID', 'DELIVERED').label).toBe('Online • PAID');
      // Delivered + Razorpay PENDING -> Online • PENDING
      expect(getOrderPaymentDisplay('RAZORPAY', 'PENDING', 'DELIVERED').label).toBe('Online • PENDING');
      // Completed + Online PAID -> Online • PAID
      expect(getOrderPaymentDisplay('ONLINE', 'PAID', 'COMPLETED').label).toBe('Online • PAID');
      // Completed + Online PENDING -> Online • PENDING
      expect(getOrderPaymentDisplay('ONLINE', 'PENDING', 'COMPLETED').label).toBe('Online • PENDING');
      // Shipped + Online PAID -> Online • PAID
      expect(getOrderPaymentDisplay('ONLINE', 'PAID', 'SHIPPED').label).toBe('Online • PAID');
    });

    it('COD order with stored PAID status remains COD • PAID for any status', () => {
      expect(getOrderPaymentDisplay('COD', 'PAID', 'SHIPPED').label).toBe('COD • PAID');
      expect(getOrderPaymentDisplay('COD', 'PAID', 'DELIVERED').label).toBe('COD • PAID');
    });
  });

  describe('UI Screen Verification', () => {
    const deliveredCodOrder: Order = {
      id: 501,
      userId: 1,
      name: 'Rahul Verma',
      city: 'Delhi',
      address: 'Sector 14, Rohini',
      total: 1999,
      discount: 0,
      status: 'DELIVERED',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING', // Stored as PENDING in DB, but delivered!
      createdAt: '2026-10-05T12:00:00.000Z',
      items: [
        {
          id: 1,
          orderId: 501,
          productId: 10,
          productName: 'Smart Fitness Band',
          price: 1999,
          quantity: 1,
        },
      ],
    };

    const shippedCodOrder: Order = {
      id: 502,
      userId: 1,
      name: 'Rahul Verma',
      city: 'Delhi',
      address: 'Sector 14, Rohini',
      total: 2499,
      discount: 0,
      status: 'SHIPPED',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      createdAt: '2026-10-11T12:00:00.000Z',
      items: [
        {
          id: 2,
          orderId: 502,
          productId: 12,
          productName: 'Bluetooth Speaker',
          price: 2499,
          quantity: 1,
        },
      ],
    };

    beforeEach(() => {
      jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
        orders: [deliveredCodOrder, shippedCodOrder],
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      jest.spyOn(orderApi, 'getOrderDetails').mockResolvedValue(deliveredCodOrder);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('My Orders page: Delivered COD order displays COD • PAID, while Shipped COD order displays COD • PENDING', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen />);
      });

      const texts = getAllRenderedStrings(renderer!.root);
      expect(texts).toContain('COD • PAID');
      expect(texts).toContain('COD • PENDING');
    });

    it('Order Details page: Delivered COD order displays COD • PAID', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(
          <OrderDetailsScreen orderId={501} initialOrder={deliveredCodOrder} onBack={jest.fn()} />
        );
      });

      const texts = getAllRenderedStrings(renderer!.root);
      expect(texts).toContain('COD • PAID');
    });

    it('Order Details page: Shipped COD order retains COD • PENDING', async () => {
      jest.spyOn(orderApi, 'getOrderDetails').mockResolvedValue(shippedCodOrder);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(
          <OrderDetailsScreen orderId={502} initialOrder={shippedCodOrder} onBack={jest.fn()} />
        );
      });

      const texts = getAllRenderedStrings(renderer!.root);
      expect(texts).toContain('COD • PENDING');
      expect(texts).not.toContain('COD • PAID');
    });
  });
});
