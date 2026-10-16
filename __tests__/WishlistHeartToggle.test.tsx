import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, LightTheme, DarkTheme } from '../src/theme/theme';
import { ProductCard } from '../src/components/ProductCard';
import { ProductDetailsScreen } from '../src/screens/ProductDetailsScreen';
import { Icon } from '../src/components/Icon';
import type { Product } from '../src/types/product';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderWithTheme(ui: React.ReactElement, isDark = false) {
  return ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ThemeProvider initialMode={isDark ? 'dark' : 'light'}>
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// Mock AuthContext
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Sujal', email: 'test@shopeasy.com' },
    token: 'test-token-123',
    isLoading: false,
    logout: jest.fn(),
  }),
}));

// Mock FeedbackContext
jest.mock('../src/context/FeedbackContext', () => ({
  useFeedback: () => ({
    toast: {
      success: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    },
    alert: jest.fn(),
  }),
}));

// Mock WishlistContext
const mockWishlistState = {
  wishlistItems: [] as Product[],
  wishlistCount: 0,
  isWishlisted: jest.fn((id: number) => false),
  toggleWishlist: jest.fn().mockImplementation(async (product: Product) => {
    return true;
  }),
  removeFromWishlist: jest.fn(),
  clearWishlist: jest.fn(),
  isLoading: false,
};

jest.mock('../src/context/WishlistContext', () => ({
  useWishlist: () => mockWishlistState,
}));

// Mock API
jest.mock('../src/services/api', () => ({
  getProductById: jest.fn().mockResolvedValue({
    id: 10,
    name: 'Silk Blend Shirt',
    price: 1999,
    discount: 10,
    image: 'https://images.unsplash.com/shirt.jpg',
    stock: 20,
    category: 'Fashion',
    averageRating: 4.5,
    reviewCount: 8,
  }),
  resolveImageUrl: (img: string) => img,
  FALLBACK_PRODUCT_IMAGE: 'https://images.unsplash.com/fallback.jpg',
}));

describe('Wishlist Heart Icon Toggle Behavior — Light and Dark Mode', () => {
  const sampleProduct: Product = {
    id: 10,
    name: 'Silk Blend Shirt',
    price: 1999,
    discount: 10,
    image: 'https://images.unsplash.com/shirt.jpg',
    stock: 20,
    category: 'Fashion',
    averageRating: 4.5,
    reviewCount: 8,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Icon SVG Component Attributes', () => {
    it('renders outlined heart with fill="none" and stroke={color} to prevent Android black fill', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <Icon name="heart" color="#FFFFFF" strokeWidth={2.2} />
        );
      });

      const paths = renderer!.root.findAll((node) => node.props.d && node.props.fill === 'none');
      expect(paths.length).toBe(1);
      expect(paths[0].props.fill).toBe('none');
      expect(paths[0].props.stroke).toBe('#FFFFFF');
      expect(paths[0].props.strokeWidth).toBe(2.2);
    });

    it('renders filled heart with fill="#EF4444" and stroke="#EF4444"', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <Icon name="heart-filled" color="#EF4444" strokeWidth={2.2} />
        );
      });

      const paths = renderer!.root.findAll((node) => node.props.d && node.props.fill === '#EF4444');
      expect(paths.length).toBe(1);
      expect(paths[0].props.fill).toBe('#EF4444');
      expect(paths[0].props.stroke).toBe('#EF4444');
    });
  });

  describe('2. ProductCard Wishlist Heart in Light Mode', () => {
    it('displays outlined heart in Light Mode theme color (#666666) when unselected', () => {
      mockWishlistState.isWishlisted.mockReturnValue(false);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithTheme(<ProductCard product={sampleProduct} />, false);
      });

      const heart = renderer!.root.find(
        (node) => node.props.name === 'heart'
      );
      expect(heart).toBeDefined();
      expect(heart.props.color).toBe(LightTheme.colors.textSecondary); // #666666
      expect(heart.props.color).not.toBe('#000000');
    });

    it('displays filled heart in #EF4444 when selected in Light Mode', () => {
      mockWishlistState.isWishlisted.mockReturnValue(true);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithTheme(<ProductCard product={sampleProduct} />, false);
      });

      const heart = renderer!.root.find(
        (node) => node.props.name === 'heart-filled'
      );
      expect(heart).toBeDefined();
      expect(heart.props.color).toBe('#EF4444');
    });

    it('immediately restores to Light Mode theme color (#666666) upon toggle removal', () => {
      // Step 1: added to wishlist
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithTheme(
          <ProductCard product={sampleProduct} isWishlisted={true} />,
          false
        );
      });

      let heart = renderer!.root.find(
        (node) => node.props.name === 'heart-filled'
      );
      expect(heart.props.color).toBe('#EF4444');

      // Step 2: remove from wishlist
      act(() => {
        renderer.update(
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ThemeProvider initialMode="light">
              <ProductCard product={sampleProduct} isWishlisted={false} />
            </ThemeProvider>
          </SafeAreaProvider>
        );
      });

      heart = renderer!.root.find(
        (node) => node.props.name === 'heart'
      );
      expect(heart).toBeDefined();
      expect(heart.props.color).toBe(LightTheme.colors.textSecondary);
      expect(heart.props.color).not.toBe('#000000');
    });
  });

  describe('3. ProductCard Wishlist Heart in Dark Mode', () => {
    it('displays outlined heart in pure white (#FFFFFF) when unselected in Dark Mode (never black)', () => {
      mockWishlistState.isWishlisted.mockReturnValue(false);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithTheme(<ProductCard product={sampleProduct} />, true);
      });

      const heart = renderer!.root.find(
        (node) => node.props.name === 'heart'
      );
      expect(heart).toBeDefined();
      expect(heart.props.color).toBe('#FFFFFF');
      expect(heart.props.color).not.toBe('#000000');
    });

    it('displays filled heart in #EF4444 when selected in Dark Mode', () => {
      mockWishlistState.isWishlisted.mockReturnValue(true);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithTheme(<ProductCard product={sampleProduct} />, true);
      });

      const heart = renderer!.root.find(
        (node) => node.props.name === 'heart-filled'
      );
      expect(heart).toBeDefined();
      expect(heart.props.color).toBe('#EF4444');
    });

    it('returns to pure white (#FFFFFF) when unselected in Dark Mode, never black', () => {
      // Step 1: added
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithTheme(
          <ProductCard product={sampleProduct} isWishlisted={true} />,
          true
        );
      });

      let heart = renderer!.root.find(
        (node) => node.props.name === 'heart-filled'
      );
      expect(heart.props.color).toBe('#EF4444');

      // Step 2: removed
      act(() => {
        renderer.update(
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ThemeProvider initialMode="dark">
              <ProductCard product={sampleProduct} isWishlisted={false} />
            </ThemeProvider>
          </SafeAreaProvider>
        );
      });

      heart = renderer!.root.find(
        (node) => node.props.name === 'heart'
      );
      expect(heart).toBeDefined();
      expect(heart.props.color).toBe('#FFFFFF');
      expect(heart.props.color).not.toBe('#000000');
    });
  });

  describe('4. ProductDetailsScreen Wishlist Heart', () => {
    it('derives heart state directly from WishlistContext on every render', async () => {
      mockWishlistState.isWishlisted.mockReturnValue(false);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithTheme(
          <ProductDetailsScreen
            productId={10}
            onBack={jest.fn()}
            onAddToCart={jest.fn()}
          />,
          false
        );
      });

      // Find the wishlist button
      const wishlistBtn = renderer!.root.find(
        (node) =>
          node.props.accessibilityRole === 'button' &&
          (node.props.accessibilityLabel === 'Add to wishlist' ||
            node.props.accessibilityLabel === 'Remove from wishlist')
      );
      expect(wishlistBtn).toBeDefined();

      const unselectedIcon = wishlistBtn.find(
        (node) => node.props.name === 'heart'
      );
      expect(unselectedIcon.props.color).toBe('#FFFFFF'); // High contrast on pure black header

      // Trigger toggle
      mockWishlistState.isWishlisted.mockReturnValue(true);
      await act(async () => {
        wishlistBtn.props.onPress();
      });

      expect(mockWishlistState.toggleWishlist).toHaveBeenCalled();
    });
  });
});
