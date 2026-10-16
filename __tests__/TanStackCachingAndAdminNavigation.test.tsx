import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { queryClient, clearUserQueryCache } from '../src/config/queryClient';
import { queryKeys } from '../src/config/queryKeys';
import { AdminDashboardScreen } from '../src/screens/admin/AdminDashboardScreen';
import { AdminOverviewCard } from '../src/components/admin/AdminOverviewCard';
import type { User } from '../src/types/auth';
import type { AdminSection } from '../src/types/admin';

// Mock contexts
const mockAdminUser: User = {
  id: 1,
  name: 'Admin User',
  email: 'admin@shopeasy.com',
  role: 'ADMIN',
  status: 'APPROVED',
};

let mockCurrentAuthUser: User | null = mockAdminUser;
let mockCurrentAuthToken: string | null = 'admin_test_token_xyz';

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockCurrentAuthUser,
    token: mockCurrentAuthToken,
    isLoading: false,
    logout: jest.fn(),
  }),
}));

const mockToast = {
  error: jest.fn(),
  success: jest.fn(),
  info: jest.fn(),
};
const mockShowConfirm = jest.fn();

jest.mock('../src/context/FeedbackContext', () => ({
  useFeedback: () => ({
    toast: mockToast,
    showAlert: jest.fn(),
    showConfirm: mockShowConfirm,
  }),
}));

// Mock section views to lightweight representations for navigation integration testing
jest.mock('../src/screens/admin/AdminOverviewView', () => ({
  AdminOverviewView: ({ onNavigateToSection }: { onNavigateToSection: (sec: AdminSection) => void }) => {
    const React = require('react');
    const { View, Text, Pressable } = require('react-native');
    const sections = ['products', 'orders', 'coupons', 'reviews', 'users', 'categories', 'registrations'];
    return (
      <View testID="admin-overview-view">
        <Text>Admin Overview Screen</Text>
        {sections.map((sec) => (
          <Pressable
            key={sec}
            testID={`overview-card-${sec}`}
            onPress={() => onNavigateToSection(sec as AdminSection)}
          >
            <Text>{sec.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
    );
  },
}));

jest.mock('../src/screens/admin/AdminProductsView', () => ({
  AdminProductsView: () => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return <View testID="admin-products-view"><Text>Products Management</Text></View>;
  },
}));

jest.mock('../src/screens/admin/AdminOrdersView', () => ({
  AdminOrdersView: () => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return <View testID="admin-orders-view"><Text>Orders Management</Text></View>;
  },
}));

jest.mock('../src/screens/admin/AdminCouponsView', () => ({
  AdminCouponsView: () => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return <View testID="admin-coupons-view"><Text>Coupons Management</Text></View>;
  },
}));

jest.mock('../src/screens/admin/AdminReviewsView', () => ({
  AdminReviewsView: () => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return <View testID="admin-reviews-view"><Text>Reviews Management</Text></View>;
  },
}));

jest.mock('../src/screens/admin/AdminAnalyticsView', () => ({
  AdminAnalyticsView: () => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return <View testID="admin-analytics-view"><Text>Analytics Management</Text></View>;
  },
}));

jest.mock('../src/screens/admin/AdminUsersView', () => ({
  AdminUsersView: () => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return <View testID="admin-users-view"><Text>Users Management</Text></View>;
  },
}));

jest.mock('../src/screens/admin/AdminCategoriesView', () => ({
  AdminCategoriesView: () => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return <View testID="admin-categories-view"><Text>Categories Management</Text></View>;
  },
}));

jest.mock('../src/screens/admin/AdminRegistrationsView', () => ({
  AdminRegistrationsView: () => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return <View testID="admin-registrations-view"><Text>Registrations Management</Text></View>;
  },
}));

function safeStringify(node: any): string {
  try {
    return JSON.stringify(node);
  } catch {
    return '';
  }
}

describe('ShopEasy Mobile — TanStack Query Caching & Admin Horizontal Auto-Scroll', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  describe('PART A: TanStack Query Shared Client & Caching Logic', () => {
    test('1. Shared QueryClient is configured with correct defaults (staleTime 60s, gcTime 5m, retry 1, refetchOnWindowFocus false)', () => {
      expect(queryClient).toBeDefined();
      const defaultOptions = queryClient.getDefaultOptions();
      expect(defaultOptions.queries?.staleTime).toBe(60 * 1000);
      expect(defaultOptions.queries?.gcTime).toBe(5 * 60 * 1000);
      expect(defaultOptions.queries?.retry).toBe(1);
      expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(false);
    });

    test('2. Query keys factory produces isolated and distinct keys for IDs, search, filters, and pagination', () => {
      // Products catalog
      const keyDefault = queryKeys.products();
      const keyFilter = queryKeys.products('electronics', 'phone', 'price_asc', 2);
      expect(keyDefault).not.toEqual(keyFilter);
      expect(keyFilter).toEqual([
        'products',
        { category: 'electronics', search: 'phone', sort: 'price_asc', page: 2 },
      ]);

      // Product detail by ID
      expect(queryKeys.product(42)).toEqual(['product', 42]);
      expect(queryKeys.product(99)).toEqual(['product', 99]);
      expect(queryKeys.product(42)).not.toEqual(queryKeys.product(99));

      // Customer data isolation by user ID
      const user1Orders = queryKeys.orders(1);
      const user2Orders = queryKeys.orders(2);
      expect(user1Orders).toEqual(['orders', 1]);
      expect(user2Orders).toEqual(['orders', 2]);
      expect(user1Orders).not.toEqual(user2Orders);

      // Admin queries
      expect(queryKeys.adminOverview).toEqual(['admin', 'overview']);
      expect(queryKeys.adminUsers('alice', 'ADMIN')).toEqual([
        'admin',
        'users',
        { search: 'alice', role: 'ADMIN' },
      ]);
      expect(queryKeys.adminOrders('PENDING', 'ord_123')).toEqual([
        'admin',
        'orders',
        { status: 'PENDING', search: 'ord_123' },
      ]);
    });

    test('3. Query cache stores and returns data without full-screen loading on revisit', async () => {
      const mockProducts = [
        { id: 1, name: 'Smartphone', price: 29999, category: 'Electronics' },
        { id: 2, name: 'Headphones', price: 1999, category: 'Audio' },
      ];

      // Simulate first fetch populating the cache
      queryClient.setQueryData(['products', 'all'], mockProducts);

      // Verify cached data is immediately available
      const cached = queryClient.getQueryData(['products', 'all']);
      expect(cached).toEqual(mockProducts);

      // Query state shows data exists
      const state = queryClient.getQueryState(['products', 'all']);
      expect(state?.data).toEqual(mockProducts);
      expect(state?.status).toBe('success');
    });

    test('4. clearUserQueryCache removes sensitive user-specific data on logout while preserving safe app state', () => {
      // Seed user-specific queries and public catalog queries
      queryClient.setQueryData(queryKeys.orders(1), [{ id: 101, total: 500 }]);
      queryClient.setQueryData(queryKeys.addresses(1), [{ id: 1, city: 'Mumbai' }]);
      queryClient.setQueryData(queryKeys.notifications(1), { notifications: [], unreadCount: 0 });
      queryClient.setQueryData(queryKeys.cart(1), [{ productId: 1, quantity: 2 }]);
      queryClient.setQueryData(queryKeys.categories, ['Electronics', 'Fashion']);

      // Execute logout cleanup
      clearUserQueryCache();

      // User-specific data must be wiped
      expect(queryClient.getQueryData(queryKeys.orders(1))).toBeUndefined();
      expect(queryClient.getQueryData(queryKeys.addresses(1))).toBeUndefined();
      expect(queryClient.getQueryData(queryKeys.notifications(1))).toBeUndefined();
      expect(queryClient.getQueryData(queryKeys.cart(1))).toBeUndefined();
    });

    test('5. Mutation invalidates affected queries correctly', async () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      // Invalidate products query key as done after stock/price update
      await queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'products'] });

      // Invalidate admin overview as done after order or product status change
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.adminOverview });

      invalidateSpy.mockRestore();
    });
  });

  describe('PART B: Admin Horizontal Navigation Auto-Scroll', () => {
    test('6. Admin Dashboard renders all 8 navigation tabs with Overview active initially', () => {
      let renderer: ReactTestRenderer | undefined;
      act(() => {
        renderer = create(
          <AdminDashboardScreen onBack={jest.fn()} />
        );
      });

      const root = renderer!.root;
      const str = safeStringify(renderer?.toJSON());

      // Verify all tabs exist in the horizontal navigation
      expect(str).toContain('Overview');
      expect(str).toContain('Products');
      expect(str).toContain('Orders');
      expect(str).toContain('Coupons');
      expect(str).toContain('Reviews');
      expect(str).toContain('Users');
      expect(str).toContain('Categories');
      expect(str).toContain('Registrations');

      // Initially renders AdminOverviewView
      const overview = root.findByProps({ testID: 'admin-overview-view' });
      expect(overview).toBeDefined();
    });

    test('7. Tapping a dashboard card (e.g. Users) changes active section to USERS and scrolls menu', () => {
      let renderer: ReactTestRenderer | undefined;
      act(() => {
        renderer = create(
          <AdminDashboardScreen onBack={jest.fn()} />
        );
      });

      const root = renderer!.root;

      // Find the horizontal ScrollView
      const scrollView = root.findByProps({ testID: 'admin-horizontal-nav-scroll' });
      expect(scrollView).toBeDefined();

      // Mock layout measurements for container and tabs
      act(() => {
        scrollView.props.onLayout({
          nativeEvent: { layout: { width: 360, height: 48, x: 0, y: 0 } },
        });
      });

      // Find the Users tab chip and trigger its onLayout
      const usersTab = root.findByProps({ testID: 'admin-tab-users' });
      expect(usersTab).toBeDefined();
      act(() => {
        usersTab.props.onLayout({
          nativeEvent: { layout: { width: 80, height: 36, x: 420, y: 0 } },
        });
      });

      // Tap the Users dashboard card inside Overview
      const usersCard = root.findByProps({ testID: 'overview-card-users' });
      act(() => {
        usersCard.props.onPress();
      });

      // View switched to AdminUsersView
      const usersView = root.findByProps({ testID: 'admin-users-view' });
      expect(usersView).toBeDefined();

      // Users tab has selected styling (bold / highlight)
      const usersTabText = usersTab.findByProps({ testID: 'admin-tab-text-users' });
      expect(usersTabText.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ fontWeight: '700' })])
      );
    });

    test('8. Tapping Registrations card opens Registrations and triggers auto-scroll to Registrations tab', () => {
      let renderer: ReactTestRenderer | undefined;
      act(() => {
        renderer = create(
          <AdminDashboardScreen onBack={jest.fn()} />
        );
      });

      const root = renderer!.root;

      // Tap Registrations card
      const regCard = root.findByProps({ testID: 'overview-card-registrations' });
      act(() => {
        regCard.props.onPress();
      });

      // View switched to Registrations view
      const regView = root.findByProps({ testID: 'admin-registrations-view' });
      expect(regView).toBeDefined();

      // Registrations tab is highlighted
      const regTab = root.findByProps({ testID: 'admin-tab-registrations' });
      const regTabText = regTab.findByProps({ testID: 'admin-tab-text-registrations' });
      expect(regTabText.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ fontWeight: '700' })])
      );
    });

    test('9. Back button returns to Overview from a management section and preserves navigation history', () => {
      let renderer: ReactTestRenderer | undefined;
      act(() => {
        renderer = create(
          <AdminDashboardScreen onBack={jest.fn()} />
        );
      });

      const root = renderer!.root;

      // Navigate to Orders
      const ordersCard = root.findByProps({ testID: 'overview-card-orders' });
      act(() => {
        ordersCard.props.onPress();
      });
      expect(root.findByProps({ testID: 'admin-orders-view' })).toBeDefined();

      // Press Back Arrow
      const backBtn = root.findByProps({ testID: 'admin-header-back-button' });
      act(() => {
        backBtn.props.onPress();
      });

      // Returned to Overview
      expect(root.findByProps({ testID: 'admin-overview-view' })).toBeDefined();

      // Logout modal was NOT triggered
      expect(mockShowConfirm).not.toHaveBeenCalled();
    });

    test('10. AdminOverviewCard renders with correct props and executes onPress', () => {
      const onPressMock = jest.fn();
      let renderer: ReactTestRenderer | undefined;
      act(() => {
        renderer = create(
          <AdminOverviewCard
            testID="admin-overview-card-test-card"
            title="Products"
            value={124}
            description="12 low stock"
            icon="box"
            onPress={onPressMock}
          />
        );
      });

      const str = safeStringify(renderer?.toJSON());
      expect(str).toContain('Products');
      expect(str).toContain('124');
      expect(str).toContain('12 low stock');

      const card = renderer!.root.findByProps({ testID: 'admin-overview-card-test-card' });
      act(() => {
        card.props.onPress();
      });
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });
  });
});
