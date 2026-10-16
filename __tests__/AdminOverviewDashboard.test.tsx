import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { BackHandler } from 'react-native';
import { AdminDashboardScreen } from '../src/screens/admin/AdminDashboardScreen';
import { AdminOverviewView } from '../src/screens/admin/AdminOverviewView';
import { AdminOverviewCard } from '../src/components/admin/AdminOverviewCard';
import * as adminApi from '../src/services/adminApi';
import * as authApi from '../src/services/authApi';
import type { User } from '../src/types/auth';
import type {
  AdminOrder,
  AdminProduct,
  AdminCategory,
  AdminUser,
  AdminCoupon,
  AdminReview,
} from '../src/types/admin';

// Mock contexts
const mockAdminUser: User = {
  id: 1,
  name: 'Store Administrator',
  email: 'admin@shopeasy.com',
  role: 'ADMIN',
  status: 'APPROVED',
};

let mockAuthUser: User | null = mockAdminUser;
let mockAuthToken: string | null = 'admin_jwt_token_valid';
const mockLogout = jest.fn();

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    token: mockAuthToken,
    isLoading: false,
    logout: mockLogout,
  }),
}));

const mockShowToast = {
  error: jest.fn(),
  success: jest.fn(),
  info: jest.fn(),
};
const mockShowConfirm = jest.fn();
const mockShowAlert = jest.fn();

jest.mock('../src/context/FeedbackContext', () => ({
  useFeedback: () => ({
    toast: mockShowToast,
    showConfirm: mockShowConfirm,
    showAlert: mockShowAlert,
  }),
}));

// Mock other admin section views so they do not spawn background promises in overview test
jest.mock('../src/screens/admin/AdminProductsView', () => ({
  AdminProductsView: () => {
    const { Text } = require('react-native');
    return <Text>Products View (In Stock)</Text>;
  },
}));
jest.mock('../src/screens/admin/AdminOrdersView', () => ({
  AdminOrdersView: () => {
    const { Text } = require('react-native');
    return <Text>Orders View (Orders)</Text>;
  },
}));
jest.mock('../src/screens/admin/AdminCouponsView', () => ({ AdminCouponsView: () => null }));
jest.mock('../src/screens/admin/AdminReviewsView', () => ({ AdminReviewsView: () => null }));
jest.mock('../src/screens/admin/AdminAnalyticsView', () => ({ AdminAnalyticsView: () => null }));
jest.mock('../src/screens/admin/AdminUsersView', () => ({ AdminUsersView: () => null }));
jest.mock('../src/screens/admin/AdminCategoriesView', () => ({ AdminCategoriesView: () => null }));
jest.mock('../src/screens/admin/AdminRegistrationsView', () => ({ AdminRegistrationsView: () => null }));

// Mock withRandomLoadingDuration to execute immediately in tests
jest.mock('../src/utils/loadingUtils', () => ({
  withRandomLoadingDuration: (fn: any) => fn(),
  getRandomLoadingDuration: () => 0,
}));

// Test data
const mockOrders: AdminOrder[] = [
  {
    id: 501,
    name: 'Birajit',
    email: 'birajit@example.com',
    address: '123 Marine Drive',
    city: 'Mumbai',
    pincode: '400001',
    total: 1999.2,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    user: { id: 10, name: 'Birajit', email: 'birajit@example.com' },
    items: [],
  },
  {
    id: 502,
    name: 'Abc',
    email: 'abc@example.com',
    address: '456 MG Road',
    city: 'Bangalore',
    pincode: '560001',
    total: 9601.64,
    status: 'SHIPPED',
    createdAt: new Date().toISOString(),
    user: { id: 11, name: 'Abc', email: 'abc@example.com' },
    items: [],
  },
  {
    id: 503,
    name: 'Om Thoriya',
    email: 'om@example.com',
    address: '789 Ring Road',
    city: 'Surat',
    pincode: '395001',
    total: 5000.0,
    status: 'CONFIRMED',
    createdAt: new Date().toISOString(),
    user: { id: 12, name: 'Om Thoriya', email: 'om@example.com' },
    items: [],
  },
];

const mockProducts: AdminProduct[] = [
  {
    id: 1,
    name: 'Fossil Machine',
    category: 'Watches',
    price: 5000,
    discount: 0,
    stock: 13,
    image: 'https://images.unsplash.com/watch.jpg',
  },
  {
    id: 2,
    name: 'Perfume',
    category: 'Beauty',
    price: 2499,
    discount: 10,
    stock: 22,
    image: 'https://images.unsplash.com/perfume.jpg',
  },
  {
    id: 3,
    name: 'Face Care Kit',
    category: 'Beauty',
    price: 1299,
    discount: 5,
    stock: 33,
    image: 'https://images.unsplash.com/kit.jpg',
  },
];

const mockCategories: AdminCategory[] = [
  { id: 1, name: 'Watches', productCount: 1 },
  { id: 2, name: 'Beauty', productCount: 2 },
];

const mockUsers: AdminUser[] = [
  {
    id: 10,
    name: 'Birajit',
    email: 'birajit@example.com',
    role: 'CUSTOMER',
    status: 'APPROVED',
    createdAt: new Date().toISOString(),
    orderCount: 1,
    wishlistCount: 0,
    cartItemCount: 0,
  },
];

const mockCoupons: AdminCoupon[] = [
  {
    id: 1,
    code: 'SAVE10',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minOrderAmount: 500,
    usedCount: 3,
    isActive: true,
  },
];

function safeStringify(obj: any): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return undefined;
      seen.add(value);
    }
    return value;
  });
}

describe('ShopEasy Mobile — Admin Overview Dashboard & Navigation Fix', () => {
  let backHandlerCallbacks: Array<() => boolean> = [];

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = mockAdminUser;
    mockAuthToken = 'admin_jwt_token_valid';

    backHandlerCallbacks = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((event: string, callback: any) => {
      if (event === 'hardwareBackPress') {
        backHandlerCallbacks.push(callback);
      }
      return {
        remove: () => {
          backHandlerCallbacks = backHandlerCallbacks.filter((cb) => cb !== callback);
        },
      } as any;
    });

    jest.spyOn(authApi, 'getProfileApi').mockResolvedValue({
      success: true,
      user: mockAdminUser,
    });

    jest.spyOn(adminApi, 'getAdminOrders').mockResolvedValue(mockOrders);
    jest.spyOn(adminApi, 'getAdminProducts').mockResolvedValue(mockProducts);
    jest.spyOn(adminApi, 'getAdminCategories').mockResolvedValue(mockCategories);
    jest.spyOn(adminApi, 'getAdminUsers').mockResolvedValue(mockUsers);
    jest.spyOn(adminApi, 'getAdminCoupons').mockResolvedValue(mockCoupons);
    jest.spyOn(adminApi, 'getAdminReviews').mockResolvedValue({
      reviews: [],
      totalPages: 1,
      total: 12,
    });
    jest.spyOn(adminApi, 'getAdminRegistrations').mockResolvedValue({
      registrations: [],
      pendingCount: 4,
    });
  });

  // =========================================================================
  // 1. DEFAULT LANDING & TABS
  // =========================================================================

  test('1. Opening Admin Panel displays Overview by default and highlights Overview tab', async () => {
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<AdminDashboardScreen onBack={jest.fn()} onLogout={jest.fn()} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const str = safeStringify(renderer?.toJSON());
    expect(str).toContain('Overview');
    expect(str).toContain('Key Performance Metrics');
    expect(str).toContain('Weekly Sales & Order Distribution');
    expect(str).toContain('Quick Management Actions');
    expect(str).toContain('Recent Orders');
    expect(str).toContain('Product Catalog Preview');
  });

  test('2. Reusable AdminOverviewCard renders title, value, description, and responds to press', () => {
    const mockPress = jest.fn();
    let renderer: ReactTestRenderer | undefined;

    act(() => {
      renderer = create(
        <AdminOverviewCard
          title="ORDERS"
          value={42}
          description="Recorded"
          icon="orders"
          onPress={mockPress}
          testID="test-overview-card"
        />
      );
    });

    const root = renderer!.root;
    const card = root.findByProps({ testID: 'test-overview-card' });
    expect(card).toBeDefined();

    const str = safeStringify(renderer?.toJSON());
    expect(str).toContain('ORDERS');
    expect(str).toContain('42');
    expect(str).toContain('Recorded');

    act(() => {
      card.props.onPress();
    });
    expect(mockPress).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  // 2. ALL SEVEN MANAGEMENT CARDS & DESTINATIONS
  // =========================================================================

  test('3. Overview renders all 7 management cards with real data counts', async () => {
    const mockNavigate = jest.fn();
    let renderer: ReactTestRenderer | undefined;

    await act(async () => {
      renderer = create(
        <AdminOverviewView token="valid_token" onNavigateToSection={mockNavigate} />
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    const root = renderer!.root;
    const ordersCard = root.findByProps({ testID: 'overview-card-orders' });
    const productsCard = root.findByProps({ testID: 'overview-card-products' });
    const categoriesCard = root.findByProps({ testID: 'overview-card-categories' });
    const usersCard = root.findByProps({ testID: 'overview-card-users' });
    const couponsCard = root.findByProps({ testID: 'overview-card-coupons' });
    const reviewsCard = root.findByProps({ testID: 'overview-card-reviews' });
    const registrationsCard = root.findByProps({ testID: 'overview-card-registrations' });

    expect(ordersCard).toBeDefined();
    expect(productsCard).toBeDefined();
    expect(categoriesCard).toBeDefined();
    expect(usersCard).toBeDefined();
    expect(couponsCard).toBeDefined();
    expect(reviewsCard).toBeDefined();
    expect(registrationsCard).toBeDefined();

    // Verify tapping each card navigates to the correct management section
    act(() => {
      ordersCard.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('orders');

    act(() => {
      productsCard.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('products');

    act(() => {
      categoriesCard.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('categories');

    act(() => {
      usersCard.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('users');

    act(() => {
      couponsCard.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('coupons');

    act(() => {
      reviewsCard.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('reviews');

    act(() => {
      registrationsCard.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('registrations');
  });

  // =========================================================================
  // 3. ANALYTICS, RECENT ORDERS & PRODUCT PREVIEW
  // =========================================================================

  test('4. Overview displays 7-day distribution, recent orders with status badges, and catalog preview', async () => {
    let renderer: ReactTestRenderer | undefined;

    await act(async () => {
      renderer = create(
        <AdminOverviewView token="valid_token" onNavigateToSection={jest.fn()} />
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    const str = safeStringify(renderer?.toJSON());

    // 7-day distribution labels
    expect(str).toContain('Mon');
    expect(str).toContain('Tue');
    expect(str).toContain('Wed');
    expect(str).toContain('Thu');
    expect(str).toContain('Fri');
    expect(str).toContain('Sat');
    expect(str).toContain('Sun');

    // Recent orders content
    expect(str).toContain('Birajit');
    expect(str).toContain('PENDING');
    expect(str).toContain('Abc');
    expect(str).toContain('SHIPPED');
    expect(str).toContain('Om Thoriya');
    expect(str).toContain('CONFIRMED');

    // Product preview content
    expect(str).toContain('Fossil Machine');
    expect(str).toContain('13 in stock');
    expect(str).toContain('Perfume');
    expect(str).toContain('Face Care Kit');
  });

  // =========================================================================
  // 4. BACK-ARROW AND LOGOUT SEPARATION TESTS (CRITICAL REQUIREMENT)
  // =========================================================================

  test('5. Pressing Back arrow returns to Overview from a management section without showing logout dialog', async () => {
    const mockBack = jest.fn();
    const mockOnLogout = jest.fn();

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <AdminDashboardScreen onBack={mockBack} onLogout={mockOnLogout} />
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    const root = renderer!.root;

    // Navigate to Products tab
    const productsTab = root.findByProps({ accessibilityLabel: 'Products section' });
    await act(async () => {
      productsTab.props.onPress();
    });

    let str = safeStringify(renderer?.toJSON());
    expect(str).toContain('In Stock');

    // Press the back arrow in header
    const backBtn = root.findByProps({ accessibilityLabel: 'Back to previous section or store' });
    await act(async () => {
      backBtn.props.onPress();
    });

    // Should return to Overview
    str = safeStringify(renderer?.toJSON());
    expect(str).toContain('Key Performance Metrics');

    // CRITICAL: Must NEVER prompt for sign out or call onLogout!
    expect(mockShowConfirm).not.toHaveBeenCalled();
    expect(mockOnLogout).not.toHaveBeenCalled();
  });

  test('6. Pressing Back arrow on Overview calls onBack without triggering sign-out dialog', async () => {
    const mockBack = jest.fn();
    const mockOnLogout = jest.fn();

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <AdminDashboardScreen onBack={mockBack} onLogout={mockOnLogout} />
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    const root = renderer!.root;
    const backBtn = root.findByProps({ accessibilityLabel: 'Back to previous section or store' });

    await act(async () => {
      backBtn.props.onPress();
    });

    // onBack is called safely to return to customer store
    expect(mockBack).toHaveBeenCalled();
    // Must NEVER show logout confirm
    expect(mockShowConfirm).not.toHaveBeenCalled();
    expect(mockOnLogout).not.toHaveBeenCalled();
  });

  test('7. Dedicated logout button prompts for confirmation, allows cancel, and confirms logout', async () => {
    const mockBack = jest.fn();
    const mockOnLogout = jest.fn();

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <AdminDashboardScreen onBack={mockBack} onLogout={mockOnLogout} />
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    const root = renderer!.root;
    const logoutBtn = root.findByProps({ accessibilityLabel: 'Sign out of Admin Console' });

    await act(async () => {
      logoutBtn.props.onPress();
    });

    // Confirmation dialog must appear
    expect(mockShowConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sign Out',
        message: expect.stringContaining('sign out of the Admin Console'),
        isDestructive: true,
      })
    );

    // Call onConfirm callback passed to showConfirm
    const confirmConfig = mockShowConfirm.mock.calls[0][0];
    await act(async () => {
      confirmConfig.onConfirm();
    });

    expect(mockOnLogout).toHaveBeenCalledTimes(1);
  });

  test('8. Android hardware back navigates back to Overview without logging out', async () => {
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <AdminDashboardScreen onBack={jest.fn()} onLogout={jest.fn()} />
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    const root = renderer!.root;

    // Navigate into Orders tab
    const ordersTab = root.findByProps({ accessibilityLabel: 'Orders section' });
    await act(async () => {
      ordersTab.props.onPress();
    });

    let str = safeStringify(renderer?.toJSON());
    expect(str).toContain('Orders');

    // Simulate Android hardware back press
    expect(backHandlerCallbacks.length).toBeGreaterThan(0);
    const hardwareBack = backHandlerCallbacks[backHandlerCallbacks.length - 1];

    let handled = false;
    await act(async () => {
      handled = hardwareBack();
    });

    expect(handled).toBe(true);
    str = safeStringify(renderer?.toJSON());
    // Returned to Overview!
    expect(str).toContain('Key Performance Metrics');
    expect(mockShowConfirm).not.toHaveBeenCalled();
  });
});
