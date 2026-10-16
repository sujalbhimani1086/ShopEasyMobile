import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useAppTheme } from '../theme/theme';
import { resolveImageUrl, FALLBACK_PRODUCT_IMAGE } from '../config/api';
import type { Product } from '../types/product';
import { useWishlist } from '../context/WishlistContext';
import { useFeedback } from '../context/FeedbackContext';
import { Icon } from './Icon';
import { HeartBounce, ScalePressable } from './animated';

export interface ProductCardProps {
  product: Product;
  cardWidth?: number;
  onPress?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  onToggleWishlist?: (product: Product) => void;
  isWishlisted?: boolean;
}

import { calculateFinalPrice, formatPrice } from '../utils/price';
export { calculateFinalPrice, formatPrice };

export const ProductCard = React.memo<ProductCardProps>(({
  product,
  cardWidth,
  onPress,
  onAddToCart,
  onToggleWishlist,
  isWishlisted: isWishlistedProp,
}) => {
  const theme = useAppTheme();
  const { isWishlisted: checkWishlist, toggleWishlist } = useWishlist();
  const [imageError, setImageError] = useState(false);

  const isWishlisted =
    isWishlistedProp !== undefined ? isWishlistedProp : checkWishlist(product.id);

  const finalPrice = calculateFinalPrice(product.price, product.discount);
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;

  const imageUri = imageError
    ? FALLBACK_PRODUCT_IMAGE
    : resolveImageUrl(product.image);

  const handleWishlist = () => {
    toggleWishlist(product).catch(() => {});
    if (onToggleWishlist) {
      onToggleWishlist(product);
    }
  };

  const feedback = useFeedback();

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    if (onAddToCart) {
      onAddToCart(product);
    } else {
      feedback.toast.success(`${product.name} added to cart`);
    }
  };

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.borderLight,
        },
        cardWidth ? { width: cardWidth } : styles.cardFlex,
      ]}
    >
      {/* Top Image Container */}
      <Pressable
        style={[
          styles.imageContainer,
          { backgroundColor: theme.colors.surfaceSubtle },
        ]}
        onPress={() => onPress && onPress(product)}
      >
        <Image
          source={{ uri: imageUri }}
          style={styles.productImage}
          resizeMode="contain"
          onError={() => setImageError(true)}
        />

        {/* Category Badge */}
        {product.category ? (
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: theme.colors.badgeBg },
            ]}
          >
            <Text
              style={[
                styles.categoryBadgeText,
                { color: theme.colors.badgeText },
              ]}
              numberOfLines={1}
            >
              {product.category}
            </Text>
          </View>
        ) : null}

        {/* Wishlist Heart Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isWishlisted
              ? `Remove ${product.name} from wishlist`
              : `Add ${product.name} to wishlist`
          }
          style={({ pressed }) => [
            styles.wishlistBtn,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.isDark
                ? 'rgba(255, 255, 255, 0.18)'
                : theme.colors.borderLight,
              borderWidth: 1,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={handleWishlist}
        >
          <HeartBounce isFilled={isWishlisted}>
            <Icon
              name={isWishlisted ? 'heart-filled' : 'heart'}
              size={16}
              color={
                isWishlisted
                  ? '#EF4444'
                  : theme.isDark
                  ? '#FFFFFF'
                  : theme.colors.textSecondary
              }
              strokeWidth={2.2}
            />
          </HeartBounce>
        </Pressable>

        {/* Rating Badge at Bottom-Left of Image */}
        {typeof product.averageRating === 'number' && product.averageRating > 0 ? (
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
            <Icon name="star-filled" size={10} color="#F59E0B" fill="#F59E0B" />
            <Text
              style={[
                styles.imageRatingText,
                { color: theme.colors.text },
              ]}
              numberOfLines={1}
            >
              {product.averageRating.toFixed(1)}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {/* Body Content */}
      <View style={styles.bodyContent}>
        <Pressable onPress={() => onPress && onPress(product)}>
          {/* Product Name: Starts at exact same vertical offset, wraps up to 2 lines consistently */}
          <Text
            style={[styles.productTitle, { color: theme.colors.text }]}
            numberOfLines={2}
          >
            {product.name}
          </Text>

          {/* Price Row */}
          <View style={styles.priceRow}>
            <Text
              style={[styles.currentPrice, { color: theme.colors.text }]}>
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

          {/* Discount & Stock Indicators */}
          <View style={styles.badgesRow}>
            {product.discount > 0 && (
              <View
                style={[
                  styles.discountBadge,
                  { backgroundColor: theme.colors.successBg },
                ]}
              >
                <Text
                  style={[
                    styles.discountBadgeText,
                    { color: theme.colors.success },
                  ]}
                >
                  {product.discount}% OFF
                </Text>
              </View>
            )}

            {isOutOfStock ? (
              <Text
                style={[
                  styles.stockIndicator,
                  { color: theme.colors.danger },
                ]}
              >
                Out of stock
              </Text>
            ) : isLowStock ? (
              <Text
                style={[
                  styles.stockIndicator,
                  { color: theme.colors.accent },
                ]}
              >
                Only {product.stock} left!
              </Text>
            ) : null}
          </View>
        </Pressable>

        {/* Add to Cart Button */}
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${product.name} to cart`}
          disabled={isOutOfStock}
          style={[
            styles.cartButton,
            {
              backgroundColor: isOutOfStock
                ? theme.colors.border
                : theme.colors.primary,
            },
          ]}
          activeScale={0.94}
          onPress={handleAddToCart}
        >
          <Text
            style={[
              styles.cartButtonText,
              {
                color: isOutOfStock
                  ? theme.colors.textMuted
                  : theme.colors.primaryText,
              },
            ]}
          >
            {isOutOfStock ? 'Out of Stock' : '+ Add to Cart'}
          </Text>
        </ScalePressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  cardFlex: {
    flex: 1,
  },
  cardContainer: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    margin: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  imageContainer: {
    height: 140,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    padding: 8,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  categoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    maxWidth: '65%',
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  wishlistBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  wishlistIcon: {
    fontSize: 13,
  },
  bodyContent: {
    padding: 10,
    justifyContent: 'space-between',
    flex: 1,
  },
  imageRatingBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  imageRatingText: {
    fontSize: 11,
    fontWeight: '700',
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    height: 36,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    height: 20,
    marginBottom: 4,
  },
  currentPrice: {
    fontSize: 15,
    fontWeight: '800',
  },
  originalPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    height: 20,
  },
  discountBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  stockIndicator: {
    fontSize: 10,
    fontWeight: '600',
  },
  cartButton: {
    width: '100%',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
