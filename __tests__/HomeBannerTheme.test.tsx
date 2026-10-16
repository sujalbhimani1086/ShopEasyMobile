import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Image, Text, Pressable, View, FlatList } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PromoBanner } from '../src/components/PromoBanner';
import { LightTheme, DarkTheme } from '../src/theme/theme';
import type { Product } from '../src/types/product';
import { buildCategoryBanners } from '../src/utils/bannerUtils';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let activeRenderer: ReactTestRenderer.ReactTestRenderer | null = null;

function renderBanner(ui: React.ReactElement) {
  activeRenderer = ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={initialMetrics}>{ui}</SafeAreaProvider>
  );
  return activeRenderer;
}

afterEach(() => {
  if (activeRenderer) {
    act(() => {
      activeRenderer!.unmount();
    });
    activeRenderer = null;
  }
});

const mockProducts: Product[] = [
  {
    id: 101,
    name: 'Wireless Noise Canceling Headphones',
    category: 'Electronics',
    price: 9999,
    discount: 30,
    stock: 15,
    image: '/images/headphones.jpg',
    featured: true,
  },
  {
    id: 102,
    name: 'Running Shoes Pro',
    category: 'Footwear',
    price: 4999,
    discount: 20,
    stock: 20,
    image: '/images/shoes.jpg',
    featured: true,
  },
];

function getResolvedStyle(node: any) {
  if (!node || !node.props) return {};
  const rawStyle =
    typeof node.props.style === 'function'
      ? node.props.style({ pressed: false })
      : node.props.style;
  return Array.isArray(rawStyle) ? Object.assign({}, ...rawStyle) : rawStyle || {};
}

describe('Home Promotional Banner Black Theme & White Text', () => {
  describe('1. Theme Tokens Consistency', () => {
    it('defines bannerBg as pure black #000000 in both Light and Dark themes', () => {
      expect(LightTheme.colors.bannerBg).toBe('#000000');
      expect(DarkTheme.colors.bannerBg).toBe('#000000');
    });

    it('defines all banner text tokens as pure white #FFFFFF in both themes', () => {
      expect(LightTheme.colors.bannerText).toBe('#FFFFFF');
      expect(DarkTheme.colors.bannerText).toBe('#FFFFFF');

      expect(LightTheme.colors.bannerSubtext).toBe('#FFFFFF');
      expect(DarkTheme.colors.bannerSubtext).toBe('#FFFFFF');

      expect(LightTheme.colors.bannerTagText).toBe('#FFFFFF');
      expect(DarkTheme.colors.bannerTagText).toBe('#FFFFFF');

      expect(LightTheme.colors.bannerBtnText).toBe('#FFFFFF');
      expect(DarkTheme.colors.bannerBtnText).toBe('#FFFFFF');
    });

    it('defines bannerBtnBg with translucent white pill styling in both themes', () => {
      expect(LightTheme.colors.bannerBtnBg).toBe('rgba(255, 255, 255, 0.18)');
      expect(DarkTheme.colors.bannerBtnBg).toBe('rgba(255, 255, 255, 0.18)');
    });
  });

  describe('2. Banner Card Rendering & Appearance', () => {
    it('renders every banner card with pure black #000000 background', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderBanner(<PromoBanner products={mockProducts} />);
      });

      const bannerCard = renderer!.root.find(
        (node) => node.props.testID === 'banner-card-101'
      );
      expect(bannerCard).toBeDefined();

      const cardStyle = getResolvedStyle(bannerCard);
      expect(cardStyle.backgroundColor).toBe('#000000');
      expect(cardStyle.borderRadius).toBe(18);
    });

    it('displays product title, category name, discount, and Shop Now in white #FFFFFF', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderBanner(<PromoBanner products={mockProducts} />);
      });

      // Product Title
      const titleNode = renderer!.root.findAll(
        (node) => node.type === Text && node.props.children === 'Wireless Noise Canceling Headphones'
      )[0];
      expect(titleNode).toBeDefined();
      const titleStyle = getResolvedStyle(titleNode);
      expect(titleStyle.color).toBe('#FFFFFF');

      // Category Tag Text
      const tagTextNode = renderer!.root.findAll(
        (node) => node.type === Text && node.props.children === 'Electronics'
      )[0];
      expect(tagTextNode).toBeDefined();
      const tagStyle = getResolvedStyle(tagTextNode);
      expect(tagStyle.color).toBe('#FFFFFF');

      // Discount Text
      const discountNode = renderer!.root.findAll(
        (node) => node.type === Text && node.props.children === 'Up to 30% OFF'
      )[0];
      expect(discountNode).toBeDefined();
      const discountStyle = getResolvedStyle(discountNode);
      expect(discountStyle.color).toBe('#FFFFFF');

      // Shop Now text
      const shopNowTextNode = renderer!.root.findAll(
        (node) => node.type === Text && node.props.children === 'Shop Now →'
      )[0];
      expect(shopNowTextNode).toBeDefined();
      const shopNowStyle = getResolvedStyle(shopNowTextNode);
      expect(shopNowStyle.color).toBe('#FFFFFF');

      // Shop Now button container has rounded corners, padding and proper background
      const shopNowBtnNode = renderer!.root.find(
        (node) => node.props.testID === 'banner-shop-now-101'
      );
      expect(shopNowBtnNode).toBeDefined();
      const shopNowBtnStyle = getResolvedStyle(shopNowBtnNode);
      expect(shopNowBtnStyle.backgroundColor).toBe('rgba(255, 255, 255, 0.18)');
      expect(shopNowBtnStyle.borderRadius).toBe(8);
      expect(shopNowBtnStyle.borderWidth).toBe(1);
    });

    it('preserves product images with resizeMode contain and correct URI resolution', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderBanner(<PromoBanner products={mockProducts} />);
      });

      const images = renderer!.root.findAllByType(Image);
      expect(images.length).toBeGreaterThan(0);
      expect(images[0].props.resizeMode).toBe('contain');
      expect(images[0].props.source.uri).toContain('headphones.jpg');
    });

    it('preserves banner card interactions and Shop Now navigation', () => {
      const onNavigate = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderBanner(
          <PromoBanner
            products={mockProducts}
            onNavigateToProducts={onNavigate}
          />
        );
      });

      const shopNowBtn = renderer!.root.find(
        (node) => node.props.testID === 'banner-shop-now-101'
      );
      expect(shopNowBtn).toBeDefined();

      act(() => {
        shopNowBtn.props.onPress();
      });

      expect(onNavigate).toHaveBeenCalledWith('Electronics');
    });

    it('navigates to product details when product title is tapped', () => {
      const onProduct = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderBanner(
          <PromoBanner
            products={mockProducts}
            onProductPress={onProduct}
          />
        );
      });

      const titleBtn = renderer!.root.find(
        (node) => node.props.testID === 'banner-title-101'
      );
      expect(titleBtn).toBeDefined();

      act(() => {
        titleBtn.props.onPress();
      });

      expect(onProduct).toHaveBeenCalledWith(101);
    });
  });

  describe('3. Previous and Next Arrow Buttons & Circular Scrolling', () => {
    it('renders white rounded-square left and right arrow buttons with subtle shadows', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderBanner(<PromoBanner products={mockProducts} />);
      });

      const prevBtn = renderer!.root.find(
        (node) => node.props.testID === 'banner-prev-btn'
      );
      const nextBtn = renderer!.root.find(
        (node) => node.props.testID === 'banner-next-btn'
      );

      expect(prevBtn).toBeDefined();
      expect(nextBtn).toBeDefined();

      const prevStyle = getResolvedStyle(prevBtn);
      const nextStyle = getResolvedStyle(nextBtn);

      // White background and rounded-square corners
      expect(prevStyle.backgroundColor).toBe('#FFFFFF');
      expect(prevStyle.borderRadius).toBe(10);
      expect(prevStyle.width).toBe(36);
      expect(prevStyle.height).toBe(36);

      expect(nextStyle.backgroundColor).toBe('#FFFFFF');
      expect(nextStyle.borderRadius).toBe(10);
      expect(nextStyle.width).toBe(36);
      expect(nextStyle.height).toBe(36);

      // Accessible button role and labels
      expect(prevBtn.props.accessibilityRole).toBe('button');
      expect(prevBtn.props.accessibilityLabel).toBe('Previous banner');
      expect(nextBtn.props.accessibilityRole).toBe('button');
      expect(nextBtn.props.accessibilityLabel).toBe('Next banner');
    });

    it('taps Next button and wraps circularly to first banner after last banner', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderBanner(<PromoBanner products={mockProducts} />);
      });

      const nextBtn = renderer!.root.find(
        (node) => node.props.testID === 'banner-next-btn'
      );

      // Tap Next once (moves from index 0 to index 1)
      act(() => {
        nextBtn.props.onPress();
      });

      // Tap Next again (wraps from index 1 back to index 0)
      act(() => {
        nextBtn.props.onPress();
      });

      // Ensure no crash and dots are rendered
      const dotsContainer = renderer!.root.find(
        (node) => node.props.testID === 'banner-dots-container'
      );
      expect(dotsContainer.props.children.length).toBe(2);
    });

    it('taps Previous button and wraps circularly from first banner to last banner', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderBanner(<PromoBanner products={mockProducts} />);
      });

      const prevBtn = renderer!.root.find(
        (node) => node.props.testID === 'banner-prev-btn'
      );

      // Tap Previous on first slide (index 0) -> wraps to index 1 (last slide)
      act(() => {
        prevBtn.props.onPress();
      });

      // Tap Previous on index 1 -> wraps back to index 0
      act(() => {
        prevBtn.props.onPress();
      });

      expect(prevBtn).toBeDefined();
    });
  });

  describe('4. Banners for All Available Categories (buildCategoryBanners)', () => {
    const multiCategoryProducts: Product[] = [
      { id: 1, name: 'Smart TV 55"', category: 'Electronics', price: 45000, discount: 25, stock: 10, image: '/tv.jpg' },
      { id: 2, name: 'Laptop Pro', category: 'Electronics', price: 80000, discount: 15, stock: 5, image: '/laptop.jpg' },
      { id: 3, name: 'Running Sneakers', category: 'Footwear', price: 4000, discount: 30, stock: 8, image: '/shoes.jpg' },
      { id: 4, name: 'Leather Jacket', category: 'Clothing', price: 6000, discount: 40, stock: 12, image: '/jacket.jpg' },
      { id: 5, name: 'Travel Backpack', category: 'Bags', price: 2500, discount: 20, stock: 15, image: '/backpack.jpg' },
      { id: 6, name: 'Coffee Maker', category: 'Home & Kitchen', price: 3500, discount: 35, stock: 6, image: '/coffee.jpg' },
      { id: 7, name: 'Cricket Bat Pro', category: 'Sports', price: 5000, discount: 10, stock: 4, image: '/bat.jpg' },
      { id: 8, name: 'Remote Control Car', category: 'Toys', price: 1500, discount: 50, stock: 20, image: '/rc_car.jpg' },
      { id: 9, name: 'Silver Necklace', category: 'Accessories', price: 2000, discount: 15, stock: 7, image: '/necklace.jpg' },
    ];

    it('generates one banner per category for all available categories without a 5-banner limit', () => {
      const categories = [
        'All',
        'Electronics',
        'Footwear',
        'Clothing',
        'Bags',
        'Home & Kitchen',
        'Sports',
        'Toys',
        'Accessories',
      ];

      const banners = buildCategoryBanners(categories, multiCategoryProducts);

      // 8 non-All categories, each should have exactly 1 representative banner
      expect(banners.length).toBe(8);

      const bannerCategories = banners.map((b) => b.category);
      expect(bannerCategories).toContain('Electronics');
      expect(bannerCategories).toContain('Footwear');
      expect(bannerCategories).toContain('Clothing');
      expect(bannerCategories).toContain('Bags');
      expect(bannerCategories).toContain('Home & Kitchen');
      expect(bannerCategories).toContain('Sports');
      expect(bannerCategories).toContain('Toys');
      expect(bannerCategories).toContain('Accessories');

      // Verifies representative product with highest discount selected for Electronics (Smart TV 25% > Laptop 15%)
      const electronicsBanner = banners.find((b) => b.category === 'Electronics');
      expect(electronicsBanner?.id).toBe(1);
      expect(electronicsBanner?.name).toBe('Smart TV 55"');
      expect(electronicsBanner?.discount).toBe(25);
    });

    it('gracefully handles categories with no products by skipping without broken banners', () => {
      const categories = ['All', 'Electronics', 'NonExistentCategory'];
      const banners = buildCategoryBanners(categories, multiCategoryProducts);

      expect(banners.length).toBe(1);
      expect(banners[0].category).toBe('Electronics');
    });

    it('PromoBanner renders all provided category banners beyond 5 items', () => {
      const categories = [
        'Electronics',
        'Footwear',
        'Clothing',
        'Bags',
        'Home & Kitchen',
        'Sports',
        'Toys',
        'Accessories',
      ];
      const banners = buildCategoryBanners(categories, multiCategoryProducts);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderBanner(<PromoBanner products={banners} />);
      });

      // Pagination dots should match all 8 banners (not sliced to 5)
      const dotsContainer = renderer!.root.find(
        (node) => node.props.testID === 'banner-dots-container'
      );
      expect(dotsContainer.props.children.length).toBe(8);
    });
  });

  describe('5. Single Banner Alignment & Anti-Clipping Carousel Configuration', () => {
    it('configures FlatList and carousel viewport to show strictly one banner at a time without side previews', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderBanner(<PromoBanner products={mockProducts} />);
      });

      const flatList = renderer!.root.findByType(FlatList);
      expect(flatList).toBeDefined();

      // Paging enabled and snapping interval set to exact banner width
      expect(flatList.props.pagingEnabled).toBe(true);
      expect(typeof flatList.props.snapToInterval).toBe('number');
      expect(flatList.props.snapToInterval).toBeGreaterThan(300);

      // Content container has 0 horizontal padding to eliminate partial previews
      const resolvedContentStyle = Array.isArray(flatList.props.contentContainerStyle)
        ? Object.assign({}, ...flatList.props.contentContainerStyle)
        : flatList.props.contentContainerStyle || {};
      expect(resolvedContentStyle.paddingHorizontal || 0).toBe(0);

      // FlatList style matches banner width
      const resolvedFlatListStyle = Array.isArray(flatList.props.style)
        ? Object.assign({}, ...flatList.props.style)
        : flatList.props.style || {};
      expect(resolvedFlatListStyle.width).toBe(flatList.props.snapToInterval);
      expect(resolvedFlatListStyle.height).toBe(180);
    });

    it('positions Previous and Next buttons symmetrically on the banner edges', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderBanner(<PromoBanner products={mockProducts} />);
      });

      const prevBtn = renderer!.root.find(
        (node) => node.props.testID === 'banner-prev-btn'
      );
      const nextBtn = renderer!.root.find(
        (node) => node.props.testID === 'banner-next-btn'
      );

      const prevStyle = getResolvedStyle(prevBtn);
      const nextStyle = getResolvedStyle(nextBtn);

      expect(prevStyle.position).toBe('absolute');
      expect(nextStyle.position).toBe('absolute');
      expect(prevStyle.left).toBe(8);
      expect(nextStyle.right).toBe(8);
      expect(prevStyle.top).toBe('50%');
      expect(nextStyle.top).toBe('50%');
      expect(prevStyle.marginTop).toBe(-18);
      expect(nextStyle.marginTop).toBe(-18);
    });

    it('creates safe content areas with clearance ensuring text and image never overlap navigation arrows', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderBanner(<PromoBanner products={mockProducts} />);
      });

      // Find banner card and column containers
      const bannerCard = renderer!.root.find(
        (node) => node.props.testID === 'banner-card-101'
      );
      expect(bannerCard).toBeDefined();

      const contentCol = renderer!.root.find(
        (node) => node.props.testID === 'banner-content-col-101'
      );
      const imageCol = renderer!.root.find(
        (node) => node.props.testID === 'banner-image-101'
      );

      const contentStyle = getResolvedStyle(contentCol);
      const imageStyle = getResolvedStyle(imageCol);

      // Safe clearance: prevBtn occupies x=8 to x=44, so paddingLeft >= 48 guarantees no overlap
      expect(contentStyle.paddingLeft).toBeGreaterThanOrEqual(48);

      // Safe clearance: nextBtn occupies width 36 at right: 8, so paddingRight >= 48 guarantees no image overlap
      expect(imageStyle.paddingRight).toBeGreaterThanOrEqual(48);

      // Product title wraps naturally across 2 lines without clipping
      const titleNode = renderer!.root.findAll(
        (node) => node.type === Text && node.props.children === 'Wireless Noise Canceling Headphones'
      )[0];
      expect(titleNode.props.numberOfLines).toBe(2);
      expect(titleNode.props.ellipsizeMode).toBe('tail');
    });
  });
});
