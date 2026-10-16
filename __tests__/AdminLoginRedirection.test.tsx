import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { LoginScreen } from '../src/screens/LoginScreen';
import { AdminDashboardScreen } from '../src/screens/admin/AdminDashboardScreen';
import * as authApi from '../src/services/authApi';
import * as adminApi from '../src/services/adminApi';
import type { User } from '../src/types/auth';

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
  name: 'Regular Customer',
  email: 'customer@example.com',
  role: 'CUSTOMER',
  status: 'APPROVED',
};

let mockAuthUser: User | null = null;
let mockAuthToken: string | null = null;
const mockLogin = jest.fn();
const mockLogout = jest.fn();

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    token: mockAuthToken,
    isLoading: false,
    login: mockLogin,
    logout: mockLogout,
  }),
}));

jest.mock('../src/screens/admin/AdminOverviewView', () => ({ AdminOverviewView: () => null }));
jest.mock('../src/screens/admin/AdminProductsView', () => ({ AdminProductsView: () => null }));
jest.mock('../src/screens/admin/AdminOrdersView', () => ({ AdminOrdersView: () => null }));
jest.mock('../src/screens/admin/AdminCouponsView', () => ({ AdminCouponsView: () => null }));
jest.mock('../src/screens/admin/AdminReviewsView', () => ({ AdminReviewsView: () => null }));
jest.mock('../src/screens/admin/AdminAnalyticsView', () => ({ AdminAnalyticsView: () => null }));
jest.mock('../src/screens/admin/AdminUsersView', () => ({ AdminUsersView: () => null }));
jest.mock('../src/screens/admin/AdminCategoriesView', () => ({ AdminCategoriesView: () => null }));
jest.mock('../src/screens/admin/AdminRegistrationsView', () => ({ AdminRegistrationsView: () => null }));

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

describe('Admin Login Redirection & Role Navigation Tests', () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = null;
    mockAuthToken = null;

    jest.spyOn(adminApi, 'getAdminProducts').mockResolvedValue([]);
    jest.spyOn(adminApi, 'getAdminOrders').mockResolvedValue([]);
    jest.spyOn(adminApi, 'getAdminCoupons').mockResolvedValue([]);
    jest.spyOn(adminApi, 'getAdminReviews').mockResolvedValue({ reviews: [], totalPages: 1, total: 0 });
    jest.spyOn(adminApi, 'getAdminAnalyticsStatus').mockResolvedValue([]);
    jest.spyOn(adminApi, 'getAdminAnalyticsSales').mockResolvedValue([]);
    jest.spyOn(adminApi, 'getAdminUsers').mockResolvedValue([]);
    jest.spyOn(adminApi, 'getAdminCategories').mockResolvedValue([]);
    jest.spyOn(adminApi, 'getAdminRegistrations').mockResolvedValue({ registrations: [], pendingCount: 0 });
  });

  test('1. Admin login immediately calls onLoginSuccess with verified ADMIN user', async () => {
    mockLogin.mockResolvedValue({
      success: true,
      user: mockAdminUser,
    });

    const mockOnLoginSuccess = jest.fn();

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <LoginScreen onLoginSuccess={mockOnLoginSuccess} />
      );
    });

    // Find the Sign In button
    const root = renderer!.root;
    const submitButton = root.findByProps({ accessibilityLabel: 'Sign In' });

    // Fill valid credentials and trigger login
    const inputs = root.findAllByType('TextInput' as any);
    const emailInput = inputs[0];
    const passwordInput = inputs[1];

    await act(async () => {
      emailInput.props.onChangeText('admin@shopeasy.com');
      passwordInput.props.onChangeText('Password123!');
    });

    await act(async () => {
      submitButton.props.onPress();
    });

    // onLoginSuccess should be called immediately with the ADMIN user
    expect(mockOnLoginSuccess).toHaveBeenCalledWith(mockAdminUser);
  });

  test('2. Customer login calls onLoginSuccess with verified CUSTOMER user directly without modal', async () => {
    mockLogin.mockResolvedValue({
      success: true,
      user: mockCustomerUser,
    });

    const mockOnLoginSuccess = jest.fn();

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <LoginScreen onLoginSuccess={mockOnLoginSuccess} />
      );
    });

    const root = renderer!.root;
    const submitButton = root.findByProps({ accessibilityLabel: 'Sign In' });
    const inputs = root.findAllByType('TextInput' as any);
    const emailInput = inputs[0];
    const passwordInput = inputs[1];

    await act(async () => {
      emailInput.props.onChangeText('customer@example.com');
      passwordInput.props.onChangeText('Password123!');
    });

    await act(async () => {
      submitButton.props.onPress();
    });

    // onLoginSuccess should be called directly with the customer user without any welcome modal
    expect(mockOnLoginSuccess).toHaveBeenCalledWith(mockCustomerUser);
  });

  test('3. Admin Dashboard enforces server-side role and rejects non-admin users', async () => {
    mockAuthUser = mockCustomerUser;
    mockAuthToken = 'customer_token';
    const mockBack = jest.fn();

    await act(async () => {
      create(<AdminDashboardScreen onBack={mockBack} />);
    });

    expect(mockBack).toHaveBeenCalled();
    expect(mockShowToast.error).toHaveBeenCalledWith(
      expect.stringContaining('Admin authorization required')
    );
  });

  test('4. Admin Dashboard verifies session with backend and notifies on expired token', async () => {
    mockAuthUser = mockAdminUser;
    mockAuthToken = 'mock.admin.jwt';
    const mockBack = jest.fn();
    const mockLogout = jest.fn();

    jest.spyOn(authApi, 'getProfileApi').mockResolvedValue({
      success: false,
      expired: true,
    });

    await act(async () => {
      create(
        <AdminDashboardScreen onBack={mockBack} onLogout={mockLogout} />
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockLogout).toHaveBeenCalled();
    expect(mockShowToast.error).toHaveBeenCalledWith(
      expect.stringContaining('Session expired or admin permissions revoked')
    );
  });
});
