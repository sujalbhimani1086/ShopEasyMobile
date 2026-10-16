import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/theme';
import { useCart, CartItem } from '../context/CartContext';
import { FullScreenRefreshLoader, FullPageContentLoader } from '../components/common';
import { withRandomLoadingDuration } from '../utils/loadingUtils';
import { resolveImageUrl, FALLBACK_PRODUCT_IMAGE } from '../config/api';
import { calculateFinalPrice, formatPrice } from '../utils/price';
import { Icon } from '../components/Icon';
import { ConfirmDialog, AlertDialog, type AlertType } from '../components/dialogs';
import { ScalePressable, FadeInView } from '../components/animated';

export interface CartScreenProps {
  onBack?: () => void;
  onProductPress?: (productId: number) => void;
  onStartShopping?: () => void;
  onProceedToCheckout?: () => void;
}

export const CartScreen: React.FC<CartScreenProps> = ({
  onBack,
  onProductPress,
  onStartShopping,
  onProceedToCheckout,
}) => {
  const theme = useAppTheme();
  const {
    cartItems,
    totalItemsCount,
    subtotal,
    totalDiscount,
    finalTotal,
    deliveryFee: _deliveryFee,
    isLoading,
    isValidating,
    validationError,
    hasUnavailableItems,
    updateQuantity,
    removeFromCart,
    clearCart,
    validateCartItems,
    removeUnavailableItems,
    refreshCart,
  } = useCart();

  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [isClearCartVisible, setIsClearCartVisible] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<CartItem | null>(null);
  const [removeUnavailableVisible, setRemoveUnavailableVisible] = useState(false);
  const [alertDialog, setAlertDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type?: AlertType;
  } | null>(null);

  // Refresh cart from server and validate items against backend database on mount
  useEffect(() => {
    async function loadFresh() {
      await withRandomLoadingDuration(async () => {
        await refreshCart();
        await validateCartItems();
      });
    }
    loadFresh();
  }, [refreshCart, validateCartItems]);

  // Pull-to-refresh handler (Task 4)
  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await withRandomLoadingDuration(async () => {
        await refreshCart();
        await validateCartItems();
      });
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, refreshCart, validateCartItems]);

  const handleImageError = (productId: number) => {
    setFailedImages((prev) => ({ ...prev, [productId]: true }));
  };

  // Confirm and clear entire cart (Modern modal with Keep Items / Clear All)
  const handleClearCart = () => {
    if (cartItems.length === 0) return;
    setIsClearCartVisible(true);
  };

  // Confirm and remove a single item
  const handleRemoveItem = (item: CartItem) => {
    setItemToRemove(item);
  };

  // Quantity decrement handler
  const handleDecrement = (item: CartItem) => {
    if (item.quantity <= 1) {
      handleRemoveItem(item);
    } else {
      updateQuantity(item.product.id, item.quantity - 1);
    }
  };

  // Quantity increment handler
  const handleIncrement = (item: CartItem) => {
    if (item.isUnavailable || item.isOutOfStock) {
      setAlertDialog({
        visible: true,
        title: 'Item Unavailable',
        message: 'This product is currently out of stock or no longer available in the store.',
        type: 'warning',
      });
      return;
    }

    const maxStock = typeof item.product.stock === 'number' ? item.product.stock : 99;
    if (item.quantity >= maxStock) {
      setAlertDialog({
        visible: true,
        title: 'Stock Limit',
        message: `Cannot add more. Only ${maxStock} units available for "${item.product.name}".`,
        type: 'warning',
      });
      return;
    }
    updateQuantity(item.product.id, item.quantity + 1);
  };

  // Safely proceed to checkout: validates against deleted/unavailable products
  const handleProceedToCheckout = async () => {
    // 1. Check if there are already flagged unavailable items
    if (hasUnavailableItems) {
      setRemoveUnavailableVisible(true);
      return;
    }

    if (totalItemsCount <= 0 || cartItems.length === 0) {
      setAlertDialog({
        visible: true,
        title: 'Empty Cart',
        message: 'Please add available products to your cart before checkout.',
        type: 'info',
      });
      return;
    }

    // 2. Perform live database verification immediately before checkout
    setIsCheckingOut(true);
    const result = await validateCartItems();
    setIsCheckingOut(false);

    // 3. Block checkout if any item became unavailable during live check
    if (result.hasUnavailableItems) {
      setRemoveUnavailableVisible(true);
      return;
    }

    // 4. All products verified available in live database
    if (onProceedToCheckout) {
      onProceedToCheckout();
    } else {
      setAlertDialog({
        visible: true,
        title: 'Checkout',
        message: `Ready to checkout ${totalItemsCount} item${totalItemsCount === 1 ? '' : 's'
          } for ${formatPrice(finalTotal)}.`,
        type: 'info',
      });
    }
  };

  // Render individual Cart Item Card
  const renderCartItem = ({ item }: { item: CartItem }) => {
    const { product, quantity, isUnavailable, isOutOfStock, unavailableReason } = item;
    const isImageFailed = failedImages[product.id];
    const imageUri = isImageFailed
      ? FALLBACK_PRODUCT_IMAGE
      : resolveImageUrl(product.image);

    const isItemUnavailable = isUnavailable || isOutOfStock || (typeof product.stock === 'number' && product.stock <= 0);
    const discountedUnit = calculateFinalPrice(product.price, product.discount);
    const itemTotal = discountedUnit * quantity;
    const maxStock = typeof product.stock === 'number' ? product.stock : 99;
    const isAtMaxStock = quantity >= maxStock;

    return (
      <View
        style={[
          styles.cartCard,
          {
            backgroundColor: theme.colors.card,
            borderColor: isItemUnavailable ? theme.colors.danger : theme.colors.borderLight,
            borderWidth: isItemUnavailable ? 1.5 : 1,
            opacity: isItemUnavailable ? 0.85 : 1,
          },
        ]}
      >
        {/* Unavailable Item Alert Tag */}
        {isItemUnavailable && (
          <View
            style={[
              styles.itemUnavailableBanner,
              { backgroundColor: theme.colors.dangerBg, flexDirection: 'row', alignItems: 'center', gap: 6 },
            ]}
          >
            <Icon name="alert-triangle" size={14} color={theme.colors.danger} />
            <Text style={[styles.itemUnavailableBannerText, { color: theme.colors.danger }]}>
              {unavailableReason || 'This product is no longer available'}
            </Text>
          </View>
        )}

        <View style={styles.cardMainRow}>
          {/* Product Thumbnail */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${product.name}`}
            style={[
              styles.imageContainer,
              { backgroundColor: theme.colors.surfaceSubtle },
            ]}
            onPress={() => onProductPress?.(product.id)}
          >
            <Image
              source={{ uri: imageUri }}
              style={[
                styles.productImage,
                isItemUnavailable && { opacity: 0.5 },
              ]}
              resizeMode="contain"
              onError={() => handleImageError(product.id)}
            />
          </Pressable>

          {/* Product Info & Pricing */}
          <View style={styles.infoCol}>
            <View style={styles.nameRow}>
              <Pressable
                style={styles.namePressable}
                onPress={() => onProductPress?.(product.id)}
              >
                <Text
                  style={[
                    styles.productName,
                    { color: isItemUnavailable ? theme.colors.textMuted : theme.colors.text },
                  ]}
                  numberOfLines={2}
                >
                  {product.name}
                </Text>
              </Pressable>

              {/* Remove Trash Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${product.name} from cart`}
                style={({ pressed }) => [
                  styles.removeBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
                onPress={() => handleRemoveItem(item)}
              >
                <Icon name="trash" size={18} color={theme.colors.danger} />
              </Pressable>
            </View>

            {/* Category tag */}
            {product.category ? (
              <Text
                style={[styles.categoryTag, { color: theme.colors.textMuted }]}
                numberOfLines={1}
              >
                {product.category}
              </Text>
            ) : null}

            {/* Unit Price Breakdown */}
            <View style={styles.unitPriceRow}>
              <Text
                style={[
                  styles.unitPriceText,
                  { color: isItemUnavailable ? theme.colors.textMuted : theme.colors.text },
                ]}
              >
                {formatPrice(discountedUnit)}
              </Text>
              {product.discount > 0 && !isItemUnavailable && (
                <>
                  <Text
                    style={[
                      styles.originalPriceText,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    {formatPrice(product.price)}
                  </Text>
                  <View
                    style={[
                      styles.discountPill,
                      { backgroundColor: theme.colors.successBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.discountPillText,
                        { color: theme.colors.success },
                      ]}
                    >
                      {product.discount}% OFF
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Bottom Actions Row: Quantity Steppers and Item Total */}
        <View
          style={[
            styles.cardBottomRow,
            { borderTopColor: theme.colors.borderLight },
          ]}
        >
          {/* Stepper Controls */}
          <View style={styles.stepperContainer}>
            <ScalePressable
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
              style={[
                styles.stepperBtn,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.border,
                },
              ]}
              activeScale={0.9}
              onPress={() => handleDecrement(item)}
            >
              {quantity === 1 ? (
                <Icon name="trash" size={14} color={theme.colors.danger} />
              ) : (
                <Icon name="minus" size={14} color={theme.colors.text} />
              )}
            </ScalePressable>

            <View style={styles.quantityBox}>
              <Text style={[styles.quantityText, { color: theme.colors.text }]}>
                {quantity}
              </Text>
            </View>

            <ScalePressable
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
              disabled={isItemUnavailable || isAtMaxStock}
              style={[
                styles.stepperBtn,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.border,
                  opacity: isItemUnavailable || isAtMaxStock ? 0.35 : 1,
                },
              ]}
              activeScale={0.9}
              onPress={() => handleIncrement(item)}
            >
              <Icon
                name="plus"
                size={14}
                color={
                  isItemUnavailable || isAtMaxStock
                    ? theme.colors.textMuted
                    : theme.colors.text
                }
              />
            </ScalePressable>

            {isAtMaxStock && !isItemUnavailable && (
              <Text
                style={[styles.maxStockNotice, { color: theme.colors.accent }]}
              >
                Max ({maxStock})
              </Text>
            )}
          </View>

          {/* Calculated Item Total */}
          <View style={styles.itemTotalCol}>
            <Text style={[styles.itemTotalLabel, { color: theme.colors.textMuted }]}>
              {isItemUnavailable ? 'Excluded:' : 'Subtotal:'}
            </Text>
            <Text
              style={[
                styles.itemTotalValue,
                {
                  color: isItemUnavailable ? theme.colors.danger : theme.colors.text,
                  textDecorationLine: isItemUnavailable ? 'line-through' : 'none',
                },
              ]}
            >
              {formatPrice(itemTotal)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Header Banner for Unavailable Items or Validation Warnings
  const renderListHeader = () => {
    if (!hasUnavailableItems && !validationError) {
      return null;
    }

    return (
      <View style={styles.listHeaderWrapper}>
        {hasUnavailableItems && (
          <View
            style={[
              styles.unavailableWarningCard,
              {
                backgroundColor: theme.colors.dangerBg,
                borderColor: theme.colors.danger,
              },
            ]}
          >
            <View style={styles.unavailableWarningLeft}>
              <Icon name="alert-triangle" size={20} color={theme.colors.danger} />
              <View style={styles.unavailableWarningTextGroup}>
                <Text style={[styles.unavailableWarningTitle, { color: theme.colors.danger }]}>
                  Unavailable Products Found
                </Text>
                <Text style={[styles.unavailableWarningSubtitle, { color: theme.colors.textSecondary }]}>
                  Some items in your cart were removed from the store or are out of stock. Remove them to checkout.
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove all unavailable products"
              style={({ pressed }) => [
                styles.removeUnavailableActionBtn,
                {
                  backgroundColor: theme.colors.danger,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={removeUnavailableItems}
            >
              <Text style={styles.removeUnavailableActionText}>
                Remove All
              </Text>
            </Pressable>
          </View>
        )}

        {validationError && (
          <View
            style={[
              styles.networkWarningCard,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Icon name="info" size={18} color={theme.colors.primary} />
            <Text style={[styles.networkWarningText, { color: theme.colors.textSecondary }]}>
              {validationError}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Order Summary Card as FlatList Footer
  const renderListFooter = () => {
    if (cartItems.length === 0) return null;

    return (
      <View style={styles.footerContainer}>
        {/* Order Summary Box */}
        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.borderLight,
            },
          ]}
        >
          <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>
            Order Summary
          </Text>

          {/* Subtotal */}
          <View style={styles.summaryRow}>
            <Text
              style={[
                styles.summaryRowLabel,
                { color: theme.colors.textSecondary },
              ]}
            >
              Available Items ({totalItemsCount} item
              {totalItemsCount === 1 ? '' : 's'})
            </Text>
            <Text
              style={[
                styles.summaryRowValue,
                { color: theme.colors.textSecondary },
              ]}
            >
              {formatPrice(subtotal)}
            </Text>
          </View>

          {/* Total Savings */}
          {totalDiscount > 0 && (
            <View style={styles.summaryRow}>
              <Text
                style={[
                  styles.summaryRowLabel,
                  { color: theme.colors.success },
                ]}
              >
                Discount Savings
              </Text>
              <Text
                style={[
                  styles.summaryRowValue,
                  { color: theme.colors.success, fontWeight: '700' },
                ]}
              >
                − {formatPrice(totalDiscount)}
              </Text>
            </View>
          )}

          {/* Delivery Fee */}
          <View style={styles.summaryRow}>
            <Text
              style={[
                styles.summaryRowLabel,
                { color: theme.colors.textSecondary },
              ]}
            >
              Delivery Fee
            </Text>
            <Text
              style={[
                styles.summaryRowValue,
                { color: theme.colors.success, fontWeight: '700' },
              ]}
            >
              FREE
            </Text>
          </View>

          <View
            style={[
              styles.summaryDivider,
              { backgroundColor: theme.colors.borderLight },
            ]}
          />

          {/* Final Total Amount */}
          <View style={styles.totalRow}>
            <View>
              <Text style={[styles.totalLabel, { color: theme.colors.text }]}>
                Total Amount
              </Text>
              <Text
                style={[styles.totalTaxesNotice, { color: theme.colors.textMuted }]}
              >
                Inclusive of all taxes
              </Text>
            </View>
            <Text style={[styles.totalValue, { color: theme.colors.text }]}>
              {formatPrice(finalTotal)}
            </Text>
          </View>

          {/* Savings Highlight Pill */}
          {totalDiscount > 0 && (
            <View
              style={[
                styles.savingsBanner,
                { backgroundColor: theme.colors.successBg, flexDirection: 'row', alignItems: 'center', gap: 6 },
              ]}
            >
              <Icon name="tag" size={15} color={theme.colors.success} />
              <Text
                style={[
                  styles.savingsBannerText,
                  { color: theme.colors.success },
                ]}
              >
                You save {formatPrice(totalDiscount)} on this order!
              </Text>
            </View>
          )}
        </View>

        <View style={styles.extraScrollSpacer} />
      </View>
    );
  };

  // Empty Cart State
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View
        style={[
          styles.emptyIconCircle,
          { backgroundColor: theme.colors.surfaceSubtle },
        ]}
      >
        <Icon name="cart" size={44} color={theme.colors.textMuted} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
        Your Cart is Empty
      </Text>
      <Text
        style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}
      >
        Looks like you haven't added anything to your cart yet. Discover trending
        products and great deals today!
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start shopping"
        style={({ pressed }) => [
          styles.startShoppingBtn,
          {
            backgroundColor: theme.colors.primary,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        onPress={() => {
          if (onStartShopping) {
            onStartShopping();
          } else {
            onBack?.();
          }
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            style={[
              styles.startShoppingBtnText,
              { color: theme.colors.primaryText },
            ]}
          >
            Start Shopping
          </Text>
          <Icon name="chevron-right" size={16} color={theme.colors.primaryText} strokeWidth={2.5} />
        </View>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      {/* Screen Header */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: theme.colors.card,
            borderBottomColor: theme.colors.borderLight,
          },
        ]}
      >
        <View style={styles.headerLeftGroup}>
          {onBack && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [
                styles.backButton,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              onPress={onBack}
            >
              <Icon name="arrow-left" size={20} color={theme.colors.text} />
            </Pressable>
          )}

          <View>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Shopping Cart
            </Text>
            {cartItems.length > 0 && (
              <Text
                style={[
                  styles.headerSubtitle,
                  { color: theme.colors.textMuted },
                ]}
              >
                {totalItemsCount} item{totalItemsCount === 1 ? '' : 's'}
                {isValidating ? ' (syncing...)' : ''}
              </Text>
            )}
          </View>
        </View>

        {/* Clear Cart Button */}
        {cartItems.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear cart"
            style={({ pressed }) => [
              styles.clearBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            onPress={handleClearCart}
          >
            <Text style={[styles.clearBtnText, { color: theme.colors.danger }]}>
              Clear
            </Text>
          </Pressable>
        )}
      </View>

      {/* Main Cart Content */}
      {isLoading && cartItems.length === 0 ? (
        <FullPageContentLoader message="Loading Cart..." />
      ) : (
        <View style={styles.contentWrapper}>
          {cartItems.length === 0 ? (
            <ScrollView
              contentContainerStyle={styles.emptyScrollContent}
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
              {renderEmptyState()}
            </ScrollView>
          ) : (
            <>
              <FlatList
                data={cartItems}
                keyExtractor={(item) => item.product.id.toString()}
                renderItem={renderCartItem}
                ListHeaderComponent={renderListHeader}
                ListFooterComponent={renderListFooter}
                contentContainerStyle={styles.listContent}
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
              />

              {/* Sticky Checkout Bottom Bar */}
              <View
                style={[
                  styles.bottomCheckoutBar,
                  {
                    backgroundColor: theme.colors.card,
                    borderTopColor: theme.colors.borderLight,
                  },
                ]}
              >
                <View style={styles.bottomTotalCol}>
                  <Text
                    style={[
                      styles.bottomTotalLabel,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    Total:
                  </Text>
                  <Text
                    style={[styles.bottomTotalValue, { color: theme.colors.text }]}
                  >
                    {formatPrice(finalTotal)}
                  </Text>
                </View>

                <ScalePressable
                  accessibilityRole="button"
                  accessibilityLabel={hasUnavailableItems ? 'Remove unavailable items' : 'Proceed to checkout'}
                  style={[
                    styles.checkoutButton,
                    {
                      backgroundColor: hasUnavailableItems
                        ? theme.colors.danger
                        : theme.colors.primary,
                      opacity: isCheckingOut ? 0.85 : 1,
                    },
                  ]}
                  activeScale={0.96}
                  onPress={hasUnavailableItems ? removeUnavailableItems : handleProceedToCheckout}
                  disabled={isCheckingOut}
                >
                  {isCheckingOut ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.primaryText}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.checkoutButtonText,
                        { color: theme.colors.primaryText },
                      ]}
                    >
                      {hasUnavailableItems
                        ? 'Remove Unavailable'
                        : 'Proceed to Checkout →'}
                    </Text>
                  )}
                </ScalePressable>
              </View>
            </>
          )}
          {refreshing && (
            <FullPageContentLoader
              message="Loading Cart..."
              overlay
            />
          )}
        </View>
      )}

      {/* 1. Custom Modern Clear Cart Confirmation Dialog */}
      <ConfirmDialog
        visible={isClearCartVisible}
        title="Clear Cart?"
        message="Are you sure you want to remove all items from your cart?"
        icon="trash"
        cancelText="Keep Items"
        confirmText="Clear All"
        isDestructive={true}
        onCancel={() => setIsClearCartVisible(false)}
        onConfirm={async () => {
          try {
            await clearCart();
            setIsClearCartVisible(false);
          } catch (err: any) {
            setAlertDialog({
              visible: true,
              title: 'Error',
              message: err?.message || 'Could not clear cart. Please try again.',
              type: 'error',
            });
          }
        }}
      />

      {/* 2. Custom Modern Remove Item Dialog */}
      <ConfirmDialog
        visible={!!itemToRemove}
        title="Remove Item?"
        message={
          itemToRemove
            ? `Are you sure you want to remove "${itemToRemove.product.name}" from your cart?`
            : ''
        }
        icon="trash"
        cancelText="Keep Item"
        confirmText="Remove"
        isDestructive={true}
        onCancel={() => setItemToRemove(null)}
        onConfirm={async () => {
          if (itemToRemove) {
            await removeFromCart(itemToRemove.product.id);
            setItemToRemove(null);
          }
        }}
      />

      {/* 3. Remove Unavailable Items Confirmation */}
      <ConfirmDialog
        visible={removeUnavailableVisible}
        title="Unavailable Products in Cart"
        message="Your cart contains products that have been deleted or are out of stock. Please remove unavailable items before proceeding to checkout."
        icon="alert-triangle"
        cancelText="Cancel"
        confirmText="Remove Unavailable Items"
        isDestructive={true}
        onCancel={() => setRemoveUnavailableVisible(false)}
        onConfirm={async () => {
          await removeUnavailableItems();
          setRemoveUnavailableVisible(false);
        }}
      />

      {/* 4. Alert Dialog (Stock limits, Empty cart, Checkout messages) */}
      <AlertDialog
        visible={alertDialog?.visible || false}
        title={alertDialog?.title || ''}
        message={alertDialog?.message || ''}
        type={alertDialog?.type || 'info'}
        onClose={() => setAlertDialog(null)}
      />
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
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  listHeaderWrapper: {
    marginBottom: 8,
    gap: 8,
  },
  unavailableWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  unavailableWarningLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  unavailableWarningIcon: {
    fontSize: 20,
  },
  unavailableWarningTextGroup: {
    flex: 1,
  },
  unavailableWarningTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  unavailableWarningSubtitle: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  removeUnavailableActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeUnavailableActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  networkWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  networkWarningIcon: {
    fontSize: 16,
  },
  networkWarningText: {
    fontSize: 12,
    flex: 1,
  },
  cartCard: {
    borderRadius: 14,
    overflow: 'hidden',
    padding: 12,
  },
  itemUnavailableBanner: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  itemUnavailableBannerText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardMainRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'space-between',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  namePressable: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  removeBtn: {
    padding: 4,
  },
  removeIcon: {
    fontSize: 16,
  },
  categoryTag: {
    fontSize: 11,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  unitPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  unitPriceText: {
    fontSize: 15,
    fontWeight: '800',
  },
  originalPriceText: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  discountPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  quantityBox: {
    minWidth: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '800',
  },
  maxStockNotice: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  itemTotalCol: {
    alignItems: 'flex-end',
  },
  itemTotalLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  itemTotalValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  footerContainer: {
    marginTop: 8,
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryRowLabel: {
    fontSize: 13,
  },
  summaryRowValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    marginVertical: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  totalTaxesNotice: {
    fontSize: 11,
    marginTop: 2,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  savingsBanner: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  savingsBannerText: {
    fontSize: 12,
    fontWeight: '700',
  },
  extraScrollSpacer: {
    height: 90,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyIconText: {
    fontSize: 42,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  startShoppingBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  startShoppingBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  bottomCheckoutBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  bottomTotalCol: {
    justifyContent: 'center',
  },
  bottomTotalLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  bottomTotalValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  checkoutButton: {
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 160,
  },
  checkoutButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
