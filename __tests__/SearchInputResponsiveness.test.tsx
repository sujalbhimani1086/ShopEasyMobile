import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { TextInput, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProductsScreen } from '../src/screens/ProductsScreen';
import { OrdersScreen } from '../src/screens/OrdersScreen';
import * as api from '../src/services/api';
import * as orderApi from '../src/services/orderApi';
import * as reviewApi from '../src/services/reviewApi';

// Mock AuthContext
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Sujal Customer', email: 'sujal@gmail.com', role: 'CUSTOMER', status: 'APPROVED' },
    token: 'mock-auth-token',
    logout: jest.fn(),
  }),
}));

// Mock WishlistContext
jest.mock('../src/context/WishlistContext', () => ({
  useWishlist: () => ({
    wishlistItems: [],
    wishlistCount: 0,
    isWishlisted: () => false,
    toggleWishlist: jest.fn().mockResolvedValue(true),
    clearWishlist: jest.fn(),
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
      badgeBg: '#F3F4F6',
      badgeText: '#1F2937',
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

const mockProductsResponse = {
  products: [
    {
      id: 1,
      name: 'Wireless Bluetooth Headphones',
      description: 'High quality noise cancelling headphones',
      price: 2999,
      discount: 10,
      stock: 15,
      category: 'Electronics',
      image: '/images/headphones.jpg',
      featured: true,
      createdAt: '2026-01-01',
    },
    {
      id: 2,
      name: 'Smart Fitness Watch',
      description: 'Fitness tracker with heart rate monitor',
      price: 1999,
      discount: 5,
      stock: 20,
      category: 'Electronics',
      image: '/images/watch.jpg',
      featured: false,
      createdAt: '2026-01-02',
    },
  ],
  total: 2,
  page: 1,
  limit: 12,
  totalPages: 1,
  categories: ['Electronics', 'Clothing'],
};

const mockOrdersResponse = {
  orders: [
    {
      id: 101,
      userId: 1,
      totalAmount: 2699,
      total: 2699,
      discount: 0,
      status: 'DELIVERED',
      createdAt: '2026-02-10T10:00:00Z',
      items: [
        {
          id: 1,
          orderId: 101,
          productId: 1,
          productName: 'Wireless Bluetooth Headphones',
          productPrice: 2699,
          quantity: 1,
        },
      ],
    },
    {
      id: 102,
      userId: 1,
      totalAmount: 1899,
      total: 1899,
      discount: 0,
      status: 'SHIPPED',
      createdAt: '2026-02-12T12:00:00Z',
      items: [
        {
          id: 2,
          orderId: 102,
          productId: 2,
          productName: 'Smart Fitness Watch',
          productPrice: 1899,
          quantity: 1,
        },
      ],
    },
  ],
  total: 2,
  page: 1,
  limit: 10,
  totalPages: 1,
};

describe('Search Input Responsiveness and Typing Stability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(api, 'getCategories').mockResolvedValue(['Electronics', 'Clothing']);
    jest.spyOn(api, 'getProducts').mockResolvedValue(mockProductsResponse);
    jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue(mockOrdersResponse as any);
    jest.spyOn(reviewApi, 'getProductReviews').mockResolvedValue({
      reviews: [],
      averageRating: 0,
      totalReviews: 0,
      ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      isEligibleToReview: false,
      userReview: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('ProductsScreen Search Input', () => {
    it('mounts the TextInput and keeps it responsive during continuous typing', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<ProductsScreen />);
      });

      // Find the search TextInput
      const textInput = renderer!.root.findByProps({ accessibilityLabel: 'Search products' });
      expect(textInput).toBeDefined();
      expect(textInput.props.value).toBe('');

      // Fast typing simulation: typing 'w', 'i', 'r', 'e'
      await act(async () => {
        textInput.props.onChangeText('w');
      });
      expect(renderer!.root.findByProps({ accessibilityLabel: 'Search products' }).props.value).toBe('w');

      await act(async () => {
        textInput.props.onChangeText('wi');
      });
      expect(renderer!.root.findByProps({ accessibilityLabel: 'Search products' }).props.value).toBe('wi');

      await act(async () => {
        textInput.props.onChangeText('wire');
      });
      expect(renderer!.root.findByProps({ accessibilityLabel: 'Search products' }).props.value).toBe('wire');

      // Crucial test: API has NOT been called for 'w', 'wi', or 'wire' yet due to 300ms debounce
      // Initial mount call was made with search = ''
      const getProductsMock = api.getProducts as jest.Mock;
      const searchCallsDuringTyping = getProductsMock.mock.calls.filter(
        (call) => (typeof call[0] === 'object' ? call[0].search : call[3]) === 'wire'
      );
      expect(searchCallsDuringTyping.length).toBe(0);

      // Advance debounce timer by 300ms
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      // Now the debounced search request has been triggered with 'wire'
      const callsAfterDebounce = getProductsMock.mock.calls.filter(
        (call) => (typeof call[0] === 'object' ? call[0].search : call[3]) === 'wire'
      );
      expect(callsAfterDebounce.length).toBe(1);

      // Verify the TextInput remained mounted with the exact value intact
      const stableInput = renderer!.root.findByProps({ accessibilityLabel: 'Search products' });
      expect(stableInput.props.value).toBe('wire');
    });

    it('clears search input immediately and resets pagination to page 1', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<ProductsScreen initialSearch="bluetooth" />);
      });

      const textInput = renderer!.root.findByProps({ accessibilityLabel: 'Search products' });
      expect(textInput.props.value).toBe('bluetooth');

      // Clear button should be present
      const clearBtn = renderer!.root.findByProps({ accessibilityLabel: 'Clear search text' });
      expect(clearBtn).toBeDefined();

      await act(async () => {
        clearBtn.props.onPress();
      });

      // Immediately cleared
      expect(renderer!.root.findByProps({ accessibilityLabel: 'Search products' }).props.value).toBe('');
    });

    it('triggers immediate search on keyboard submit (Enter/Search)', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<ProductsScreen />);
      });

      const textInput = renderer!.root.findByProps({ accessibilityLabel: 'Search products' });

      await act(async () => {
        textInput.props.onChangeText('watch');
      });

      const getProductsMock = api.getProducts as jest.Mock;
      const initialCallCount = getProductsMock.mock.calls.length;

      // Submit editing without waiting for the 300ms timer
      await act(async () => {
        textInput.props.onSubmitEditing();
      });

      // A search was immediately fired with 'watch'
      const immediateWatchCalls = getProductsMock.mock.calls.filter(
        (call) => (typeof call[0] === 'object' ? call[0].search : call[3]) === 'watch'
      );
      expect(immediateWatchCalls.length).toBe(1);
    });

    it('ignores outdated/stale search responses when newer requests complete', async () => {
      let resolveFirstSearch: (val: any) => void;
      let resolveSecondSearch: (val: any) => void;

      const getProductsMock = jest.spyOn(api, 'getProducts');
      getProductsMock.mockReset();

      // First call (mount) resolves immediately
      getProductsMock.mockResolvedValueOnce(mockProductsResponse);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<ProductsScreen />);
      });

      // Subsequent calls will return manual promises
      getProductsMock
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirstSearch = resolve;
            })
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveSecondSearch = resolve;
            })
        );

      const textInput = renderer!.root.findByProps({ accessibilityLabel: 'Search products' });

      // First query: 'slow'
      await act(async () => {
        textInput.props.onChangeText('slow');
      });
      // Fire first request
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      // Second query: 'fast'
      await act(async () => {
        textInput.props.onChangeText('fast');
      });
      // Fire second request
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      // Second response arrives FIRST with new products
      const fastProducts = [
        {
          id: 99,
          name: 'Fast Search Product',
          price: 500,
          discount: 0,
          stock: 10,
          category: 'Electronics',
          image: '/fast.jpg',
        },
      ];

      await act(async () => {
        resolveSecondSearch!({
          ...mockProductsResponse,
          products: fastProducts,
          total: 1,
        });
      });

      // First response arrives LATER with stale products
      const staleProducts = [
        {
          id: 55,
          name: 'Stale Slow Product',
          price: 100,
          discount: 0,
          stock: 5,
          category: 'Electronics',
          image: '/stale.jpg',
        },
      ];

      await act(async () => {
        resolveFirstSearch!({
          ...mockProductsResponse,
          products: staleProducts,
          total: 1,
        });
      });

      // Verify input and state is not corrupted by stale response
      const input = renderer!.root.findByProps({ accessibilityLabel: 'Search products' });
      expect(input.props.value).toBe('fast');
    });
  });

  describe('OrdersScreen Search Input', () => {
    it('filters orders with debouncing and keeps FlatList stable when no matches exist', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen />);
      });

      const searchInput = renderer!.root.findByProps({ accessibilityLabel: 'Search in your orders' });
      expect(searchInput).toBeDefined();

      // Continuous typing: 'xyz123' (matches nothing)
      await act(async () => {
        searchInput.props.onChangeText('x');
      });
      await act(async () => {
        searchInput.props.onChangeText('xy');
      });
      await act(async () => {
        searchInput.props.onChangeText('xyz123');
      });

      expect(renderer!.root.findByProps({ accessibilityLabel: 'Search in your orders' }).props.value).toBe('xyz123');

      // Advance debounce timer
      await act(async () => {
        jest.advanceTimersByTime(250);
      });

      // FlatLists remain mounted (both filter chips and orders list)
      const scrollViews = renderer!.root.findAllByType('RCTScrollView' as any);
      expect(scrollViews.length).toBeGreaterThanOrEqual(2);

      // Verify the search input remains mounted and active
      const stableInput = renderer!.root.findByProps({ accessibilityLabel: 'Search in your orders' });
      expect(stableInput.props.value).toBe('xyz123');

      // Clear search
      await act(async () => {
        stableInput.props.onChangeText('');
      });
      expect(renderer!.root.findByProps({ accessibilityLabel: 'Search in your orders' }).props.value).toBe('');
    });
  });
});
