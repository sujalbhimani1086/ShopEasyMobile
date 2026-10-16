import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, View } from 'react-native';
import {
  ScalePressable,
  FadeInView,
  HeartBounce,
  BadgeBounce,
  ShimmerSkeleton,
  ScreenTransitionView,
} from '../src/components/animated';
import { AppDialog } from '../src/components/dialogs/AppDialog';
import { OrderTrackingTimeline } from '../src/components/OrderTrackingTimeline';

// Mock theme
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
      modalOverlay: 'rgba(0, 0, 0, 0.55)',
    },
  }),
  ThemeProvider: ({ children }: any) => children,
}));

describe('App-Wide Animation Upgrade Component Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ScalePressable', () => {
    it('renders children correctly and triggers onPress', () => {
      const onPressMock = jest.fn();
      let testRenderer: any;
      act(() => {
        testRenderer = ReactTestRenderer.create(
          <ScalePressable testID="scale-btn" onPress={onPressMock}>
            <Text>Touch Me</Text>
          </ScalePressable>
        );
      });

      const pressableInstance = testRenderer.root.findByProps({ testID: 'scale-btn' });
      expect(pressableInstance).toBeTruthy();

      act(() => {
        pressableInstance.props.onPressIn?.();
        pressableInstance.props.onPressOut?.();
        pressableInstance.props.onPress?.();
      });

      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it('honors disabled prop', () => {
      const onPressMock = jest.fn();
      let testRenderer: any;
      act(() => {
        testRenderer = ReactTestRenderer.create(
          <ScalePressable testID="disabled-btn" disabled onPress={onPressMock}>
            <Text>Disabled Button</Text>
          </ScalePressable>
        );
      });

      const pressableInstance = testRenderer.root.findByProps({ testID: 'disabled-btn' });
      expect(pressableInstance.props.disabled).toBe(true);
    });
  });

  describe('FadeInView', () => {
    it('renders children with smooth entry animation', () => {
      let testRenderer: any;
      act(() => {
        testRenderer = ReactTestRenderer.create(
          <FadeInView duration={200}>
            <Text>Animated Content</Text>
          </FadeInView>
        );
      });

      const textInstance = testRenderer.root.findByProps({ children: 'Animated Content' });
      expect(textInstance).toBeTruthy();
    });

    it('supports horizontal slide directions', () => {
      let testRenderer: any;
      act(() => {
        testRenderer = ReactTestRenderer.create(
          <FadeInView slideDirection="left" slideDistance={15}>
            <Text>Slide Left Content</Text>
          </FadeInView>
        );
      });

      const textInstance = testRenderer.root.findByProps({ children: 'Slide Left Content' });
      expect(textInstance).toBeTruthy();
    });
  });

  describe('HeartBounce', () => {
    it('renders children and updates when isFilled toggles', () => {
      let testRenderer: any;
      act(() => {
        testRenderer = ReactTestRenderer.create(
          <HeartBounce isFilled={false}>
            <Text>Heart Icon</Text>
          </HeartBounce>
        );
      });

      expect(testRenderer.root.findByProps({ children: 'Heart Icon' })).toBeTruthy();

      // Toggle to filled
      act(() => {
        testRenderer.update(
          <HeartBounce isFilled={true}>
            <Text>Heart Icon</Text>
          </HeartBounce>
        );
      });

      expect(testRenderer.root.findByProps({ children: 'Heart Icon' })).toBeTruthy();
    });
  });

  describe('BadgeBounce', () => {
    it('renders children and updates when count increases', () => {
      let testRenderer: any;
      act(() => {
        testRenderer = ReactTestRenderer.create(
          <BadgeBounce count={1}>
            <Text>1</Text>
          </BadgeBounce>
        );
      });

      expect(testRenderer.root.findByProps({ children: '1' })).toBeTruthy();

      act(() => {
        testRenderer.update(
          <BadgeBounce count={2}>
            <Text>2</Text>
          </BadgeBounce>
        );
      });

      expect(testRenderer.root.findByProps({ children: '2' })).toBeTruthy();
    });
  });

  describe('ShimmerSkeleton', () => {
    it('renders placeholder skeleton', () => {
      let testRenderer: any;
      act(() => {
        testRenderer = ReactTestRenderer.create(
          <ShimmerSkeleton width={120} height={24} borderRadius={8} />
        );
      });

      expect(testRenderer.toJSON()).toBeTruthy();
    });
  });

  describe('ScreenTransitionView', () => {
    it('renders route transitions smoothly', () => {
      let testRenderer: any;
      act(() => {
        testRenderer = ReactTestRenderer.create(
          <ScreenTransitionView routeKey="home">
            <Text>Home Screen Page</Text>
          </ScreenTransitionView>
        );
      });

      expect(testRenderer.root.findByProps({ children: 'Home Screen Page' })).toBeTruthy();

      act(() => {
        testRenderer.update(
          <ScreenTransitionView routeKey="products">
            <Text>Products Screen Page</Text>
          </ScreenTransitionView>
        );
      });

      expect(testRenderer.root.findByProps({ children: 'Products Screen Page' })).toBeTruthy();
    });
  });

  describe('AppDialog with spring animation', () => {
    it('renders modal dialog smoothly with spring entry', () => {
      const onCloseMock = jest.fn();
      let testRenderer: any;
      act(() => {
        testRenderer = ReactTestRenderer.create(
          <AppDialog
            visible={true}
            title="Animated Dialog"
            subtitle="Testing smooth spring scale entry"
            onClose={onCloseMock}
          />
        );
      });

      expect(testRenderer.root.findByProps({ children: 'Animated Dialog' })).toBeTruthy();
      expect(testRenderer.root.findByProps({ children: 'Testing smooth spring scale entry' })).toBeTruthy();
    });
  });

  describe('OrderTrackingTimeline with active pulse node', () => {
    it('renders timeline with pulsing current status node', () => {
      let testRenderer: any;
      act(() => {
        testRenderer = ReactTestRenderer.create(
          <OrderTrackingTimeline status="SHIPPED" />
        );
      });

      const shippedMatches = testRenderer.root.findAllByProps({ children: 'Shipped' });
      expect(shippedMatches.length).toBeGreaterThanOrEqual(1);

      const deliveredMatches = testRenderer.root.findAllByProps({ children: 'Delivered' });
      expect(deliveredMatches.length).toBeGreaterThanOrEqual(1);
    });
  });
});
