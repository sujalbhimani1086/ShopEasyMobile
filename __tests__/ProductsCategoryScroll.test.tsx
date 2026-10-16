import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { FlatList, Text, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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

const waitMs = (ms = 50) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });

async function renderWithSafeAreaAsync(ui: React.ReactElement) {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={initialMetrics}>{ui}</SafeAreaProvider>
    );
  });
  // Flush promises to allow getCategories and getProducts to resolve and update state
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await waitMs(50);
  });
  return renderer!;
}

function getResolvedStyle(node: any) {
  if (!node || !node.props) return {};
  const rawStyle =
    typeof node.props.style === 'function'
      ? node.props.style({ pressed: false })
      : node.props.style;
  return Array.isArray(rawStyle) ? Object.assign({}, ...rawStyle) : rawStyle || {};
}

const mockCategories = [
  'Accessories',
  'Bags',
  'Beauty',
  'Books',
  'Clothing',
  'Electronics',
  'Footwear',
  'Home & Kitchen',
  'Sports',
  'Toys',
];

const mockProductsAll = {
  products: [
    {
      id: 1,
      name: 'All Product 1',
      description: 'Desc 1',
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
  categories: mockCategories,
};

const mockProductsSports = {
  products: [
    {
      id: 2,
      name: 'Sports Football',
      description: 'FIFA football',
      price: 999,
      discount: 15,
      stock: 25,
      category: 'Sports',
      image: '/images/sports.jpg',
      featured: false,
      createdAt: '2026-01-02',
    },
  ],
  total: 1,
  page: 1,
  limit: 12,
  totalPages: 1,
  categories: mockCategories,
};

describe('Category Chip Auto-Reset & Scroll Position Fix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(api, 'getCategories').mockResolvedValue(mockCategories);
    jest.spyOn(api, 'getProducts').mockImplementation((params?: any) => {
      if (params?.category === 'Sports') {
        return Promise.resolve(mockProductsSports);
      }
      return Promise.resolve(mockProductsAll);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders horizontally scrollable category chips including All and all available categories', async () => {
    const renderer = await renderWithSafeAreaAsync(<ProductsScreen />);

    // Find the category chips horizontal FlatList
    const flatLists = renderer.root.findAllByType(FlatList);
    const categoryFlatList = flatLists.find((fl) => fl.props.horizontal === true);

    expect(categoryFlatList).toBeDefined();
    expect(categoryFlatList?.props.data).toContain('All');
    expect(categoryFlatList?.props.data).toContain('Sports');
    expect(categoryFlatList?.props.data).toContain('Toys');
    expect(categoryFlatList?.props.data).toContain('Home & Kitchen');
  });

  it('preserves the category list instance across category selection without unmounting', async () => {
    const renderer = await renderWithSafeAreaAsync(<ProductsScreen />);

    const flatListsBefore = renderer.root.findAllByType(FlatList);
    const categoryFlatListBefore = flatListsBefore.find((fl) => fl.props.horizontal === true);
    expect(categoryFlatListBefore).toBeDefined();

    // Find the Sports category chip and select it
    const sportsChip = renderer.root.findAll(
      (node) => node.props && node.props.accessibilityLabel === 'Category Sports'
    )[0];
    expect(sportsChip).toBeDefined();

    await act(async () => {
      sportsChip.props.onPress();
      await Promise.resolve();
      await waitMs(50);
    });

    // The horizontal FlatList must still be mounted and present
    const flatListsAfter = renderer.root.findAllByType(FlatList);
    const categoryFlatListAfter = flatListsAfter.find((fl) => fl.props.horizontal === true);
    expect(categoryFlatListAfter).toBeDefined();

    // Verify Sports chip is now selected with active blue background
    const sportsChipAfter = renderer.root.findAll(
      (node) => node.props && node.props.accessibilityLabel === 'Category Sports'
    )[0];
    const styleObj = getResolvedStyle(sportsChipAfter);
    expect(styleObj.backgroundColor).toBe('#2874F0');
  });

  it('filters products to Sports when Sports category is selected', async () => {
    const renderer = await renderWithSafeAreaAsync(<ProductsScreen />);

    const sportsChip = renderer.root.findAll(
      (node) => node.props && node.props.accessibilityLabel === 'Category Sports'
    )[0];
    expect(sportsChip).toBeDefined();

    await act(async () => {
      sportsChip.props.onPress();
      await Promise.resolve();
      await waitMs(50);
    });

    expect(api.getProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Sports',
        page: 1,
      })
    );
  });

  it('keeps the selected category highlighted with blue active background and unselects All', async () => {
    const renderer = await renderWithSafeAreaAsync(<ProductsScreen />);

    const allChipBefore = renderer.root.findAll(
      (node) => node.props && node.props.accessibilityLabel === 'Category All'
    )[0];
    const allStyleBefore = getResolvedStyle(allChipBefore);
    expect(allStyleBefore.backgroundColor).toBe('#2874F0');

    const sportsChip = renderer.root.findAll(
      (node) => node.props && node.props.accessibilityLabel === 'Category Sports'
    )[0];
    await act(async () => {
      sportsChip.props.onPress();
      await Promise.resolve();
      await waitMs(50);
    });

    // Sports is now blue
    const sportsChipAfter = renderer.root.findAll(
      (node) => node.props && node.props.accessibilityLabel === 'Category Sports'
    )[0];
    const sportsStyleAfter = getResolvedStyle(sportsChipAfter);
    expect(sportsStyleAfter.backgroundColor).toBe('#2874F0');

    // All is now white / unselected
    const allChipAfter = renderer.root.findAll(
      (node) => node.props && node.props.accessibilityLabel === 'Category All'
    )[0];
    const allStyleAfter = getResolvedStyle(allChipAfter);
    expect(allStyleAfter.backgroundColor).toBe('#FFFFFF');
  });

  it('supports selecting other categories like Toys and maintains filtering without jumping back', async () => {
    const renderer = await renderWithSafeAreaAsync(<ProductsScreen />);

    const toysChip = renderer.root.findAll(
      (node) => node.props && node.props.accessibilityLabel === 'Category Toys'
    )[0];
    expect(toysChip).toBeDefined();

    await act(async () => {
      toysChip.props.onPress();
      await Promise.resolve();
      await waitMs(50);
    });

    expect(api.getProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Toys',
      })
    );

    const toysChipAfter = renderer.root.findAll(
      (node) => node.props && node.props.accessibilityLabel === 'Category Toys'
    )[0];
    const toysStyle = getResolvedStyle(toysChipAfter);
    expect(toysStyle.backgroundColor).toBe('#2874F0');
  });

  it('clearing the active category filter pill returns to All', async () => {
    const renderer = await renderWithSafeAreaAsync(<ProductsScreen />);

    const sportsChip = renderer.root.findAll(
      (node) => node.props && node.props.accessibilityLabel === 'Category Sports'
    )[0];
    expect(sportsChip).toBeDefined();

    await act(async () => {
      sportsChip.props.onPress();
      await Promise.resolve();
      await waitMs(50);
    });

    // Locate active filter pill text for "Sports"
    const texts = renderer.root.findAllByType(Text);
    const sportsPillText = texts.find((t) => t.props.children === 'Sports');
    expect(sportsPillText).toBeDefined();

    // Now select 'All' directly
    const allChip = renderer.root.findAll(
      (node) => node.props && node.props.accessibilityLabel === 'Category All'
    )[0];
    await act(async () => {
      allChip.props.onPress();
      await Promise.resolve();
      await waitMs(50);
    });

    const allChipAfter = renderer.root.findAll(
      (node) => node.props && node.props.accessibilityLabel === 'Category All'
    )[0];
    const allStyle = getResolvedStyle(allChipAfter);
    expect(allStyle.backgroundColor).toBe('#2874F0');
  });
});
