import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { TextInput, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Header } from '../src/components/Header';
import { HomeScreen } from '../src/screens/HomeScreen';
import { CategoriesScreen } from '../src/screens/CategoriesScreen';
import { ProductsScreen } from '../src/screens/ProductsScreen';
import * as api from '../src/services/api';

// Mock AuthContext
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Sujal Test', email: 'sujal@example.com', role: 'CUSTOMER', status: 'APPROVED' },
    token: 'test-token',
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
      name: 'Test Product 1',
      description: 'Test Description 1',
      price: 1999,
      discount: 10,
      stock: 10,
      category: 'Electronics',
      image: '/images/p1.jpg',
      featured: true,
      createdAt: '2026-01-01',
    },
  ],
  total: 1,
  page: 1,
  limit: 12,
  totalPages: 1,
  categories: ['Electronics'],
};

describe('Global Search Focus and Keyboard Behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(api, 'getProducts').mockResolvedValue(mockProductsResponse);
    jest.spyOn(api, 'getCategories').mockResolvedValue(['Electronics', 'Clothing']);
    jest.spyOn(api, 'getBannerProducts').mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Header and Home Screen Search Icon', () => {
    it('triggers onSearchPress when Header search button is tapped', () => {
      const onSearchPress = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;

      act(() => {
        renderer = renderWithSafeArea(
          <Header onSearchPress={onSearchPress} />
        );
      });

      const searchBtn = renderer!.root.find(
        (node) =>
          node.props.accessibilityRole === 'button' &&
          node.props.accessibilityLabel === 'Search products'
      );

      expect(searchBtn).toBeDefined();

      act(() => {
        searchBtn.props.onPress();
      });

      expect(onSearchPress).toHaveBeenCalledTimes(1);
    });

    it('HomeScreen forwards search button press to onNavigateToProducts with autoFocusSearch=true', async () => {
      const onNavigateToProducts = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;

      await act(async () => {
        renderer = renderWithSafeArea(
          <HomeScreen onNavigateToProducts={onNavigateToProducts} />
        );
      });

      const searchBtn = renderer!.root.find(
        (node) =>
          node.props.accessibilityRole === 'button' &&
          node.props.accessibilityLabel === 'Search products'
      );

      act(() => {
        searchBtn.props.onPress();
      });

      expect(onNavigateToProducts).toHaveBeenCalledWith(undefined, undefined, true);
    });

    it('HomeScreen prefers onSearchPress if explicitly provided', async () => {
      const onSearchPress = jest.fn();
      const onNavigateToProducts = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;

      await act(async () => {
        renderer = renderWithSafeArea(
          <HomeScreen
            onNavigateToProducts={onNavigateToProducts}
            onSearchPress={onSearchPress}
          />
        );
      });

      const searchBtn = renderer!.root.find(
        (node) =>
          node.props.accessibilityRole === 'button' &&
          node.props.accessibilityLabel === 'Search products'
      );

      act(() => {
        searchBtn.props.onPress();
      });

      expect(onSearchPress).toHaveBeenCalledTimes(1);
      expect(onNavigateToProducts).not.toHaveBeenCalled();
    });
  });

  describe('2. Categories Screen Search Icon', () => {
    it('calls onSearchPress when CategoriesScreen search button is tapped', async () => {
      const onSearchPress = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;

      await act(async () => {
        renderer = renderWithSafeArea(
          <CategoriesScreen onSearchPress={onSearchPress} />
        );
      });

      const searchBtn = renderer!.root.find(
        (node) =>
          node.props.accessibilityRole === 'button' &&
          node.props.accessibilityLabel === 'Search products'
      );

      expect(searchBtn).toBeDefined();

      act(() => {
        searchBtn.props.onPress();
      });

      expect(onSearchPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. ProductsScreen Search Focus & Consumption', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('automatically calls focus and onConsumeAutoFocus when autoFocusSearch is true', async () => {
      const onConsumeAutoFocus = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;

      await act(async () => {
        renderer = renderWithSafeArea(
          <ProductsScreen
            autoFocusSearch={true}
            searchFocusKey={1}
            onConsumeAutoFocus={onConsumeAutoFocus}
          />
        );
      });

      const textInput = renderer!.root.findByType(TextInput);
      expect(textInput).toBeDefined();
      expect(textInput.props.accessibilityLabel).toBe('Search products');

      // Check that onConsumeAutoFocus was called to clear the navigation parameter
      expect(onConsumeAutoFocus).toHaveBeenCalledTimes(1);

      // Fast-forward timers to verify no unhandled focus errors
      act(() => {
        jest.runAllTimers();
      });
    });

    it('does not re-trigger onConsumeAutoFocus if autoFocusSearch is false', async () => {
      const onConsumeAutoFocus = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;

      await act(async () => {
        renderer = renderWithSafeArea(
          <ProductsScreen
            autoFocusSearch={false}
            onConsumeAutoFocus={onConsumeAutoFocus}
          />
        );
      });

      expect(onConsumeAutoFocus).not.toHaveBeenCalled();
    });

    it('focuses search input when search icon inside search bar is tapped', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;

      await act(async () => {
        renderer = renderWithSafeArea(<ProductsScreen />);
      });

      const focusIconBtn = renderer!.root.find(
        (node) =>
          node.props.accessibilityRole === 'button' &&
          node.props.accessibilityLabel === 'Focus search input'
      );

      expect(focusIconBtn).toBeDefined();

      // Tap search icon inside search bar
      act(() => {
        focusIconBtn.props.onPress();
      });

      act(() => {
        jest.runAllTimers();
      });
    });

    it('re-triggers focus when searchFocusKey updates while already mounted', async () => {
      const onConsumeAutoFocus = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;

      await act(async () => {
        renderer = renderWithSafeArea(
          <ProductsScreen
            autoFocusSearch={true}
            searchFocusKey={1}
            onConsumeAutoFocus={onConsumeAutoFocus}
          />
        );
      });

      expect(onConsumeAutoFocus).toHaveBeenCalledTimes(1);

      // Update props with new searchFocusKey (e.g. user tapped search icon again)
      await act(async () => {
        renderer.update(
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ProductsScreen
              autoFocusSearch={true}
              searchFocusKey={2}
              onConsumeAutoFocus={onConsumeAutoFocus}
            />
          </SafeAreaProvider>
        );
      });

      expect(onConsumeAutoFocus).toHaveBeenCalledTimes(2);
    });
  });
});
