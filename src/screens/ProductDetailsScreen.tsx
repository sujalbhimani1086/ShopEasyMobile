import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  StatusBar,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/theme';
import { useFeedback } from '../context/FeedbackContext';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../config/queryKeys';
import { getProductById } from '../services/api';
import { resolveImageUrl, FALLBACK_PRODUCT_IMAGE } from '../config/api';
import { calculateFinalPrice, formatPrice } from '../utils/price';
import type { Product } from '../types/product';
import { Icon } from '../components/Icon';
import { useWishlist } from '../context/WishlistContext';
import { HeartBounce, BadgeBounce, ScalePressable, FadeInView } from '../components/animated';
import { FullPageContentLoader } from '../components/common';
import { withRandomLoadingDuration } from '../utils/loadingUtils';

export interface ProductDetailsScreenProps {
  productId: number;
  onBack: () => void;
  onAddToCart?: (product: Product) => void;
  onToggleWishlist?: (product: Product) => void;
  onCartPress?: () => void;
  cartItemCount?: number;
}

/**
 * Formats review counts cleanly (e.g. 1700 -> '1.7K+', 25 -> '25')
 */
export function formatReviewCount(count?: number | null): string {
  if (typeof count !== 'number' || count <= 0) return '';
  if (count >= 1000000) {
    const val = (count / 1000000).toFixed(1).replace(/\.0$/, '');
    return `${val}M+`;
  }
  if (count >= 1000) {
    const val = (count / 1000).toFixed(1).replace(/\.0$/, '');
    return `${val}K+`;
  }
  return String(count);
}

export const ProductDetailsScreen: React.FC<ProductDetailsScreenProps> = ({
  productId,
  onBack,
  onAddToCart,
  onToggleWishlist,
  onCartPress,
  cartItemCount = 0,
}) => {
  const theme = useAppTheme();
  const { isWishlisted: checkWishlist, toggleWishlist } = useWishlist();

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);

  // TanStack Query for product details
  const {
    data: productData,
    isLoading: isProductLoading,
    error: productError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.product(productId),
    queryFn: async () => {
      const data = await withRandomLoadingDuration(() => getProductById(productId));
      if (!data) {
        throw new Error('Product not found');
      }
      return data;
    },
  });

  const product = productData || null;
  const loading = isProductLoading && !productData;
  const error = !productData && productError ? (productError as any)?.message || 'Unable to load product.' : null;

  const isWishlisted = Boolean(product && checkWishlist(product.id));

  let insetsTop = 0;
  try {
    const insets = useSafeAreaInsets();
    insetsTop = insets?.top || 0;
  } catch {
    insetsTop = 0;
  }

  useEffect(() => {
    if (Platform.OS === 'android') {
      (StatusBar as any).setBackgroundColor?.('#000000');
    }
  }, []);

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Wishlist Action
  const handleWishlistToggle = () => {
    if (!product) return;
    toggleWishlist(product).catch((err) => {
      console.warn('ProductDetailsScreen: Wishlist toggle failed:', err);
    });
    if (onToggleWishlist) {
      onToggleWishlist(product);
    }
  };

  const feedback = useFeedback();

  // Add to Cart Action
  const handleAddToCart = () => {
    if (!product || product.stock <= 0) return;
    if (onAddToCart) {
      onAddToCart(product);
    } else {
      feedback.toast.success(`${product.name} added to cart`);
    }
  };

  // Loading State
  if (loading) {
    return (
      <SafeAreaView
        edges={['bottom', 'left', 'right']}
        style={[
          styles.safeArea,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <StatusBar barStyle="light-content" />
        {insetsTop > 0 && <View style={[styles.safeAreaFiller, { height: insetsTop }]} />}

        {/* Header with back button */}
        <View style={styles.headerBar}>
          <View style={styles.headerLeftGroup}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back to products"
              style={({ pressed }) => [
                styles.headerBackBtn,
                { opacity: pressed ? 0.75 : 1 },
              ]}
              onPress={onBack}
            >
              <Icon name="arrow-left" size={20} color="#FFFFFF" strokeWidth={2.2} />
            </Pressable>
          </View>

          <View style={styles.headerBrandContainer}>
            <Image
              source={require('../assets/logos/1logo-white.png')}
              style={styles.logoImage}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="ShopEasy"
            />
          </View>

          <View style={styles.headerRightPlaceholder} />
        </View>

        <FullPageContentLoader message="Loading product details..." />
      </SafeAreaView>
    );
  }

  // Error / Not Found State
  if (error || !product) {
    return (
      <SafeAreaView
        edges={['bottom', 'left', 'right']}
        style={[
          styles.safeArea,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <StatusBar barStyle="light-content" />
        {insetsTop > 0 && <View style={[styles.safeAreaFiller, { height: insetsTop }]} />}

        <View style={styles.headerBar}>
          <View style={styles.headerLeftGroup}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back to products"
              style={({ pressed }) => [
                styles.headerBackBtn,
                { opacity: pressed ? 0.75 : 1 },
              ]}
              onPress={onBack}
            >
              <Icon name="arrow-left" size={20} color="#FFFFFF" strokeWidth={2.2} />
            </Pressable>
          </View>

          <View style={styles.headerBrandContainer}>
            <Image
              source={require('../assets/logos/1logo-white.png')}
              style={styles.logoImage}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="ShopEasy"
            />
          </View>

          <View style={styles.headerRightPlaceholder} />
        </View>

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
              <Icon name="search" size={44} color={theme.colors.textMuted} />
            </View>
            <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
              Product not found
            </Text>
            <Text
              style={[
                styles.errorSubtitle,
                { color: theme.colors.textSecondary },
              ]}
            >
              {error === 'Product not found'
                ? 'This product could not be located in the catalogue or may have been removed.'
                : error || 'Unable to load product information.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back to products"
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={onBack}
            >
              <Text
                style={[
                  styles.primaryBtnText,
                  { color: theme.colors.primaryText },
                ]}
              >
                Go Back
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Calculated values
  const finalPrice = calculateFinalPrice(product.price, product.discount);
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;
  const imageUri = imageError
    ? FALLBACK_PRODUCT_IMAGE
    : resolveImageUrl(product.image);

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[
        styles.safeArea,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <StatusBar barStyle="light-content" />
      {insetsTop > 0 && <View style={[styles.safeAreaFiller, { height: insetsTop }]} />}

      {/* Screen Header - Permanently Pure Black #000000 with official white logo */}
      <View style={styles.headerBar}>
        {/* Back Button */}
        <View style={styles.headerLeftGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back to products"
            style={({ pressed }) => [
              styles.headerBackBtn,
              { opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={onBack}
          >
            <Icon name="arrow-left" size={20} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* Center Official Brand Logo */}
        <View style={styles.headerBrandContainer}>
          <Image
            source={require('../assets/logos/1logo-white.png')}
            style={styles.logoImage}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="ShopEasy"
          />
        </View>

        {/* Right Header Actions (Wishlist & Cart) */}
        <View style={styles.headerRightActions}>
          {/* Wishlist Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            style={({ pressed }) => [
              styles.headerActionBtn,
              { opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={handleWishlistToggle}
          >
            <HeartBounce isFilled={isWishlisted}>
              <Icon
                name={isWishlisted ? 'heart-filled' : 'heart'}
                size={19}
                color={isWishlisted ? '#EF4444' : '#FFFFFF'}
                strokeWidth={2.2}
              />
            </HeartBounce>
          </Pressable>

          {/* Cart Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Shopping cart"
            style={({ pressed }) => [
              styles.headerActionBtn,
              { opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={onCartPress}
          >
            <Icon name="cart" size={19} color="#FFFFFF" strokeWidth={2.2} />
            {cartItemCount > 0 && (
              <BadgeBounce count={cartItemCount} style={styles.headerBadgeWrapper}>
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </Text>
                </View>
              </BadgeBounce>
            )}
          </Pressable>
        </View>
      </View>

      {/* Scrollable Product Details Content */}
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['transparent']}
              tintColor="transparent"
              progressBackgroundColor="transparent"
            />
          }
        >
        {/* Large Product Image Container */}
        <View
          style={[
            styles.imageContainer,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.borderLight,
            },
          ]}
        >
          <Image
            source={{ uri: imageUri }}
            style={styles.productImage}
            resizeMode="contain"
            onError={() => setImageError(true)}
          />

          {/* Discount Badge on Image */}
          {product.discount > 0 && (
            <View
              style={[
                styles.imageDiscountBadge,
                { backgroundColor: theme.colors.badgeBg },
              ]}
            >
              <Text
                style={[
                  styles.imageDiscountText,
                  { color: theme.colors.badgeText },
                ]}
              >
                {product.discount}% OFF
              </Text>
            </View>
          )}

          {/* Numerical Rating & Review Count Badge at bottom-left */}
          {typeof product.averageRating === 'number' && product.averageRating > 0 && (
            <View
              style={[
                styles.imageRatingBadge,
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
              <Icon name="star-filled" size={12} color="#F59E0B" fill="#F59E0B" />
              <Text
                style={[
                  styles.imageRatingText,
                  { color: theme.colors.text },
                ]}
              >
                {product.averageRating.toFixed(1)}
              </Text>
              {typeof product.reviewCount === 'number' && product.reviewCount > 0 ? (
                <>
                  <Text
                    style={[
                      styles.imageRatingDivider,
                      { color: theme.isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.25)' },
                    ]}
                  >
                    |
                  </Text>
                  <Text
                    style={[
                      styles.imageReviewCountText,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    {formatReviewCount(product.reviewCount)}
                  </Text>
                </>
              ) : null}
            </View>
          )}
        </View>

        {/* Product Details Section */}
        <View
          style={[
            styles.detailsCard,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.borderLight,
            },
          ]}
        >
          {/* Category Chip */}
          {product.category ? (
            <View
              style={[
                styles.categoryChip,
                { backgroundColor: theme.colors.surfaceSubtle },
              ]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {product.category}
              </Text>
            </View>
          ) : null}

          {/* Product Name */}
          <Text style={[styles.productName, { color: theme.colors.text }]}>
            {product.name}
          </Text>

          {/* Price & Discount Row */}
          <View style={styles.priceContainer}>
            <View style={styles.priceRow}>
              <Text
                style={[styles.currentPrice, { color: theme.colors.text }]}
              >
                {formatPrice(finalPrice)}
              </Text>

              {product.discount > 0 && (
                <Text
                  style={[
                    styles.originalPrice,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  {formatPrice(product.price)}
                </Text>
              )}
            </View>

            {product.discount > 0 && (
              <View
                style={[
                  styles.saveBadge,
                  { backgroundColor: theme.colors.successBg },
                ]}
              >
                <Text
                  style={[
                    styles.saveBadgeText,
                    { color: theme.colors.success },
                  ]}
                >
                  Save {product.discount}%
                </Text>
              </View>
            )}
          </View>

          {/* Stock Availability Badge */}
          <View style={styles.stockSection}>
            <View
              style={[
                styles.stockBadge,
                {
                  backgroundColor: isOutOfStock
                    ? theme.colors.dangerBg
                    : isLowStock
                    ? 'rgba(245, 158, 11, 0.15)'
                    : theme.colors.successBg,
                },
              ]}
            >
              <View
                style={[
                  styles.stockDot,
                  {
                    backgroundColor: isOutOfStock
                      ? theme.colors.danger
                      : isLowStock
                      ? theme.colors.accent
                      : theme.colors.success,
                  },
                ]}
              />
              <Text
                style={[
                  styles.stockBadgeText,
                  {
                    color: isOutOfStock
                      ? theme.colors.danger
                      : isLowStock
                      ? theme.colors.accent
                      : theme.colors.success,
                  },
                ]}
              >
                {isOutOfStock
                  ? 'Out of Stock'
                  : isLowStock
                  ? `Only ${product.stock} left in stock`
                  : 'In Stock'}
              </Text>
            </View>
          </View>
        </View>

        {/* Extra Bottom Spacing for Sticky Footer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
      {refreshing && (
        <FullPageContentLoader
          message="Loading product details..."
          overlay
        />
      )}
    </View>

      {/* Bottom Sticky Action Bar: Prominent Add to Cart Button */}
      <View
        style={[
          styles.bottomActionBar,
          {
            backgroundColor: theme.colors.card,
            borderTopColor: theme.colors.borderLight,
          },
        ]}
      >
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel={
            isOutOfStock ? 'Product is out of stock' : `Add ${product.name} to cart`
          }
          accessibilityState={{ disabled: isOutOfStock }}
          disabled={isOutOfStock}
          style={[
            styles.addToCartButton,
            {
              backgroundColor: isOutOfStock
                ? theme.colors.border
                : theme.colors.primary,
            },
          ]}
          activeScale={0.96}
          onPress={handleAddToCart}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {!isOutOfStock && (
              <Icon name="cart" size={18} color={theme.colors.primaryText} />
            )}
            <Text
              style={[
                styles.addToCartButtonText,
                {
                  color: isOutOfStock
                    ? theme.colors.textMuted
                    : theme.colors.primaryText,
                },
              ]}
            >
              {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
            </Text>
          </View>
        </ScalePressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  safeAreaFiller: {
    backgroundColor: '#000000',
    width: '100%',
  },
  headerBar: {
    height: 60,
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  headerLeftGroup: {
    minWidth: 84,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  headerBrandContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 120,
    height: 38,
  },
  headerRightActions: {
    minWidth: 84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    position: 'relative',
  },
  headerBadgeWrapper: {
    position: 'absolute',
    top: -2,
    right: -2,
    zIndex: 10,
  },
  headerBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  headerRightPlaceholder: {
    minWidth: 84,
    height: 38,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  imageContainer: {
    width: '100%',
    height: 320,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 16,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imageDiscountBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  imageDiscountText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  detailsCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productName: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  imageRatingBadge: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  imageRatingText: {
    fontSize: 13,
    fontWeight: '700',
  },
  imageRatingDivider: {
    fontSize: 12,
    fontWeight: '400',
    marginHorizontal: 1,
  },
  imageReviewCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.15)',
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  currentPrice: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  originalPrice: {
    fontSize: 16,
    fontWeight: '500',
    textDecorationLine: 'line-through',
  },
  saveBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  saveBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stockSection: {
    marginTop: 2,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  stockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stockBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 40,
  },
  bottomActionBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  addToCartButton: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  addToCartButtonText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  stateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorCard: {
    width: '100%',
    padding: 28,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  errorIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  primaryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
