import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, View, Image } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomNavigation } from '../src/components/BottomNavigation';
import { Header } from '../src/components/Header';
import { PromoBanner } from '../src/components/PromoBanner';
import { resolveBannerDestination } from '../src/utils/bannerUtils';
import { selectFeaturedProducts } from '../src/screens/HomeScreen';
import { WishlistProvider, useWishlist } from '../src/context/WishlistContext';
import { AuthProvider } from '../src/context/AuthContext';
import { ProductDetailsScreen } from '../src/screens/ProductDetailsScreen';
import * as api from '../src/services/api';
import type { Product } from '../src/types/product';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../src/config/queryClient';
import { queryKeys } from '../src/config/queryKeys';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderWithProviders(ui: React.ReactElement) {
  return ReactTestRenderer.create(
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={initialMetrics}>{ui}</SafeAreaProvider>
    </QueryClientProvider>
  );
}

function createMockProduct(id: number, name: string, category: string): Product {
  return {
    id,
    name,
    category,
    price: 1000,
    discount: 10,
    image: `img_${id}.png`,
    stock: 15,
  };
}

describe('Bottom Navigation & Header Features', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('BottomNavigation component', () => {
    it('renders all 5 tabs: Home, Products, Categories, My Orders, and Cart', () => {
      const onSelect = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithProviders(
          <BottomNavigation activeTab="home" onTabSelect={onSelect} cartItemCount={5} />
        );
      });

      const root = renderer!.root;
      const texts = root.findAllByType(Text).map((t) => t.props.children);

      expect(texts).toContain('Home');
      expect(texts).toContain('Products');
      expect(texts).toContain('Categories');
      expect(texts).toContain('My Orders');
      expect(texts).toContain('Cart');
      expect(texts).toContain(5);
    });

    it('triggers onTabSelect with the correct tab key when pressed', () => {
      const onSelect = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithProviders(
          <BottomNavigation activeTab="home" onTabSelect={onSelect} />
        );
      });

      const pressables = renderer!.root.findAll(
        (node) =>
          node.props.accessibilityRole === 'tab' &&
          typeof node.props.onPress === 'function'
      );

      // Press Products tab
      act(() => {
        pressables[1].props.onPress();
      });
      expect(onSelect).toHaveBeenCalledWith('products');

      // Press Categories tab
      act(() => {
        pressables[2].props.onPress();
      });
      expect(onSelect).toHaveBeenCalledWith('categories');

      // Press My Orders tab
      act(() => {
        pressables[3].props.onPress();
      });
      expect(onSelect).toHaveBeenCalledWith('orders');

      // Press Cart tab
      act(() => {
        pressables[4].props.onPress();
      });
      expect(onSelect).toHaveBeenCalledWith('cart');
    });
  });

  describe('Header icon order', () => {
    it('renders action buttons in exact order: Search -> Wishlist -> Profile (Cart moved to bottom nav)', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <Header
            wishlistItemCount={2}
            isLoggedIn={true}
            userName="John"
          />
        );
      });

      const buttons = renderer!.root
        .findAllByType(View)
        .filter((node) => node.props.accessibilityRole === 'button');

      expect(buttons.length).toBe(3);
      expect(buttons[0].props.accessibilityLabel).toBe('Search products');
      expect(buttons[1].props.accessibilityLabel).toBe('Saved wishlist items');
      expect(buttons[2].props.accessibilityLabel).toContain('Account');
    });

    it('renders permanent pure black background and exact website white logo', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <Header
            wishlistItemCount={0}
            isLoggedIn={false}
          />
        );
      });

      // Verifies exact website white logo Image is rendered
      const logoImage = renderer!.root.findByType(Image);
      expect(logoImage).toBeDefined();
      expect(logoImage.props.accessibilityLabel).toBe('ShopEasy');
      expect(logoImage.props.resizeMode).toBe('contain');

      // Verifies pure black #000000 header background
      const blackViews = renderer!.root.findAll((node) => {
        const style = node.props.style;
        if (!style) return false;
        if (style.backgroundColor === '#000000') return true;
        if (Array.isArray(style)) {
          return style.some((s: any) => s && s.backgroundColor === '#000000');
        }
        return false;
      });
      expect(blackViews.length).toBeGreaterThan(0);
    });

    it('triggers search, wishlist, and account callbacks when pressed', () => {
      const onSearch = jest.fn();
      const onWishlist = jest.fn();
      const onAccount = jest.fn();

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <Header
            onSearchPress={onSearch}
            onWishlistPress={onWishlist}
            onAccountPress={onAccount}
            isLoggedIn={true}
            userName="John"
          />
        );
      });

      const searchBtn = renderer!.root.find(
        (node) => node.props.accessibilityLabel === 'Search products' && typeof node.props.onPress === 'function'
      );
      const wishlistBtn = renderer!.root.find(
        (node) => node.props.accessibilityLabel === 'Saved wishlist items' && typeof node.props.onPress === 'function'
      );
      const accountBtn = renderer!.root.find(
        (node) => node.props.accessibilityLabel?.includes('Account') && typeof node.props.onPress === 'function'
      );

      act(() => {
        searchBtn.props.onPress();
      });
      expect(onSearch).toHaveBeenCalledTimes(1);

      act(() => {
        wishlistBtn.props.onPress();
      });
      expect(onWishlist).toHaveBeenCalledTimes(1);

      act(() => {
        accountBtn.props.onPress();
      });
      expect(onAccount).toHaveBeenCalledTimes(1);
    });
  });

  describe('Featured Products selection algorithm', () => {
    it('selects exactly 6 products preferring one per category until all categories are represented', () => {
      const mockProducts: Product[] = [
        createMockProduct(1, 'Laptop', 'Electronics'),
        createMockProduct(2, 'Phone', 'Electronics'),
        createMockProduct(3, 'T-Shirt', 'Clothing'),
        createMockProduct(4, 'Jeans', 'Clothing'),
        createMockProduct(5, 'Sneakers', 'Footwear'),
        createMockProduct(6, 'Boots', 'Footwear'),
        createMockProduct(7, 'Backpack', 'Bags'),
        createMockProduct(8, 'Watch', 'Accessories'),
        createMockProduct(9, 'Lipstick', 'Beauty'),
        createMockProduct(10, 'Novel', 'Books'),
      ];

      const featured = selectFeaturedProducts(mockProducts, 6);

      expect(featured.length).toBe(6);

      // Verify all 6 products have distinct categories
      const categories = featured.map((p) => p.category);
      const uniqueCategories = new Set(categories);
      expect(uniqueCategories.size).toBe(6);

      // Verify no duplicates
      const ids = featured.map((p) => p.id);
      expect(new Set(ids).size).toBe(6);
    });

    it('fills remaining slots with different products when there are fewer than 6 categories', () => {
      const mockProducts: Product[] = [
        createMockProduct(1, 'Laptop', 'Electronics'),
        createMockProduct(2, 'Phone', 'Electronics'),
        createMockProduct(3, 'Tablet', 'Electronics'),
        createMockProduct(4, 'T-Shirt', 'Clothing'),
        createMockProduct(5, 'Jeans', 'Clothing'),
        createMockProduct(6, 'Jacket', 'Clothing'),
        createMockProduct(7, 'Sneakers', 'Footwear'),
        createMockProduct(8, 'Boots', 'Footwear'),
      ];

      const featured = selectFeaturedProducts(mockProducts, 6);

      expect(featured.length).toBe(6);

      // Verify all 3 categories are represented
      const categories = featured.map((p) => p.category);
      expect(categories).toContain('Electronics');
      expect(categories).toContain('Clothing');
      expect(categories).toContain('Footwear');

      // Verify zero duplicates
      const ids = featured.map((p) => p.id);
      expect(new Set(ids).size).toBe(6);
    });

    it('never creates duplicate products', () => {
      const mockProducts: Product[] = [
        createMockProduct(1, 'Item 1', 'Cat A'),
        createMockProduct(2, 'Item 2', 'Cat A'),
        createMockProduct(3, 'Item 3', 'Cat B'),
      ];

      const featured = selectFeaturedProducts(mockProducts, 6);
      expect(featured.length).toBe(3);
      expect(new Set(featured.map((p) => p.id)).size).toBe(3);
    });
  });

  describe('WishlistContext', () => {
    let wishlistRef: ReturnType<typeof useWishlist> | null = null;

    function TestWishlistConsumer() {
      wishlistRef = useWishlist();
      return null;
    }

    it('adds and removes products from wishlist and updates state immediately', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <AuthProvider>
            <WishlistProvider>
              <TestWishlistConsumer />
            </WishlistProvider>
          </AuthProvider>
        );
      });

      expect(wishlistRef?.wishlistCount).toBe(0);

      const p1 = createMockProduct(101, 'Galaxy Watch', 'Electronics');

      // Add to wishlist
      await act(async () => {
        await wishlistRef?.toggleWishlist(p1);
      });

      expect(wishlistRef?.wishlistCount).toBe(1);
      expect(wishlistRef?.isWishlisted(101)).toBe(true);

      // Toggle again to remove
      await act(async () => {
        await wishlistRef?.toggleWishlist(p1);
      });

      expect(wishlistRef?.wishlistCount).toBe(0);
      expect(wishlistRef?.isWishlisted(101)).toBe(false);
    });
  });

  describe('PromoBanner & Banner Navigation', () => {
    describe('resolveBannerDestination utility', () => {
      it('correctly resolves category banners to exact filtered category', () => {
        const categoryBanner: Product = {
          id: 66,
          name: 'Apple MacBook Air',
          category: 'Electronics',
          price: 99999,
          discount: 20,
          image: 'macbook.jpg',
          stock: 5,
          targetType: 'category',
        };

        const dest = resolveBannerDestination(categoryBanner);
        expect(dest).toEqual({ type: 'category', category: 'Electronics' });
      });

      it('correctly resolves product banners to Product Details screen', () => {
        const productBanner: Product = {
          id: 42,
          name: 'Sony WH-1000XM5',
          category: 'Electronics',
          price: 24999,
          discount: 15,
          image: 'sony.jpg',
          stock: 8,
          targetType: 'product',
        };

        const dest = resolveBannerDestination(productBanner);
        expect(dest).toEqual({ type: 'product', productId: 42 });
      });

      it('correctly resolves general promotion banners to products listing', () => {
        const promoBanner: Product = {
          id: 0,
          name: 'Discover Great Products',
          category: 'ShopEasy Deals',
          price: 0,
          discount: 50,
          image: '',
          stock: 10,
          targetType: 'promotion',
        };

        const dest = resolveBannerDestination(promoBanner);
        expect(dest).toEqual({ type: 'promotion' });
      });

      it('correctly infers category when targetType is not explicitly set but category is provided', () => {
        const bannerWithoutType = {
          id: 0,
          name: 'Fashion Fest',
          category: 'Fashion',
          price: 0,
          discount: 30,
          image: '',
          stock: 10,
        };

        const dest = resolveBannerDestination(bannerWithoutType);
        expect(dest).toEqual({ type: 'category', category: 'Fashion' });
      });

      it('correctly infers product when targetType is not explicitly set but valid id exists without category', () => {
        const bannerWithoutCategory = {
          id: 88,
          name: 'Noise Cancelling Earbuds',
          price: 2999,
          discount: 40,
          image: 'earbuds.jpg',
          stock: 15,
        };

        const dest = resolveBannerDestination(bannerWithoutCategory);
        expect(dest).toEqual({ type: 'product', productId: 88 });
      });

      it('gracefully returns null when banner has no valid destination', () => {
        expect(resolveBannerDestination(null)).toBeNull();
        expect(resolveBannerDestination(undefined)).toBeNull();
        expect(resolveBannerDestination({} as any)).toBeNull();
        expect(resolveBannerDestination({ id: -1, name: '', category: '' } as any)).toBeNull();
      });
    });

    describe('PromoBanner component interactions', () => {
      it('navigates to filtered category when category banner card is tapped', () => {
        const onNavigate = jest.fn();
        const onProduct = jest.fn();

        const banner: Product = {
          id: 5,
          name: 'Safari Backpack',
          category: 'Bags',
          price: 1800,
          discount: 50,
          image: 'bag.jpg',
          stock: 4,
          targetType: 'category',
        };

        let renderer: ReactTestRenderer.ReactTestRenderer;
        act(() => {
          renderer = renderWithProviders(
            <PromoBanner
              products={[banner]}
              onNavigateToProducts={onNavigate}
              onProductPress={onProduct}
            />
          );
        });

        // Find the banner card pressable
        const cardPressable = renderer!.root.find(
          (node) => node.props.testID === 'banner-card-5'
        );

        act(() => {
          cardPressable.props.onPress();
        });

        expect(onNavigate).toHaveBeenCalledWith('Bags');
        expect(onProduct).not.toHaveBeenCalled();
      });

      it('navigates to product details when product banner card is tapped', () => {
        const onNavigate = jest.fn();
        const onProduct = jest.fn();

        const banner: Product = {
          id: 99,
          name: 'Pro Smartphone',
          category: 'Mobiles',
          price: 49999,
          discount: 25,
          image: 'phone.jpg',
          stock: 6,
          targetType: 'product',
        };

        let renderer: ReactTestRenderer.ReactTestRenderer;
        act(() => {
          renderer = renderWithProviders(
            <PromoBanner
              products={[banner]}
              onNavigateToProducts={onNavigate}
              onProductPress={onProduct}
            />
          );
        });

        const cardPressable = renderer!.root.find(
          (node) => node.props.testID === 'banner-card-99'
        );

        act(() => {
          cardPressable.props.onPress();
        });

        expect(onProduct).toHaveBeenCalledWith(99);
        expect(onNavigate).not.toHaveBeenCalled();
      });

      it('navigates correctly when Shop Now button is tapped', () => {
        const onNavigate = jest.fn();
        const onProduct = jest.fn();

        const banner: Product = {
          id: 12,
          name: 'Running Shoes',
          category: 'Footwear',
          price: 3499,
          discount: 30,
          image: 'shoes.jpg',
          stock: 12,
          targetType: 'category',
        };

        let renderer: ReactTestRenderer.ReactTestRenderer;
        act(() => {
          renderer = renderWithProviders(
            <PromoBanner
              products={[banner]}
              onNavigateToProducts={onNavigate}
              onProductPress={onProduct}
            />
          );
        });

        const shopNowBtn = renderer!.root.find(
          (node) => node.props.testID === 'banner-shop-now-12'
        );

        act(() => {
          shopNowBtn.props.onPress();
        });

        expect(onNavigate).toHaveBeenCalledWith('Footwear');
      });

      it('navigates correctly when banner image is tapped', () => {
        const onProduct = jest.fn();

        const banner: Product = {
          id: 55,
          name: 'Mechanical Keyboard',
          category: 'Electronics',
          price: 4500,
          discount: 20,
          image: 'keyboard.jpg',
          stock: 10,
          targetType: 'product',
        };

        let renderer: ReactTestRenderer.ReactTestRenderer;
        act(() => {
          renderer = renderWithProviders(
            <PromoBanner
              products={[banner]}
              onProductPress={onProduct}
            />
          );
        });

        const imagePressable = renderer!.root.find(
          (node) => node.props.testID === 'banner-image-55'
        );

        act(() => {
          imagePressable.props.onPress();
        });

        expect(onProduct).toHaveBeenCalledWith(55);
      });

      it('navigates to category when deal tag is tapped', () => {
        const onCategory = jest.fn();

        const banner: Product = {
          id: 77,
          name: 'Wireless Mouse',
          category: 'Accessories',
          price: 1200,
          discount: 15,
          image: 'mouse.jpg',
          stock: 20,
          targetType: 'product',
        };

        let renderer: ReactTestRenderer.ReactTestRenderer;
        act(() => {
          renderer = renderWithProviders(
            <PromoBanner
              products={[banner]}
              onCategoryPress={onCategory}
            />
          );
        });

        const tagPressable = renderer!.root.find(
          (node) => node.props.testID === 'banner-tag-77'
        );

        act(() => {
          tagPressable.props.onPress();
        });

        expect(onCategory).toHaveBeenCalledWith('Accessories');
      });

      it('handles banners with no destination gracefully without throwing', () => {
        const onNavigate = jest.fn();
        const onProduct = jest.fn();

        const invalidBanner = {
          id: -1,
          name: '',
          category: '',
          price: 0,
          discount: 0,
          image: '',
          stock: 0,
        } as Product;

        let renderer: ReactTestRenderer.ReactTestRenderer;
        act(() => {
          renderer = renderWithProviders(
            <PromoBanner
              products={[invalidBanner]}
              onNavigateToProducts={onNavigate}
              onProductPress={onProduct}
            />
          );
        });

        const cardPressable = renderer!.root.find(
          (node) => node.props.testID === 'banner-card--1'
        );

        act(() => {
          cardPressable.props.onPress();
        });

        expect(onNavigate).not.toHaveBeenCalled();
        expect(onProduct).not.toHaveBeenCalled();
      });
    });

    describe('ProductDetailsScreen Header & Logo', () => {
      it('renders pure black header and official white logo on product details', async () => {
        const mockProduct = {
          id: 42,
          name: 'Noise Cancelling Headphones',
          description: 'Premium wireless headphones',
          price: 2999,
          discount: 15,
          stock: 10,
          category: 'Electronics',
          image: '/headphones.jpg',
        };
        jest.spyOn(api, 'getProductById').mockResolvedValue(mockProduct as any);
        queryClient.setQueryData(queryKeys.product(42), mockProduct);

        const onBack = jest.fn();
        const onCart = jest.fn();
        const onToggleWishlist = jest.fn();

        let renderer: ReactTestRenderer.ReactTestRenderer;
        await act(async () => {
          renderer = renderWithProviders(
            <ProductDetailsScreen
              productId={42}
              onBack={onBack}
              onCartPress={onCart}
              onToggleWishlist={onToggleWishlist}
              cartItemCount={5}
            />
          );
          await Promise.resolve();
          await Promise.resolve();
        });

        // 1. Verify official white logo Image is rendered
        const logoImages = renderer!.root.findAll((node) => {
          return (
            node.type === Image &&
            node.props.accessibilityLabel === 'ShopEasy' &&
            node.props.resizeMode === 'contain'
          );
        });
        expect(logoImages.length).toBeGreaterThan(0);

        // 2. Verify pure black background #000000 on header
        const blackViews = renderer!.root.findAll((node) => {
          const style = node.props.style;
          if (!style) return false;
          if (style.backgroundColor === '#000000') return true;
          if (Array.isArray(style)) {
            return style.some((s: any) => s && s.backgroundColor === '#000000');
          }
          return false;
        });
        expect(blackViews.length).toBeGreaterThan(0);

        // 3. Verify back button works
        const backBtn = renderer!.root.find(
          (node) => node.props.accessibilityLabel === 'Go back to products'
        );
        expect(backBtn).toBeDefined();
        act(() => {
          backBtn.props.onPress();
        });
        expect(onBack).toHaveBeenCalled();

        // 4. Verify cart button works and shows badge
        const cartBtn = renderer!.root.find(
          (node) => node.props.accessibilityLabel === 'Shopping cart'
        );
        expect(cartBtn).toBeDefined();
        act(() => {
          cartBtn.props.onPress();
        });
        expect(onCart).toHaveBeenCalled();

        // 5. Verify wishlist button works
        const wishlistBtn = renderer!.root.find(
          (node) =>
            node.props.accessibilityLabel === 'Add to wishlist' ||
            node.props.accessibilityLabel === 'Remove from wishlist'
        );
        expect(wishlistBtn).toBeDefined();
        act(() => {
          wishlistBtn.props.onPress();
        });
        expect(onToggleWishlist).toHaveBeenCalled();
        renderer!.unmount();
      });
    });
  });
});


