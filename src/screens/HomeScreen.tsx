import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Dimensions,
  StatusBar,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../config/queryKeys';
import { queryClient as staticQueryClient } from '../config/queryClient';
import { getProducts, getBannerProducts, getCategories } from '../services/api';
import type { Product } from '../types/product';
import { Header } from '../components/Header';
import { PromoBanner } from '../components/PromoBanner';
import { CategoryItem } from '../components/CategoryItem';
import { ProductCard } from '../components/ProductCard';
import { WhyShopEasySection } from '../components/FeatureCard';
import { resolveBannerDestination, buildCategoryBanners } from '../utils/bannerUtils';
import { useWishlist } from '../context/WishlistContext';
import { Icon } from '../components/Icon';
import { FullScreenRefreshLoader, FullPageContentLoader } from '../components/common';
import { withRandomLoadingDuration } from '../utils/loadingUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 12;
const GAP = 10;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GAP) / 2;

export interface HomeScreenSavedState {
  scrollOffset: number;
  bannerIndex: number;
  selectedCategory: string;
}

let lastHomeScreenState: HomeScreenSavedState | null = null;

export function getLastHomeScreenState(): HomeScreenSavedState | null {
  return lastHomeScreenState;
}

export function setLastHomeScreenState(state: HomeScreenSavedState | null): void {
  lastHomeScreenState = state;
}

export function clearHomeScreenState(): void {
  lastHomeScreenState = null;
}

export interface HomeScreenProps {
  isActive?: boolean;
  onNavigateToProducts?: (
    category?: string,
    search?: string,
    autoFocusSearch?: boolean
  ) => void;
  onSearchPress?: () => void;
  onNavigateToCategories?: (category?: string) => void;
  onProductPress?: (productId: number) => void;
  onCartPress?: () => void;
  onWishlistPress?: () => void;
  onAddToCart?: (product: Product) => void;
  onAccountPress?: () => void;
  cartItemCount?: number;
  notificationCount?: number;
  onNotificationsPress?: () => void;
  isLoggedIn?: boolean;
  userName?: string;
}

/**
 * Select exactly 6 featured products with maximum category diversity and zero duplicates.
 * 1. Picks no more than one product per category until all categories are represented.
 * 2. If fewer than 6 categories, fills remaining slots with different products.
 */
export function selectFeaturedProducts(allProducts: Product[], targetCount = 6): Product[] {
  if (!allProducts || allProducts.length === 0) return [];

  // Group products by category
  const categoryMap = new Map<string, Product[]>();
  for (const product of allProducts) {
    const cat = (product.category || 'General').trim();
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, []);
    }
    categoryMap.get(cat)!.push(product);
  }

  const selected: Product[] = [];
  const selectedIds = new Set<number>();
  const categories = Array.from(categoryMap.keys());

  // Pass 1: Select at most one product per category
  for (const cat of categories) {
    if (selected.length >= targetCount) break;
    const catProducts = categoryMap.get(cat)!;
    // Prefer in-stock and higher discount products
    const bestProduct =
      catProducts.find((p) => !selectedIds.has(p.id) && p.stock > 0) ||
      catProducts.find((p) => !selectedIds.has(p.id));

    if (bestProduct) {
      selected.push(bestProduct);
      selectedIds.add(bestProduct.id);
    }
  }

  // Pass 2: If fewer than targetCount, fill remaining slots with different products
  if (selected.length < targetCount) {
    const remaining = allProducts.filter((p) => !selectedIds.has(p.id));
    for (const prod of remaining) {
      if (selected.length >= targetCount) break;
      selected.push(prod);
      selectedIds.add(prod.id);
    }
  }

  return selected.slice(0, targetCount);
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  isActive = true,
  onNavigateToProducts,
  onSearchPress,
  onNavigateToCategories,
  onProductPress,
  onCartPress,
  onWishlistPress,
  onAddToCart,
  onAccountPress,
  cartItemCount = 0,
  notificationCount = 0,
  onNotificationsPress,
  isLoggedIn = false,
  userName,
}) => {
  const theme = useAppTheme();
  const { wishlistCount } = useWishlist();

  let queryClient = staticQueryClient;
  try {
    const activeClient = useQueryClient();
    if (activeClient) queryClient = activeClient;
  } catch {
    // Fall back to staticQueryClient in test environments
  }

  // State
  const [selectedCategory, setSelectedCategory] = useState<string>(
    lastHomeScreenState?.selectedCategory || 'All'
  );
  const [refreshing, setRefreshing] = useState(false);
  const [activeBannerIndex, setActiveBannerIndex] = useState<number>(
    lastHomeScreenState?.bannerIndex || 0
  );

  const flatListRef = useRef<FlatList>(null);
  const currentScrollOffsetRef = useRef<number>(lastHomeScreenState?.scrollOffset || 0);
  const isNavigatingAwayRef = useRef(false);
  const isRestoringScrollRef = useRef(false);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isActive === false || isNavigatingAwayRef.current) return;
      const y = event.nativeEvent.contentOffset.y;
      // Guard against spurious y near 0 reset events during layout transitions if previously scrolled
      if (y <= 5 && currentScrollOffsetRef.current > 50) {
        return;
      }
      isRestoringScrollRef.current = false;
      currentScrollOffsetRef.current = y;
      if (!lastHomeScreenState) {
        lastHomeScreenState = {
          scrollOffset: y,
          bannerIndex: activeBannerIndex,
          selectedCategory,
        };
      } else {
        lastHomeScreenState.scrollOffset = y;
      }
    },
    [isActive, activeBannerIndex, selectedCategory]
  );

  const restoreScrollPosition = useCallback(() => {
    const target = currentScrollOffsetRef.current || lastHomeScreenState?.scrollOffset || 0;
    if (target > 0 && flatListRef.current) {
      try {
        flatListRef.current.scrollToOffset({ offset: target, animated: false });
      } catch {
        // Layout might not be ready yet
      }
    }
  }, []);

  const prevIsActiveRef = useRef(isActive);
  useEffect(() => {
    if (prevIsActiveRef.current === false && isActive === true) {
      isNavigatingAwayRef.current = false;
      isRestoringScrollRef.current = true;
      const target = currentScrollOffsetRef.current || lastHomeScreenState?.scrollOffset || 0;
      if (target > 0 && flatListRef.current) {
        restoreScrollPosition();
        const frameId = requestAnimationFrame(() => {
          restoreScrollPosition();
        });
        const timer1 = setTimeout(() => {
          restoreScrollPosition();
        }, 50);
        const timer2 = setTimeout(() => {
          restoreScrollPosition();
          isRestoringScrollRef.current = false;
        }, 180);
        return () => {
          cancelAnimationFrame(frameId);
          clearTimeout(timer1);
          clearTimeout(timer2);
          isRestoringScrollRef.current = false;
        };
      } else {
        isRestoringScrollRef.current = false;
      }
    }
    prevIsActiveRef.current = isActive;
  }, [isActive, restoreScrollPosition]);

  // TanStack Query for Home screen overview
  const {
    data: homeData,
    isLoading: isHomeLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.homeData,
    queryFn: async () => {
      const [productsRes, bannerRes, categoriesRes] = await withRandomLoadingDuration(
        () =>
          Promise.all([
            getProducts(1, 36, 'all'),
            getBannerProducts(),
            getCategories(),
          ])
      );

      const fetchedProducts = productsRes?.products || [];
      const featured = selectFeaturedProducts(fetchedProducts, 6);

      const fetchedCategories =
        categoriesRes.length > 0
          ? categoriesRes
          : productsRes?.categories?.length > 0
            ? productsRes.categories
            : Array.from(new Set(fetchedProducts.map((p) => p.category).filter(Boolean)));

      const cleanCategories = [
        'All',
        ...fetchedCategories
          .map((c: any) => (typeof c === 'string' ? c.trim() : c?.name ? String(c.name).trim() : ''))
          .filter((c: string): c is string => Boolean(c) && c.toUpperCase() !== 'ALL'),
      ];

      // Pre-seed the public products catalog and categories caches for instant navigation
      const productsCatalogKey = queryKeys.products('all', '', 'default', 1);
      if (!queryClient.getQueryData(productsCatalogKey) && fetchedProducts.length > 0) {
        queryClient.setQueryData(productsCatalogKey, {
          products: fetchedProducts.slice(0, 8),
          total: productsRes?.total || fetchedProducts.length,
          hasMore: (productsRes?.total || fetchedProducts.length) > 8,
          page: 1,
        });
      }
      if (!queryClient.getQueryData(queryKeys.categories) && cleanCategories.length > 0) {
        queryClient.setQueryData(queryKeys.categories, cleanCategories);
      }

      const dynamicCategoryBanners = buildCategoryBanners(
        cleanCategories,
        fetchedProducts,
        bannerRes
      );

      let banners = dynamicCategoryBanners;
      if (banners.length === 0 && bannerRes.length > 0) {
        banners = bannerRes;
      } else if (banners.length === 0 && fetchedProducts.length > 0) {
        banners = [...fetchedProducts]
          .sort((a, b) => b.discount - a.discount)
          .map((p) => ({
            ...p,
            targetType: 'category' as const,
          }));
      }

      return {
        allProducts: fetchedProducts,
        featuredProducts: featured,
        categories: cleanCategories,
        bannerProducts: banners,
      };
    },
  });

  const featuredProducts = homeData?.featuredProducts || [];
  const bannerProducts = homeData?.bannerProducts || [];
  const categories = homeData?.categories || ['All'];
  const loading = isHomeLoading && !homeData;
  const error = !homeData && queryError ? (queryError as any)?.message || 'Unable to load products. Please check your network connection.' : null;

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, refetch]);

  // Handle Category selection
  const handleCategorySelect = (categoryName: string) => {
    setSelectedCategory(categoryName);
    if (!lastHomeScreenState) {
      lastHomeScreenState = {
        scrollOffset: currentScrollOffsetRef.current,
        bannerIndex: activeBannerIndex,
        selectedCategory: categoryName,
      };
    } else {
      lastHomeScreenState.selectedCategory = categoryName;
    }
    if (categoryName !== 'All') {
      isNavigatingAwayRef.current = true;
      lastHomeScreenState.scrollOffset = currentScrollOffsetRef.current;
      onNavigateToProducts?.(categoryName);
    }
  };

  // Handle product press on home screen (Flow A)
  const handleProductCardPress = useCallback(
    (productId: number) => {
      isNavigatingAwayRef.current = true;
      if (!lastHomeScreenState) {
        lastHomeScreenState = {
          scrollOffset: currentScrollOffsetRef.current,
          bannerIndex: activeBannerIndex,
          selectedCategory,
        };
      } else {
        lastHomeScreenState.scrollOffset = currentScrollOffsetRef.current;
        lastHomeScreenState.bannerIndex = activeBannerIndex;
      }
      onProductPress?.(productId);
    },
    [activeBannerIndex, selectedCategory, onProductPress]
  );

  // Handle banner navigation based on banner destination type (Flow B)
  const handleBannerPress = useCallback(
    (product?: Product) => {
      isNavigatingAwayRef.current = true;
      if (!lastHomeScreenState) {
        lastHomeScreenState = {
          scrollOffset: currentScrollOffsetRef.current,
          bannerIndex: activeBannerIndex,
          selectedCategory,
        };
      } else {
        lastHomeScreenState.scrollOffset = currentScrollOffsetRef.current;
        lastHomeScreenState.bannerIndex = activeBannerIndex;
      }

      if (!product) {
        onNavigateToProducts?.();
        return;
      }

      const destination = resolveBannerDestination(product);
      if (!destination) {
        // Requirement 9: Gracefully handle banners with no valid destination
        return;
      }

      if (destination.type === 'product') {
        onProductPress?.(destination.productId);
      } else if (destination.type === 'category') {
        onNavigateToProducts?.(destination.category);
      } else if (destination.type === 'promotion') {
        onNavigateToProducts?.(destination.category);
      }
    },
    [activeBannerIndex, selectedCategory, onNavigateToProducts, onProductPress]
  );

  // Header Component for FlatList
  const renderListHeader = () => (
    <View style={styles.listHeaderContainer}>
      {/* Promotional Banner */}
      <PromoBanner
        products={bannerProducts}
        isActive={isActive}
        initialIndex={activeBannerIndex}
        onIndexChange={(idx) => {
          setActiveBannerIndex(idx);
          if (lastHomeScreenState) {
            lastHomeScreenState.bannerIndex = idx;
          }
        }}
        onBannerPress={handleBannerPress}
        onShopNowPress={handleBannerPress}
        onProductPress={handleProductCardPress}
        onCategoryPress={handleCategorySelect}
        onNavigateToProducts={onNavigateToProducts}
      />

      {/* Categories Horizontal Section */}
      <View style={styles.categoriesSection}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
            Categories
          </Text>
          <Pressable
            onPress={() => {
              isNavigatingAwayRef.current = true;
              if (lastHomeScreenState) {
                lastHomeScreenState.scrollOffset = currentScrollOffsetRef.current;
              }
              onNavigateToCategories?.();
            }}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <Text
              style={[styles.sectionCountBadge, { color: theme.colors.accent }]}
            >
              Explore All →
            </Text>
          </Pressable>
        </View>

        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) =>
            typeof item === 'string' && item ? `cat-home-${item}` : `cat-home-${index}`
          }
          contentContainerStyle={styles.categoriesListContent}
          renderItem={({ item }) => (
            <CategoryItem
              name={item}
              isSelected={selectedCategory === item}
              onSelect={handleCategorySelect}
            />
          )}
        />
      </View>

      {/* Featured Products Heading */}
      <View style={styles.productsSectionHeader}>
        <View style={styles.productsTitleGroup}>
          <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
            Featured Products
          </Text>
          <Text
            style={[
              styles.sectionSubheading,
              { color: theme.colors.textSecondary },
            ]}
          >
            Handpicked top products across categories
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all products"
          style={({ pressed }) => [
            styles.viewAllBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={() => {
            isNavigatingAwayRef.current = true;
            if (lastHomeScreenState) {
              lastHomeScreenState.scrollOffset = currentScrollOffsetRef.current;
            }
            onNavigateToProducts?.();
          }}
        >
          <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>
            View All →
          </Text>
        </Pressable>
      </View>
    </View>
  );

  // Footer Component for FlatList
  const renderListFooter = () => (
    <View style={styles.listFooterContainer}>
      <WhyShopEasySection />
      <View style={styles.bottomSpacer} />
    </View>
  );

  // Empty State when no featured products are available
  const renderEmptyState = () => (
    <View
      style={[
        styles.emptyContainer,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.borderLight },
      ]}
    >
      <View style={{ marginBottom: 12 }}>
        <Icon name="package" size={48} color={theme.colors.textMuted} strokeWidth={1.7} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
        No featured products available
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
        Products could not be loaded at this time. Please check your connection or retry.
      </Text>
      <Pressable
        style={[styles.resetFilterBtn, { backgroundColor: theme.colors.primary }]}
        onPress={() => refetch()}
      >
        <Text
          style={[
            styles.resetFilterText,
            { color: theme.colors.primaryText },
          ]}
        >
          Reload Products
        </Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[
        styles.safeArea,
        { backgroundColor: theme.colors.background },
      ]}
    >

      {/* Top Header with exact order: Search -> Wishlist -> Profile */}
      <Header
        onSearchPress={() => {
          isNavigatingAwayRef.current = true;
          if (lastHomeScreenState) {
            lastHomeScreenState.scrollOffset = currentScrollOffsetRef.current;
          }
          if (onSearchPress) {
            onSearchPress();
          } else if (onNavigateToProducts) {
            onNavigateToProducts(undefined, undefined, true);
          }
        }}
        onWishlistPress={onWishlistPress}
        onCartPress={onCartPress}
        onAccountPress={onAccountPress}
        isLoggedIn={isLoggedIn}
        userName={userName}
        cartItemCount={cartItemCount}
        wishlistItemCount={wishlistCount}
        notificationCount={notificationCount}
        onNotificationsPress={onNotificationsPress}
      />

      {/* Main Content Area */}
      {loading ? (
        <FullPageContentLoader message="Loading Home..." />
      ) : error ? (
        <View style={styles.centerContainer}>
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.borderLight,
              },
            ]}
          >
            <View style={{ marginBottom: 12 }}>
              <Icon name="alert-triangle" size={44} color={theme.colors.danger} strokeWidth={2} />
            </View>
            <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
              Unable to load products
            </Text>
            <Text
              style={[
                styles.errorMessage,
                { color: theme.colors.textSecondary },
              ]}
            >
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading Products"
              style={({ pressed }) => [
                styles.retryBtn,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={() => refetch()}
            >
              <Text
                style={[
                  styles.retryBtnText,
                  { color: theme.colors.primaryText },
                ]}
              >
                Retry
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.contentWrapper}>
          <FlatList
            ref={flatListRef}
            data={featuredProducts}
            keyExtractor={(item) => `featured-${item.id}`}
            numColumns={2}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.columnWrapper}
            ListHeaderComponent={renderListHeader}
            ListFooterComponent={renderListFooter}
            ListEmptyComponent={renderEmptyState}
            renderItem={({ item }) => (
              <ProductCard
                product={item}
                cardWidth={CARD_WIDTH}
                onPress={(p) => handleProductCardPress(p.id)}
                onAddToCart={onAddToCart}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['transparent']}
                tintColor="transparent"
                progressBackgroundColor="transparent"
              />
            }
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={(w, h) => {
              const target = currentScrollOffsetRef.current || lastHomeScreenState?.scrollOffset || 0;
              if (target > 0 && h > target) {
                restoreScrollPosition();
              }
            }}
            onLayout={() => {
              const target = currentScrollOffsetRef.current || lastHomeScreenState?.scrollOffset || 0;
              if (target > 0) {
                restoreScrollPosition();
              }
            }}
          />
          {refreshing && (
            <FullPageContentLoader
              message="Loading Home..."
              overlay
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
    position: 'relative',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '500',
  },
  errorCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    maxWidth: 340,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  errorIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 18,
  },
  retryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 10,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  gridContent: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  listHeaderContainer: {
    paddingBottom: 10,
  },
  categoriesSection: {
    marginBottom: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  categoriesListContent: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  productsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  productsTitleGroup: {
    flex: 1,
    marginRight: 8,
  },
  viewAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionSubheading: {
    fontSize: 12,
    marginTop: 3,
  },
  sectionCountBadge: {
    fontSize: 13,
    fontWeight: '700',
  },
  listFooterContainer: {
    marginTop: 16,
  },
  bottomSpacer: {
    height: 48,
  },
  emptyContainer: {
    padding: 30,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginVertical: 20,
    marginHorizontal: 4,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  resetFilterBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 8,
  },
  resetFilterText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
