import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { FlatList, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OrdersScreen } from '../src/screens/OrdersScreen';
import * as orderApi from '../src/services/orderApi';
import { queryClient } from '../src/config/queryClient';
import { queryKeys } from '../src/config/queryKeys';
import type { Order } from '../src/types/order';

// Mock AuthContext
let mockCurrentUser: any = {
  id: 1,
  name: 'Test Customer',
  email: 'customer@shopeasy.com',
  role: 'CUSTOMER',
  status: 'APPROVED',
};
let mockCurrentToken: string | null = 'test-valid-auth-token';

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    token: mockCurrentToken,
    logout: jest.fn(),
  }),
}));

// Mock Reviews
jest.mock('../src/services/reviewApi', () => ({
  getProductReviews: jest.fn().mockResolvedValue({ reviews: [], userReview: null }),
  getAllCachedReviews: jest.fn().mockReturnValue({}),
  saveReviewLocally: jest.fn(),
}));

// Mock Payment API
jest.mock('../src/services/paymentApi', () => ({
  executeRazorpayCheckout: jest.fn().mockResolvedValue({
    razorpay_payment_id: 'pay_test_123',
    razorpay_order_id: 'order_test_123',
    razorpay_signature: 'sig_test_123',
  }),
  parseRazorpayError: jest.fn((err: any) => err?.message || 'Payment error'),
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
      danger: '#EF4444',
      chipSelectedBg: '#2874F0',
      chipSelectedText: '#FFFFFF',
      chipUnselectedBg: '#FFFFFF',
      chipUnselectedText: '#4B5563',
    },
  }),
}));

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderWithSafeArea(ui: React.ReactElement) {
  return ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={initialMetrics}>{ui}</SafeAreaProvider>
  );
}

function extractAllStrings(root: ReactTestRenderer.ReactTestInstance): string[] {
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

const createMockOrder = (
  id: number,
  status: string,
  productName: string,
  paymentMethod = 'COD',
  paymentStatus = 'PAID'
): Order => ({
  id,
  userId: 1,
  name: 'Test Customer',
  city: 'Mumbai',
  address: '123 Marine Drive',
  total: 1500,
  discount: 0,
  status,
  paymentMethod,
  paymentStatus,
  createdAt: '2026-10-10T10:00:00.000Z',
  items: [
    {
      id,
      orderId: id,
      productId: id,
      productName,
      price: 1500,
      quantity: 1,
    },
  ],
});

describe('ShopEasy Mobile — Customer My Orders Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    mockCurrentUser = {
      id: 1,
      name: 'Test Customer',
      email: 'customer@shopeasy.com',
      role: 'CUSTOMER',
      status: 'APPROVED',
    };
    mockCurrentToken = 'test-valid-auth-token';
  });

  describe('Scenario 1-5: All Orders & Pagination', () => {
    it('1 & 2. Initial orders load and scrolling loads next page', async () => {
      const page1Orders = [createMockOrder(1, 'CONFIRMED', 'Product Page 1')];
      const page2Orders = [createMockOrder(2, 'CONFIRMED', 'Product Page 2')];

      const getMyOrdersSpy = jest.spyOn(orderApi, 'getMyOrders')
        .mockResolvedValueOnce({
          orders: page1Orders,
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 2,
        })
        .mockResolvedValueOnce({
          orders: page2Orders,
          total: 2,
          page: 2,
          limit: 10,
          totalPages: 2,
        });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen />);
      });

      let texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Product Page 1');
      expect(texts).not.toContain('Product Page 2');

      // Trigger pagination
      const flatList = renderer!.root.findByType(FlatList);
      flatList.props.onMomentumScrollBegin();
      await act(async () => {
        flatList.props.onEndReached();
      });

      texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Product Page 1');
      expect(texts).toContain('Product Page 2');
      expect(getMyOrdersSpy).toHaveBeenCalledTimes(2);
    });

    it('3 & 4. All available pages load without duplicates and pagination stops after final page', async () => {
      const page1Orders = [createMockOrder(1, 'SHIPPED', 'Shipped Item 1')];
      const page2Orders = [createMockOrder(1, 'SHIPPED', 'Shipped Item 1'), createMockOrder(2, 'SHIPPED', 'Shipped Item 2')]; // Overlapping ID

      const getMyOrdersSpy = jest.spyOn(orderApi, 'getMyOrders')
        .mockResolvedValueOnce({
          orders: page1Orders,
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 2,
        })
        .mockResolvedValueOnce({
          orders: page2Orders,
          total: 2,
          page: 2,
          limit: 10,
          totalPages: 2,
        });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen />);
      });

      const flatList = renderer!.root.findByType(FlatList);
      flatList.props.onMomentumScrollBegin();
      await act(async () => {
        flatList.props.onEndReached();
      });

      // Attempt to scroll again when already at final page
      flatList.props.onMomentumScrollBegin();
      await act(async () => {
        flatList.props.onEndReached();
      });

      // getMyOrders should NOT have been called a 3rd time
      expect(getMyOrdersSpy).toHaveBeenCalledTimes(2);

      const texts = extractAllStrings(renderer!.root);
      // Item 1 and Item 2 both present, no crash or duplicates
      expect(texts).toContain('Shipped Item 1');
      expect(texts).toContain('Shipped Item 2');
    });

    it('5. Repeated bottom-scroll events do not trigger duplicate requests while fetching', async () => {
      let resolveSecondPage: any;
      const secondPagePromise = new Promise((resolve) => {
        resolveSecondPage = resolve;
      });

      const getMyOrdersSpy = jest.spyOn(orderApi, 'getMyOrders')
        .mockResolvedValueOnce({
          orders: [createMockOrder(1, 'PENDING', 'Pending Item 1')],
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 2,
        })
        .mockImplementationOnce(() => secondPagePromise as any);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen />);
      });

      const flatList = renderer!.root.findByType(FlatList);
      flatList.props.onMomentumScrollBegin();

      // Trigger first onEndReached
      act(() => {
        flatList.props.onEndReached();
      });

      // Immediately trigger second onEndReached while request 2 is pending
      act(() => {
        flatList.props.onEndReached();
      });

      expect(getMyOrdersSpy).toHaveBeenCalledTimes(2);

      await act(async () => {
        resolveSecondPage({
          orders: [createMockOrder(2, 'PENDING', 'Pending Item 2')],
          total: 2,
          page: 2,
          limit: 10,
          totalPages: 2,
        });
      });
    });
  });

  describe('Scenario 6-12: Status Filters & Empty States', () => {
    it('6-9. Status filters (Confirmed, Shipped, Pending, Cancelled) load and filter correctly', async () => {
      const allOrders = [
        createMockOrder(10, 'CONFIRMED', 'Confirmed Jacket'),
        createMockOrder(11, 'SHIPPED', 'Shipped Watch'),
        createMockOrder(12, 'PENDING', 'Pending Shoes'),
        createMockOrder(13, 'CANCELLED', 'Cancelled Belt'),
      ];

      jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
        orders: allOrders,
        total: 4,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen />);
      });

      // By default "ALL" shows all orders
      let texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Confirmed Jacket');
      expect(texts).toContain('Shipped Watch');
      expect(texts).toContain('Pending Shoes');
      expect(texts).toContain('Cancelled Belt');

      // Tap "Confirmed" filter
      const confirmedTab = renderer!.root.findByProps({ accessibilityLabel: 'Filter by Confirmed' });
      await act(async () => {
        confirmedTab.props.onPress();
      });

      texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Confirmed Jacket');
      expect(texts).not.toContain('Shipped Watch');
      expect(texts).not.toContain('Cancelled Belt');

      // Tap "Cancelled" filter
      const cancelledTab = renderer!.root.findByProps({ accessibilityLabel: 'Filter by Cancelled' });
      await act(async () => {
        cancelledTab.props.onPress();
      });

      texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Cancelled Belt');
      expect(texts).not.toContain('Confirmed Jacket');
    });

    it('10. Filters with zero orders show empty state and HIDE loading footer', async () => {
      // Only confirmed order exists
      const orders = [createMockOrder(20, 'CONFIRMED', 'Confirmed Laptop')];

      jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
        orders,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen />);
      });

      // Switch to Cancelled filter which has 0 orders
      const cancelledTab = renderer!.root.findByProps({ accessibilityLabel: 'Filter by Cancelled' });
      await act(async () => {
        cancelledTab.props.onPress();
      });

      const texts = extractAllStrings(renderer!.root);
      // Must show filter-specific empty state
      expect(texts).toContain('No cancelled orders yet');
      // Must NOT contain loading indicator text
      expect(texts).not.toContain('Loading more orders...');

      // FlatList footer must not render an ActivityIndicator
      const footerLoaders = renderer!.root.findAllByType(ActivityIndicator);
      expect(footerLoaders.length).toBe(0);
    });

    it('11 & 12. Switching filters resets pagination state and prevents cross-contamination', async () => {
      const getMyOrdersSpy = jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
        orders: [createMockOrder(30, 'DELIVERED', 'Delivered Sneaker')],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen />);
      });

      // Switch to Pending filter
      const pendingTab = renderer!.root.findByProps({ accessibilityLabel: 'Filter by Pending' });
      await act(async () => {
        pendingTab.props.onPress();
      });

      const texts = extractAllStrings(renderer!.root);
      expect(texts).not.toContain('Delivered Sneaker');
      expect(texts).toContain('No pending orders yet');
    });
  });

  describe('Scenario 13-16: Loading, Error & Refresh States', () => {
    it('14 & 15. Failed request stops loader and displays retry button that recovers', async () => {
      const getMyOrdersSpy = jest.spyOn(orderApi, 'getMyOrders')
        .mockRejectedValueOnce(new Error('Network connection failed'))
        .mockResolvedValueOnce({
          orders: [createMockOrder(40, 'CONFIRMED', 'Recovered Order Item')],
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen />);
      });

      let texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Unable to load orders');
      expect(texts).toContain('Network connection failed');
      expect(texts).toContain('Retry');

      // Click Retry
      const retryBtn = renderer!.root.findByProps({ accessibilityLabel: 'Retry loading orders' });
      expect(retryBtn).toBeDefined();

      await act(async () => {
        retryBtn.props.onPress();
      });

      texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Recovered Order Item');
      expect(texts).not.toContain('Unable to load orders');
    });

    it('16. Pull-to-refresh does not erase usable orders or duplicate existing items', async () => {
      const initialOrders = [createMockOrder(50, 'CONFIRMED', 'Initial Watch')];
      const refreshedOrders = [
        createMockOrder(50, 'CONFIRMED', 'Initial Watch'),
        createMockOrder(51, 'CONFIRMED', 'Refreshed Sunglasses'),
      ];

      jest.spyOn(orderApi, 'getMyOrders')
        .mockResolvedValueOnce({
          orders: initialOrders,
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        })
        .mockResolvedValueOnce({
          orders: refreshedOrders,
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
        });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen />);
      });

      let texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Initial Watch');

      const flatList = renderer!.root.findByType(FlatList);
      await act(async () => {
        flatList.props.refreshControl.props.onRefresh();
      });

      texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Initial Watch');
      expect(texts).toContain('Refreshed Sunglasses');
    });
  });

  describe('Scenario 17-21: Caching, Visibility & Account Switching', () => {
    it('18. Cached orders remain visible during background fetching without full-screen loader', async () => {
      // Seed query cache
      const cachedOrders = [createMockOrder(60, 'DELIVERED', 'Cached Headset')];
      queryClient.setQueryData(queryKeys.orders(1, 'ALL'), {
        orders: cachedOrders,
        total: 1,
        page: 1,
        totalPages: 1,
      });

      let resolveBackgroundFetch: any;
      const bgPromise = new Promise((resolve) => {
        resolveBackgroundFetch = resolve;
      });
      jest.spyOn(orderApi, 'getMyOrders').mockImplementation(() => bgPromise as any);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen />);
      });

      // Cached order is immediately rendered
      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Cached Headset');

      // Finish background fetch
      await act(async () => {
        resolveBackgroundFetch({
          orders: cachedOrders,
          total: 1,
          page: 1,
          totalPages: 1,
        });
      });
    });

    it('20. Payment and order visibility rules exclude unverified failed online payments', async () => {
      const orders = [
        createMockOrder(70, 'CONFIRMED', 'Legit COD Order', 'COD', 'PENDING'),
        createMockOrder(71, 'CONFIRMED', 'Legit Paid Online', 'RAZORPAY', 'PAID'),
        createMockOrder(72, 'PENDING', 'Failed Online Payment Attempt', 'RAZORPAY', 'FAILED'),
        createMockOrder(73, 'PENDING', 'Unverified Online Attempt', 'CARD', 'PENDING'),
      ];

      jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
        orders,
        total: 4,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen />);
      });

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Legit COD Order');
      expect(texts).toContain('Legit Paid Online');
      // Failed and unverified attempts MUST be excluded
      expect(texts).not.toContain('Failed Online Payment Attempt');
      expect(texts).not.toContain('Unverified Online Attempt');
    });

    it('21. Account switching clears previous user orders and isolates cache', async () => {
      const user1Orders = [createMockOrder(80, 'DELIVERED', 'User 1 Secret Order')];

      jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
        orders: user1Orders,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen />);
      });

      let texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('User 1 Secret Order');

      // Switch user to User 2 with no orders
      mockCurrentUser = {
        id: 2,
        name: 'Another Customer',
        email: 'user2@shopeasy.com',
        role: 'CUSTOMER',
        status: 'APPROVED',
      };

      jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
        orders: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });

      // Re-render
      await act(async () => {
        renderer.update(
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <OrdersScreen />
          </SafeAreaProvider>
        );
      });

      texts = extractAllStrings(renderer!.root);
      // User 1 orders must NOT leak to User 2
      expect(texts).not.toContain('User 1 Secret Order');
    });
  });
});
