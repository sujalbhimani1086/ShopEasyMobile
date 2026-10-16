import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { FlatList, Pressable } from 'react-native';
import { PromoBanner } from '../src/components/PromoBanner';
import type { Product } from '../src/types/product';

let mockIsDark = false;
jest.mock('../src/theme/theme', () => ({
  useAppTheme: () => ({
    isDark: mockIsDark,
    colors: {
      background: mockIsDark ? '#121212' : '#F8F9FA',
      card: mockIsDark ? '#1E1E1E' : '#FFFFFF',
      text: mockIsDark ? '#FFFFFF' : '#111827',
      primary: '#111827',
      border: '#E5E7EB',
      borderLight: '#F3F4F6',
      bannerBg: '#000000',
      bannerTagBg: 'rgba(255, 255, 255, 0.2)',
      bannerBtnBg: 'rgba(255, 255, 255, 0.25)',
      bannerBtnText: '#FFFFFF',
    },
  }),
}));

const mockBannerProducts: Product[] = [
  {
    id: 1,
    name: 'Wireless Earbuds Pro',
    category: 'Electronics',
    discount: 25,
    price: 2999,
    image: '/earbuds.jpg',
    stock: 50,
  },
  {
    id: 2,
    name: 'Mechanical Gaming Keyboard',
    category: 'Computers',
    discount: 15,
    price: 4999,
    image: '/keyboard.jpg',
    stock: 30,
  },
  {
    id: 3,
    name: 'Leather Running Shoes',
    category: 'Footwear',
    discount: 30,
    price: 3499,
    image: '/shoes.jpg',
    stock: 20,
  },
];

describe('PromoBanner Carousel Smoothness & Indicator Synchronization', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockIsDark = false;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders all banners without clipping and mounts pagination dots', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<PromoBanner products={mockBannerProducts} />);
    });

    const flatList = renderer!.root.findByType(FlatList);
    expect(flatList).toBeDefined();
    expect(flatList.props.data.length).toBe(3);

    const dotsContainer = renderer!.root.findByProps({ testID: 'banner-dots-container' });
    expect(dotsContainer).toBeDefined();

    const dot0 = renderer!.root.findByProps({ testID: 'banner-dot-0' });
    const dot1 = renderer!.root.findByProps({ testID: 'banner-dot-1' });
    const dot2 = renderer!.root.findByProps({ testID: 'banner-dot-2' });
    expect(dot0).toBeDefined();
    expect(dot1).toBeDefined();
    expect(dot2).toBeDefined();

    // Initially dot 0 is active
    expect(dot0.props.style[1]).toEqual({ width: 18 });
    expect(dot1.props.style[1]).toEqual({ width: 6 });
  });

  it('automatically advances to next banner after 4.5s and updates indicator smoothly', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<PromoBanner products={mockBannerProducts} />);
    });

    // Advance 4500ms
    act(() => {
      jest.advanceTimersByTime(4500);
    });

    const dot0 = renderer!.root.findByProps({ testID: 'banner-dot-0' });
    const dot1 = renderer!.root.findByProps({ testID: 'banner-dot-1' });

    // Dot 1 becomes active
    expect(dot1.props.style[1]).toEqual({ width: 18 });
    expect(dot0.props.style[1]).toEqual({ width: 6 });
  });

  it('tapping Next button advances active index and resets auto-slide timer', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<PromoBanner products={mockBannerProducts} />);
    });

    const nextBtn = renderer!.root.findByProps({ testID: 'banner-next-btn' });

    // Tap Next
    act(() => {
      nextBtn.props.onPress();
    });

    let dot1 = renderer!.root.findByProps({ testID: 'banner-dot-1' });
    expect(dot1.props.style[1]).toEqual({ width: 18 });

    // Advance 3000ms (not yet 4500ms) - should not advance yet because timer was reset
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    dot1 = renderer!.root.findByProps({ testID: 'banner-dot-1' });
    expect(dot1.props.style[1]).toEqual({ width: 18 });

    // Advance remaining 1500ms -> now advances to slide 2
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    const dot2 = renderer!.root.findByProps({ testID: 'banner-dot-2' });
    expect(dot2.props.style[1]).toEqual({ width: 18 });
  });

  it('tapping Previous button wraps circularly to last slide without stuttering', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<PromoBanner products={mockBannerProducts} />);
    });

    const prevBtn = renderer!.root.findByProps({ testID: 'banner-prev-btn' });

    // Tap Prev from slide 0 -> wraps to slide 2
    act(() => {
      prevBtn.props.onPress();
    });

    const dot2 = renderer!.root.findByProps({ testID: 'banner-dot-2' });
    const dot0 = renderer!.root.findByProps({ testID: 'banner-dot-0' });
    expect(dot2.props.style[1]).toEqual({ width: 18 });
    expect(dot0.props.style[1]).toEqual({ width: 6 });
  });

  it('tapping a dot directly transitions to that slide', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<PromoBanner products={mockBannerProducts} />);
    });

    const dot2 = renderer!.root.findByProps({ testID: 'banner-dot-2' });
    act(() => {
      dot2.props.onPress();
    });

    const updatedDot2 = renderer!.root.findByProps({ testID: 'banner-dot-2' });
    expect(updatedDot2.props.style[1]).toEqual({ width: 18 });
  });

  it('pauses auto-slide while dragging and resumes after momentum scroll ends', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<PromoBanner products={mockBannerProducts} />);
    });

    const flatList = renderer!.root.findByType(FlatList);

    // User starts drag
    act(() => {
      flatList.props.onScrollBeginDrag();
    });

    // Advance 6000ms while user is holding drag
    act(() => {
      jest.advanceTimersByTime(6000);
    });

    // Still at slide 0 because auto-slide was paused!
    const dot0 = renderer!.root.findByProps({ testID: 'banner-dot-0' });
    expect(dot0.props.style[1]).toEqual({ width: 18 });

    const { width: screenWidth } = require('react-native').Dimensions.get('window');
    const bannerWidth = screenWidth - 32;

    // User finishes scroll to slide 1
    act(() => {
      flatList.props.onMomentumScrollEnd({
        nativeEvent: { contentOffset: { x: bannerWidth } },
      });
    });

    const dot1 = renderer!.root.findByProps({ testID: 'banner-dot-1' });
    expect(dot1.props.style[1]).toEqual({ width: 18 });
  });

  it('does not re-render active index during programmatic slide animation (no hover/flicker)', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<PromoBanner products={mockBannerProducts} />);
    });

    const flatList = renderer!.root.findByType(FlatList);
    const nextBtn = renderer!.root.findByProps({ testID: 'banner-next-btn' });

    // Programmatic next button pressed
    act(() => {
      nextBtn.props.onPress();
    });

    // Active index is now set to 1
    let dot1 = renderer!.root.findByProps({ testID: 'banner-dot-1' });
    expect(dot1.props.style[1]).toEqual({ width: 18 });

    // Simulate onScroll events firing with fractional offsets mid-animation (e.g. x = 50px, which rounds to 0)
    act(() => {
      flatList.props.onScroll({
        nativeEvent: { contentOffset: { x: 50 } },
      });
    });

    // Dot 1 must REMAIN active! It must NOT flicker or jump back to 0!
    dot1 = renderer!.root.findByProps({ testID: 'banner-dot-1' });
    expect(dot1.props.style[1]).toEqual({ width: 18 });

    const dot0 = renderer!.root.findByProps({ testID: 'banner-dot-0' });
    expect(dot0.props.style[1]).toEqual({ width: 6 });
  });
});
