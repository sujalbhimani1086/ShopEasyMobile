import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { View, FlatList, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FullScreenRefreshLoader } from '../src/components/common/FullScreenRefreshLoader';
import { ProductsScreen } from '../src/screens/ProductsScreen';
import { CategoriesScreen } from '../src/screens/CategoriesScreen';
import { OrdersScreen } from '../src/screens/OrdersScreen';
import { HomeScreen } from '../src/screens/HomeScreen';
import { WishlistScreen } from '../src/screens/WishlistScreen';
import { CartScreen } from '../src/screens/CartScreen';
import * as api from '../src/services/api';
import * as orderApi from '../src/services/orderApi';
import type { Product } from '../src/types/product';
import type { Order } from '../src/types/order';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 44, left: 0, right: 0, bottom: 34 },
};

// Mock loadingUtils
jest.mock('../src/utils/loadingUtils', () => ({
  MIN_RANDOM_LOADING_MS: 1000,
  MAX_RANDOM_LOADING_MS: 3000,
  getRandomLoadingDuration: () => 1500,
  withRandomLoadingDuration: jest.fn(async (task) => await task()),
}));

// Mock Auth
const mockUser = {
  id: 1,
  name: 'Test Customer',
  email: 'customer@shopeasy.com',
  role: 'CUSTOMER',
  status: 'APPROVED',
};

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    token: 'test-token',
    isLoading: false,
    logout: jest.fn(),
  }),
}));

// Mock WishlistContext
const mockRefreshWishlist = jest.fn().mockResolvedValue(undefined);
const mockToggleWishlist = jest.fn().mockResolvedValue(true);
jest.mock('../src/context/WishlistContext', () => ({
  useWishlist: () => ({
    wishlistItems: [
      {
        id: 101,
        name: 'Wishlist Item 1',
        price: 999,
        discount: 10,
        category: 'Electronics',
        image: 'http://test.com/img1.jpg',
        stock: 5,
      },
    ],
    wishlistCount: 1,
    isWishlisted: () => true,
    toggleWishlist: mockToggleWishlist,
    removeFromWishlist: jest.fn(),
    clearWishlist: jest.fn(),
    refreshWishlist: mockRefreshWishlist,
    isLoading: false,
  }),
}));

// Mock CartContext
const mockRefreshCart = jest.fn().mockResolvedValue(undefined);
const mockValidateCartItems = jest.fn().mockResolvedValue({
  hasUnavailableItems: false,
  unavailableCount: 0,
  outOfStockCount: 0,
  adjustedCount: 0,
});
jest.mock('../src/context/CartContext', () => ({
  useCart: () => ({
    cartItems: [
      {
        product: {
          id: 201,
          name: 'Cart Item 1',
          price: 1500,
          discount: 15,
          category: 'Footwear',
          image: 'http://test.com/cart1.jpg',
          stock: 10,
        },
        quantity: 2,
      },
    ],
    totalItemsCount: 2,
    subtotal: 3000,
    totalDiscount: 450,
    finalTotal: 2550,
    deliveryFee: 0,
    isLoading: false,
    isValidating: false,
    validationError: null,
    hasUnavailableItems: false,
    updateQuantity: jest.fn(),
    removeFromCart: jest.fn(),
    clearCart: jest.fn(),
    validateCartItems: mockValidateCartItems,
    removeUnavailableItems: jest.fn(),
    refreshCart: mockRefreshCart,
  }),
}));

// Mock reviewApi
jest.mock('../src/services/reviewApi', () => ({
  getProductReviews: jest.fn().mockResolvedValue({ reviews: [], userReview: null }),
  getCachedReview: jest.fn().mockReturnValue(null),
  getAllCachedReviews: jest.fn().mockReturnValue({}),
}));

// Mock notificationApi
jest.mock('../src/services/notificationApi', () => ({
  getNotifications: jest.fn().mockResolvedValue({ notifications: [], unreadCount: 0 }),
  markNotificationRead: jest.fn().mockResolvedValue({ success: true }),
  markAllNotificationsRead: jest.fn().mockResolvedValue({ success: true }),
  dismissNotification: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock Theme
let mockIsDark = false;
jest.mock('../src/theme/theme', () => ({
  useAppTheme: () => ({
    isDark: mockIsDark,
    colors: {
      background: mockIsDark ? '#121212' : '#F8F9FA',
      card: mockIsDark ? '#1E1E1E' : '#FFFFFF',
      surfaceSubtle: mockIsDark ? '#2A2A2A' : '#F1F3F5',
      text: mockIsDark ? '#FFFFFF' : '#111827',
      textSecondary: mockIsDark ? '#A0A0A0' : '#4B5563',
      textMuted: mockIsDark ? '#707070' : '#6B7280',
      border: mockIsDark ? '#333333' : '#E5E7EB',
      borderLight: mockIsDark ? '#252525' : '#F3F4F6',
      primary: '#111827',
      primaryText: '#FFFFFF',
      accent: '#F59E0B',
      brandBlue: '#2874F0',
      success: '#10B981',
      danger: '#EF4444',
      chipSelectedBg: '#111827',
      chipSelectedText: '#FFFFFF',
      chipUnselectedBg: '#FFFFFF',
      chipUnselectedText: '#4B5563',
    },
  }),
}));

const sampleProducts: Product[] = [
  {
    id: 1,
    name: 'Wireless Bluetooth Headphones',
    price: 2999,
    discount: 20,
    category: 'Electronics',
    image: 'http://test.com/p1.jpg',
    stock: 15,
  },
  {
    id: 2,
    name: 'Classic Cotton T-Shirt',
    price: 799,
    discount: 10,
    category: 'Clothing',
    image: 'http://test.com/p2.jpg',
    stock: 25,
  },
];

const sampleOrders: Order[] = [
  {
    id: 501,
    userId: 1,
    total: 2399,
    discount: 0,
    status: 'DELIVERED',
    paymentMethod: 'COD',
    paymentStatus: 'PAID',
    items: [
      {
        id: 1,
        orderId: 1,
        productId: 1,
        productName: 'Wireless Bluetooth Headphones',
        price: 2399,
        quantity: 1,
        productImage: 'http://test.com/p1.jpg',
      },
    ],
    createdAt: '2026-03-20T10:00:00Z',
  },
];

describe('FullScreenRefreshLoader Component', () => {
  it('renders with title, large ActivityIndicator, and theme styling', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <FullScreenRefreshLoader title="Loading Products" />
      );
    });

    const titleNodes = renderer!.root.findAllByProps({ children: 'Loading Products' });
    expect(titleNodes.length).toBeGreaterThanOrEqual(1);

    const spinner = renderer!.root.findByType(ActivityIndicator);
    expect(spinner.props.size).toBe('large');
    expect(spinner.props.color).toBe('#111827');
  });

  it('renders with overlay=true having absolute position and high zIndex', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <FullScreenRefreshLoader title="Refreshing Home" overlay={true} />
      );
    });

    const views = renderer!.root.findAllByType(View);
    const rootAnim = views.find((v) => v.props.testID === 'full-screen-refresh-loader') || views[0];
    const flattenedStyle = Array.isArray(rootAnim.props.style)
      ? Object.assign({}, ...rootAnim.props.style.filter(Boolean))
      : rootAnim.props.style || {};

    expect(flattenedStyle.position).toBe('absolute');
    expect(flattenedStyle.top).toBe(0);
    expect(flattenedStyle.left).toBe(0);
    expect(flattenedStyle.right).toBe(0);
    expect(flattenedStyle.bottom).toBe(0);
    expect(flattenedStyle.zIndex).toBeGreaterThanOrEqual(999);
    expect(flattenedStyle.backgroundColor).toBe('#F8F9FA');
  });

  it('adapts background and typography in Dark Mode', () => {
    mockIsDark = true;
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <FullScreenRefreshLoader title="Loading Wishlist" overlay={true} />
      );
    });

    const views = renderer!.root.findAllByType(View);
    const rootAnim = views.find((v) => v.props.testID === 'full-screen-refresh-loader') || views[0];
    const flattenedStyle = Array.isArray(rootAnim.props.style)
      ? Object.assign({}, ...rootAnim.props.style.filter(Boolean))
      : rootAnim.props.style || {};

    expect(flattenedStyle.backgroundColor).toBe('#121212');
    mockIsDark = false;
  });
});

describe('Page-Specific Full-Screen Pull-to-Refresh Integration', () => {
  let activeRenderer: ReactTestRenderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsDark = false;
    jest.spyOn(api, 'getProducts').mockImplementation(async () => ({
      products: sampleProducts,
      total: 2,
      totalPages: 1,
      page: 1,
      limit: 10,
      categories: ['Electronics', 'Clothing'],
    }));
    jest.spyOn(api, 'getCategories').mockResolvedValue(['Electronics', 'Clothing']);
    jest.spyOn(api, 'getBannerProducts').mockResolvedValue([]);
    jest.spyOn(orderApi, 'getAllMyOrders').mockResolvedValue(sampleOrders);
    jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
      orders: sampleOrders,
      total: 1,
      totalPages: 1,
      page: 1,
      limit: 10,
    });
  });

  afterEach(() => {
    if (activeRenderer) {
      act(() => {
        activeRenderer?.unmount();
      });
      activeRenderer = null;
    }
  });

  describe('Products Page', () => {
    it('shows "Loading Products" during pull-to-refresh with transparent circular indicator', async () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ProductsScreen />
          </SafeAreaProvider>
        );
      });
      activeRenderer = renderer;

      // Find FlatList and its refreshControl prop
      const flatLists = renderer!.root.findAllByType(FlatList);
      const productFlatList = flatLists.find((f) => f.props.numColumns === 2)!;
      expect(productFlatList).toBeDefined();

      const refreshControl = productFlatList.props.refreshControl;
      expect(refreshControl).toBeDefined();
      expect(refreshControl.props.tintColor).toBe('transparent');
      expect(refreshControl.props.colors).toEqual(['transparent']);

      // Setup deferred refresh
      let resolveRefresh: (val: any) => void;
      const refreshPromise = new Promise((resolve) => {
        resolveRefresh = resolve;
      });
      (api.getProducts as jest.Mock).mockReturnValue(refreshPromise);

      act(() => {
        refreshControl.props.onRefresh();
      });

      // Full-screen refresh loader is visible with standardized title "Loading Products..."
      const refreshLoaderTitle = renderer!.root.findAll(
        (node) => node.props && typeof node.props.children === 'string' && /loading Products/i.test(node.props.children)
      );
      expect(refreshLoaderTitle.length).toBeGreaterThanOrEqual(1);

      // Complete refresh
      await act(async () => {
        resolveRefresh!({
          products: sampleProducts,
          total: 2,
          totalPages: 1,
          currentPage: 1,
          categories: ['Electronics', 'Clothing'],
        });
      });
    });
  });

  describe('Categories Page', () => {
    it('shows category-specific loading title "Loading Popular For You" on pull-to-refresh', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <CategoriesScreen />
          </SafeAreaProvider>
        );
      });

      const flatLists = renderer!.root.findAllByType(FlatList);
      const categoryFlatList = flatLists.find((f) => f.props.numColumns === 2)!;
      expect(categoryFlatList).toBeDefined();

      const refreshControl = categoryFlatList.props.refreshControl;
      expect(refreshControl).toBeDefined();
      expect(refreshControl.props.tintColor).toBe('transparent');
      expect(refreshControl.props.colors).toEqual(['transparent']);

      // Setup deferred refresh
      let resolveCatProducts: (val: any) => void;
      const catPromise = new Promise((resolve) => {
        resolveCatProducts = resolve;
      });
      (api.getProducts as jest.Mock).mockReturnValue(catPromise);

      act(() => {
        refreshControl.props.onRefresh();
      });

      // Shows category-specific full-screen loader with "Loading Popular For You..."
      const catLoader = renderer!.root.findAll(
        (node) => node.props && typeof node.props.children === 'string' && /loading popular for you/i.test(node.props.children)
      );
      expect(catLoader.length).toBeGreaterThanOrEqual(1);

      await act(async () => {
        resolveCatProducts!({ products: sampleProducts, total: 2, totalPages: 1, currentPage: 1, categories: [] });
      });
    });
  });

  describe('My Orders Page', () => {
    it('shows "Loading Your Orders" full-screen loader during pull-to-refresh', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <OrdersScreen />
          </SafeAreaProvider>
        );
      });

      const flatList = renderer!.root.findByType(FlatList);
      expect(flatList).toBeDefined();

      const refreshControl = flatList.props.refreshControl;
      expect(refreshControl).toBeDefined();
      expect(refreshControl.props.tintColor).toBe('transparent');
      expect(refreshControl.props.colors).toEqual(['transparent']);

      // Setup deferred orders refresh
      let resolveOrders: (val: any) => void;
      const ordersPromise = new Promise((resolve) => {
        resolveOrders = resolve;
      });
      (orderApi.getMyOrders as jest.Mock).mockReturnValue(ordersPromise);

      act(() => {
        refreshControl.props.onRefresh();
      });

      // Shows full-screen loader with "Loading your orders..."
      const ordersLoader = renderer!.root.findAll(
        (node) => node.props && typeof node.props.children === 'string' && /loading your Orders/i.test(node.props.children)
      );
      expect(ordersLoader.length).toBeGreaterThanOrEqual(1);

      await act(async () => {
        resolveOrders!({
          orders: sampleOrders,
          total: 1,
          totalPages: 1,
          currentPage: 1,
        });
      });
    });
  });

  describe('Home Page', () => {
    it('shows "Refreshing Home" full-screen loader during pull-to-refresh', async () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <HomeScreen />
          </SafeAreaProvider>
        );
      });
      activeRenderer = renderer;

      const flatLists = renderer!.root.findAllByType(FlatList);
      const homeFlatList = flatLists.find((f) => f.props.numColumns === 2)!;
      expect(homeFlatList).toBeDefined();

      const refreshControl = homeFlatList.props.refreshControl;
      expect(refreshControl).toBeDefined();
      expect(refreshControl.props.tintColor).toBe('transparent');
      expect(refreshControl.props.colors).toEqual(['transparent']);

      // Setup deferred home refresh
      let resolveHome: (val: any) => void;
      const homePromise = new Promise((resolve) => {
        resolveHome = resolve;
      });
      (api.getProducts as jest.Mock).mockReturnValue(homePromise);

      act(() => {
        refreshControl.props.onRefresh();
      });

      // Shows full-screen loader with "Loading home..."
      const homeLoader = renderer!.root.findAll(
        (node) => node.props && typeof node.props.children === 'string' && /loading home/i.test(node.props.children)
      );
      expect(homeLoader.length).toBeGreaterThanOrEqual(1);

      await act(async () => {
        resolveHome!({ products: sampleProducts, total: 2, totalPages: 1, currentPage: 1, categories: [] });
      });
    });
  });

  describe('Wishlist Page', () => {
    it('triggers refreshWishlist and shows "Loading Wishlist" full-screen loader during pull-to-refresh', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <WishlistScreen onBack={jest.fn()} />
          </SafeAreaProvider>
        );
      });

      const flatList = renderer!.root.findByType(FlatList);
      expect(flatList).toBeDefined();

      const refreshControl = flatList.props.refreshControl;
      expect(refreshControl).toBeDefined();
      expect(refreshControl.props.tintColor).toBe('transparent');
      expect(refreshControl.props.colors).toEqual(['transparent']);

      let resolveWishlist: () => void;
      const wishlistPromise = new Promise<void>((resolve) => {
        resolveWishlist = resolve;
      });
      mockRefreshWishlist.mockReturnValue(wishlistPromise);

      act(() => {
        refreshControl.props.onRefresh();
      });

      expect(mockRefreshWishlist).toHaveBeenCalledTimes(1);

      // Shows full-screen loader with "Loading wishlist..."
      const wishlistLoader = renderer!.root.findAll(
        (node) => node.props && typeof node.props.children === 'string' && /loading wishlist/i.test(node.props.children)
      );
      expect(wishlistLoader.length).toBeGreaterThanOrEqual(1);

      await act(async () => {
        resolveWishlist!();
      });
    });
  });

  describe('Cart Page', () => {
    it('triggers refreshCart & validateCartItems and shows "Refreshing Cart" full-screen loader during pull-to-refresh', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <CartScreen />
          </SafeAreaProvider>
        );
      });

      const flatList = renderer!.root.findByType(FlatList);
      expect(flatList).toBeDefined();

      const refreshControl = flatList.props.refreshControl;
      expect(refreshControl).toBeDefined();
      expect(refreshControl.props.tintColor).toBe('transparent');
      expect(refreshControl.props.colors).toEqual(['transparent']);

      let resolveCart: () => void;
      const cartPromise = new Promise<void>((resolve) => {
        resolveCart = resolve;
      });
      mockRefreshCart.mockReturnValue(cartPromise);

      act(() => {
        refreshControl.props.onRefresh();
      });

      expect(mockRefreshCart).toHaveBeenCalled();

      // Shows full-screen loader with "Loading cart..."
      const cartLoader = renderer!.root.findAll(
        (node) => node.props && typeof node.props.children === 'string' && /loading cart/i.test(node.props.children)
      );
      expect(cartLoader.length).toBeGreaterThanOrEqual(1);

      await act(async () => {
        resolveCart!();
      });
    });
  });
});
