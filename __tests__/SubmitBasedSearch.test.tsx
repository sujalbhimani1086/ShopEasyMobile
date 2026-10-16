import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Keyboard, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProductsScreen } from '../src/screens/ProductsScreen';
import * as api from '../src/services/api';

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

const mockInitialProductsResponse = {
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
      name: 'AirPods Max Headphones',
      description: 'Over-ear headphones with active noise cancellation',
      price: 59900,
      discount: 5,
      stock: 8,
      category: 'Electronics',
      image: '/images/airpods.jpg',
      featured: true,
      createdAt: '2026-01-02',
    },
    {
      id: 3,
      name: 'Cotton Graphic T-Shirt',
      description: 'Comfortable casual wear t-shirt',
      price: 699,
      discount: 20,
      stock: 40,
      category: 'Clothing',
      image: '/images/tshirt.jpg',
      featured: false,
      createdAt: '2026-01-03',
    },
  ],
  total: 3,
  page: 1,
  limit: 12,
  totalPages: 1,
  categories: ['Electronics', 'Clothing'],
};

const mockHeadphonesSearchResults = {
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
      name: 'AirPods Max Headphones',
      description: 'Over-ear headphones with active noise cancellation',
      price: 59900,
      discount: 5,
      stock: 8,
      category: 'Electronics',
      image: '/images/airpods.jpg',
      featured: true,
      createdAt: '2026-01-02',
    },
  ],
  total: 2,
  page: 1,
  limit: 12,
  totalPages: 1,
  categories: ['Electronics', 'Clothing'],
};

describe('Submit-Based Product Search Experience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(Keyboard, 'dismiss');
    jest.spyOn(api, 'getCategories').mockResolvedValue(['Electronics', 'Clothing']);
    jest.spyOn(api, 'getProducts').mockImplementation(async (params: any) => {
      const searchParam = typeof params === 'object' ? params.search : '';
      if (searchParam && searchParam.toLowerCase().includes('head')) {
        return mockHeadphonesSearchResults;
      }
      if (searchParam && searchParam.toLowerCase().includes('nonexistent')) {
        return {
          products: [],
          total: 0,
          page: 1,
          limit: 12,
          totalPages: 0,
          categories: ['Electronics', 'Clothing'],
        };
      }
      return mockInitialProductsResponse;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('1. Typing in search field displays matching product names only and hides product cards grid', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderWithSafeArea(<ProductsScreen />);
    });

    const searchInput = renderer!.root.findByProps({ accessibilityLabel: 'Search products' });
    expect(searchInput).toBeDefined();
    expect(searchInput.props.returnKeyType).toBe('search');

    // Simulate typing "head"
    await act(async () => {
      searchInput.props.onChangeText('head');
    });

    // Advance 200ms timer to trigger suggestions fetch
    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    // Verify suggestions are displayed with product names only
    const suggestionHeader = renderer!.root.findAllByProps({ children: 'Product Suggestions' });
    expect(suggestionHeader.length).toBeGreaterThan(0);

    // Verify product name suggestion buttons exist
    const suggestionButtons = renderer!.root.findAllByProps({
      accessibilityLabel: 'Search for Wireless Bluetooth Headphones',
    });
    expect(suggestionButtons.length).toBeGreaterThanOrEqual(1);

    const airpodsSuggestion = renderer!.root.findAllByProps({
      accessibilityLabel: 'Search for AirPods Max Headphones',
    });
    expect(airpodsSuggestion.length).toBeGreaterThanOrEqual(1);

    // Verify product cards grid is NOT rendered while viewing suggestions
    const productCards = renderer!.root.findAllByProps({ accessibilityLabel: /Add to cart/i });
    expect(productCards.length).toBe(0);
  });

  it('2. Pressing keyboard Search dismisses keyboard, hides suggestions, and renders matching product cards', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderWithSafeArea(<ProductsScreen />);
    });

    const searchInput = renderer!.root.findByProps({ accessibilityLabel: 'Search products' });

    // Type query
    await act(async () => {
      searchInput.props.onChangeText('head');
    });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    // Submit via keyboard Enter/Search
    await act(async () => {
      searchInput.props.onSubmitEditing();
    });

    // Verify keyboard is dismissed
    expect(Keyboard.dismiss).toHaveBeenCalled();

    // Verify suggestions list is now hidden
    const suggestionHeaders = renderer!.root.findAllByProps({ children: 'Product Suggestions' });
    expect(suggestionHeaders.length).toBe(0);

    // Verify matching product cards are rendered
    const product1 = renderer!.root.findAllByProps({ children: 'Wireless Bluetooth Headphones' });
    expect(product1.length).toBeGreaterThan(0);

    // Search query remains visible in the search field
    const updatedInput = renderer!.root.findByProps({ accessibilityLabel: 'Search products' });
    expect(updatedInput.props.value).toBe('head');
  });

  it('3. Tapping a suggestion fills the input and executes search for that product', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderWithSafeArea(<ProductsScreen />);
    });

    const searchInput = renderer!.root.findByProps({ accessibilityLabel: 'Search products' });

    // Type query
    await act(async () => {
      searchInput.props.onChangeText('head');
    });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    // Find suggestion button and tap it
    const suggestionBtn = renderer!.root.findByProps({
      accessibilityLabel: 'Search for AirPods Max Headphones',
    });
    expect(suggestionBtn).toBeDefined();

    await act(async () => {
      suggestionBtn.props.onPress();
    });

    // Verify keyboard dismissed
    expect(Keyboard.dismiss).toHaveBeenCalled();

    // Verify search input filled with the selected product name
    const updatedInput = renderer!.root.findByProps({ accessibilityLabel: 'Search products' });
    expect(updatedInput.props.value).toBe('AirPods Max Headphones');

    // Suggestions list is closed
    const suggestionHeaders = renderer!.root.findAllByProps({ children: 'Product Suggestions' });
    expect(suggestionHeaders.length).toBe(0);
  });

  it('4. Shows appropriate empty message when search yields no products', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderWithSafeArea(<ProductsScreen />);
    });

    const searchInput = renderer!.root.findByProps({ accessibilityLabel: 'Search products' });

    await act(async () => {
      searchInput.props.onChangeText('nonexistent');
    });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    // Press Search on keyboard
    await act(async () => {
      searchInput.props.onSubmitEditing();
    });

    // Empty state message is rendered
    const emptyMsg = renderer!.root.findAllByProps({
      children: 'No matching products found for "nonexistent". Try checking your spelling or clear your search.',
    });
    expect(emptyMsg.length).toBeGreaterThanOrEqual(1);
  });

  it('5. Clearing search resets input and displays all products', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderWithSafeArea(<ProductsScreen initialSearch="head" />);
    });

    const clearBtn = renderer!.root.findByProps({ accessibilityLabel: 'Clear search text' });
    expect(clearBtn).toBeDefined();

    await act(async () => {
      clearBtn.props.onPress();
    });

    const input = renderer!.root.findByProps({ accessibilityLabel: 'Search products' });
    expect(input.props.value).toBe('');
  });
});
