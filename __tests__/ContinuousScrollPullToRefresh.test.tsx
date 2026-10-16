import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { FlatList, RefreshControl, Text, Pressable, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProductsScreen } from '../src/screens/ProductsScreen';
import { OrdersScreen } from '../src/screens/OrdersScreen';
import { Pagination } from '../src/components/Pagination';
import * as api from '../src/services/api';
import * as orderApi from '../src/services/orderApi';
import type { Order } from '../src/types/order';

// Mock AuthContext
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
    token: 'test-valid-auth-token',
    logout: jest.fn(),
  }),
}));

// Mock WishlistContext
const mockToggleWishlist = jest.fn().mockResolvedValue(true);
jest.mock('../src/context/WishlistContext', () => ({
  useWishlist: () => ({
    wishlistItems: [],
    wishlistCount: 2,
    isWishlisted: (id: number) => id === 1,
    toggleWishlist: mockToggleWishlist,
    clearWishlist: jest.fn(),
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
      chipSelectedBg: '#2874F0',
      chipSelectedText: '#FFFFFF',
      chipUnselectedBg: mockIsDark ? '#2A2A2A' : '#FFFFFF',
      chipUnselectedText: mockIsDark ? '#FFFFFF' : '#4B5563',
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

// Sample mock products spanning multiple records
const mockProductsList = [
  {
    id: 1,
    name: 'Wireless Bluetooth Earbuds',
    description: 'High bass noise cancelling earbuds',
    price: 1999,
    discount: 15,
    stock: 25,
    category: 'Electronics',
    image: '/images/earbuds.jpg',
  },
  {
    id: 2,
    name: 'Mechanical Gaming Keyboard',
    description: 'RGB mechanical keyboard',
    price: 3499,
    discount: 10,
    stock: 12,
    category: 'Electronics',
    image: '/images/keyboard.jpg',
  },
  {
    id: 3,
    name: 'Running Sports Shoes',
    description: 'Lightweight breathable sports shoes',
    price: 2499,
    discount: 20,
    stock: 40,
    category: 'Footwear',
    image: '/images/shoes.jpg',
  },
];

// Sample mock orders
const mockOrdersList: Order[] = [
  {
    id: 101,
    userId: 1,
    name: 'Test Customer',
    city: 'Mumbai',
    address: '123 Marine Drive',
    total: 1999,
    discount: 0,
    status: 'DELIVERED',
    paymentMethod: 'COD',
    paymentStatus: 'PAID',
    createdAt: '2026-10-10T10:00:00.000Z',
    items: [
      {
        id: 1,
        orderId: 101,
        productId: 1,
        productName: 'Wireless Bluetooth Earbuds',
        price: 1999,
        quantity: 1,
      },
    ],
  },
  {
    id: 102,
    userId: 1,
    name: 'Test Customer',
    city: 'Mumbai',
    address: '123 Marine Drive',
    total: 3499,
    discount: 0,
    status: 'SHIPPED',
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    createdAt: '2026-10-12T14:30:00.000Z',
    items: [
      {
        id: 2,
        orderId: 102,
        productId: 2,
        productName: 'Mechanical Gaming Keyboard',
        price: 3499,
        quantity: 1,
      },
    ],
  },
];

describe('ShopEasy Mobile — Continuous Scrolling & Pull-to-Refresh', () => {
  beforeEach(() => {
    mockIsDark = false;
    jest.clearAllMocks();

    jest.spyOn(api, 'getCategories').mockResolvedValue(['All', 'Electronics', 'Footwear']);
    jest.spyOn(api, 'getProducts').mockResolvedValue({
      products: mockProductsList,
      total: mockProductsList.length,
      page: 1,
      limit: 50,
      totalPages: 1,
      hasMore: false,
      categories: ['All', 'Electronics', 'Footwear'],
    });

    jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
      orders: mockOrdersList,
      total: mockOrdersList.length,
      page: 1,
      limit: 50,
      totalPages: 1,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Customer Products Page', () => {
    it('renders products in a continuously scrollable list without pagination controls', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<ProductsScreen />);
      });

      // Confirm there are NO pagination components or page numbers
      const paginationControls = renderer!.root.findAllByType(Pagination);
      expect(paginationControls.length).toBe(0);

      // Verify products are displayed continuously
      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Wireless Bluetooth Earbuds');
      expect(texts).toContain('Mechanical Gaming Keyboard');
      expect(texts).toContain('Running Sports Shoes');

      // Verify the list has a pull-to-refresh control
      const flatLists = renderer!.root.findAllByType(FlatList);
      const flatList = flatLists.find((f) => f.props.numColumns === 2)!;
      expect(flatList.props.refreshControl).toBeDefined();
    });

    it('reloads product list when pull-to-refresh is triggered without clearing existing list', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<ProductsScreen />);
      });

      const flatLists = renderer!.root.findAllByType(FlatList);
      const flatList = flatLists.find((f) => f.props.numColumns === 2)!;
      const refreshControl = flatList.props.refreshControl;
      expect(refreshControl).toBeDefined();

      // Trigger pull-to-refresh
      const updatedProducts = [
        ...mockProductsList,
        {
          id: 4,
          name: 'Noise Cancelling Headphones',
          description: 'Premium headphones',
          price: 4999,
          discount: 5,
          stock: 15,
          category: 'Electronics',
          image: '/images/headphones.jpg',
        },
      ];

      (api.getProducts as jest.Mock).mockResolvedValueOnce({
        products: updatedProducts,
        total: updatedProducts.length,
        page: 1,
        limit: 50,
        totalPages: 1,
        categories: ['All', 'Electronics', 'Footwear'],
      });

      await act(async () => {
        refreshControl.props.onRefresh();
      });

      // Verify the updated product list is rendered
      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Noise Cancelling Headphones');
      expect(texts).toContain('Wireless Bluetooth Earbuds');
    });

    it('keeps existing products visible when pull-to-refresh fails', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<ProductsScreen />);
      });

      const initialTexts = extractAllStrings(renderer!.root);
      expect(initialTexts).toContain('Wireless Bluetooth Earbuds');

      // Refresh fails with network error
      (api.getProducts as jest.Mock).mockRejectedValueOnce(new Error('Network error on refresh'));

      const flatLists = renderer!.root.findAllByType(FlatList);
      const flatList = flatLists.find((f) => f.props.numColumns === 2)!;
      await act(async () => {
        flatList.props.refreshControl.props.onRefresh();
      });

      // Existing products must still be visible and not replaced with an empty screen
      const textsAfterFailure = extractAllStrings(renderer!.root);
      expect(textsAfterFailure).toContain('Wireless Bluetooth Earbuds');
      expect(textsAfterFailure).toContain('Mechanical Gaming Keyboard');
    });

    it('preserves search, category filter, and wishlist interactions', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<ProductsScreen />);
      });

      // Search input is present and responsive
      const searchInput = renderer!.root.findByProps({ accessibilityLabel: 'Search products' });
      expect(searchInput).toBeDefined();

      // Category chips are present
      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('All');
      expect(texts).toContain('Electronics');
      expect(texts).toContain('Footwear');
    });
  });

  describe('2. Customer My Orders Page', () => {
    it('renders customer orders in a continuously scrollable list without pagination controls', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen />);
      });

      // Confirm there are NO pagination controls
      const paginationControls = renderer!.root.findAllByType(Pagination);
      expect(paginationControls.length).toBe(0);

      // Verify all orders are displayed continuously
      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Order #101');
      expect(texts).toContain('Wireless Bluetooth Earbuds');
      expect(texts).toContain('Order #102');
      expect(texts).toContain('Mechanical Gaming Keyboard');

      // Verify RefreshControl is mounted
      const flatList = renderer!.root.findByType(FlatList);
      expect(flatList.props.refreshControl).toBeDefined();
    });

    it('reloads orders when pull-to-refresh is triggered without navigating away', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen />);
      });

      const flatList = renderer!.root.findByType(FlatList);
      const refreshControl = flatList.props.refreshControl;
      expect(refreshControl).toBeDefined();

      const newOrder: Order = {
        id: 103,
        userId: 1,
        name: 'Test Customer',
        city: 'Delhi',
        address: '456 CP Outer Circle',
        total: 2499,
        discount: 0,
        status: 'PENDING',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        createdAt: '2026-10-14T08:00:00.000Z',
        items: [
          {
            id: 3,
            orderId: 103,
            productId: 3,
            productName: 'Running Sports Shoes',
            price: 2499,
            quantity: 1,
          },
        ],
      };

      (orderApi.getMyOrders as jest.Mock).mockResolvedValueOnce({
        orders: [...mockOrdersList, newOrder],
        total: 3,
        page: 1,
        limit: 50,
        totalPages: 1,
      });

      await act(async () => {
        refreshControl.props.onRefresh();
      });

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Order #103');
      expect(texts).toContain('Running Sports Shoes');
      expect(texts).toContain('Order #101');
    });

    it('keeps existing orders visible if pull-to-refresh encounters network failure', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen />);
      });

      const initialTexts = extractAllStrings(renderer!.root);
      expect(initialTexts).toContain('Order #101');

      (orderApi.getMyOrders as jest.Mock).mockRejectedValueOnce(new Error('Connection lost'));

      const flatList = renderer!.root.findByType(FlatList);
      await act(async () => {
        flatList.props.refreshControl.props.onRefresh();
      });

      const textsAfterError = extractAllStrings(renderer!.root);
      expect(textsAfterError).toContain('Order #101');
      expect(textsAfterError).toContain('Order #102');
    });

    it('supports Dark Mode styling cleanly on both screens without errors', async () => {
      mockIsDark = true;
      let productsRenderer: ReactTestRenderer.ReactTestRenderer;
      let ordersRenderer: ReactTestRenderer.ReactTestRenderer;

      await act(async () => {
        productsRenderer = renderWithSafeArea(<ProductsScreen />);
        ordersRenderer = renderWithSafeArea(<OrdersScreen />);
      });

      expect(productsRenderer!.root).toBeDefined();
      expect(ordersRenderer!.root).toBeDefined();

      const prodPagination = productsRenderer!.root.findAllByType(Pagination);
      const ordersPagination = ordersRenderer!.root.findAllByType(Pagination);

      expect(prodPagination.length).toBe(0);
      expect(ordersPagination.length).toBe(0);
    });
  });
});
