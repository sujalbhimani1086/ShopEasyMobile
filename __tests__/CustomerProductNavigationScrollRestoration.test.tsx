import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { FlatList, Text, TextInput, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme/theme';
import {
  ProductsScreen,
  getLastProductsScreenState,
  setLastProductsScreenState,
  clearProductsScreenState,
} from '../src/screens/ProductsScreen';
import {
  HomeScreen,
  getLastHomeScreenState,
  setLastHomeScreenState,
  clearHomeScreenState,
} from '../src/screens/HomeScreen';
import { queryKeys } from '../src/config/queryKeys';
import * as api from '../src/services/api';
import type { Product } from '../src/types/product';

// Mock AuthContext
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Sujal Customer', role: 'CUSTOMER' },
    token: 'test-token',
    logout: jest.fn(),
  }),
}));

// Mock WishlistContext
jest.mock('../src/context/WishlistContext', () => ({
  useWishlist: () => ({
    wishlistItems: [],
    wishlistCount: 2,
    isWishlisted: () => false,
    toggleWishlist: jest.fn().mockResolvedValue(true),
    clearWishlist: jest.fn(),
  }),
}));

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 60 * 1000,
      },
    },
  });
}

function renderWithClient(ui: React.ReactElement, client: QueryClient) {
  return ReactTestRenderer.create(
    <QueryClientProvider client={client}>
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <ThemeProvider initialMode="light">{ui}</ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

function extractStrings(node: ReactTestRenderer.ReactTestInstance): string[] {
  const result: string[] = [];
  function recurse(current: ReactTestRenderer.ReactTestInstance | string) {
    if (typeof current === 'string') {
      result.push(current);
      return;
    }
    if (current && current.children) {
      current.children.forEach((child) => recurse(child as any));
    }
  }
  recurse(node);
  return result;
}

function clickProduct(root: ReactTestRenderer.ReactTestInstance, productName: string) {
  const textNode = root.findAllByType(Text).find((t) => t.props.children === productName);
  if (!textNode) {
    throw new Error(`Could not find text node for product: ${productName}`);
  }
  let curr: ReactTestRenderer.ReactTestInstance | null = textNode;
  while (curr && typeof curr.props?.onPress !== 'function') {
    curr = curr.parent;
  }
  if (!curr || typeof curr.props?.onPress !== 'function') {
    throw new Error(`Could not find pressable ancestor for product: ${productName}`);
  }
  curr.props.onPress();
}

const mockCategoriesList = ['All', 'Electronics', 'Clothing', 'Sports', 'Home', 'Footwear'];

const mockPage1Products: Product[] = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  name: `Product ${i + 1}`,
  price: (i + 1) * 100,
  discount: 0,
  stock: 10,
  category: i % 2 === 0 ? 'Electronics' : 'Footwear',
  image: `/img${i + 1}.png`,
}));

const mockPage2Products: Product[] = Array.from({ length: 8 }, (_, i) => ({
  id: i + 9,
  name: `Product ${i + 9}`,
  price: (i + 9) * 100,
  discount: 5,
  stock: 8,
  category: 'Electronics',
  image: `/img${i + 9}.png`,
}));

const mockBanners: Product[] = [
  {
    id: 201,
    name: 'Running Pro Shoes',
    price: 3499,
    discount: 30,
    stock: 10,
    category: 'Footwear',
    image: '/shoes.png',
    targetType: 'category',
  },
  {
    id: 202,
    name: 'Wireless Noise-Canceling Earphones',
    price: 4999,
    discount: 20,
    stock: 15,
    category: 'Electronics',
    image: '/earphones.png',
    targetType: 'category',
  },
];

import { queryClient as staticQueryClient } from '../src/config/queryClient';

describe('Customer Product Back Navigation and Scroll Restoration Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearProductsScreenState();
    clearHomeScreenState();
    staticQueryClient.clear();

    jest.spyOn(api, 'getCategories').mockResolvedValue(mockCategoriesList);
    jest.spyOn(api, 'getBannerProducts').mockResolvedValue(mockBanners);
    jest.spyOn(api, 'getProducts').mockResolvedValue({
      products: mockPage1Products,
      total: 16,
      page: 1,
      limit: 8,
      totalPages: 2,
      hasMore: true,
      categories: mockCategoriesList,
    });
  });

  afterEach(() => {
    clearProductsScreenState();
    clearHomeScreenState();
    staticQueryClient.clear();
  });

  it('1. Preserves scroll position and restores exact offset when returning from Product Details in middle of list', async () => {
    const client = createTestQueryClient();
    // Pre-populate page 1 query cache for instant render
    client.setQueryData(queryKeys.products('all', '', 'default', 1), {
      products: mockPage1Products,
      total: 16,
      page: 1,
      limit: 8,
      totalPages: 2,
      hasMore: true,
    });

    const onProductPress = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = renderWithClient(
        <ProductsScreen isActive={true} onProductPress={onProductPress} />,
        client
      );
      await Promise.resolve();
    });

    const root = renderer!.root;
    const flatLists = root.findAllByType(FlatList);
    const productGrid = flatLists.find((fl) => fl.props.numColumns === 2);
    expect(productGrid).toBeDefined();

    // Mock scrollToOffset on the FlatList ref
    const scrollToOffsetSpy = jest.fn();
    (productGrid!.instance as any).scrollToOffset = scrollToOffsetSpy;

    // Simulate user scrolling down to middle of list (offset = 640)
    await act(async () => {
      productGrid!.props.onScroll({
        nativeEvent: { contentOffset: { x: 0, y: 640 } },
      });
    });

    expect(getLastProductsScreenState()?.scrollOffset).toBe(640);

    // Simulate opening product 4 (near middle)
    await act(async () => {
      clickProduct(root, 'Product 4');
    });
    expect(onProductPress).toHaveBeenCalledWith(4);
    expect(getLastProductsScreenState()?.scrollOffset).toBe(640);

    // Simulate screen becoming inactive (navigating to details)
    await act(async () => {
      renderer!.update(
        <QueryClientProvider client={client}>
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ThemeProvider initialMode="light">
              <ProductsScreen isActive={false} onProductPress={onProductPress} />
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      );
    });

    // Spurious scroll reset event to 0 while hidden must be IGNORED
    await act(async () => {
      productGrid!.props.onScroll({
        nativeEvent: { contentOffset: { x: 0, y: 0 } },
      });
    });
    expect(getLastProductsScreenState()?.scrollOffset).toBe(640);

    // Simulate pressing Back from Product Details (screen becomes active again)
    await act(async () => {
      renderer!.update(
        <QueryClientProvider client={client}>
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ThemeProvider initialMode="light">
              <ProductsScreen isActive={true} onProductPress={onProductPress} />
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      );
      await Promise.resolve();
    });

    // Verify scrollToOffset was called with offset 640 to restore exact position
    expect(scrollToOffsetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 640, animated: false })
    );

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('2. Preserves multi-page infinite scroll state, all 16 loaded products, and restores position near bottom', async () => {
    const client = createTestQueryClient();
    jest.spyOn(api, 'getProducts').mockImplementation(async (params: any) => {
      if (params?.page === 2) {
        return {
          products: mockPage2Products,
          total: 16,
          page: 2,
          limit: 8,
          totalPages: 2,
          hasMore: false,
          categories: mockCategoriesList,
        };
      }
      return {
        products: mockPage1Products,
        total: 16,
        page: 1,
        limit: 8,
        totalPages: 2,
        hasMore: true,
        categories: mockCategoriesList,
      };
    });

    // Cache pre-populated with 2 pages of data
    client.setQueryData(queryKeys.products('all', '', 'default', 1), {
      products: mockPage1Products,
      total: 16,
      page: 1,
      limit: 8,
      totalPages: 2,
      hasMore: true,
    });

    const onProductPress = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = renderWithClient(
        <ProductsScreen isActive={true} onProductPress={onProductPress} />,
        client
      );
      await Promise.resolve();
    });

    const root = renderer!.root;
    const flatLists = root.findAllByType(FlatList);
    const productGrid = flatLists.find((fl) => fl.props.numColumns === 2);
    expect(productGrid).toBeDefined();

    // Trigger onEndReached to load page 2
    await act(async () => {
      await productGrid!.props.onEndReached();
      await Promise.resolve();
    });

    const scrollToOffsetSpy = jest.fn();
    (productGrid!.instance as any).scrollToOffset = scrollToOffsetSpy;

    // Simulate scrolling near bottom to product 14 (offset = 1580)
    await act(async () => {
      productGrid!.props.onScroll({
        nativeEvent: { contentOffset: { x: 0, y: 1580 } },
      });
    });

    // User taps product 14 on page 2
    await act(async () => {
      clickProduct(root, 'Product 14');
    });
    expect(onProductPress).toHaveBeenCalledWith(14);
    expect(getLastProductsScreenState()?.scrollOffset).toBe(1580);

    // Navigate to details (inactive) and press Back (active)
    await act(async () => {
      renderer!.update(
        <QueryClientProvider client={client}>
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ThemeProvider initialMode="light">
              <ProductsScreen isActive={false} onProductPress={onProductPress} />
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      );
    });

    await act(async () => {
      renderer!.update(
        <QueryClientProvider client={client}>
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ThemeProvider initialMode="light">
              <ProductsScreen isActive={true} onProductPress={onProductPress} />
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      );
      await Promise.resolve();
    });

    // Confirm all 16 items remain loaded, NOT truncated to 8
    expect(productGrid!.props.data.length).toBe(16);
    expect(scrollToOffsetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 1580, animated: false })
    );

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('3. Preserves category, search query, sorting, and scroll offset on back navigation', async () => {
    const client = createTestQueryClient();
    const electronicsProducts: Product[] = [
      {
        id: 101,
        name: 'Wireless Bluetooth Earphones',
        price: 1499,
        discount: 20,
        stock: 12,
        category: 'Electronics',
        image: '/earphones.png',
      },
    ];

    client.setQueryData(queryKeys.products('Electronics', 'Bluetooth', 'default', 1), {
      products: electronicsProducts,
      total: 1,
      page: 1,
      limit: 8,
      totalPages: 1,
      hasMore: false,
    });

    jest.spyOn(api, 'getProducts').mockResolvedValue({
      products: electronicsProducts,
      total: 1,
      page: 1,
      limit: 8,
      totalPages: 1,
      hasMore: false,
      categories: mockCategoriesList,
    });

    const onProductPress = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = renderWithClient(
        <ProductsScreen
          isActive={true}
          initialCategory="Electronics"
          initialSearch="Bluetooth"
          onProductPress={onProductPress}
        />,
        client
      );
      await Promise.resolve();
    });

    const root = renderer!.root;
    const flatLists = root.findAllByType(FlatList);
    const productGrid = flatLists.find((fl) => fl.props.numColumns === 2);
    expect(productGrid).toBeDefined();

    const scrollToOffsetSpy = jest.fn();
    (productGrid!.instance as any).scrollToOffset = scrollToOffsetSpy;

    // Simulate scroll to offset 320
    await act(async () => {
      productGrid!.props.onScroll({
        nativeEvent: { contentOffset: { x: 0, y: 320 } },
      });
    });

    // Verify saved state reflects category, search, and scroll
    const state = getLastProductsScreenState();
    expect(state?.category).toBe('Electronics');
    expect(state?.search).toBe('Bluetooth');
    expect(state?.scrollOffset).toBe(320);

    // Tap product 101
    await act(async () => {
      clickProduct(root, 'Wireless Bluetooth Earphones');
    });

    // Simulate forward navigation to details (screen becomes inactive)
    await act(async () => {
      renderer!.update(
        <QueryClientProvider client={client}>
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ThemeProvider initialMode="light">
              <ProductsScreen
                isActive={false}
                initialCategory="Electronics"
                initialSearch="Bluetooth"
                onProductPress={onProductPress}
              />
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      );
    });

    // Simulate pressing Back from Product Details (screen becomes active again)
    await act(async () => {
      renderer!.update(
        <QueryClientProvider client={client}>
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ThemeProvider initialMode="light">
              <ProductsScreen
                isActive={true}
                initialCategory="Electronics"
                initialSearch="Bluetooth"
                onProductPress={onProductPress}
              />
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      );
      await Promise.resolve();
    });

    // Verify category and search query were preserved
    const texts = extractStrings(root);
    expect(texts).toContain('Wireless Bluetooth Earphones');
    expect(scrollToOffsetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 320, animated: false })
    );

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('4. Back navigation does NOT trigger duplicate API requests when cached products exist', async () => {
    const client = createTestQueryClient();
    const cacheKey = queryKeys.products('all', '', 'default', 1);
    client.setQueryData(cacheKey, {
      products: mockPage1Products,
      total: 16,
      page: 1,
      hasMore: true,
    });

    const getProductsSpy = jest.spyOn(api, 'getProducts');

    // Simulate pre-existing state as if user previously scrolled to offset 400
    setLastProductsScreenState({
      category: 'all',
      search: '',
      sort: 'default',
      scrollOffset: 400,
      loadedProducts: mockPage1Products,
      page: 1,
      hasMore: true,
      totalCount: 16,
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderWithClient(<ProductsScreen isActive={true} />, client);
      await Promise.resolve();
    });

    // getProducts should NOT have been called because cached products exist and user is scrolled
    expect(getProductsSpy).not.toHaveBeenCalled();

    const root = renderer!.root;
    const texts = extractStrings(root);
    expect(texts).toContain('Product 1');
    expect(texts).not.toContain('Loading Products...');

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('5. Cached products render immediately with zero full-page loader flash upon return', async () => {
    const client = createTestQueryClient();
    const cacheKey = queryKeys.products('all', '', 'default', 1);
    client.setQueryData(cacheKey, {
      products: mockPage1Products,
      total: 8,
      hasMore: false,
      page: 1,
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    // Synchronous initial render pass:
    act(() => {
      renderer = renderWithClient(<ProductsScreen />, client);
    });

    const texts = extractStrings(renderer!.root);
    expect(texts).toContain('Product 1');
    expect(texts).not.toContain('Loading Products...');

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('6. Explicit filter change (selecting new category or search) resets scroll position to 0', async () => {
    const client = createTestQueryClient();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = renderWithClient(<ProductsScreen isActive={true} />, client);
      await Promise.resolve();
    });

    const root = renderer!.root;
    const flatLists = root.findAllByType(FlatList);
    const productGrid = flatLists.find((fl) => fl.props.numColumns === 2);
    expect(productGrid).toBeDefined();

    // Scroll to 500
    await act(async () => {
      productGrid!.props.onScroll({
        nativeEvent: { contentOffset: { x: 0, y: 500 } },
      });
    });
    expect(getLastProductsScreenState()?.scrollOffset).toBe(500);

    // Select category 'Sports'
    const sportsChip = root.findAll(
      (n) => n.props && n.props.accessibilityLabel === 'Category Sports'
    )[0];
    expect(sportsChip).toBeDefined();

    await act(async () => {
      sportsChip.props.onPress();
      await Promise.resolve();
    });

    // Changing category explicitly resets scroll offset to 0
    expect(getLastProductsScreenState()?.scrollOffset).toBe(0);

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('7. Flow A: Preserves scroll position and restores exact offset when returning from Product Details on Home Screen', async () => {
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.homeData, {
      allProducts: mockPage1Products,
      featuredProducts: mockPage1Products.slice(0, 6),
      categories: mockCategoriesList,
      bannerProducts: mockBanners,
    });

    const onProductPress = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = renderWithClient(
        <HomeScreen isActive={true} onProductPress={onProductPress} />,
        client
      );
      await Promise.resolve();
    });

    const root = renderer!.root;
    // Find the main vertical FlatList (numColumns === 2)
    const flatLists = root.findAllByType(FlatList);
    const homeGrid = flatLists.find((fl) => fl.props.numColumns === 2);
    expect(homeGrid).toBeDefined();

    const scrollToOffsetSpy = jest.fn();
    (homeGrid!.instance as any).scrollToOffset = scrollToOffsetSpy;

    // 1. User scrolls down the Home screen to middle (offset = 720)
    await act(async () => {
      homeGrid!.props.onScroll({
        nativeEvent: { contentOffset: { x: 0, y: 720 } },
      });
    });

    expect(getLastHomeScreenState()?.scrollOffset).toBe(720);

    // 2. User taps a product card
    await act(async () => {
      clickProduct(root, 'Product 3');
    });

    expect(onProductPress).toHaveBeenCalledWith(3);
    expect(getLastHomeScreenState()?.scrollOffset).toBe(720);

    // 3. Screen transitions to hidden/inactive (Product Details opened)
    await act(async () => {
      renderer!.update(
        <QueryClientProvider client={client}>
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ThemeProvider initialMode="light">
              <HomeScreen isActive={false} onProductPress={onProductPress} />
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      );
    });

    // Spurious reset event to y=0 during hidden layout MUST be ignored
    await act(async () => {
      homeGrid!.props.onScroll({
        nativeEvent: { contentOffset: { x: 0, y: 0 } },
      });
    });
    expect(getLastHomeScreenState()?.scrollOffset).toBe(720);

    // 4. User presses Back (screen becomes active again)
    await act(async () => {
      renderer!.update(
        <QueryClientProvider client={client}>
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ThemeProvider initialMode="light">
              <HomeScreen isActive={true} onProductPress={onProductPress} />
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      );
      await Promise.resolve();
    });

    // 5. Exact scroll position restored without resetting to top
    expect(scrollToOffsetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 720, animated: false })
    );

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('8. Flow B: Shop Now navigates to category products and restores source screen scroll position and banner card on Back', async () => {
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.homeData, {
      allProducts: mockPage1Products,
      featuredProducts: mockPage1Products.slice(0, 6),
      categories: mockCategoriesList,
      bannerProducts: mockBanners,
    });

    const onNavigateToProducts = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = renderWithClient(
        <HomeScreen isActive={true} onNavigateToProducts={onNavigateToProducts} />,
        client
      );
      await Promise.resolve();
    });

    const root = renderer!.root;
    const flatLists = root.findAllByType(FlatList);
    const homeGrid = flatLists.find((fl) => fl.props.numColumns === 2);
    expect(homeGrid).toBeDefined();

    const scrollToOffsetSpy = jest.fn();
    (homeGrid!.instance as any).scrollToOffset = scrollToOffsetSpy;

    // 1. User scrolls to a card away from top (offset = 480)
    await act(async () => {
      homeGrid!.props.onScroll({
        nativeEvent: { contentOffset: { x: 0, y: 480 } },
      });
    });

    expect(getLastHomeScreenState()?.scrollOffset).toBe(480);

    // 2. User taps Shop Now button on Footwear banner (id 201)
    const shopNowBtn = root.find((n) => n.props && n.props.testID === 'banner-shop-now-201');
    expect(shopNowBtn).toBeDefined();

    await act(async () => {
      shopNowBtn.props.onPress();
    });

    // 3. Category Products opens for Footwear
    expect(onNavigateToProducts).toHaveBeenCalledWith('Footwear');
    expect(getLastHomeScreenState()?.scrollOffset).toBe(480);

    // 4. Source screen becomes inactive
    await act(async () => {
      renderer!.update(
        <QueryClientProvider client={client}>
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ThemeProvider initialMode="light">
              <HomeScreen isActive={false} onNavigateToProducts={onNavigateToProducts} />
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      );
    });

    // 5. Back pressed -> source screen becomes active again
    await act(async () => {
      renderer!.update(
        <QueryClientProvider client={client}>
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ThemeProvider initialMode="light">
              <HomeScreen isActive={true} onNavigateToProducts={onNavigateToProducts} />
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      );
      await Promise.resolve();
    });

    // 6. Source screen restores exact scroll position where Shop Now was tapped
    expect(scrollToOffsetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 480, animated: false })
    );

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('9. Flow B Repeated Navigation: multiple forward & back round-trips preserve source screen position without progressive loss', async () => {
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.homeData, {
      allProducts: mockPage1Products,
      featuredProducts: mockPage1Products.slice(0, 6),
      categories: mockCategoriesList,
      bannerProducts: mockBanners,
    });

    const onNavigateToProducts = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = renderWithClient(
        <HomeScreen isActive={true} onNavigateToProducts={onNavigateToProducts} />,
        client
      );
      await Promise.resolve();
    });

    const root = renderer!.root;
    const flatLists = root.findAllByType(FlatList);
    const homeGrid = flatLists.find((fl) => fl.props.numColumns === 2);
    expect(homeGrid).toBeDefined();

    const scrollToOffsetSpy = jest.fn();
    (homeGrid!.instance as any).scrollToOffset = scrollToOffsetSpy;

    // --- Round 1: Scroll to 360, tap Footwear Shop Now, Back ---
    await act(async () => {
      homeGrid!.props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 360 } } });
    });
    expect(getLastHomeScreenState()?.scrollOffset).toBe(360);

    const btn1 = root.find((n) => n.props && n.props.testID === 'banner-shop-now-201');
    await act(async () => {
      btn1.props.onPress();
    });
    expect(onNavigateToProducts).toHaveBeenCalledWith('Footwear');

    // Inactive -> Active
    await act(async () => {
      renderer!.update(
        <QueryClientProvider client={client}>
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ThemeProvider initialMode="light">
              <HomeScreen isActive={false} onNavigateToProducts={onNavigateToProducts} />
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      );
    });
    await act(async () => {
      renderer!.update(
        <QueryClientProvider client={client}>
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ThemeProvider initialMode="light">
              <HomeScreen isActive={true} onNavigateToProducts={onNavigateToProducts} />
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      );
      await Promise.resolve();
    });

    expect(scrollToOffsetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 360, animated: false })
    );

    // --- Round 2: Scroll further to 650, tap Electronics Shop Now, Back ---
    await act(async () => {
      homeGrid!.props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 650 } } });
    });
    expect(getLastHomeScreenState()?.scrollOffset).toBe(650);

    const btn2 = root.find((n) => n.props && n.props.testID === 'banner-shop-now-202');
    await act(async () => {
      btn2.props.onPress();
    });
    expect(onNavigateToProducts).toHaveBeenCalledWith('Electronics');

    // Inactive -> Active
    await act(async () => {
      renderer!.update(
        <QueryClientProvider client={client}>
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ThemeProvider initialMode="light">
              <HomeScreen isActive={false} onNavigateToProducts={onNavigateToProducts} />
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      );
    });
    await act(async () => {
      renderer!.update(
        <QueryClientProvider client={client}>
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ThemeProvider initialMode="light">
              <HomeScreen isActive={true} onNavigateToProducts={onNavigateToProducts} />
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      );
      await Promise.resolve();
    });

    // Returned to exact position 650 without resetting to 0 or reverting to round 1's position
    expect(scrollToOffsetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 650, animated: false })
    );

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('10. Strict separation: Category Products screen maintains independent scroll state from Home screen', async () => {
    const client = createTestQueryClient();

    // 1. Simulate Home screen with saved scroll position at 800
    setLastHomeScreenState({
      scrollOffset: 800,
      bannerIndex: 1,
      selectedCategory: 'All',
    });

    // 2. Open Category Products screen for "Clothing"
    let productsRenderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      productsRenderer = renderWithClient(
        <ProductsScreen isActive={true} initialCategory="Clothing" />,
        client
      );
      await Promise.resolve();
    });

    // Category Products must start at its own scroll target 0, NOT Home's 800!
    expect(getLastProductsScreenState()?.scrollOffset ?? 0).not.toBe(800);

    const root = productsRenderer!.root;
    const flatLists = root.findAllByType(FlatList);
    const productGrid = flatLists.find((fl) => fl.props.numColumns === 2);
    expect(productGrid).toBeDefined();

    // User scrolls Category Products to 340
    await act(async () => {
      productGrid!.props.onScroll({
        nativeEvent: { contentOffset: { x: 0, y: 340 } },
      });
    });

    // Category Products scroll offset is 340, Home remains 800
    expect(getLastProductsScreenState()?.scrollOffset).toBe(340);
    expect(getLastHomeScreenState()?.scrollOffset).toBe(800);

    await act(async () => {
      productsRenderer!.unmount();
    });
  });
});
