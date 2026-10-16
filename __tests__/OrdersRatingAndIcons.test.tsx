import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TextInput, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Icon } from '../src/components/Icon';
import { RatingReviewScreen } from '../src/screens/RatingReviewScreen';
import { OrdersScreen } from '../src/screens/OrdersScreen';
import { Pagination } from '../src/components/Pagination';
import * as reviewApi from '../src/services/reviewApi';
import * as orderApi from '../src/services/orderApi';

// Mock AuthContext
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Sujal Customer', email: 'sujal@gmail.com', role: 'CUSTOMER', status: 'APPROVED' },
    token: 'mock-auth-token',
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

function renderWithSafeArea(ui: React.ReactElement) {
  return ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={initialMetrics}>{ui}</SafeAreaProvider>
  );
}

function getAllRenderedStrings(root: ReactTestRenderer.ReactTestInstance): string[] {
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

describe('Vector Icons Component', () => {
  it('renders vector icons without error for core app UI icons', () => {
    const icons = [
      'home',
      'products',
      'categories',
      'orders',
      'search',
      'heart',
      'heart-filled',
      'cart',
      'star',
      'star-filled',
      'package',
      'truck',
      'map-pin',
      'alert-triangle',
      'close',
      'arrow-left',
      'chevron-right',
      'chevron-left',
      'zap',
      'trash',
      'plus',
      'minus',
      'lock',
      'mail',
      'eye',
      'eye-off',
      'edit',
      'filter',
      'arrow-up-down',
      'check',
      'check-circle',
    ];

    icons.forEach((iconName) => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(<Icon name={iconName} size={24} color="#111827" />);
      });
      expect(renderer!.toJSON()).toBeTruthy();
    });
  });
});

describe('Pagination Component', () => {
  it('renders page indicator and calls onPageChange on Next and Prev', () => {
    const onPageChange = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={onPageChange}
        />
      );
    });

    const root = renderer!.root;
    const texts = getAllRenderedStrings(root);

    expect(texts.some((t) => t.includes('Page 1 of 5'))).toBe(true);
    expect(texts).toContain('Prev');
    expect(texts).toContain('Next');

    const buttons = root.findAll(
      (node) =>
        node.props.accessibilityRole === 'button' &&
        typeof node.props.onPress === 'function'
    );

    const nextBtn = buttons.find((b) => b.props.accessibilityLabel === 'Next page');
    expect(nextBtn).toBeDefined();
    act(() => {
      nextBtn!.props.onPress();
    });
    expect(onPageChange).toHaveBeenCalledWith(2);

    // Prev should be disabled on page 1
    const prevBtn = buttons.find((b) => b.props.accessibilityLabel === 'Previous page');
    expect(prevBtn).toBeDefined();
    act(() => {
      prevBtn!.props.onPress();
    });
    expect(onPageChange).not.toHaveBeenCalledWith(0);
  });
});

describe('RatingReviewScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(reviewApi, 'getProductReviews').mockResolvedValue({
      reviews: [],
      totalReviews: 0,
      averageRating: 0,
      ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      isEligibleToReview: true,
      userReview: null,
    });
  });

  it('renders product details and initial 5 stars with Great label', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderWithSafeArea(
        <RatingReviewScreen
          productId={10}
          productName="Wireless Noise Cancelling Headphones"
          deliveryDate="Oct 10"
          initialRating={5}
          onBack={jest.fn()}
        />
      );
    });

    const root = renderer!.root;
    const texts = getAllRenderedStrings(root);

    expect(texts).toContain('Wireless Noise Cancelling Headphones');
    expect(texts.some((t) => t.includes('Delivered on Oct 10'))).toBe(true);
    expect(texts).toContain('Great');
  });

  it('updates rating label when a star is pressed', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderWithSafeArea(
        <RatingReviewScreen
          productId={10}
          productName="Wireless Headphones"
          initialRating={5}
          onBack={jest.fn()}
        />
      );
    });

    const root = renderer!.root;

    const star3 = root.find(
      (node) => node.props.accessibilityLabel === 'Rate 3 of 5 stars'
    );
    await act(async () => {
      star3.props.onPress();
    });
    let texts = getAllRenderedStrings(root);
    expect(texts).toContain('Okay');

    const star1 = root.find(
      (node) => node.props.accessibilityLabel === 'Rate 1 of 5 stars'
    );
    await act(async () => {
      star1.props.onPress();
    });
    texts = getAllRenderedStrings(root);
    expect(texts).toContain('Terrible');
  });

  it('submits review successfully to backend', async () => {
    jest.useFakeTimers();

    const submitSpy = jest.spyOn(reviewApi, 'submitReview').mockResolvedValue({
      success: true,
      message: 'Review submitted successfully.',
      review: {
        id: 99,
        userId: 1,
        userName: 'Sujal Customer',
        productId: 10,
        rating: 4,
        comment: 'Amazing sound quality and battery life!',
        isVerifiedBuyer: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    const onSubmitted = jest.fn();
    const onBack = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderWithSafeArea(
        <RatingReviewScreen
          productId={10}
          productName="Wireless Headphones"
          initialRating={4}
          onBack={onBack}
          onReviewSubmitted={onSubmitted}
        />
      );
    });

    const root = renderer!.root;

    const textInput = root.findByType(TextInput);
    act(() => {
      textInput.props.onChangeText('Amazing sound quality and battery life!');
    });

    const submitBtn = root.find(
      (node) =>
        node.props.accessibilityRole === 'button' &&
        node.props.accessibilityLabel === 'Submit review'
    );

    await act(async () => {
      await submitBtn.props.onPress();
    });

    expect(submitSpy).toHaveBeenCalledWith(
      10,
      { rating: 4, comment: 'Amazing sound quality and battery life!' },
      'mock-auth-token'
    );
    expect(onSubmitted).toHaveBeenCalled();

    // Advance fake timers for post-submit onBack timeout
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(onBack).toHaveBeenCalled();

    jest.useRealTimers();
  });

  describe('Delivered Orders Star Ratings on My Orders Screen', () => {
    const mockDeliveredOrders = {
      orders: [
        {
          id: 201,
          userId: 1,
          total: 1999,
          status: 'DELIVERED',
          createdAt: '2026-03-01T10:00:00Z',
          items: [
            {
              id: 1,
              orderId: 201,
              productId: 42,
              productName: 'Premium Wireless Earbuds',
              productPrice: 1999,
              quantity: 1,
            },
          ],
        },
        {
          id: 202,
          userId: 1,
          total: 4500,
          status: 'SHIPPED',
          createdAt: '2026-03-02T10:00:00Z',
          items: [
            {
              id: 2,
              orderId: 202,
              productId: 88,
              productName: 'Running Shoes',
              productPrice: 4500,
              quantity: 1,
            },
          ],
        },
      ],
      total: 2,
      totalPages: 1,
      currentPage: 1,
    };

    beforeEach(() => {
      jest.spyOn(orderApi, 'getMyOrders').mockResolvedValue(mockDeliveredOrders as any);
      jest.spyOn(reviewApi, 'getProductReviews').mockResolvedValue({
        reviews: [],
        stats: { averageRating: 0, totalReviews: 0, ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
        userReview: null,
      } as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('displays 5 clearly visible outline stars and Rate & Review action on delivered order cards', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen />);
      });

      const root = renderer!.root;

      // Find the 5 rating stars for delivered order #201
      const star1 = root.find((n) => n.props.accessibilityLabel === 'Rate 1 of 5 stars');
      const star2 = root.find((n) => n.props.accessibilityLabel === 'Rate 2 of 5 stars');
      const star3 = root.find((n) => n.props.accessibilityLabel === 'Rate 3 of 5 stars');
      const star4 = root.find((n) => n.props.accessibilityLabel === 'Rate 4 of 5 stars');
      const star5 = root.find((n) => n.props.accessibilityLabel === 'Rate 5 of 5 stars');

      expect(star1).toBeDefined();
      expect(star2).toBeDefined();
      expect(star3).toBeDefined();
      expect(star4).toBeDefined();
      expect(star5).toBeDefined();

      // Check that unrated stars use visible neutral gray (textMuted '#6B7280'), NOT invisible '#F3F4F6'
      const icon1 = star1.findByType(Icon);
      expect(icon1.props.name).toBe('star');
      expect(icon1.props.color).toBe('#6B7280'); // theme.colors.textMuted
      expect(icon1.props.color).not.toBe('#F3F4F6'); // Not the invisible borderLight color

      // Check Rate & Review button exists
      const rateReviewBtn = root.find((n) => n.props.accessibilityLabel === 'Rate & Review');
      expect(rateReviewBtn).toBeDefined();
    });

    it('invokes onRateProduct with the tapped star index prefilled from 1 to 5', async () => {
      const onRateProduct = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen onRateProduct={onRateProduct} />);
      });

      const root = renderer!.root;

      // Tap Star 4
      const star4 = root.find((n) => n.props.accessibilityLabel === 'Rate 4 of 5 stars');
      act(() => {
        star4.props.onPress();
      });

      expect(onRateProduct).toHaveBeenCalledTimes(1);
      expect(onRateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 42,
          productName: 'Premium Wireless Earbuds',
        }),
        4,
        undefined
      );

      // Tap Star 2
      const star2 = root.find((n) => n.props.accessibilityLabel === 'Rate 2 of 5 stars');
      act(() => {
        star2.props.onPress();
      });

      expect(onRateProduct).toHaveBeenCalledTimes(2);
      expect(onRateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 42,
        }),
        2,
        undefined
      );
    });

    it('invokes onRateProduct when tapping the Rate & Review text button', async () => {
      const onRateProduct = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen onRateProduct={onRateProduct} />);
      });

      const root = renderer!.root;
      const rateReviewBtn = root.find((n) => n.props.accessibilityLabel === 'Rate & Review');

      act(() => {
        rateReviewBtn.props.onPress();
      });

      expect(onRateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 42,
        }),
        5,
        undefined
      );
    });

    it('does not display rating stars for non-delivered (SHIPPED) orders', async () => {
      jest.spyOn(orderApi, 'getMyOrders').mockResolvedValueOnce({
        orders: [
          {
            id: 202,
            userId: 1,
            total: 4500,
            status: 'SHIPPED',
            createdAt: '2026-03-02T10:00:00Z',
            items: [
              {
                id: 2,
                orderId: 202,
                productId: 88,
                productName: 'Running Shoes',
                productPrice: 4500,
                quantity: 1,
              },
            ],
          },
        ],
        total: 1,
        totalPages: 1,
        page: 1,
      } as any);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithSafeArea(<OrdersScreen />);
      });

      const root = renderer!.root;
      // No Rate & Review action button should exist for non-delivered order
      const rateReviewButtons = root.findAll(
        (n) => n.props.accessibilityLabel === 'Rate & Review'
      );
      expect(rateReviewButtons.length).toBe(0);
    });
  });
});
