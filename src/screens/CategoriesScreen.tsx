import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  RefreshControl,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/theme';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../config/queryKeys';
import { getCategories, getProducts } from '../services/api';
import { resolveImageUrl, FALLBACK_PRODUCT_IMAGE } from '../config/api';
import { calculateFinalPrice, formatPrice } from '../utils/price';
import type { Product } from '../types/product';
import { useWishlist } from '../context/WishlistContext';
import { Icon, IconName } from '../components/Icon';
import { FullPageContentLoader, FullScreenRefreshLoader } from '../components/common';
import { withRandomLoadingDuration } from '../utils/loadingUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LEFT_NAV_WIDTH = 92;

export interface CategoriesScreenProps {
  isActive?: boolean;
  initialCategory?: string;
  onSelectCategory?: (category: string) => void;
  onProductPress?: (productId: number) => void;
  onNavigateToProducts?: (category?: string) => void;
  onCartPress?: () => void;
  onWishlistPress?: () => void;
  onSearchPress?: () => void;
  cartItemCount?: number;
}

const CATEGORY_ICONS: Record<string, IconName> = {
  'for-you': 'sparkles',
  Electronics: 'laptop',
  Clothing: 'shirt',
  Footwear: 'shoe',
  Bags: 'bag',
  Accessories: 'gem',
  Beauty: 'flower',
  Books: 'book',
  'Home & Kitchen': 'utensils',
  Sports: 'activity',
  Toys: 'gamepad',
  Mobiles: 'phone',
  Fashion: 'shirt',
};

function getCategoryIcon(name: string): IconName {
  if (CATEGORY_ICONS[name]) return CATEGORY_ICONS[name];
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key.toLowerCase())) return icon;
  }
  return 'tag';
}

export const CategoriesScreen: React.FC<CategoriesScreenProps> = ({
  isActive = true,
  initialCategory,
  onProductPress,
  onNavigateToProducts,
  onCartPress,
  onWishlistPress,
  onSearchPress,
  cartItemCount = 0,
}) => {
  const theme = useAppTheme();
  const { wishlistCount } = useWishlist();

  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string>(
    initialCategory || 'for-you'
  );
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const rightListRef = useRef<FlatList>(null);
  const currentScrollOffsetRef = useRef(0);
  const isNavigatingAwayRef = useRef(false);
  const isRestoringScrollRef = useRef(false);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isActive === false || isNavigatingAwayRef.current || isRestoringScrollRef.current) return;
      const y = event.nativeEvent.contentOffset.y;
      if (y === 0 && currentScrollOffsetRef.current > 60) return;
      currentScrollOffsetRef.current = y;
    },
    [isActive]
  );

  const restoreScrollPosition = useCallback(() => {
    const target = currentScrollOffsetRef.current;
    if (target > 0 && rightListRef.current) {
      try {
        rightListRef.current.scrollToOffset({ offset: target, animated: false });
      } catch {
        // Layout not ready
      }
    }
  }, []);

  const prevIsActiveRef = useRef(isActive);
  useEffect(() => {
    if (prevIsActiveRef.current === false && isActive === true) {
      isNavigatingAwayRef.current = false;
      isRestoringScrollRef.current = true;
      const target = currentScrollOffsetRef.current;
      if (target > 0 && rightListRef.current) {
        restoreScrollPosition();
        const rAF = requestAnimationFrame(() => restoreScrollPosition());
        const t1 = setTimeout(() => restoreScrollPosition(), 50);
        const t2 = setTimeout(() => {
          restoreScrollPosition();
          isRestoringScrollRef.current = false;
        }, 180);
        return () => {
          cancelAnimationFrame(rAF);
          clearTimeout(t1);
          clearTimeout(t2);
          isRestoringScrollRef.current = false;
        };
      } else {
        isRestoringScrollRef.current = false;
      }
    }
    prevIsActiveRef.current = isActive;
  }, [isActive, restoreScrollPosition]);

  // TanStack Query for categories list
  const {
    data: categoriesData,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () => {
      const catList = await getCategories();
      return catList.filter((c) => c && c !== 'All');
    },
  });

  const categories = categoriesData || [];

  // TanStack Query for products in the selected category
  const {
    data: activeCategoryProducts,
    isLoading: loadingProducts,
    refetch: refetchCategoryProducts,
  } = useQuery({
    queryKey: queryKeys.categoryProducts(selectedCategoryKey),
    queryFn: async () => {
      return await withRandomLoadingDuration(async () => {
        if (selectedCategoryKey === 'for-you') {
          const res = await getProducts(1, 30, 'all');
          const byCategory = new Map<string, Product[]>();
          for (const p of res.products) {
            const c = p.category || 'General';
            if (!byCategory.has(c)) byCategory.set(c, []);
            byCategory.get(c)!.push(p);
          }

          const diverse: Product[] = [];
          const seen = new Set<number>();
          for (const [_, list] of byCategory.entries()) {
            if (list.length > 0 && !seen.has(list[0].id)) {
              diverse.push(list[0]);
              seen.add(list[0].id);
            }
          }
          for (const [_, list] of byCategory.entries()) {
            if (list.length > 1 && !seen.has(list[1].id)) {
              diverse.push(list[1]);
              seen.add(list[1].id);
            }
          }
          for (const p of res.products) {
            if (!seen.has(p.id)) {
              diverse.push(p);
              seen.add(p.id);
            }
          }
          return diverse;
        } else {
          const res = await getProducts(1, 24, selectedCategoryKey);
          return res.products || [];
        }
      });
    },
  });

  const activeProducts = activeCategoryProducts || [];

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([refetchCategories(), refetchCategoryProducts()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, refetchCategories, refetchCategoryProducts]);

  const selectedCategoryTitle =
    selectedCategoryKey === 'for-you' ? 'Popular For You' : selectedCategoryKey;

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      {/* Screen Header Bar */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: theme.colors.card,
            borderBottomColor: theme.colors.borderLight,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          All Categories
        </Text>

        <View style={styles.headerRightActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search products"
            style={({ pressed }) => [
              styles.headerActionBtn,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={onSearchPress}
          >
            <Icon name="search" size={20} color={theme.colors.text} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Saved wishlist"
            style={({ pressed }) => [
              styles.headerActionBtn,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={onWishlistPress}
          >
            <Icon
              name={wishlistCount > 0 ? 'heart-filled' : 'heart'}
              size={19}
              color={
                wishlistCount > 0
                  ? '#EF4444'
                  : theme.isDark
                    ? '#FFFFFF'
                    : theme.colors.text
              }
              strokeWidth={2.2}
            />
            {wishlistCount > 0 && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: theme.colors.accent },
                ]}
              >
                <Text style={styles.badgeText}>
                  {wishlistCount > 99 ? '99+' : wishlistCount}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Shopping cart"
            style={({ pressed }) => [
              styles.headerActionBtn,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={onCartPress}
          >
            <Icon name="cart" size={20} color={theme.colors.text} />
            {cartItemCount > 0 && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: theme.colors.danger },
                ]}
              >
                <Text style={styles.badgeText}>
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Split Navigation Layout (Left Sidebar + Right Product Grid) */}
      <View style={styles.bodySplitLayout}>
        {/* Left Side: Vertically Scrollable Category Menu */}
        <View
          style={[
            styles.leftSidebar,
            {
              backgroundColor: theme.colors.card,
              borderRightColor: theme.colors.borderLight,
            },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sidebarContent}
          >
            {/* 1. For You item */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="For You categories"
              style={[
                styles.categoryNavItem,
                selectedCategoryKey === 'for-you' && [
                  styles.categoryNavItemActive,
                  { backgroundColor: theme.colors.surfaceSubtle },
                ],
              ]}
              onPress={() => setSelectedCategoryKey('for-you')}
            >
              {selectedCategoryKey === 'for-you' && (
                <View style={styles.activeSideIndicator} />
              )}
              <View
                style={[
                  styles.categoryIconCircle,
                  {
                    backgroundColor:
                      selectedCategoryKey === 'for-you'
                        ? (theme.isDark ? '#262626' : '#E5E5E5')
                        : theme.colors.surfaceSubtle,
                  },
                ]}
              >
                <Icon
                  name="sparkles"
                  size={22}
                  color={
                    selectedCategoryKey === 'for-you'
                      ? theme.colors.primary
                      : theme.colors.textSecondary
                  }
                />
              </View>
              <Text
                style={[
                  styles.categoryNavLabel,
                  {
                    color:
                      selectedCategoryKey === 'for-you'
                        ? theme.colors.primary
                        : theme.colors.textSecondary,
                    fontWeight:
                      selectedCategoryKey === 'for-you' ? '800' : '500',
                  },
                ]}
                numberOfLines={2}
              >
                For You
              </Text>
            </Pressable>

            {/* Dynamic Category Items */}
            {categories.map((catName) => {
              const isActive = selectedCategoryKey === catName;
              const icon = getCategoryIcon(catName);

              return (
                <Pressable
                  key={`cat-nav-${catName}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${catName} category`}
                  style={[
                    styles.categoryNavItem,
                    isActive && [
                      styles.categoryNavItemActive,
                      { backgroundColor: theme.colors.surfaceSubtle },
                    ],
                  ]}
                  onPress={() => setSelectedCategoryKey(catName)}
                >
                  {isActive && <View style={[styles.activeSideIndicator, { backgroundColor: theme.colors.primary }]} />}
                  <View
                    style={[
                      styles.categoryIconCircle,
                      {
                        backgroundColor: isActive
                          ? (theme.isDark ? '#262626' : '#E5E5E5')
                          : theme.colors.surfaceSubtle,
                      },
                    ]}
                  >
                    <Icon
                      name={icon}
                      size={22}
                      color={isActive ? theme.colors.primary : theme.colors.textSecondary}
                    />
                  </View>
                  <Text
                    style={[
                      styles.categoryNavLabel,
                      {
                        color: isActive ? theme.colors.primary : theme.colors.textSecondary,
                        fontWeight: isActive ? '800' : '500',
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {catName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Right Side: Selected Category's Products */}
        <View style={styles.rightContentArea}>
          {/* Header Bar for Category */}
          <View
            style={[
              styles.rightHeaderBar,
              {
                backgroundColor: theme.colors.card,
                borderBottomColor: theme.colors.borderLight,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.rightCategoryTitle, { color: theme.colors.text }]}
                numberOfLines={1}
              >
                {selectedCategoryTitle}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View all ${selectedCategoryTitle}`}
              style={({ pressed }) => [
                styles.viewAllCategoryBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() =>
                onNavigateToProducts?.(
                  selectedCategoryKey !== 'for-you'
                    ? selectedCategoryKey
                    : undefined
                )
              }
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.viewAllCategoryText, { color: theme.colors.primary }]}>View All</Text>
                <Icon name="chevron-right" size={14} color={theme.colors.primary} strokeWidth={2.5} />
              </View>
            </Pressable>
          </View>

          {/* Product Items Grid */}
          {loadingProducts && activeProducts.length === 0 ? (
            <FullPageContentLoader
              message={`Loading ${selectedCategoryTitle}...`}
            />
          ) : activeProducts.length === 0 ? (
            <View style={styles.centerContainer}>
              <View style={{ marginBottom: 12 }}>
                <Icon name="package" size={44} color={theme.colors.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                No products found
              </Text>
              <Text
                style={[
                  styles.emptySubtitle,
                  { color: theme.colors.textSecondary },
                ]}
              >
                No products are currently available in this category.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={rightListRef}
              data={activeProducts}
              keyExtractor={(item) => `cat-prod-${item.id}`}
              numColumns={2}
              contentContainerStyle={styles.rightGridContent}
              columnWrapperStyle={styles.rightColumnWrapper}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={['transparent']}
                  tintColor="transparent"
                  progressBackgroundColor="transparent"
                />
              }
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onContentSizeChange={(w, h) => {
                if (currentScrollOffsetRef.current > 0 && h > currentScrollOffsetRef.current) {
                  restoreScrollPosition();
                }
              }}
              onLayout={() => {
                if (currentScrollOffsetRef.current > 0) {
                  restoreScrollPosition();
                }
              }}
              renderItem={({ item }) => {
                const finalPrice = calculateFinalPrice(item.price, item.discount);
                const imgUri = resolveImageUrl(item.image);

                return (
                  <Pressable
                    style={[
                      styles.compactProductCard,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.borderLight,
                      },
                    ]}
                    onPress={() => {
                      isNavigatingAwayRef.current = true;
                      onProductPress?.(item.id);
                    }}
                  >
                    <View
                      style={[
                        styles.compactImgBox,
                        { backgroundColor: theme.colors.surfaceSubtle },
                      ]}
                    >
                      <Image
                        source={{ uri: imgUri || FALLBACK_PRODUCT_IMAGE }}
                        style={styles.compactImg}
                        resizeMode="contain"
                      />
                      {item.discount > 0 && (
                        <View style={styles.compactDiscountBadge}>
                          <Text style={styles.compactDiscountText}>
                            {item.discount}%
                          </Text>
                        </View>
                      )}

                      {/* Rating Badge at Bottom-Left of Image */}
                      {typeof item.averageRating === 'number' && item.averageRating > 0 && (
                        <View
                          style={[
                            styles.compactRatingBadge,
                            {
                              backgroundColor: theme.isDark
                                ? 'rgba(24, 24, 27, 0.88)'
                                : 'rgba(255, 255, 255, 0.92)',
                              borderColor: theme.isDark
                                ? 'rgba(255, 255, 255, 0.15)'
                                : 'rgba(0, 0, 0, 0.08)',
                            },
                          ]}
                        >
                          <Icon name="star-filled" size={9} color="#F59E0B" fill="#F59E0B" />
                          <Text
                            style={[
                              styles.compactRatingText,
                              { color: theme.colors.text },
                            ]}
                          >
                            {item.averageRating.toFixed(1)}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.compactInfo}>
                      <Text
                        style={[
                          styles.compactName,
                          { color: theme.colors.text },
                        ]}
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                      <View style={styles.compactPriceRow}>
                        <Text
                          style={[
                            styles.compactPrice,
                            { color: theme.colors.text },
                          ]}
                        >
                          {formatPrice(finalPrice)}
                        </Text>
                        {item.discount > 0 && (
                          <Text
                            style={[
                              styles.compactOldPrice,
                              { color: theme.colors.textMuted },
                            ]}
                          >
                            {formatPrice(item.price)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerActionIcon: {
    fontSize: 17,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  bodySplitLayout: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  leftSidebar: {
    width: LEFT_NAV_WIDTH,
    borderRightWidth: 1,
  },
  sidebarContent: {
    paddingVertical: 8,
  },
  categoryNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    position: 'relative',
  },
  categoryNavItemActive: {
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  activeSideIndicator: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 4,
    backgroundColor: '#000000',
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  categoryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryNavIcon: {
    fontSize: 20,
  },
  categoryNavLabel: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  rightContentArea: {
    flex: 1,
  },
  rightHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  rightCategoryTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  rightCategorySubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  viewAllCategoryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewAllCategoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  rightGridContent: {
    padding: 8,
    paddingBottom: 24,
  },
  rightColumnWrapper: {
    justifyContent: 'space-between',
  },
  compactProductCard: {
    flex: 1,
    margin: 4,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    maxWidth: (SCREEN_WIDTH - LEFT_NAV_WIDTH - 24) / 2,
  },
  compactImgBox: {
    height: 100,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    padding: 6,
  },
  compactImg: {
    width: '100%',
    height: '100%',
  },
  compactDiscountBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  compactDiscountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  compactInfo: {
    padding: 8,
  },
  compactRatingBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  compactRatingText: {
    fontSize: 9,
    fontWeight: '700',
  },
  compactName: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    minHeight: 30,
    marginBottom: 4,
  },
  compactPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  compactPrice: {
    fontSize: 13,
    fontWeight: '800',
  },
  compactOldPrice: {
    fontSize: 10,
    textDecorationLine: 'line-through',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '500',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
