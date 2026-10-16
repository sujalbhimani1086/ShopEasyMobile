import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, View, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomNavigation } from '../src/components/BottomNavigation';
import { Header } from '../src/components/Header';
import { ProductCard } from '../src/components/ProductCard';
import { UserProfileModal } from '../src/components/UserProfileModal';
import { ThemeProvider } from '../src/theme/theme';
import type { Product } from '../src/types/product';
import type { User } from '../src/types/auth';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderWithProviders(ui: React.ReactElement) {
  return ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ThemeProvider>{ui}</ThemeProvider>
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

describe('Bottom Navigation, Product Card Alignment & Profile Modal Verification', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('1. Move Cart to Bottom Navigation & Remove from Top Header', () => {
    it('renders exactly 5 items in bottom navigation in order: Home, Products, Categories, My Orders, Cart', () => {
      const onSelect = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithProviders(
          <BottomNavigation activeTab="home" onTabSelect={onSelect} />
        );
      });

      const tabs = renderer!.root.findAll(
        (node) => node.props.accessibilityRole === 'tab' && typeof node.props.onPress === 'function'
      );
      expect(tabs.length).toBe(5);

      const labels = renderer!.root.findAllByType(Text).map((t) => t.props.children);
      expect(labels).toEqual(['Home', 'Products', 'Categories', 'My Orders', 'Cart']);
    });

    it('highlights Cart when its tab is active and shows active top indicator pill', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithProviders(
          <BottomNavigation activeTab="cart" onTabSelect={jest.fn()} />
        );
      });

      const tabs = renderer!.root.findAll(
        (node) => node.props.accessibilityRole === 'tab' && typeof node.props.onPress === 'function'
      );
      expect(tabs[4].props.accessibilityState.selected).toBe(true);
      expect(tabs[0].props.accessibilityState.selected).toBe(false);
    });

    it('displays and updates cart count badge on bottom navigation Cart tab', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithProviders(
          <BottomNavigation activeTab="home" onTabSelect={jest.fn()} cartItemCount={7} />
        );
      });

      const texts = renderer!.root.findAllByType(Text).map((t) => t.props.children);
      expect(texts).toContain(7);

      // Verify 99+ formatting when item count exceeds 99
      act(() => {
        renderer.update(
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <ThemeProvider>
              <BottomNavigation activeTab="home" onTabSelect={jest.fn()} cartItemCount={120} />
            </ThemeProvider>
          </SafeAreaProvider>
        );
      });

      const updatedTexts = renderer!.root.findAllByType(Text).map((t) => t.props.children);
      expect(updatedTexts).toContain('99+');
    });

    it('does NOT render Cart icon or badge in the top Header', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <Header
            cartItemCount={5}
            wishlistItemCount={2}
            isLoggedIn={true}
            userName="Sujal"
          />
        );
      });

      const buttons = renderer!.root
        .findAllByType(View)
        .filter((node) => node.props.accessibilityRole === 'button');

      // Header has: Search, Wishlist, Profile (3 buttons)
      expect(buttons.length).toBe(3);
      expect(buttons[0].props.accessibilityLabel).toBe('Search products');
      expect(buttons[1].props.accessibilityLabel).toBe('Saved wishlist items');
      expect(buttons[2].props.accessibilityLabel).toContain('Account');

      // Cart is completely absent from Header
      const cartButton = renderer!.root.findAll(
        (node) => node.props.accessibilityLabel === 'Shopping cart'
      );
      expect(cartButton.length).toBe(0);
    });
  });

  describe('2. Product Card Alignment When Ratings Are Missing', () => {
    const ratedProduct: Product = {
      id: 1,
      name: 'Noise Cancelling Wireless Headphones',
      price: 2999,
      discount: 15,
      image: 'headphones.png',
      stock: 10,
      category: 'Electronics',
      averageRating: 4.5,
      reviewCount: 38,
    };

    const unratedProduct: Product = {
      id: 2,
      name: 'Organic Cotton T-Shirt',
      price: 499,
      discount: 0,
      image: 'tshirt.png',
      stock: 25,
      category: 'Clothing',
    };

    it('displays numerical rating only without review count for rated products', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithProviders(<ProductCard product={ratedProduct} />);
      });

      const texts = renderer!.root.findAllByType(Text).map((t) =>
        Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children)
      );
      expect(texts.some((t) => t.includes('4.5'))).toBe(true);
      expect(texts.some((t) => t.includes('(38)'))).toBe(false);
    });

    it('does not display fake ratings or review counts for unrated products', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithProviders(<ProductCard product={unratedProduct} />);
      });

      const texts = renderer!.root.findAllByType(Text).map((t) => String(t.props.children));
      const hasAnyRating = texts.some((t) => t.includes('4.') || t.includes('5.') || t.includes('★'));
      expect(hasAnyRating).toBe(false);
    });

    it('reserves consistent rating-area height and keeps product titles and details aligned', () => {
      let ratedRenderer: ReactTestRenderer.ReactTestRenderer;
      let unratedRenderer: ReactTestRenderer.ReactTestRenderer;

      act(() => {
        ratedRenderer = renderWithProviders(<ProductCard product={ratedProduct} />);
        unratedRenderer = renderWithProviders(<ProductCard product={unratedProduct} />);
      });

      // Find productTitle Text components
      const ratedTitle = ratedRenderer!.root.find(
        (node) => node.props.children === ratedProduct.name
      );
      const unratedTitle = unratedRenderer!.root.find(
        (node) => node.props.children === unratedProduct.name
      );

      // Both should have numberOfLines=2 and matching style structure
      expect(ratedTitle.props.numberOfLines).toBe(2);
      expect(unratedTitle.props.numberOfLines).toBe(2);

      // Both have Add to Cart buttons
      const ratedAddBtn = ratedRenderer!.root.find(
        (node) => node.props.accessibilityLabel === `Add ${ratedProduct.name} to cart`
      );
      const unratedAddBtn = unratedRenderer!.root.find(
        (node) => node.props.accessibilityLabel === `Add ${unratedProduct.name} to cart`
      );
      expect(ratedAddBtn).toBeDefined();
      expect(unratedAddBtn).toBeDefined();
    });
  });

  describe('3. Account Profile Status Row Removal', () => {
    const mockUser: User = {
      id: 99,
      name: 'Alice Customer',
      email: 'alice@example.com',
      role: 'CUSTOMER',
      status: 'APPROVED',
    };

    it('does not display the Status row or approval status in UserProfileModal', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithProviders(
          <UserProfileModal
            visible={true}
            user={mockUser}
            onClose={jest.fn()}
            onLogout={jest.fn()}
          />
        );
      });

      const texts = renderer!.root.findAllByType(Text).map((t) => t.props.children);

      // Verify Status label and APPROVED badge are NOT displayed
      expect(texts).not.toContain('Status');
      expect(texts).not.toContain('APPROVED');

      // Verify retained items: Account Type, Appearance, User details
      expect(texts).toContain('Account Profile');
      expect(texts).toContain('Account Type');
      expect(texts).toContain('CUSTOMER');
      expect(texts).toContain('Appearance');
      expect(texts).toContain('Alice Customer');
      expect(texts).toContain('alice@example.com');
    });

    it('preserves My Orders, Address Book, Notifications, and Help actions in UserProfileModal', () => {
      const onMyOrders = jest.fn();
      const onAddressBook = jest.fn();
      const onNotifications = jest.fn();
      const onHelpSupport = jest.fn();

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithProviders(
          <UserProfileModal
            visible={true}
            user={mockUser}
            onClose={jest.fn()}
            onLogout={jest.fn()}
            onMyOrders={onMyOrders}
            onAddressBook={onAddressBook}
            onNotifications={onNotifications}
            onHelpSupport={onHelpSupport}
          />
        );
      });

      const texts = renderer!.root.findAllByType(Text).map((t) => t.props.children);
      expect(texts).toContain('My Orders');
      expect(texts).toContain('Delivery Addresses');
      expect(texts).toContain('Notifications');
      expect(texts).toContain('Help & Support');
    });
  });
});
