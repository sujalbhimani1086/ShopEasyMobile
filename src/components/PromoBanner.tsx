import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useAppTheme } from '../theme/theme';
import { resolveImageUrl } from '../config/api';
import type { Product } from '../types/product';
import { resolveBannerDestination } from '../utils/bannerUtils';
import { Icon } from './Icon';

export interface PromoBannerProps {
  products: Product[];
  isActive?: boolean;
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  onShopNowPress?: (product?: Product) => void;
  onBannerPress?: (product: Product) => void;
  onProductPress?: (productId: number) => void;
  onCategoryPress?: (category: string) => void;
  onNavigateToProducts?: (category?: string, search?: string) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Standard page margins: 16px on left, 16px on right
const BANNER_WIDTH = SCREEN_WIDTH - 32;
const isSmallScreen = SCREEN_WIDTH < 380;

interface BannerCardItemProps {
  item: Product;
  bannerWidth: number;
  isSmall: boolean;
  themeColors: any;
  isDark: boolean;
  onPress: (product: Product, origin: 'card' | 'image' | 'button' | 'tag' | 'title') => void;
}

/**
 * Memoized individual banner card item.
 * Prevents unnecessary re-renders of cards and images when the active carousel index changes.
 */
const BannerCardItem = React.memo<BannerCardItemProps>(({
  item,
  bannerWidth,
  isSmall,
  themeColors,
  isDark,
  onPress,
}) => {
  const discountText =
    item.discount > 0 ? `Up to ${item.discount}% OFF` : 'Exclusive Deal';

  const imageUri = resolveImageUrl(item.image);

  return (
    <Pressable
      testID={`banner-card-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Banner: ${item.name || item.category || 'Special Offer'}`}
      style={({ pressed }) => [
        styles.bannerCard,
        {
          width: bannerWidth,
          backgroundColor: themeColors.bannerBg,
          borderColor: themeColors.borderLight,
          borderWidth: isDark ? 1 : 0,
          opacity: pressed ? 0.94 : 1,
        },
      ]}
      onPress={() => onPress(item, 'card')}
    >
      {/* Left Column: Promotion Info inside Safe Area */}
      <View style={styles.contentCol} testID={`banner-content-col-${item.id}`}>
        <Pressable
          testID={`banner-tag-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Filter by ${item.category || 'Special Deal'}`}
          style={({ pressed }) => [
            styles.dealTag,
            {
              backgroundColor: themeColors.bannerTagBg,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
          onPress={(e) => {
            e?.stopPropagation?.();
            onPress(item, 'tag');
          }}
        >
          <View style={styles.dealTagInner}>
            <Icon
              name="tag"
              size={isSmall ? 11 : 12}
              color="#FFFFFF"
              strokeWidth={2.2}
            />
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.dealTagText,
                { color: '#FFFFFF', marginLeft: 4 },
              ]}
            >
              {item.category || 'Special Deal'}
            </Text>
          </View>
        </Pressable>

        <Pressable
          testID={`banner-title-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={`View details for ${item.name}`}
          onPress={(e) => {
            e?.stopPropagation?.();
            onPress(item, 'title');
          }}
        >
          <Text
            numberOfLines={2}
            ellipsizeMode="tail"
            style={[
              styles.productTitle,
              { color: '#FFFFFF' },
            ]}
          >
            {item.name}
          </Text>
        </Pressable>

        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.discountSubtitle,
            { color: '#FFFFFF' },
          ]}
        >
          {discountText}
        </Text>

        <Pressable
          testID={`banner-shop-now-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Shop now for ${item.name}`}
          style={({ pressed }) => [
            styles.shopNowBtn,
            {
              backgroundColor: themeColors.bannerBtnBg,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
          onPress={(e) => {
            e?.stopPropagation?.();
            onPress(item, 'button');
          }}
        >
          <Text
            style={[
              styles.shopNowText,
              { color: themeColors.bannerBtnText },
            ]}
          >
            Shop Now →
          </Text>
        </Pressable>
      </View>

      {/* Right Column: Product Image inside Safe Area */}
      <Pressable
        testID={`banner-image-${item.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Image for ${item.name}`}
        style={({ pressed }) => [
          styles.imageCol,
          { opacity: pressed ? 0.88 : 1 },
        ]}
        onPress={(e) => {
          e?.stopPropagation?.();
          onPress(item, 'image');
        }}
      >
        <Image
          source={{
            uri: imageUri,
          }}
          style={styles.bannerImage}
          resizeMode="contain"
          fadeDuration={0}
        />
      </Pressable>
    </Pressable>
  );
});

interface PaginationDotProps {
  index: number;
  isActive: boolean;
  activeColor: string;
  inactiveColor: string;
  onPress: (index: number) => void;
}

/**
 * Memoized individual pagination dot.
 * Only the previously active and newly active dots re-render during transitions.
 */
const PaginationDot = React.memo<PaginationDotProps>(({
  index,
  isActive,
  activeColor,
  inactiveColor,
  onPress,
}) => {
  return (
    <Pressable
      testID={`banner-dot-${index}`}
      accessibilityRole="button"
      accessibilityLabel={`Go to banner slide ${index + 1}`}
      onPress={() => onPress(index)}
      style={[
        styles.dot,
        isActive ? styles.dotActive : styles.dotInactive,
        {
          backgroundColor: isActive ? activeColor : inactiveColor,
        },
      ]}
    />
  );
});

export const PromoBanner: React.FC<PromoBannerProps> = ({
  products,
  isActive = true,
  initialIndex = 0,
  onIndexChange,
  onShopNowPress,
  onBannerPress,
  onProductPress,
  onCategoryPress,
  onNavigateToProducts,
}) => {
  const theme = useAppTheme();
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex || 0);
  const activeIndexRef = useRef(initialIndex || 0);
  const isDraggingRef = useRef(false);
  const isAnimatingRef = useRef(false);
  const autoSlideTimerRef = useRef<any>(null);
  const animationTimeoutRef = useRef<any>(null);

  activeIndexRef.current = activeIndex;

  // Render all dynamically provided category banners without 5-banner restriction
  const displayItems =
    products.length > 0
      ? products
      : [
          {
            id: 0,
            name: 'Discover Great Products',
            category: 'ShopEasy Deals',
            discount: 50,
            price: 0,
            image: '',
            stock: 10,
            targetType: 'promotion',
          } as Product,
        ];

  // Clean auto-slide timer reset
  const resetAutoSlideTimer = useCallback(() => {
    if (autoSlideTimerRef.current) {
      clearInterval(autoSlideTimerRef.current);
      autoSlideTimerRef.current = null;
    }

    if (!isActive || displayItems.length <= 1) {
      return;
    }

    autoSlideTimerRef.current = setInterval(() => {
      if (isDraggingRef.current || isAnimatingRef.current) {
        return;
      }
      const nextIndex = (activeIndexRef.current + 1) % displayItems.length;
      scrollToIndex(nextIndex, true);
    }, 4500);
  }, [isActive, displayItems.length]); // Note: scrollToIndex defined below

  // Helper to scroll to a specific index with modulo wrap and native sync
  const scrollToIndex = useCallback(
    (index: number, animated = true) => {
      if (displayItems.length === 0) return;
      const targetIndex = (index + displayItems.length) % displayItems.length;

      // Clear any pending animation timeout
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }

      if (animated) {
        // Lock handleScroll from overwriting activeIndex with fractional values mid-transition
        isAnimatingRef.current = true;
        setActiveIndex(targetIndex);
        activeIndexRef.current = targetIndex;
        onIndexChange?.(targetIndex);

        try {
          flatListRef.current?.scrollToIndex({
            index: targetIndex,
            animated: true,
          });
        } catch {
          flatListRef.current?.scrollToOffset({
            offset: targetIndex * BANNER_WIDTH,
            animated: true,
          });
        }

        // Release animation lock when native scroll transition settles
        animationTimeoutRef.current = setTimeout(() => {
          isAnimatingRef.current = false;
        }, 380);
      } else {
        isAnimatingRef.current = false;
        try {
          flatListRef.current?.scrollToIndex({
            index: targetIndex,
            animated: false,
          });
        } catch {
          flatListRef.current?.scrollToOffset({
            offset: targetIndex * BANNER_WIDTH,
            animated: false,
          });
        }
        setActiveIndex(targetIndex);
        activeIndexRef.current = targetIndex;
        onIndexChange?.(targetIndex);
      }

      // Reset timer so the user has a full 4.5s before the next auto transition
      resetAutoSlideTimer();
    },
    [displayItems.length, resetAutoSlideTimer, onIndexChange]
  );

  // Previous banner handler with continuous circular wrapping
  const handlePrev = useCallback(() => {
    if (displayItems.length <= 1) return;
    const prevIndex = (activeIndexRef.current - 1 + displayItems.length) % displayItems.length;
    scrollToIndex(prevIndex, true);
  }, [displayItems.length, scrollToIndex]);

  // Next banner handler with continuous circular wrapping
  const handleNext = useCallback(() => {
    if (displayItems.length <= 1) return;
    const nextIndex = (activeIndexRef.current + 1) % displayItems.length;
    scrollToIndex(nextIndex, true);
  }, [displayItems.length, scrollToIndex]);

  // Dot press handler
  const handleDotPress = useCallback(
    (index: number) => {
      scrollToIndex(index, true);
    },
    [scrollToIndex]
  );

  // Initialize and clean up auto-sliding timer, respecting isActive
  useEffect(() => {
    if (isActive) {
      // Ensure banner is on the preserved slide
      if (activeIndexRef.current > 0) {
        scrollToIndex(activeIndexRef.current, false);
      }
      resetAutoSlideTimer();
    } else {
      if (autoSlideTimerRef.current) {
        clearInterval(autoSlideTimerRef.current);
        autoSlideTimerRef.current = null;
      }
    }

    return () => {
      if (autoSlideTimerRef.current) {
        clearInterval(autoSlideTimerRef.current);
        autoSlideTimerRef.current = null;
      }
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    };
  }, [isActive, resetAutoSlideTimer, scrollToIndex]);

  const handleScrollBeginDrag = useCallback(() => {
    isDraggingRef.current = true;
    isAnimatingRef.current = false;
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
    // Pause auto-slide while user is actively dragging
    if (autoSlideTimerRef.current) {
      clearInterval(autoSlideTimerRef.current);
      autoSlideTimerRef.current = null;
    }
  }, []);

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const scrollPosition = event.nativeEvent.contentOffset.x;
      const maxOffset = (displayItems.length - 1) * BANNER_WIDTH;
      if (displayItems.length > 1) {
        if (scrollPosition > maxOffset + 35) {
          scrollToIndex(0, true);
        } else if (scrollPosition < -35) {
          scrollToIndex(displayItems.length - 1, true);
        }
      }
    },
    [displayItems.length, scrollToIndex]
  );

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      isDraggingRef.current = false;
      isAnimatingRef.current = false;

      const scrollPosition = event.nativeEvent.contentOffset.x;
      let index = Math.round(scrollPosition / BANNER_WIDTH);
      if (index >= displayItems.length) {
        index = 0;
        scrollToIndex(0, false);
      } else if (index < 0) {
        index = displayItems.length - 1;
        scrollToIndex(index, false);
      } else {
        if (index !== activeIndexRef.current) {
          setActiveIndex(index);
          activeIndexRef.current = index;
        }
      }

      // Resume auto-slide timer with fresh interval
      resetAutoSlideTimer();
    },
    [displayItems.length, scrollToIndex, resetAutoSlideTimer]
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // During programmatic transition (auto-slide or arrow click), DO NOT update activeIndex
      // from onScroll rounding fluctuations. This eliminates the indicator hovering/stuttering!
      if (isAnimatingRef.current) {
        return;
      }

      const scrollPosition = event.nativeEvent.contentOffset.x;
      if (scrollPosition < 0 || scrollPosition > (displayItems.length - 1) * BANNER_WIDTH + 50) {
        return;
      }

      const index = Math.round(scrollPosition / BANNER_WIDTH);
      if (index !== activeIndexRef.current && index >= 0 && index < displayItems.length) {
        setActiveIndex(index);
        activeIndexRef.current = index;
      }
    },
    [displayItems.length]
  );

  const handlePress = useCallback(
    (
      product: Product,
      origin: 'card' | 'image' | 'button' | 'tag' | 'title' = 'card'
    ) => {
      const categoryName = (product.category || product.categoryName)?.trim();

      // 1. Tapping explicitly on the category badge always filters by that category
      if (origin === 'tag') {
        if (
          categoryName &&
          categoryName.toLowerCase() !== 'all' &&
          categoryName !== 'ShopEasy Deals'
        ) {
          if (onCategoryPress) {
            onCategoryPress(categoryName);
            return;
          }
          if (onNavigateToProducts) {
            onNavigateToProducts(categoryName);
            return;
          }
        }
      }

      // 2. Tapping "Shop Now →" navigates to the Products page filtered by the banner's category
      if (origin === 'button') {
        if (
          categoryName &&
          categoryName.toLowerCase() !== 'all' &&
          categoryName !== 'ShopEasy Deals'
        ) {
          if (onNavigateToProducts) {
            onNavigateToProducts(categoryName);
            return;
          }
          if (onCategoryPress) {
            onCategoryPress(categoryName);
            return;
          }
        }
        if (onShopNowPress) {
          onShopNowPress(product.id === 0 ? undefined : product);
          return;
        }
      }

      // 3. Tapping the product image or product title opens product details if supported
      if ((origin === 'image' || origin === 'title') && product.id > 0) {
        if (onProductPress) {
          onProductPress(product.id);
          return;
        }
      }

      // 4. Delegate to parent custom press handlers if provided
      if (origin === 'button' && onShopNowPress) {
        onShopNowPress(product.id === 0 ? undefined : product);
        return;
      }

      if (onBannerPress) {
        onBannerPress(product);
        return;
      }

      if (onShopNowPress) {
        onShopNowPress(product.id === 0 ? undefined : product);
        return;
      }

      // 5. Direct destination resolution
      const destination = resolveBannerDestination(product);
      if (!destination) {
        return;
      }

      if (destination.type === 'product') {
        onProductPress?.(destination.productId);
      } else if (destination.type === 'category') {
        if (onCategoryPress) {
          onCategoryPress(destination.category);
        } else {
          onNavigateToProducts?.(destination.category);
        }
      } else if (destination.type === 'promotion') {
        onNavigateToProducts?.(destination.category);
      }
    },
    [onCategoryPress, onNavigateToProducts, onProductPress, onShopNowPress, onBannerPress]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: BANNER_WIDTH,
      offset: BANNER_WIDTH * index,
      index,
    }),
    []
  );

  const onScrollToIndexFailed = useCallback(
    (info: {
      index: number;
      highestMeasuredFrameIndex: number;
      averageItemLength: number;
    }) => {
      flatListRef.current?.scrollToOffset({
        offset: info.index * BANNER_WIDTH,
        animated: true,
      });
    },
    []
  );

  const keyExtractor = useCallback(
    (item: Product, index: number) => `${item.id}-${item.category || index}`,
    []
  );

  const renderBannerItem = useCallback(
    ({ item }: { item: Product }) => (
      <BannerCardItem
        item={item}
        bannerWidth={BANNER_WIDTH}
        isSmall={isSmallScreen}
        themeColors={theme.colors}
        isDark={theme.isDark}
        onPress={handlePress}
      />
    ),
    [theme.colors, theme.isDark, handlePress]
  );

  return (
    <View style={styles.container}>
      {/* Outer wrapper: Centered with exact BANNER_WIDTH dimensions */}
      <View style={styles.carouselContainer}>
        {/* Viewport: Strict overflow clipping so ONLY ONE banner is visible */}
        <View style={styles.carouselViewport}>
          <FlatList
            ref={flatListRef}
            data={displayItems}
            renderItem={renderBannerItem}
            keyExtractor={keyExtractor}
            horizontal
            pagingEnabled={true}
            showsHorizontalScrollIndicator={false}
            snapToInterval={BANNER_WIDTH}
            snapToAlignment="start"
            decelerationRate="fast"
            bounces={false}
            onScroll={handleScroll}
            onScrollBeginDrag={handleScrollBeginDrag}
            onScrollEndDrag={handleScrollEndDrag}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            scrollEventThrottle={16}
            getItemLayout={getItemLayout}
            onScrollToIndexFailed={onScrollToIndexFailed}
            initialNumToRender={displayItems.length}
            maxToRenderPerBatch={displayItems.length}
            windowSize={3}
            removeClippedSubviews={false}
            style={styles.flatList}
            contentContainerStyle={styles.listContent}
          />
        </View>

        {/* Previous Button (Left Arrow) - positioned over edge without covering content */}
        <Pressable
          testID="banner-prev-btn"
          accessibilityRole="button"
          accessibilityLabel="Previous banner"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 4 }}
          style={({ pressed }) => [
            styles.arrowBtn,
            styles.prevBtn,
            {
              opacity: pressed ? 0.75 : 1,
            },
          ]}
          onPress={handlePrev}
        >
          <Icon
            name="chevron-left"
            size={18}
            color="#111827"
            strokeWidth={2.6}
          />
        </Pressable>

        {/* Next Button (Right Arrow) - positioned over edge without covering content */}
        <Pressable
          testID="banner-next-btn"
          accessibilityRole="button"
          accessibilityLabel="Next banner"
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }}
          style={({ pressed }) => [
            styles.arrowBtn,
            styles.nextBtn,
            {
              opacity: pressed ? 0.75 : 1,
            },
          ]}
          onPress={handleNext}
        >
          <Icon
            name="chevron-right"
            size={18}
            color="#111827"
            strokeWidth={2.6}
          />
        </Pressable>
      </View>

      {/* Pagination Dots */}
      {displayItems.length > 1 && (
        <View style={styles.dotsContainer} testID="banner-dots-container">
          {displayItems.map((_, index) => (
            <PaginationDot
              key={index}
              index={index}
              isActive={index === activeIndex}
              activeColor={theme.colors.primary}
              inactiveColor={theme.colors.border}
              onPress={handleDotPress}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  carouselContainer: {
    position: 'relative',
    width: BANNER_WIDTH,
    height: 180,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  carouselViewport: {
    width: BANNER_WIDTH,
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
  },
  flatList: {
    width: BANNER_WIDTH,
    height: 180,
  },
  listContent: {
    paddingHorizontal: 0,
  },
  bannerCard: {
    width: BANNER_WIDTH,
    height: 180,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  arrowBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 25,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  prevBtn: {
    left: 8,
  },
  nextBtn: {
    right: 8,
  },
  // Safe content area: 52px paddingLeft leaves an 8px clearance from prevBtn (left: 8 + width: 36 = 44px)
  contentCol: {
    flex: 1.2,
    justifyContent: 'center',
    paddingLeft: 52,
    paddingRight: 8,
  },
  dealTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
    maxWidth: '100%',
  },
  dealTagInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dealTagText: {
    fontSize: isSmallScreen ? 10 : 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  productTitle: {
    fontSize: isSmallScreen ? 14.5 : 16,
    fontWeight: '700',
    lineHeight: isSmallScreen ? 19 : 21,
    marginBottom: 4,
  },
  discountSubtitle: {
    fontSize: isSmallScreen ? 12 : 13,
    fontWeight: '600',
    marginBottom: isSmallScreen ? 8 : 10,
  },
  shopNowBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    marginTop: 2,
  },
  shopNowText: {
    fontSize: isSmallScreen ? 12 : 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  // Safe content area: 52px paddingRight leaves an 8px clearance from nextBtn (right: 8 + width: 36 = 44px)
  imageCol: {
    flex: 0.8,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 52,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    maxHeight: 135,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 5,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
  },
  dotInactive: {
    width: 6,
  },
});
