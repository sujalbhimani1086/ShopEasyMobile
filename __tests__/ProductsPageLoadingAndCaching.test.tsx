import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, FlatList, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme/theme';
import { ProductsScreen } from '../src/screens/ProductsScreen';
import { queryKeys } from '../src/config/queryKeys';
import * as api from '../src/services/api';
import type { Product } from '../src/types/product';

// Mock Auth
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Sujal Customer', role: 'CUSTOMER' },
    token: 'test-token',
    logout: jest.fn(),
  }),
}));

// Mock Wishlist
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
        gcTime: 5 * 60 * 1000,
      },
    },
  });
}

function renderWithClient(ui: React.ReactElement, client: QueryClient) {
  return ReactTestRenderer.create(
    <QueryClientProvider client={client}>
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <ThemeProvider initialMode="light">
          {ui}
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
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

const mockProductsList: Product[] = [
  {
    id: 101,
    name: 'Wireless Bluetooth Earbuds',
    price: 1999,
    discount: 10,
    stock: 25,
    category: 'Electronics',
    image: '/images/earbuds.jpg',
    featured: true,
    createdAt: '2026-01-01',
  },
  {
    id: 102,
    name: 'Mechanical Gaming Keyboard',
    price: 3499,
    discount: 15,
    stock: 12,
    category: 'Electronics',
    image: '/images/keyboard.jpg',
    featured: true,
    createdAt: '2026-01-02',
  },
  {
    id: 103,
    name: 'Running Sports Shoes',
    price: 2499,
    discount: 20,
    stock: 30,
    category: 'Footwear',
    image: '/images/shoes.jpg',
    featured: false,
    createdAt: '2026-01-03',
  },
];

describe('ShopEasyMobile — Products Page Loading and Caching Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(api, 'getCategories').mockResolvedValue(['Electronics', 'Footwear', 'Clothing']);
    jest.spyOn(api, 'getProducts').mockResolvedValue({
      products: mockProductsList,
      total: mockProductsList.length,
      page: 1,
      limit: 8,
      totalPages: 1,
      hasMore: false,
      categories: ['Electronics', 'Footwear', 'Clothing'],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. First visit with no cached data displays the loading state', async () => {
    jest.spyOn(api, 'getProducts').mockReturnValue(new Promise(() => {}));
    const client = createTestQueryClient();

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = renderWithClient(<ProductsScreen />, client);
    });

    const texts = extractAllStrings(renderer!.root);
    expect(texts).toContain('Loading Products...');
  });

  it('2. Products load and render once the request completes', async () => {
    const client = createTestQueryClient();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = renderWithClient(<ProductsScreen />, client);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const texts = extractAllStrings(renderer!.root);
    expect(texts).toContain('Wireless Bluetooth Earbuds');
    expect(texts).toContain('Mechanical Gaming Keyboard');
    expect(texts).toContain('Running Sports Shoes');
    expect(texts).not.toContain('Loading Products...');
  });

  it('3. Navigating away and returning to Products displays cached products immediately with ZERO loader flash', async () => {
    const client = createTestQueryClient();

    // 1. First visit: load products
    let renderer1: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer1 = renderWithClient(<ProductsScreen />, client);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Verify cache has products
    const cachedKey = queryKeys.products('all', '', 'default', 1);
    const cachedData = client.getQueryData<any>(cachedKey);
    expect(cachedData).toBeDefined();
    expect(cachedData.products.length).toBe(3);

    // 2. Simulate navigating away (unmounting ProductsScreen)
    act(() => {
      renderer1.unmount();
    });

    // 3. Simulate returning to ProductsScreen (remounting)
    let renderer2: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer2 = renderWithClient(<ProductsScreen />, client);
    });

    // On the VERY FIRST render pass after mount, cached products must be displayed immediately
    const firstRenderTexts = extractAllStrings(renderer2!.root);
    expect(firstRenderTexts).toContain('Wireless Bluetooth Earbuds');
    expect(firstRenderTexts).not.toContain('Loading Products...');
  });

  it('4. Repeatedly visiting Products reuses cache without multiple full-screen loading flashes', async () => {
    const client = createTestQueryClient();

    // Visit 1
    let r1: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      r1 = renderWithClient(<ProductsScreen />, client);
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      r1.unmount();
    });

    // Visit 2
    let r2: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      r2 = renderWithClient(<ProductsScreen />, client);
    });
    expect(extractAllStrings(r2!.root)).not.toContain('Loading Products...');
    expect(extractAllStrings(r2!.root)).toContain('Wireless Bluetooth Earbuds');
    act(() => {
      r2.unmount();
    });

    // Visit 3
    let r3: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      r3 = renderWithClient(<ProductsScreen />, client);
    });
    expect(extractAllStrings(r3!.root)).not.toContain('Loading Products...');
    expect(extractAllStrings(r3!.root)).toContain('Mechanical Gaming Keyboard');
  });

  it('5. Pull down to refresh preserves existing products and updates content cleanly', async () => {
    const client = createTestQueryClient();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = renderWithClient(<ProductsScreen />, client);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const flatLists = renderer!.root.findAllByType(FlatList);
    const productFlatList = flatLists.find((f) => f.props.numColumns === 2)!;
    expect(productFlatList).toBeDefined();

    const refreshControl = productFlatList.props.refreshControl;
    expect(refreshControl).toBeDefined();

    // Refresh returns updated list with a 4th product
    const updatedProducts: Product[] = [
      ...mockProductsList,
      {
        id: 104,
        name: 'Smart Fitness Band',
        price: 1499,
        discount: 25,
        stock: 50,
        category: 'Electronics',
        image: '/images/band.jpg',
        featured: false,
        createdAt: '2026-01-04',
      },
    ];

    jest.spyOn(api, 'getProducts').mockResolvedValueOnce({
      products: updatedProducts,
      total: 4,
      page: 1,
      limit: 8,
      totalPages: 1,
      hasMore: false,
      categories: ['Electronics', 'Footwear', 'Clothing'],
    });

    await act(async () => {
      refreshControl.props.onRefresh();
      await Promise.resolve();
    });

    const refreshedTexts = extractAllStrings(renderer!.root);
    expect(refreshedTexts).toContain('Smart Fitness Band');
    expect(refreshedTexts).toContain('Wireless Bluetooth Earbuds');
  });

  it('6. Failed initial request with no cached data shows error screen with retry button', async () => {
    jest.spyOn(api, 'getProducts').mockRejectedValue(new Error('Backend server unreachable'));
    const client = createTestQueryClient();

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderWithClient(<ProductsScreen />, client);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const texts = extractAllStrings(renderer!.root);
    expect(texts).toContain('Unable to load products');
    expect(texts).toContain('Retry');
  });

  it('7. Background refresh error preserves existing loaded products without blanking page', async () => {
    const client = createTestQueryClient();

    // Pre-populate query cache
    client.setQueryData(queryKeys.products('all', '', 'default', 1), {
      products: mockProductsList,
      total: 3,
      hasMore: false,
      page: 1,
    });

    // Background fetch fails
    jest.spyOn(api, 'getProducts').mockRejectedValue(new Error('Network timeout'));

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderWithClient(<ProductsScreen />, client);
    });

    // Existing products remain visible
    const texts = extractAllStrings(renderer!.root);
    expect(texts).toContain('Wireless Bluetooth Earbuds');
    expect(texts).not.toContain('Loading Products...');
  });

  it('8. Empty search results render empty state instead of infinite loader', async () => {
    jest.spyOn(api, 'getProducts').mockResolvedValue({
      products: [],
      total: 0,
      page: 1,
      limit: 8,
      totalPages: 0,
      hasMore: false,
      categories: ['Electronics'],
    });

    const client = createTestQueryClient();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = renderWithClient(<ProductsScreen initialSearch="NonexistentItem" />, client);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const texts = extractAllStrings(renderer!.root);
    expect(texts).toContain('No products found');
    expect(texts).toContain('Clear All Filters');
  });
});
