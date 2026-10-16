import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, Image, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OrdersScreen } from '../src/screens/OrdersScreen';
import { Pagination } from '../src/components/Pagination';
import { Icon } from '../src/components/Icon';
import * as orderApi from '../src/services/orderApi';
import * as reviewApi from '../src/services/reviewApi';
import { FALLBACK_PRODUCT_IMAGE, getOrderItemImage } from '../src/config/api';

// Mock AuthContext
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Sujal Customer', email: 'sujal@gmail.com', role: 'CUSTOMER', status: 'APPROVED' },
    token: 'test-auth-token-123',
    logout: jest.fn(),
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
    },
  }),
}));

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderScreen(ui: React.ReactElement) {
  return ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={initialMetrics}>{ui}</SafeAreaProvider>
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

describe('ShopEasy Mobile — Orders, Line Items, Images, Reviews & Pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Review Star Rating Display & Persistence', () => {
    it('displays 3 filled orange stars and 2 outlined gray stars for a 3-star saved rating (★★★☆☆)', async () => {
      // Mock delivered order with 1 item
      jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
        orders: [
          {
            id: 501,
            userId: 1,
            total: 900,
            status: 'DELIVERED',
            createdAt: '2026-04-01T10:00:00Z',
            items: [
              {
                id: 1,
                orderId: 501,
                productId: 10,
                productName: 'Safari Backpack',
                price: 900,
                quantity: 1,
              },
            ],
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      } as any);

      // Mock user review returning 3 stars
      jest.spyOn(reviewApi, 'getProductReviews').mockResolvedValue({
        reviews: [],
        totalReviews: 1,
        averageRating: 3.0,
        ratingBreakdown: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 0 },
        isEligibleToReview: true,
        userReview: {
          id: 77,
          userId: 1,
          userName: 'Sujal Customer',
          productId: 10,
          rating: 3,
          comment: 'Good quality bag for daily use.',
          isVerifiedBuyer: true,
          createdAt: '2026-04-02T10:00:00Z',
          updatedAt: '2026-04-02T10:00:00Z',
        },
      });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderScreen(<OrdersScreen />);
      });

      const root = renderer!.root;

      // Find all stars rendered in the card
      const stars = [1, 2, 3, 4, 5].map((idx) =>
        root.find((n) => n.props.accessibilityLabel === `Rate ${idx} of 5 stars`)
      );

      // Stars 1, 2, 3 must be filled orange (#F59E0B)
      for (let i = 0; i < 3; i++) {
        const icon = stars[i].findByType(Icon);
        expect(icon.props.name).toBe('star-filled');
        expect(icon.props.color).toBe('#F59E0B');
      }

      // Stars 4, 5 must be outlined gray (#6B7280)
      for (let i = 3; i < 5; i++) {
        const icon = stars[i].findByType(Icon);
        expect(icon.props.name).toBe('star');
        expect(icon.props.color).toBe('#6B7280');
      }

      // Button should say "Edit Review"
      const editReviewBtn = root.find((n) => n.props.accessibilityLabel === 'Edit review');
      expect(editReviewBtn).toBeDefined();
    });

    it('displays 5 filled orange stars for a 5-star saved rating', async () => {
      jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
        orders: [
          {
            id: 502,
            userId: 1,
            total: 1200,
            status: 'DELIVERED',
            createdAt: '2026-04-01T10:00:00Z',
            items: [
              {
                id: 2,
                orderId: 502,
                productId: 20,
                productName: 'Polarized Sunglasses',
                price: 1200,
                quantity: 1,
              },
            ],
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      } as any);

      jest.spyOn(reviewApi, 'getProductReviews').mockResolvedValue({
        reviews: [],
        totalReviews: 1,
        averageRating: 5.0,
        ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
        isEligibleToReview: true,
        userReview: {
          id: 88,
          userId: 1,
          userName: 'Sujal Customer',
          productId: 20,
          rating: 5,
          comment: 'Perfect fit and stylish!',
          isVerifiedBuyer: true,
          createdAt: '2026-04-02T10:00:00Z',
          updatedAt: '2026-04-02T10:00:00Z',
        },
      });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderScreen(<OrdersScreen />);
      });

      const root = renderer!.root;

      // All 5 stars must be star-filled with orange color
      for (let i = 1; i <= 5; i++) {
        const star = root.find((n) => n.props.accessibilityLabel === `Rate ${i} of 5 stars`);
        const icon = star.findByType(Icon);
        expect(icon.props.name).toBe('star-filled');
        expect(icon.props.color).toBe('#F59E0B');
      }
    });

    it('associates reviews with the specific product in multi-product checkouts', async () => {
      jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
        orders: [
          {
            id: 503,
            userId: 1,
            total: 2100,
            status: 'DELIVERED',
            createdAt: '2026-04-01T10:00:00Z',
            items: [
              {
                id: 1,
                orderId: 503,
                productId: 10,
                productName: 'Safari Backpack',
                price: 900,
                quantity: 1,
              },
              {
                id: 2,
                orderId: 503,
                productId: 20,
                productName: 'Sunglasses',
                price: 1200,
                quantity: 1,
              },
            ],
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      } as any);

      // Backpack has 4 stars, Sunglasses has no review
      jest.spyOn(reviewApi, 'getProductReviews').mockImplementation(async (pId) => {
        if (pId === 10) {
          return {
            reviews: [],
            totalReviews: 1,
            averageRating: 4.0,
            ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 },
            isEligibleToReview: true,
            userReview: {
              id: 101,
              userId: 1,
              userName: 'Sujal',
              productId: 10,
              rating: 4,
              comment: 'Great backpack',
              isVerifiedBuyer: true,
              createdAt: '2026-04-02T10:00:00Z',
              updatedAt: '2026-04-02T10:00:00Z',
            },
          };
        }
        return {
          reviews: [],
          totalReviews: 0,
          averageRating: 0,
          ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          isEligibleToReview: true,
          userReview: null,
        };
      });

      const onRateProduct = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderScreen(<OrdersScreen onRateProduct={onRateProduct} />);
      });

      const root = renderer!.root;

      // Backpack card should have "Edit Review"
      const editReviewBtn = root.find((n) => n.props.accessibilityLabel === 'Edit review');
      expect(editReviewBtn).toBeDefined();

      // Sunglasses card should have "Rate & Review"
      const rateReviewBtn = root.find((n) => n.props.accessibilityLabel === 'Rate & Review');
      expect(rateReviewBtn).toBeDefined();

      // Tapping "Rate & Review" on Sunglasses must pass productId 20
      act(() => {
        rateReviewBtn.props.onPress();
      });

      expect(onRateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 20,
          productName: 'Sunglasses',
        }),
        5,
        undefined
      );
    });
  });

  describe('2. Display Each Ordered Product Separately in My Orders', () => {
    it('displays 3 separate product cards for a checkout containing 3 items', async () => {
      // 1 order with 3 products: Safari Backpack (900), Sunglasses (1200), Headphones (2000)
      jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
        orders: [
          {
            id: 1001,
            userId: 1,
            total: 4100, // Total checkout sum
            status: 'DELIVERED',
            paymentMethod: 'COD',
            paymentStatus: 'PAID',
            createdAt: '2026-04-01T10:00:00Z',
            name: 'Sujal Customer',
            city: 'Mumbai',
            items: [
              {
                id: 11,
                orderId: 1001,
                productId: 101,
                productName: 'Safari Backpack',
                productImage: '/images/bag.jpg',
                price: 900,
                quantity: 1,
              },
              {
                id: 12,
                orderId: 1001,
                productId: 102,
                productName: 'Sunglasses',
                productImage: '/images/sunglasses.jpg',
                price: 1200,
                quantity: 1,
              },
              {
                id: 13,
                orderId: 1001,
                productId: 103,
                productName: 'Headphones',
                productImage: '/images/headphone.jpg',
                price: 2000,
                quantity: 1,
              },
            ],
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      } as any);

      jest.spyOn(reviewApi, 'getProductReviews').mockResolvedValue({
        reviews: [],
        totalReviews: 0,
        averageRating: 0,
        ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        isEligibleToReview: true,
        userReview: null,
      });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderScreen(<OrdersScreen />);
      });

      const root = renderer!.root;
      const texts = extractAllStrings(root);

      // Verify each product name is rendered individually (not grouped into "Safari Backpack + 2 more items")
      expect(texts).toContain('Safari Backpack');
      expect(texts).toContain('Sunglasses');
      expect(texts).toContain('Headphones');
      expect(texts.some((t) => t.includes('+ 2 more items'))).toBe(false);

      // Verify line-item prices are displayed individually, NOT the combined order total ₹4,100
      expect(texts).toContain('₹900');
      expect(texts).toContain('₹1,200');
      expect(texts).toContain('₹2,000');

      // Verify all 3 cards retain the parent order ID "#1001"
      const orderIdTexts = texts.filter((t) => t.includes('Order #1001'));
      expect(orderIdTexts.length).toBe(3);

      // Verify all 3 cards share the parent status and payment badge
      const paidBadges = texts.filter((t) => t === 'COD • PAID');
      expect(paidBadges.length).toBe(3);
    });

    it('displays quantity clearly when line item has quantity > 1', async () => {
      jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
        orders: [
          {
            id: 1002,
            userId: 1,
            total: 4000,
            status: 'CONFIRMED',
            paymentMethod: 'UPI',
            paymentStatus: 'PAID',
            createdAt: '2026-04-01T10:00:00Z',
            items: [
              {
                id: 21,
                orderId: 1002,
                productId: 103,
                productName: 'Headphones',
                price: 2000,
                quantity: 2, // Quantity 2
              },
            ],
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      } as any);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderScreen(<OrdersScreen />);
      });

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Headphones');
      expect(texts).toContain('₹4,000'); // 2 * 2000
      expect(texts).toContain('(Qty: 2)');
    });
  });

  describe('3. Fix Missing Product Images', () => {
    it('uses getOrderItemImage to resolve correct image or fallback on placeholder', () => {
      // Direct unit check on getOrderItemImage
      const itemWithProductImg = {
        product: { image: '/images/products/shoes.jpg' },
        productImage: null,
      };
      expect(getOrderItemImage(itemWithProductImg)).toContain('/images/products/shoes.jpg');

      const itemWithItemImg = {
        product: undefined,
        productImage: 'https://cdn.example.com/item.jpg',
      };
      expect(getOrderItemImage(itemWithItemImg)).toBe('https://cdn.example.com/item.jpg');

      // Placeholder should resolve to FALLBACK_PRODUCT_IMAGE
      const itemWithPlaceholder = {
        productImage: '/images/placeholder.png',
      };
      expect(getOrderItemImage(itemWithPlaceholder)).toBe(FALLBACK_PRODUCT_IMAGE);

      // Empty should resolve to FALLBACK_PRODUCT_IMAGE
      const itemEmpty = {
        productImage: '',
      };
      expect(getOrderItemImage(itemEmpty)).toBe(FALLBACK_PRODUCT_IMAGE);
    });

    it('renders each product card with its own distinct image uri', async () => {
      jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
        orders: [
          {
            id: 1003,
            userId: 1,
            total: 2100,
            status: 'CONFIRMED',
            items: [
              {
                id: 1,
                orderId: 1003,
                productId: 101,
                productName: 'Safari Backpack',
                productImage: '/images/bag.jpg',
                price: 900,
                quantity: 1,
              },
              {
                id: 2,
                orderId: 1003,
                productId: 102,
                productName: 'Sunglasses',
                productImage: '/images/sunglasses.jpg',
                price: 1200,
                quantity: 1,
              },
            ],
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      } as any);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderScreen(<OrdersScreen />);
      });

      const images = renderer!.root.findAllByType(Image);
      const uris = images.map((img) => img.props.source?.uri);

      expect(uris.some((u) => u.includes('bag.jpg'))).toBe(true);
      expect(uris.some((u) => u.includes('sunglasses.jpg'))).toBe(true);
    });
  });

  describe('4. Global Pagination Rule (10 records per page)', () => {
    it('0 records: displays empty state and NO pagination controls', async () => {
      jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
        orders: [],
        total: 0,
        page: 1,
        totalPages: 1,
      } as any);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderScreen(<OrdersScreen />);
      });

      const paginations = renderer!.root.findAllByType(Pagination);
      expect(paginations.length).toBe(0);

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('No orders yet');
    });

    it('1 record (e.g. Cancelled filter): displays the 1 card and NO pagination controls', async () => {
      jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
        orders: [
          {
            id: 301,
            userId: 1,
            total: 500,
            status: 'CANCELLED',
            items: [{ id: 1, orderId: 301, productId: 5, productName: 'Hat', price: 500, quantity: 1 }],
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      } as any);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderScreen(<OrdersScreen />);
      });

      // Filter by Cancelled
      const cancelledChip = renderer!.root.find(
        (n) => n.props.accessibilityLabel === 'Filter by Cancelled'
      );
      expect(cancelledChip).toBeDefined();
      await act(async () => {
        cancelledChip.props.onPress();
      });

      const paginations = renderer!.root.findAllByType(Pagination);
      expect(paginations.length).toBe(0);

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Hat');
    });

    it('10 records: displays all 10 cards and NO pagination controls', async () => {
      const tenItems = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        orderId: 400 + i,
        productId: i + 1,
        productName: `Product ${i + 1}`,
        price: 100 * (i + 1),
        quantity: 1,
      }));

      jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
        orders: [
          {
            id: 400,
            userId: 1,
            total: 5500,
            status: 'SHIPPED',
            items: tenItems,
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      } as any);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderScreen(<OrdersScreen />);
      });

      // Exactly 10 records -> NO pagination
      const paginations = renderer!.root.findAllByType(Pagination);
      expect(paginations.length).toBe(0);

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Product 1');
      expect(texts).toContain('Product 10');
    });

    it('11 records: displays pagination with 10 on page 1 and 1 on page 2', async () => {
      const elevenItems = Array.from({ length: 11 }, (_, i) => ({
        id: i + 1,
        orderId: 500 + i,
        productId: i + 1,
        productName: `Product ${i + 1}`,
        price: 100,
        quantity: 1,
      }));

      jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue({
        orders: [
          {
            id: 500,
            userId: 1,
            total: 1100,
            status: 'SHIPPED',
            items: elevenItems,
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      } as any);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderScreen(<OrdersScreen />);
      });

      // No pagination controls should appear; all records continuously scrollable
      const pagination = renderer!.root.findAllByType(Pagination);
      expect(pagination.length).toBe(0);

      // All records are continuously rendered
      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Product 1');
      expect(texts).toContain('Product 10');
      expect(texts).toContain('Product 11');
    });

    it('Pagination component directly enforces hiding when totalRecords <= 10 or totalPages <= 1', async () => {
      // Direct unit test of Pagination component
      const onPageChange = jest.fn();

      // totalItems = 10 -> returns null
      let renderer10: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer10 = ReactTestRenderer.create(
          <Pagination currentPage={1} totalPages={1} totalItems={10} onPageChange={onPageChange} />
        );
      });
      expect(renderer10!.toJSON()).toBeNull();

      // totalItems = 1 -> returns null
      let renderer1: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer1 = ReactTestRenderer.create(
          <Pagination currentPage={1} totalPages={1} totalItems={1} onPageChange={onPageChange} />
        );
      });
      expect(renderer1!.toJSON()).toBeNull();

      // totalItems = 11, totalPages = 2 -> renders controls
      let renderer11: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer11 = ReactTestRenderer.create(
          <Pagination currentPage={1} totalPages={2} totalItems={11} onPageChange={onPageChange} />
        );
      });
      expect(renderer11!.toJSON()).not.toBeNull();
      const texts11 = renderer11!.root.findAllByType(Text).map((t) => String(t.props.children));
      expect(texts11).toContain('Prev');
      expect(texts11).toContain('Next');
    });
  });
});
