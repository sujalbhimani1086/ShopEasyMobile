import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../src/theme/theme';
import { ProductCard } from '../src/components/ProductCard';
import { ProductDetailsScreen, formatReviewCount } from '../src/screens/ProductDetailsScreen';
import type { Product } from '../src/types/product';
import * as apiModule from '../src/services/api';

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

describe('ShopEasy Mobile — Product Rating UI Fix', () => {
  const sampleRatedProduct: Product = {
    id: 101,
    name: 'Sony WH-1000XM5 Wireless Headphones',
    price: 29990,
    discount: 15,
    image: 'https://images.unsplash.com/headphones.jpg',
    stock: 20,
    category: 'Electronics',
    averageRating: 4.8,
    reviewCount: 1720,
  };

  const sampleSmallCountProduct: Product = {
    id: 102,
    name: 'Smart LED Desk Lamp with Wireless Charger',
    price: 1999,
    discount: 10,
    image: 'https://images.unsplash.com/lamp.jpg',
    stock: 12,
    category: 'Home & Living',
    averageRating: 5.0,
    reviewCount: 25,
  };

  const sampleRatingOnlyProduct: Product = {
    id: 103,
    name: 'Ceramic Coffee Mug Set of 2',
    price: 599,
    discount: 0,
    image: 'https://images.unsplash.com/mug.jpg',
    stock: 50,
    category: 'Kitchen',
    averageRating: 4.2,
    reviewCount: 0,
  };

  const sampleUnratedProduct: Product = {
    id: 104,
    name: 'Ergonomic Mousepad',
    price: 299,
    discount: 0,
    image: 'https://images.unsplash.com/mousepad.jpg',
    stock: 30,
    category: 'Accessories',
    averageRating: 0,
    reviewCount: 0,
  };

  describe('formatReviewCount helper', () => {
    it('formats thousands cleanly with K+ (e.g. 1700 -> 1.7K+)', () => {
      expect(formatReviewCount(1700)).toBe('1.7K+');
      expect(formatReviewCount(1000)).toBe('1K+');
      expect(formatReviewCount(2500)).toBe('2.5K+');
    });

    it('formats millions with M+', () => {
      expect(formatReviewCount(1000000)).toBe('1M+');
      expect(formatReviewCount(2500000)).toBe('2.5M+');
    });

    it('formats counts under 1000 as plain numbers (e.g. 25 -> 25)', () => {
      expect(formatReviewCount(25)).toBe('25');
      expect(formatReviewCount(1)).toBe('1');
      expect(formatReviewCount(999)).toBe('999');
    });

    it('returns empty string for 0, negative, or undefined counts', () => {
      expect(formatReviewCount(0)).toBe('');
      expect(formatReviewCount(undefined)).toBe('');
      expect(formatReviewCount(null)).toBe('');
      expect(formatReviewCount(-5)).toBe('');
    });
  });

  describe('1. Product Cards — Rating at Bottom-Left of Image', () => {
    it('displays rating badge inside product image container at bottom-left corner', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithTheme(<ProductCard product={sampleRatedProduct} />);
      });

      // Find the star icon inside the card
      const starIcon = renderer!.root.findAll((node) => node.props.name === 'star-filled');
      expect(starIcon.length).toBe(1);

      // Verify numerical rating "4.8" is rendered
      const allTexts = renderer!.root.findAllByType(Text).map((t) =>
        Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children)
      );
      expect(allTexts).toContain('4.8');

      // The card body does NOT contain a separate rating row
      const imageContainer = renderer!.root.find(
        (node) =>
          node.props.style &&
          Array.isArray(node.props.style) &&
          node.props.style.some((s: any) => s && s.overflow === 'hidden' && s.position === 'relative')
      );
      expect(imageContainer).toBeDefined();

      // Rating badge is inside imageContainer with position: absolute, bottom: 8, left: 8
      const ratingBadge = imageContainer.find(
        (node) =>
          node.props.style &&
          Array.isArray(node.props.style) &&
          node.props.style.some((s: any) => s && s.position === 'absolute' && s.bottom === 8 && s.left === 8)
      );
      expect(ratingBadge).toBeDefined();
    });

    it('does not display rating outside image or as a separate row below the product image', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithTheme(<ProductCard product={sampleRatedProduct} />);
      });

      // Find body content
      const bodyContent = renderer!.root.find(
        (node) =>
          node.props.style &&
          node.props.style.padding === 10 &&
          node.props.style.justifyContent === 'space-between'
      );

      // Body content starts directly with productTitle, no ratingArea in body
      const starInBody = bodyContent.findAll((node) => node.props.name === 'star-filled');
      expect(starInBody.length).toBe(0);
    });

    it('does not display rating badge for unrated products', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithTheme(<ProductCard product={sampleUnratedProduct} />);
      });

      const starIcon = renderer!.root.findAll((node) => node.props.name === 'star-filled');
      expect(starIcon.length).toBe(0);
    });
  });

  describe('2. Product Details Screen — Rating and Review Count on Image', () => {
    beforeEach(() => {
      jest.spyOn(apiModule, 'getProductById').mockImplementation(async (id: number | string) => {
        const numId = Number(id);
        if (numId === 101) return sampleRatedProduct;
        if (numId === 102) return sampleSmallCountProduct;
        if (numId === 103) return sampleRatingOnlyProduct;
        if (numId === 104) return sampleUnratedProduct;
        return null;
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('displays rating and formatted review count (e.g. ⭐ 4.8 | 1.7K+) inside main image container', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithTheme(
          <ProductDetailsScreen productId={101} onBack={jest.fn()} />
        );
      });

      const allTexts = renderer!.root.findAllByType(Text).map((t) =>
        Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children)
      );

      // Star icon exists
      const starIcon = renderer!.root.findAll((node) => node.props.name === 'star-filled');
      expect(starIcon.length).toBeGreaterThan(0);

      // Rating value 4.8, divider |, and formatted count 1.7K+ are displayed
      expect(allTexts).toContain('4.8');
      expect(allTexts).toContain('|');
      expect(allTexts).toContain('1.7K+');
    });

    it('displays rating and exact count for smaller counts (e.g. ⭐ 5.0 | 25)', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithTheme(
          <ProductDetailsScreen productId={102} onBack={jest.fn()} />
        );
      });

      const allTexts = renderer!.root.findAllByType(Text).map((t) =>
        Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children)
      );

      expect(allTexts).toContain('5.0');
      expect(allTexts).toContain('|');
      expect(allTexts).toContain('25');
    });

    it('displays only rating when no review count exists (e.g. ⭐ 4.2)', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithTheme(
          <ProductDetailsScreen productId={103} onBack={jest.fn()} />
        );
      });

      const allTexts = renderer!.root.findAllByType(Text).map((t) =>
        Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children)
      );

      expect(allTexts).toContain('4.2');
      // No divider or fabricated count
      expect(allTexts).not.toContain('|');
    });

    it('hides rating badge on image when product is unrated', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithTheme(
          <ProductDetailsScreen productId={104} onBack={jest.fn()} />
        );
      });

      const starIcons = renderer!.root.findAll((node) => node.props.name === 'star-filled');
      expect(starIcons.length).toBe(0);
    });

    it('rating badge is positioned at bottom-left (bottom: 14, left: 14) and does not overlap top-left discount badge', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithTheme(
          <ProductDetailsScreen productId={101} onBack={jest.fn()} />
        );
      });

      // Discount badge at top: 14, left: 14
      const discountBadge = renderer!.root.find(
        (node) =>
          node.props.style &&
          Array.isArray(node.props.style) &&
          node.props.style.some((s: any) => s && s.top === 14 && s.left === 14)
      );
      expect(discountBadge).toBeDefined();

      // Rating badge at bottom: 14, left: 14
      const ratingBadge = renderer!.root.find(
        (node) =>
          node.props.style &&
          Array.isArray(node.props.style) &&
          node.props.style.some((s: any) => s && s.bottom === 14 && s.left === 14)
      );
      expect(ratingBadge).toBeDefined();

      // No duplicate rating row in details box
      const allTexts = renderer!.root.findAllByType(Text).map((t) => String(t.props.children));
      expect(allTexts.some((t) => t.includes('reviews)'))).toBe(false);
      expect(allTexts.some((t) => t.includes('No reviews yet'))).toBe(false);
    });
  });
});
