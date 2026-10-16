import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { AdminDashboardScreen } from '../src/screens/admin/AdminDashboardScreen';
import { AdminProductsView } from '../src/screens/admin/AdminProductsView';
import { AdminOrdersView } from '../src/screens/admin/AdminOrdersView';
import { AdminCouponsView } from '../src/screens/admin/AdminCouponsView';
import { AdminReviewsView } from '../src/screens/admin/AdminReviewsView';
import { AdminAnalyticsView } from '../src/screens/admin/AdminAnalyticsView';
import { AdminUsersView } from '../src/screens/admin/AdminUsersView';
import { AdminCategoriesView } from '../src/screens/admin/AdminCategoriesView';
import { AdminRegistrationsView } from '../src/screens/admin/AdminRegistrationsView';
import { UserProfileModal } from '../src/components/UserProfileModal';
import * as adminApi from '../src/services/adminApi';
import type { User } from '../src/types/auth';
import type {
  AdminProduct,
  AdminOrder,
  AdminCoupon,
  AdminReview,
  AdminUser,
  AdminCategory,
  AdminRegistration,
} from '../src/types/admin';

// Mock contexts
const mockAdminUser: User = {
  id: 1,
  name: 'Admin User',
  email: 'admin@shopeasy.com',
  role: 'ADMIN',
  status: 'APPROVED',
};

const mockCustomerUser: User = {
  id: 2,
  name: 'Customer User',
  email: 'customer@example.com',
  role: 'CUSTOMER',
  status: 'APPROVED',
};

let mockCurrentAuthUser: User | null = mockAdminUser;
let mockCurrentAuthToken: string | null = 'test_admin_jwt_token_123';

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockCurrentAuthUser,
    token: mockCurrentAuthToken,
    isLoading: false,
    logout: jest.fn(),
  }),
}));

const mockShowToast = {
  error: jest.fn(),
  success: jest.fn(),
  info: jest.fn(),
};

const mockShowConfirm = jest.fn();
const mockShowAlert = jest.fn();

const mockFeedbackContext = {
  toast: mockShowToast,
  showConfirm: mockShowConfirm,
  showAlert: mockShowAlert,
};

jest.mock('../src/context/FeedbackContext', () => ({
  useFeedback: () => mockFeedbackContext,
}));

jest.mock('../src/utils/loadingUtils', () => ({
  withRandomLoadingDuration: (fn: any) => fn(),
  getRandomLoadingDuration: () => 0,
}));

// Mock Test Data
const mockProductsList: AdminProduct[] = [
  {
    id: 101,
    name: 'Wireless Bluetooth Headphones',
    price: 1999,
    discount: 10,
    category: 'Electronics',
    image: 'https://example.com/headphones.jpg',
    stock: 25,
  },
  {
    id: 102,
    name: 'Old Discontinued Item',
    price: 499,
    discount: 0,
    category: 'Accessories',
    image: '',
    stock: 0,
  },
];

const mockOrdersList: AdminOrder[] = [
  {
    id: 201,
    name: 'Customer One',
    email: 'cust1@example.com',
    address: '123 Marine Drive',
    city: 'Mumbai',
    pincode: '400001',
    total: 3998,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    user: { id: 2, name: 'Customer One', email: 'cust1@example.com' },
    items: [
      {
        id: 1,
        quantity: 2,
        price: 1999,
        product: { id: 101, name: 'Wireless Bluetooth Headphones', image: '' },
      },
    ],
  },
];

const mockCouponsList: AdminCoupon[] = [
  {
    id: 301,
    code: 'SAVE20',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    minOrderAmount: 1000,
    maxDiscount: 500,
    usedCount: 5,
    isActive: true,
  },
];

const mockReviewsList: AdminReview[] = [
  {
    id: 401,
    userId: 2,
    userName: 'Happy Customer',
    userEmail: 'happy@example.com',
    productId: 101,
    productName: 'Wireless Bluetooth Headphones',
    productImage: '',
    rating: 5,
    comment: 'Exceptional sound quality and comfort!',
    isVerifiedBuyer: true,
    createdAt: new Date().toISOString(),
  },
];

const mockCategoriesList: AdminCategory[] = [
  { id: 1, name: 'Electronics', productCount: 12 },
  { id: 2, name: 'Fashion', productCount: 8 },
];

const mockUsersList: AdminUser[] = [
  {
    id: 2,
    name: 'Customer One',
    email: 'cust1@example.com',
    role: 'CUSTOMER',
    status: 'APPROVED',
    createdAt: new Date().toISOString(),
    orderCount: 3,
    wishlistCount: 2,
    cartItemCount: 1,
  },
];

const mockRegistrationsList: AdminRegistration[] = [
  {
    id: 501,
    name: 'New Registrant',
    email: 'newuser@example.com',
    role: 'CUSTOMER',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  },
];

function safeStringify(obj: any): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return undefined;
      }
      seen.add(value);
    }
    return value;
  });
}

describe('ShopEasy Mobile — Admin Panel & Security Guard Tests', () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentAuthUser = mockAdminUser;
    mockCurrentAuthToken = 'test_admin_jwt_token_123';

    // Mock API implementations
    jest.spyOn(adminApi, 'getAdminProducts').mockResolvedValue(mockProductsList);
    jest.spyOn(adminApi, 'getAdminOrders').mockResolvedValue(mockOrdersList);
    jest.spyOn(adminApi, 'getAdminCoupons').mockResolvedValue(mockCouponsList);
    jest.spyOn(adminApi, 'getAdminReviews').mockResolvedValue({
      reviews: mockReviewsList,
      totalPages: 1,
      total: 1,
    });
    jest.spyOn(adminApi, 'getAdminAnalyticsStatus').mockResolvedValue([
      { label: 'Pending', count: 5 },
      { label: 'Completed', count: 15 },
      { label: 'Delivered', count: 20 },
    ]);
    jest.spyOn(adminApi, 'getAdminAnalyticsSales').mockResolvedValue([
      { label: 'Today', sales: 15000 },
      { label: 'Yesterday', sales: 12000 },
    ]);
    jest.spyOn(adminApi, 'getAdminUsers').mockResolvedValue(mockUsersList);
    jest.spyOn(adminApi, 'getAdminCategories').mockResolvedValue(mockCategoriesList);
    jest.spyOn(adminApi, 'getAdminRegistrations').mockResolvedValue({
      registrations: mockRegistrationsList,
      pendingCount: 1,
    });
  });

  // ==========================================================================
  // 1. STRICT AUTHORIZATION & ACCESS CONTROL
  // ==========================================================================

  test('Blocks CUSTOMER user from opening AdminDashboardScreen and redirects back', async () => {
    mockCurrentAuthUser = mockCustomerUser;
    const mockBack = jest.fn();

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<AdminDashboardScreen onBack={mockBack} />);
    });

    expect(mockBack).toHaveBeenCalled();
    expect(mockShowToast.error).toHaveBeenCalledWith(
      expect.stringContaining('Admin authorization required')
    );
  });

  test('Allows verified ADMIN role to access AdminDashboardScreen', async () => {
    mockCurrentAuthUser = mockAdminUser;
    const mockBack = jest.fn();

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<AdminDashboardScreen onBack={mockBack} />);
    });

    expect(mockBack).not.toHaveBeenCalled();
    const str = safeStringify(renderer?.toJSON());
    expect(str).toContain('ADMIN');
    expect(str).toContain('Products');
    expect(str).toContain('Orders');
  });

  test('UserProfileModal does not show "Admin Dashboard" option (admins enter dashboard directly after login)', async () => {
    // 1. With CUSTOMER user
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <UserProfileModal
          visible={true}
          user={mockCustomerUser}
          onClose={jest.fn()}
          onLogout={jest.fn()}
        />
      );
    });
    let str = safeStringify(renderer?.toJSON());
    expect(str).not.toContain('Admin Dashboard');

    // 2. With ADMIN user: Admin Dashboard button is removed from Profile tab
    await act(async () => {
      renderer?.update(
        <UserProfileModal
          visible={true}
          user={mockAdminUser}
          onClose={jest.fn()}
          onLogout={jest.fn()}
        />
      );
    });
    str = safeStringify(renderer?.toJSON());
    expect(str).not.toContain('Admin Dashboard');
  });

  test('AdminDashboardScreen provides Sign Out action in header when onLogout is provided', async () => {
    mockCurrentAuthUser = mockAdminUser;
    const mockBack = jest.fn();
    const mockLogout = jest.fn();

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <AdminDashboardScreen onBack={mockBack} onLogout={mockLogout} />
      );
    });

    const str = safeStringify(renderer?.toJSON());
    expect(str).toContain('Sign out of Admin Console');
  });

  // ==========================================================================
  // 2. ALL 8 ADMIN SECTIONS VERIFICATION
  // ==========================================================================

  test('1. Products View lists products and displays stock', async () => {
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<AdminProductsView token={mockCurrentAuthToken!} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const str = safeStringify(renderer?.toJSON());
    expect(str).toContain('Wireless Bluetooth Headphones');
    expect(str).toContain('25 in stock');
    expect(str).toContain('Out of Stock');
  });

  test('2. Orders View displays order details and items', async () => {
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<AdminOrdersView token={mockCurrentAuthToken!} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const str = safeStringify(renderer?.toJSON());
    expect(str).toContain('201');
    expect(str).toContain('Customer One');
    expect(str).toContain('Change Status');
  });

  test('3. Coupons View lists coupons and displays activation switch', async () => {
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<AdminCouponsView token={mockCurrentAuthToken!} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const str = safeStringify(renderer?.toJSON());
    expect(str).toContain('SAVE20');
    expect(str).toContain('20% OFF');
    expect(str).toContain('Active');
  });

  test('4. Reviews View displays stars and reviewer details', async () => {
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<AdminReviewsView token={mockCurrentAuthToken!} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const str = safeStringify(renderer?.toJSON());
    expect(str).toContain('Happy Customer');
    expect(str).toContain('Exceptional sound quality and comfort!');
    expect(str).toContain('Verified Buyer');
  });

  test('5. Analytics View displays status breakdown and period sales', async () => {
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<AdminAnalyticsView token={mockCurrentAuthToken!} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const str = safeStringify(renderer?.toJSON());
    expect(str).toContain('Order Status Breakdown');
    expect(str).toContain('Sales Performance Trend');
    expect(str).toContain('Daily (14 Days)');
    expect(str).toContain('Monthly (Year)');
    expect(str).toContain('Yearly');
  });

  test('6. Users View displays user list, order counts, and role toggle', async () => {
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<AdminUsersView token={mockCurrentAuthToken!} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const str = safeStringify(renderer?.toJSON());
    expect(str).toContain('Customer One');
    expect(str).toContain('cust1@example.com');
    expect(str).toContain('CUSTOMER');
    expect(str).toContain('Make Admin');
  });

  test('7. Categories View displays product counts and add category', async () => {
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<AdminCategoriesView token={mockCurrentAuthToken!} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const str = safeStringify(renderer?.toJSON());
    expect(str).toContain('Electronics');
    expect(str).toContain('Products');
    expect(str).toContain('Fashion');
    expect(str).toContain('Add Category');
  });

  test('8. Registrations View displays pending requests and actions', async () => {
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<AdminRegistrationsView token={mockCurrentAuthToken!} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const str = safeStringify(renderer?.toJSON());
    expect(str).toContain('New Registrant');
    expect(str).toContain('newuser@example.com');
    expect(str).toContain('PENDING');
    expect(str).toContain('Approve');
    expect(str).toContain('Decline');
  });
});
