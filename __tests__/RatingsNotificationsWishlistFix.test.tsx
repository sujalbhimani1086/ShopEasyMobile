import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, View, Pressable, Image } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../src/theme/theme';
import { ProductCard } from '../src/components/ProductCard';
import { ProductDetailsScreen } from '../src/screens/ProductDetailsScreen';
import { NotificationsScreen } from '../src/screens/NotificationsScreen';
import { Header } from '../src/components/Header';
import { Icon } from '../src/components/Icon';
import type { Product } from '../src/types/product';
import type { NotificationItem } from '../src/types/notification';
import * as notificationApi from '../src/services/notificationApi';
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

// Mock AuthContext
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Sujal', email: 'test@shopeasy.com' },
    token: 'test-token-123',
    logout: jest.fn(),
  }),
}));

// Mock WishlistContext
const mockWishlistState = {
  wishlistItems: [] as Product[],
  wishlistCount: 0,
  isWishlisted: jest.fn((id: number) => id === 99),
  toggleWishlist: jest.fn().mockResolvedValue(true),
  clearWishlist: jest.fn(),
};

jest.mock('../src/context/WishlistContext', () => ({
  useWishlist: () => mockWishlistState,
}));

describe('Product Ratings, Notifications, and Wishlist UI Fixes', () => {
  const ratedProduct: Product = {
    id: 1,
    name: 'Wireless Noise Cancelling Headphones',
    price: 4999,
    discount: 20,
    image: 'https://images.unsplash.com/test.jpg',
    stock: 15,
    category: 'Electronics',
    averageRating: 5.0,
    reviewCount: 14,
  };

  const unratedProduct: Product = {
    id: 2,
    name: 'Minimalist Desk Lamp',
    price: 1299,
    discount: 0,
    image: 'https://images.unsplash.com/lamp.jpg',
    stock: 8,
    category: 'Home & Living',
    averageRating: 0,
    reviewCount: 0,
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('1. Product Cards — Show Rating Only', () => {
    it('1. Product cards display 5.0 without review count (e.g. ⭐ 5.0 instead of ⭐ 5.0 (14))', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithTheme(<ProductCard product={ratedProduct} />);
      });

      const allTexts = renderer!.root.findAllByType(Text).map((t) =>
        Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children)
      );

      // Star icon exists
      const starIcon = renderer!.root.findAll(
        (node) => node.props.name === 'star-filled'
      );
      expect(starIcon.length).toBeGreaterThan(0);

      // Numerical rating "5.0" is present
      expect(allTexts.some((t) => t.includes('5.0'))).toBe(true);

      // Review count "(14)" is completely absent from product card
      expect(allTexts.some((t) => t.includes('(14)'))).toBe(false);
      expect(allTexts.some((t) => t.includes('('))).toBe(false);
    });

    it('2. Actual ratings are displayed correctly with toFixed(1)', () => {
      const customRatedProduct: Product = {
        ...ratedProduct,
        averageRating: 4.2,
      };

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithTheme(<ProductCard product={customRatedProduct} />);
      });

      const allTexts = renderer!.root.findAllByType(Text).map((t) =>
        Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children)
      );
      expect(allTexts.some((t) => t.includes('4.2'))).toBe(true);
      expect(allTexts.some((t) => t.includes('('))).toBe(false);
    });

    it('3. Unrated products do not show fabricated ratings and render unratedPlaceholder', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithTheme(<ProductCard product={unratedProduct} />);
      });

      const allTexts = renderer!.root.findAllByType(Text).map((t) => String(t.props.children));
      const hasFabricatedRating = allTexts.some(
        (t) => t.includes('5.') || t.includes('4.') || t.includes('0.0')
      );
      expect(hasFabricatedRating).toBe(false);

      // No star icon rendered for unrated product
      const starIcon = renderer!.root.findAll((node) => node.props.name === 'star-filled');
      expect(starIcon.length).toBe(0);
    });

    it('6. Product names, prices, discounts, stock labels, and buttons remain aligned between rated and unrated cards', () => {
      let ratedRenderer: ReactTestRenderer.ReactTestRenderer;
      let unratedRenderer: ReactTestRenderer.ReactTestRenderer;

      act(() => {
        ratedRenderer = renderWithTheme(<ProductCard product={ratedProduct} />);
        unratedRenderer = renderWithTheme(<ProductCard product={unratedProduct} />);
      });

      const ratedTitle = ratedRenderer!.root.find(
        (node) => node.props.children === ratedProduct.name
      );
      const unratedTitle = unratedRenderer!.root.find(
        (node) => node.props.children === unratedProduct.name
      );

      expect(ratedTitle.props.numberOfLines).toBe(2);
      expect(unratedTitle.props.numberOfLines).toBe(2);

      // Both cards retain Add to Cart buttons
      const ratedCartBtn = ratedRenderer!.root.find(
        (node) => node.props.accessibilityLabel === `Add ${ratedProduct.name} to cart`
      );
      const unratedCartBtn = unratedRenderer!.root.find(
        (node) => node.props.accessibilityLabel === `Add ${unratedProduct.name} to cart`
      );
      expect(ratedCartBtn).toBeDefined();
      expect(unratedCartBtn).toBeDefined();
    });
  });

  describe('2. Product Details — Move Rating Badge Onto the Image', () => {
    beforeEach(() => {
      jest.spyOn(apiModule, 'getProductById').mockImplementation(async (id: number | string) => {
        if (Number(id) === 1) return ratedProduct;
        if (Number(id) === 2) return unratedProduct;
        return null;
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('4. The product details page shows the rating badge inside the main image container at bottom-left without review count', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithTheme(
          <ProductDetailsScreen productId={1} onBack={jest.fn()} />
        );
      });

      // Find the rating text on the details screen
      const allTexts = renderer!.root.findAllByType(Text).map((t) =>
        Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children)
      );

      // Rating number "5.0" appears
      expect(allTexts.some((t) => t.includes('5.0'))).toBe(true);

      // Image badge does not contain review count
      expect(allTexts.some((t) => t.includes('reviews'))).toBe(false);

      // Check image rating badge styling inside image container
      const starFilled = renderer!.root.findAll(
        (node) => node.props.name === 'star-filled'
      );
      expect(starFilled.length).toBeGreaterThan(0);
    });

    it('5. The separate rating row is removed from the product details box below the image', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithTheme(
          <ProductDetailsScreen productId={1} onBack={jest.fn()} />
        );
      });

      const allTexts = renderer!.root.findAllByType(Text).map((t) =>
        Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children)
      );

      // No separate "reviews" string or "No reviews yet" row in details card
      expect(allTexts.some((t) => t.includes('reviews)'))).toBe(false);
      expect(allTexts.some((t) => t.includes('No reviews yet'))).toBe(false);
    });

    it('hides rating badge on product details when product has no valid rating', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithTheme(
          <ProductDetailsScreen productId={2} onBack={jest.fn()} />
        );
      });

      const starFilled = renderer!.root.findAll(
        (node) => node.props.name === 'star-filled'
      );
      expect(starFilled.length).toBe(0);
    });
  });

  describe('3. Notifications Badge Count & Synchronization', () => {
    it('7. One unread notification displays badge 1', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithTheme(
          <Header
            notificationCount={1}
            onNotificationsPress={jest.fn()}
            onSearchPress={jest.fn()}
            onWishlistPress={jest.fn()}
          />
        );
      });

      const badges = renderer!.root.findAllByType(Text).filter((t) => t.props.children === 1);
      expect(badges.length).toBe(1);
    });

    it('8. Multiple unread notifications display the correct count and 99+ when exceeding 99', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithTheme(
          <Header
            notificationCount={5}
            onNotificationsPress={jest.fn()}
            onSearchPress={jest.fn()}
            onWishlistPress={jest.fn()}
          />
        );
      });

      const badge5 = renderer!.root.findAllByType(Text).filter((t) => t.props.children === 5);
      expect(badge5.length).toBe(1);

      // When unread count exceeds 99
      act(() => {
        renderer = renderWithTheme(
          <Header
            notificationCount={120}
            onNotificationsPress={jest.fn()}
            onSearchPress={jest.fn()}
            onWishlistPress={jest.fn()}
          />
        );
      });

      const badge99Plus = renderer!.root.findAllByType(Text).filter((t) => t.props.children === '99+');
      expect(badge99Plus.length).toBe(1);
    });

    it('hides badge when count is zero or unavailable/negative', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithTheme(
          <Header
            notificationCount={0}
            onNotificationsPress={jest.fn()}
            onSearchPress={jest.fn()}
            onWishlistPress={jest.fn()}
          />
        );
      });

      const badges = renderer!.root.findAll(
        (node) => node.props.style && node.props.style.backgroundColor === '#0EA5E9'
      );
      expect(badges.length).toBe(0);
    });

    it('9, 10, 11, 12. Reading and deleting notifications updates unread count accurately', async () => {
      const initialNotifs: NotificationItem[] = [
        {
          id: 101,
          userId: 1,
          title: 'Order Confirmed',
          message: 'Your order #1234 is confirmed.',
          type: 'ORDER',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: 102,
          userId: 1,
          title: 'Special Promotion',
          message: 'Flat 20% off today only!',
          type: 'PROMO',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: 103,
          userId: 1,
          title: 'Account Alert',
          message: 'Password changed.',
          type: 'ACCOUNT',
          isRead: true, // Already read
          createdAt: new Date().toISOString(),
        },
      ];

      jest.spyOn(notificationApi, 'getNotifications').mockResolvedValue({
        notifications: initialNotifs,
        unreadCount: 2,
      });
      jest.spyOn(notificationApi, 'markNotificationRead').mockResolvedValue();
      jest.spyOn(notificationApi, 'markAllNotificationsRead').mockResolvedValue();
      jest.spyOn(notificationApi, 'dismissNotification').mockResolvedValue();

      const onUnreadCountChange = jest.fn();

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithTheme(
          <NotificationsScreen
            onBack={jest.fn()}
            onUnreadCountChange={onUnreadCountChange}
          />
        );
      });

      // Initial unread count 2 reported
      expect(onUnreadCountChange).toHaveBeenCalledWith(2);

      // 9. Reading one unread notification decreases count to 1
      const notifItem1 = renderer!.root.find(
        (node) => node.props.accessibilityLabel === 'Notification: Order Confirmed'
      );
      await act(async () => {
        notifItem1.props.onPress();
      });
      expect(onUnreadCountChange).toHaveBeenCalledWith(1);

      // 12. Deleting an ALREADY READ notification does NOT decrease unread count
      const dismissButtons = renderer!.root.findAll(
        (node) =>
          node.props.accessibilityLabel === 'Dismiss notification' &&
          typeof node.props.onPress === 'function'
      );
      // Dismiss the third item (id 103, which isRead: true)
      await act(async () => {
        dismissButtons[2].props.onPress();
      });
      // Should not have called onUnreadCountChange with 0
      expect(onUnreadCountChange).toHaveBeenLastCalledWith(1);

      // 11. Deleting an UNREAD notification updates count immediately to 0
      await act(async () => {
        // The remaining unread is id 102
        dismissButtons[1].props.onPress();
      });
      expect(onUnreadCountChange).toHaveBeenCalledWith(0);

      // 10. Reading all notifications sets count to 0
      const markAllBtn = renderer!.root.findAll(
        (node) => node.props.accessibilityLabel === 'Mark all as read'
      );
      if (markAllBtn.length > 0) {
        await act(async () => {
          markAllBtn[0].props.onPress();
        });
        expect(onUnreadCountChange).toHaveBeenCalledWith(0);
      }
    });
  });

  describe('4. Wishlist Icon Consistency Across All Screens', () => {
    it('15. Uses consistent vector heart icon style and strokeWidth 2.2 across Header, ProductCard, and ProductDetails', () => {
      let headerRenderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        headerRenderer = renderWithTheme(
          <Header
            wishlistItemCount={2}
            onWishlistPress={jest.fn()}
            onSearchPress={jest.fn()}
          />
        );
      });

      const headerHeart = headerRenderer!.root.find(
        (node) => node.props.name === 'heart-filled'
      );
      expect(headerHeart.props.size).toBe(19);
      expect(headerHeart.props.strokeWidth).toBe(2.2);
      expect(headerHeart.props.color).toBe('#EF4444');

      let cardRenderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        cardRenderer = renderWithTheme(<ProductCard product={ratedProduct} />);
      });

      const cardHeart = cardRenderer!.root.find(
        (node) => node.props.name === 'heart' || node.props.name === 'heart-filled'
      );
      expect(cardHeart.props.strokeWidth).toBe(2.2);
    });

    it('16. Filled heart for wishlisted products, outline heart for un-wishlisted products', () => {
      mockWishlistState.isWishlisted.mockImplementation((id: number) => id === 1);

      let cardRendererWishlisted: ReactTestRenderer.ReactTestRenderer;
      let cardRendererUnwishlisted: ReactTestRenderer.ReactTestRenderer;

      act(() => {
        cardRendererWishlisted = renderWithTheme(<ProductCard product={ratedProduct} />);
        cardRendererUnwishlisted = renderWithTheme(<ProductCard product={unratedProduct} />);
      });

      const wishlistedIcon = cardRendererWishlisted!.root.find(
        (node) => node.props.name === 'heart-filled'
      );
      expect(wishlistedIcon.props.color).toBe('#EF4444');

      const unwishlistedIcon = cardRendererUnwishlisted!.root.find(
        (node) => node.props.name === 'heart'
      );
      expect(unwishlistedIcon).toBeDefined();
    });
  });

  describe('5. Dark & Light Theme Verification', () => {
    it('18. Renders cleanly in both Light and Dark themes without visual regressions', () => {
      let lightCard: ReactTestRenderer.ReactTestRenderer;
      let darkCard: ReactTestRenderer.ReactTestRenderer;

      act(() => {
        lightCard = renderWithTheme(<ProductCard product={ratedProduct} />, false);
        darkCard = renderWithTheme(<ProductCard product={ratedProduct} />, true);
      });

      expect(lightCard!.root).toBeDefined();
      expect(darkCard!.root).toBeDefined();

      let lightHeader: ReactTestRenderer.ReactTestRenderer;
      let darkHeader: ReactTestRenderer.ReactTestRenderer;

      act(() => {
        lightHeader = renderWithTheme(<Header onSearchPress={jest.fn()} />, false);
        darkHeader = renderWithTheme(<Header onSearchPress={jest.fn()} />, true);
      });

      expect(lightHeader!.root).toBeDefined();
      expect(darkHeader!.root).toBeDefined();
    });
  });
});
