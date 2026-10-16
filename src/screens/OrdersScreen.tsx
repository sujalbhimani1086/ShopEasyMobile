import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../config/queryKeys';
import { queryClient } from '../config/queryClient';
import { AppDialog, ConfirmDialog, AlertDialog, type AlertType } from '../components/dialogs';
import {
  getMyOrders,
  getAllMyOrders,
  cancelOrder,
  isOrderCancellable,
  isOrderPayable,
  getOrderPaymentDisplay,
  updateOrderPaymentMethod,
  isLegitimateCustomerOrder,
} from '../services/orderApi';
import {
  executeRazorpayCheckout,
  parseRazorpayError,
} from '../services/paymentApi';
import {
  getProductReviews,
  getCachedReview,
  getAllCachedReviews,
  ReviewData,
} from '../services/reviewApi';
import {
  resolveImageUrl,
  getOrderItemImage,
  FALLBACK_PRODUCT_IMAGE,
} from '../config/api';
import { formatPrice } from '../utils/price';
import { Icon, IconName } from '../components/Icon';
import { ScalePressable, FadeInView } from '../components/animated';
import { FullScreenRefreshLoader, FullPageContentLoader } from '../components/common';
import { withRandomLoadingDuration } from '../utils/loadingUtils';
import type { Order, OrderItem, OrdersResponse } from '../types/order';

export interface OrdersScreenProps {
  onBack?: () => void;
  onOrderPress?: (order: Order) => void;
  onStartShopping?: () => void;
  onProductPress?: (productId: number) => void;
  onNavigateToLogin?: () => void;
  onTrackOrder?: (orderId: number) => void;
  onRateProduct?: (
    item: {
      productId: number;
      productName: string;
      productImage?: string;
      deliveryDate?: string;
    },
    initialRating: number,
    existingReview?: ReviewData | null
  ) => void;
}

type OrderStatusFilter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

interface StatusFilterChip {
  key: OrderStatusFilter;
  label: string;
}

const STATUS_FILTERS: StatusFilterChip[] = [
  { key: 'ALL', label: 'All Orders' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

/**
 * Checks whether an order's status matches the selected status filter chip.
 * Delivers consistent normalization across all order statuses:
 * - ALL: Matches any order
 * - DELIVERED: Matches DELIVERED and COMPLETED
 * - SHIPPED: Matches SHIPPED
 * - CONFIRMED: Matches CONFIRMED, PACKED, and PROCESSING
 * - PENDING: Matches PENDING
 * - CANCELLED: Matches CANCELLED and REFUNDED
 */
export function isStatusMatching(
  orderStatusRaw: string | undefined | null,
  filter: OrderStatusFilter
): boolean {
  if (filter === 'ALL') return true;
  const upper = (orderStatusRaw || '').toUpperCase().trim();
  switch (filter) {
    case 'DELIVERED':
      return upper === 'DELIVERED' || upper === 'COMPLETED';
    case 'SHIPPED':
      return upper === 'SHIPPED';
    case 'CONFIRMED':
      return upper === 'CONFIRMED' || upper === 'PACKED' || upper === 'PROCESSING';
    case 'PENDING':
      return upper === 'PENDING';
    case 'CANCELLED':
      return upper === 'CANCELLED' || upper === 'REFUNDED';
    default:
      return upper === filter;
  }
}

/**
 * Represents a single product card (one card per order line item) in My Orders.
 */
export interface OrderLineItemCardData {
  cardKey: string;
  order: Order;
  orderId: number;
  orderStatus: string;
  orderCreatedAt: string;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  recipientName?: string | null;
  recipientCity?: string | null;
  itemId: number;
  productId: number;
  productName: string;
  productImage: string;
  quantity: number;
  unitPrice: number;
  lineItemTotal: number;
}

// Individual Product Card for each Order Line Item
const OrderProductCard: React.FC<{
  card: OrderLineItemCardData;
  onPress?: () => void;
  onTrack?: () => void;
  onCancel?: () => void;
  isCancelling?: boolean;
  onRate?: (
    productId: number,
    productName: string,
    productImage: string,
    initialRating: number,
    existingReview?: ReviewData | null
  ) => void;
  savedReview?: ReviewData | null;
  statusInfo: {
    badgeColor: string;
    icon: IconName;
    title: string;
    description: string;
    isDelivered: boolean;
    dateStr: string;
  };
  paymentDisplay: {
    label: string;
    isPaid: boolean;
    method?: string;
    statusText?: string;
    isPayable?: boolean;
    actionLabel?: string;
  };
  isCancellable: boolean;
  onPay?: () => void;
  isPaying?: boolean;
}> = ({
  card,
  onPress,
  onTrack,
  onCancel,
  isCancelling,
  onRate,
  savedReview,
  statusInfo,
  paymentDisplay,
  isCancellable,
  onPay,
  isPaying,
}) => {
    const theme = useAppTheme();
    const [imageError, setImageError] = useState(false);
    const savedRating = savedReview?.rating || 0;
    const imageSourceUri = imageError
      ? FALLBACK_PRODUCT_IMAGE
      : card.productImage || FALLBACK_PRODUCT_IMAGE;

    return (
      <View
        style={[
          styles.orderCard,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.borderLight,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Order #${card.orderId}, ${card.productName}, ${statusInfo.title}`}
          onPress={onPress}
        >
          {/* Main Card Content */}
          <View style={styles.cardMainRow}>
            {/* Product Thumbnail on the Left */}
            <View
              style={[
                styles.thumbnailContainer,
                { backgroundColor: theme.colors.surfaceSubtle },
              ]}
            >
              <Image
                source={{ uri: imageSourceUri }}
                style={styles.thumbnailImg}
                resizeMode="contain"
                onError={() => setImageError(true)}
              />
            </View>

            {/* Center Info Col */}
            <View style={styles.cardInfoCol}>
              {/* Status indicator row */}
              <View style={styles.statusIndicatorRow}>
                <Icon name={statusInfo.icon} size={14} color={statusInfo.badgeColor} />
                <Text
                  style={[
                    styles.statusTitleText,
                    { color: statusInfo.badgeColor },
                  ]}
                  numberOfLines={1}
                >
                  {statusInfo.title}
                </Text>
              </View>

              {/* Product Name (exact product name for this line item) */}
              <Text
                style={[styles.orderProductName, { color: theme.colors.text }]}
                numberOfLines={2}
              >
                {card.productName}
              </Text>

              {/* Description & Order Details */}
              <Text
                style={[styles.statusDescText, { color: theme.colors.textSecondary }]}
                numberOfLines={1}
              >
                {statusInfo.description}
              </Text>

              {/* Row 1: Order ID Badge + Payment Badge */}
              <View style={styles.orderMetaTopRow}>
                <Text style={[styles.orderIdBadge, { color: theme.colors.textMuted }]}>
                  Order #{card.orderId}
                </Text>
                <View
                  style={[
                    styles.paymentBadge,
                    {
                      backgroundColor: paymentDisplay.isPaid
                        ? 'rgba(16, 185, 129, 0.15)'
                        : paymentDisplay.statusText === 'Failed'
                          ? 'rgba(239, 68, 68, 0.15)'
                          : 'rgba(245, 158, 11, 0.15)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.paymentBadgeText,
                      {
                        color: paymentDisplay.isPaid
                          ? '#10B981'
                          : paymentDisplay.statusText === 'Failed'
                            ? '#EF4444'
                            : '#F59E0B',
                      },
                    ]}
                  >
                    {paymentDisplay.label}
                  </Text>
                </View>
              </View>

              {/* Row 2: Line-Item Price and Quantity */}
              <View style={styles.orderMetaBottomRow}>
                <Text style={[styles.orderPriceBadge, { color: theme.colors.text }]}>
                  {formatPrice(card.lineItemTotal)}
                </Text>
                <Text style={[styles.orderItemCountText, { color: theme.colors.textSecondary }]}>
                  (Qty: {card.quantity})
                </Text>
                <Text style={[styles.orderItemCountText, { color: theme.colors.textSecondary }]}>
                  ({card.quantity} {card.quantity === 1 ? 'item' : 'items'})
                </Text>
                <Text style={[styles.orderItemCountText, { color: theme.colors.textMuted }]}>
                  · Total: {formatPrice(card.order.total)}
                </Text>
              </View>
            </View>

            {/* Right Chevron */}
            <View style={styles.chevronCol}>
              <Icon name="chevron-right" size={18} color={theme.colors.textMuted} strokeWidth={2.2} />
            </View>
          </View>
        </Pressable>

        {/* Action Row for Tracking & Cancellation */}
        <View
          style={[
            styles.cardBottomActionRow,
            { borderTopColor: theme.colors.borderLight },
          ]}
        >
          <View style={styles.addressContainer}>
            <Text
              style={[styles.orderPlacedOnText, { color: theme.colors.textMuted }]}
              numberOfLines={1}
            >
              To: {card.recipientName || 'Recipient'} ({card.recipientCity || 'Home'})
            </Text>
          </View>

          <View style={styles.actionButtonsContainer}>
            {paymentDisplay.isPayable && onPay && (
              <ScalePressable
                accessibilityRole="button"
                accessibilityLabel={`${paymentDisplay.actionLabel || 'Pay Now'} for order #${card.orderId}`}
                disabled={isPaying}
                style={[
                  styles.payOrderBtn,
                  {
                    backgroundColor:
                      paymentDisplay.actionLabel === 'Retry Payment'
                        ? '#DC2626'
                        : theme.colors.primary,
                    opacity: isPaying ? 0.6 : 1,
                  },
                ]}
                activeScale={0.93}
                onPress={onPay}
              >
                {isPaying ? (
                  <ActivityIndicator size="small" color={theme.colors.primaryText} />
                ) : (
                  <View style={styles.payBtnInner}>
                    <Icon name="credit-card" size={13} color={theme.colors.primaryText} />
                    <Text
                      style={[
                        styles.payOrderBtnText,
                        { color: theme.colors.primaryText },
                      ]}
                    >
                      {paymentDisplay.actionLabel || 'Pay Now'}
                    </Text>
                  </View>
                )}
              </ScalePressable>
            )}

            {onTrack && (
              <ScalePressable
                accessibilityRole="button"
                accessibilityLabel={`Track order #${card.orderId}`}
                style={[
                  styles.trackOrderBtn,
                  {
                    backgroundColor: theme.colors.primary,
                  },
                ]}
                activeScale={0.93}
                onPress={onTrack}
              >
                <Icon name="truck" size={13} color={theme.colors.primaryText} />
                <Text
                  style={[
                    styles.trackOrderBtnText,
                    { color: theme.colors.primaryText },
                  ]}
                >
                  Track
                </Text>
              </ScalePressable>
            )}

            {isCancellable && onCancel && (
              <ScalePressable
                accessibilityRole="button"
                accessibilityLabel={`Cancel order #${card.orderId}`}
                disabled={isCancelling}
                style={[
                  styles.cancelOrderTextBtn,
                  { opacity: isCancelling ? 0.6 : 1 },
                ]}
                activeScale={0.93}
                onPress={onCancel}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color={theme.colors.danger} />
                ) : (
                  <Text style={[styles.cancelOrderText, { color: theme.colors.danger }]}>
                    Cancel
                  </Text>
                )}
              </ScalePressable>
            )}
          </View>
        </View>

        {/* ELIGIBLE DELIVERED ORDERS RATING SECTION FOR THIS PRODUCT */}
        {statusInfo.isDelivered && Boolean(card.productId) && onRate && (
          <View
            style={[
              styles.deliveredRatingSection,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                borderTopColor: theme.colors.borderLight,
              },
            ]}
          >
            <View style={styles.ratingSectionHeaderRow}>
              {/* 5 Interactive Stars: filled orange for selected, outlined gray for unselected */}
              <View style={styles.ratingStarsRow}>
                {[1, 2, 3, 4, 5].map((starIdx) => {
                  const isFilled = starIdx <= savedRating;
                  return (
                    <Pressable
                      key={`rate-star-${card.cardKey}-${starIdx}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Rate ${starIdx} of 5 stars`}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      style={styles.inlineStarPressable}
                      onPress={() => {
                        onRate(
                          card.productId,
                          card.productName,
                          imageSourceUri,
                          starIdx,
                          savedReview
                        );
                      }}
                    >
                      <Icon
                        name={isFilled ? 'star-filled' : 'star'}
                        size={22}
                        strokeWidth={1.8}
                        color={isFilled ? '#F59E0B' : theme.colors.textMuted}
                      />
                    </Pressable>
                  );
                })}
              </View>

              {/* Rate & Review / Edit Review Action Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={savedReview ? 'Edit review' : 'Rate & Review'}
                style={({ pressed }) => [
                  styles.rateActionTextBtn,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => {
                  onRate(
                    card.productId,
                    card.productName,
                    imageSourceUri,
                    savedRating || 5,
                    savedReview
                  );
                }}
              >
                <Text style={[styles.rateActionTextLabel, { color: theme.colors.primary }]}>
                  {savedReview ? 'Edit Review' : 'Rate & Review'}
                </Text>
                <Icon name="chevron-right" size={13} color={theme.colors.primary} strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    );
  };

export const OrdersScreen: React.FC<OrdersScreenProps> = ({
  onBack,
  onOrderPress,
  onStartShopping,
  onProductPress: _onProductPress,
  onNavigateToLogin,
  onTrackOrder,
  onRateProduct,
}) => {
  const theme = useAppTheme();
  const { user, token } = useAuth();

  const cachedInitialOrders = useMemo(() => {
    const cached = queryClient.getQueryData<OrdersResponse>(queryKeys.orders(user?.id, 'ALL'));
    return (cached?.orders || []).filter(isLegitimateCustomerOrder);
  }, [user?.id]);

  const [orders, setOrders] = useState<Order[]>(cachedInitialOrders);
  const [loading, setLoading] = useState<boolean>(cachedInitialOrders.length === 0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [alertDialog, setAlertDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type?: AlertType;
  } | null>(null);

  // Pagination & query states for Orders
  const ORDERS_PER_PAGE = 10;
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [isFilterScanning, setIsFilterScanning] = useState<boolean>(false);
  const activeFetchId = React.useRef<number>(0);
  const isFetchingMoreRef = React.useRef<boolean>(false);
  const onEndReachedCalledDuringMomentum = React.useRef<boolean>(true);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatusFilter>('ALL');

  // Debounce search query to prevent heavy re-filtering during typing
  useEffect(() => {
    if (searchQuery.trim() === debouncedSearch.trim()) return;

    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearch]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearch('');
  }, []);

  const handleStatusChange = useCallback((newStatus: OrderStatusFilter) => {
    if (newStatus === selectedStatus) return;

    activeFetchId.current += 1;
    isFetchingMoreRef.current = false;
    setLoadingMore(false);
    setIsFilterScanning(false);
    onEndReachedCalledDuringMomentum.current = true;
    setSelectedStatus(newStatus);
  }, [selectedStatus]);

  // Cached reviews for delivered products, pre-loaded from persistent memory cache
  const [productReviews, setProductReviews] = useState<Record<number, ReviewData>>(
    () => getAllCachedReviews()
  );

  // Helper for delivery status display & vector icon
  const getStatusDisplay = useCallback((status: string, createdAt?: string) => {
    const upper = (status || '').toUpperCase();
    let dateStr = '';
    if (createdAt) {
      try {
        const d = new Date(createdAt);
        dateStr = d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        });
      } catch { }
    }

    switch (upper) {
      case 'DELIVERED':
      case 'COMPLETED':
        return {
          badgeColor: '#10B981',
          icon: 'check-circle' as IconName,
          title: `Delivered on ${dateStr || 'recently'}`,
          description: 'Your item has been delivered',
          isDelivered: true,
          dateStr: dateStr || 'recently',
        };
      case 'SHIPPED':
        return {
          badgeColor: '#9333EA',
          icon: 'truck' as IconName,
          title: 'Shipped · In Transit',
          description: 'Package is on the way to your delivery address',
          isDelivered: false,
          dateStr,
        };
      case 'PACKED':
        return {
          badgeColor: theme.colors.primary,
          icon: 'package' as IconName,
          title: 'Packed · Ready to Ship',
          description: 'Seller has processed your order',
          isDelivered: false,
          dateStr,
        };
      case 'CONFIRMED':
        return {
          badgeColor: '#0EA5E9',
          icon: 'check' as IconName,
          title: 'Order Confirmed',
          description: 'Payment verified and sent to warehouse',
          isDelivered: false,
          dateStr,
        };
      case 'CANCELLED':
        return {
          badgeColor: '#EF4444',
          icon: 'close' as IconName,
          title: `Cancelled ${dateStr ? 'on ' + dateStr : ''}`,
          description: 'This order was cancelled',
          isDelivered: false,
          dateStr,
        };
      case 'PENDING':
      default:
        return {
          badgeColor: '#f59f0bf8',
          icon: 'clock' as IconName,
          title: 'Order Placed',
          description: 'Order awaiting warehouse confirmation',
          isDelivered: false,
          dateStr,
        };
    }
  }, []);

  const ordersCountRef = React.useRef(0);
  ordersCountRef.current = orders.length;

  // Hydrate reviews for delivered products
  const hydrateReviewsForOrders = useCallback((orderList: Order[]) => {
    if (!token) return;
    const deliveredProductIds = orderList
      .filter((o) => {
        const st = (o.status || '').toUpperCase();
        return st === 'DELIVERED' || st === 'COMPLETED';
      })
      .flatMap((o) => o.items.map((it) => it.productId || it.product?.id).filter(Boolean) as number[]);

    const uniqueIds = Array.from(new Set(deliveredProductIds));
    if (uniqueIds.length > 0) {
      uniqueIds.forEach(async (pId) => {
        try {
          const revData = await getProductReviews(pId, token);
          if (revData.userReview) {
            setProductReviews((prev) => ({
              ...prev,
              [pId]: revData.userReview!,
            }));
          }
        } catch {
          // Ignore failure to fetch individual review
        }
      });
    }
  }, [token]);

  // Sync initial query cache into orders list on mount if cached data exists
  useEffect(() => {
    const cached = queryClient.getQueryData<OrdersResponse>(queryKeys.orders(user?.id, selectedStatus));
    if (cached?.orders && ordersCountRef.current === 0) {
      const validOrders = cached.orders.filter(isLegitimateCustomerOrder);
      setOrders(validOrders);
      setPage(cached.page || 1);
      setTotalPages(cached.totalPages || 1);
      setHasMore((cached.page || 1) < (cached.totalPages || 1));
      hydrateReviewsForOrders(validOrders);
      setLoading(false);
    }
  }, [user?.id, selectedStatus, hydrateReviewsForOrders]);

  // Reset pagination state when switching user accounts
  const previousUserIdRef = React.useRef(user?.id);
  useEffect(() => {
    if (previousUserIdRef.current !== user?.id) {
      previousUserIdRef.current = user?.id;
      setOrders([]);
      setPage(1);
      setTotalPages(1);
      setHasMore(false);
      setLoading(true);
      setError(null);
    }
  }, [user?.id]);

  // Fetch initial batch (Page 1) of orders from backend
  const fetchOrders = useCallback(
    async (isRefresh = false) => {
      if (!token) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const fetchId = ++activeFetchId.current;
      isFetchingMoreRef.current = false;
      setLoadingMore(false);
      setIsFilterScanning(false);

      if (!isRefresh && ordersCountRef.current === 0) {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await getMyOrders(token, 1, ORDERS_PER_PAGE, selectedStatus);
        if (fetchId !== activeFetchId.current) {
          return;
        }

        const initialOrders = (response?.orders || []).filter(isLegitimateCustomerOrder);
        setOrders(initialOrders);
        const respPage = typeof response?.page === 'number' ? response.page : 1;
        const respTotalPages = typeof response?.totalPages === 'number' ? response.totalPages : 1;
        setPage(respPage);
        setTotalPages(respTotalPages);
        setHasMore(respPage < respTotalPages);

        hydrateReviewsForOrders(initialOrders);

        // Populate TanStack Query cache
        queryClient.setQueryData(queryKeys.orders(user?.id, selectedStatus), response);
      } catch (err: any) {
        if (fetchId !== activeFetchId.current) return;
        console.error('Error fetching customer orders:', err);
        if (!isRefresh || ordersCountRef.current === 0) {
          setError(err?.message || 'Unable to load orders. Please retry.');
        }
      } finally {
        if (fetchId === activeFetchId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [token, selectedStatus, user?.id, hydrateReviewsForOrders]
  );

  // Initial load
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    await fetchOrders(true);
  }, [refreshing, fetchOrders]);

  // Cancel order handler
  const handleCancelOrder = useCallback((order: Order) => {
    setOrderToCancel(order);
  }, []);

  // Payment states and debouncing
  const [payingOrderId, setPayingOrderId] = useState<number | null>(null);
  const payingRef = React.useRef<boolean>(false);
  const [orderForPaymentDialog, setOrderForPaymentDialog] = useState<Order | null>(null);

  const handlePayOrder = useCallback((order: Order) => {
    if (payingRef.current) return;
    setOrderForPaymentDialog(order);
  }, []);

  const handlePayOnlineWithRazorpay = useCallback(
    async (order: Order) => {
      if (payingRef.current || !token) return;
      payingRef.current = true;
      setPayingOrderId(order.id);
      setOrderForPaymentDialog(null);

      try {
        await executeRazorpayCheckout({
          orderId: order.id,
          amount: order.total,
          customerName: order.name || user?.name || undefined,
          customerEmail: order.email || user?.email || undefined,
          token,
        });

        setAlertDialog({
          visible: true,
          title: 'Payment Successful',
          message: `Payment of ${formatPrice(order.total)} for Order #${order.id} was verified successfully.`,
          type: 'success',
        });

        await fetchOrders(true);
      } catch (payErr: any) {
        console.log('Razorpay payment error in My Orders:', payErr);
        const parsed = parseRazorpayError(payErr);
        setAlertDialog({
          visible: true,
          title: parsed.title,
          message: parsed.message,
          type: parsed.isCancelled ? 'info' : 'error',
        });
      } finally {
        payingRef.current = false;
        setPayingOrderId(null);
      }
    },
    [token, user, fetchOrders]
  );

  const handleSwitchToCod = useCallback(
    async (order: Order) => {
      if (payingRef.current || !token) return;
      payingRef.current = true;
      setPayingOrderId(order.id);
      setOrderForPaymentDialog(null);

      try {
        await updateOrderPaymentMethod(order.id, 'COD', token);
        setAlertDialog({
          visible: true,
          title: 'Switched to Cash on Delivery',
          message: `Order #${order.id} has been changed to Cash on Delivery. You can pay ${formatPrice(order.total)} upon delivery.`,
          type: 'success',
        });
        await fetchOrders(true);
      } catch (err: any) {
        setAlertDialog({
          visible: true,
          title: 'Update Failed',
          message: err?.message || 'Could not change payment method to COD.',
          type: 'error',
        });
      } finally {
        payingRef.current = false;
        setPayingOrderId(null);
      }
    },
    [token, fetchOrders]
  );

  const executeCancelOrder = useCallback(async () => {
    if (!orderToCancel || !token) return;
    const orderId = orderToCancel.id;
    setCancellingOrderId(orderId);
    try {
      const res = await cancelOrder(orderId, token);
      setOrderToCancel(null);
      setAlertDialog({
        visible: true,
        title: 'Order Cancelled',
        message: res.message || `Order #${orderId} has been cancelled.`,
        type: 'success',
      });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: 'CANCELLED' } : o
        )
      );
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(orderId) });
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
    } catch (err: any) {
      setOrderToCancel(null);
      setAlertDialog({
        visible: true,
        title: 'Error',
        message: err?.message || 'Could not cancel order.',
        type: 'error',
      });
    } finally {
      setCancellingOrderId(null);
    }
  }, [orderToCancel, token]);

  // Separate line items: flatten each order into individual line item cards
  const filteredLineItems = useMemo(() => {
    const list: OrderLineItemCardData[] = [];

    for (const order of orders) {
      // 0. Confirmed Order check: Exclude unverified or failed online payment checkout attempts
      if (!isLegitimateCustomerOrder(order)) {
        continue;
      }

      // 1. Status Filter
      if (!isStatusMatching(order.status, selectedStatus)) {
        continue;
      }

      // Check items
      const items = order.items && order.items.length > 0 ? order.items : [];
      if (items.length === 0) {
        // Fallback card if order has no line items
        const query = debouncedSearch.toLowerCase().trim();
        if (query.length > 0 && !String(order.id).includes(query)) {
          continue;
        }
        list.push({
          cardKey: `order-${order.id}-0`,
          order,
          orderId: order.id,
          orderStatus: order.status,
          orderCreatedAt: order.createdAt,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          recipientName: order.name,
          recipientCity: order.city,
          itemId: 0,
          productId: 0,
          productName: `Order #${order.id}`,
          productImage: FALLBACK_PRODUCT_IMAGE,
          quantity: 1,
          unitPrice: order.total,
          lineItemTotal: order.total,
        });
        continue;
      }

      items.forEach((it, index) => {
        const pName = it.productName || it.product?.name || 'Order Item';
        const pId = it.productId || it.product?.id || 0;
        const pImg = getOrderItemImage(it);
        const qty = Math.max(1, it.quantity || 1);
        const price = typeof it.price === 'number' ? it.price : 0;
        const lineTotal = price * qty;

        // Search Query (matches order ID or product name)
        if (debouncedSearch.trim().length > 0) {
          const query = debouncedSearch.toLowerCase().trim();
          const matchesId = String(order.id).includes(query);
          const matchesName = pName.toLowerCase().includes(query);
          if (!matchesId && !matchesName) {
            return;
          }
        }

        list.push({
          cardKey: `order-${order.id}-item-${it.id || pId || index}`,
          order,
          orderId: order.id,
          orderStatus: order.status,
          orderCreatedAt: order.createdAt,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          recipientName: order.name,
          recipientCity: order.city,
          itemId: it.id || index,
          productId: pId,
          productName: pName,
          productImage: pImg,
          quantity: qty,
          unitPrice: price,
          lineItemTotal: lineTotal,
        });
      });
    }

    return list;
  }, [orders, selectedStatus, debouncedSearch]);

  // Automatically fetch next batch of orders when user scrolls near the bottom
  const loadMoreOrders = useCallback(async () => {
    if (
      !token ||
      loading ||
      refreshing ||
      loadingMore ||
      isFilterScanning ||
      !hasMore ||
      isFetchingMoreRef.current ||
      filteredLineItems.length === 0
    ) {
      return;
    }

    const isTestEnv = (globalThis as any).process?.env?.NODE_ENV === 'test';
    if (!isTestEnv && onEndReachedCalledDuringMomentum.current) {
      return;
    }
    onEndReachedCalledDuringMomentum.current = true;

    isFetchingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = page + 1;
    const currentFetchId = activeFetchId.current;

    try {
      const response = await getMyOrders(token, nextPage, ORDERS_PER_PAGE, selectedStatus);

      if (currentFetchId !== activeFetchId.current) {
        return;
      }

      const nextBatch = (response?.orders || []).filter(isLegitimateCustomerOrder);
      if (nextBatch.length > 0) {
        setOrders((prev) => {
          const existingIds = new Set(prev.map((o) => o.id));
          const newOrders = nextBatch.filter((o) => !existingIds.has(o.id));
          return [...prev, ...newOrders];
        });
        hydrateReviewsForOrders(nextBatch);
      }

      const respPage = typeof response?.page === 'number' ? response.page : nextPage;
      const respTotalPages = typeof response?.totalPages === 'number' ? response.totalPages : totalPages;
      setPage(respPage);
      setTotalPages(respTotalPages);
      setHasMore(respPage < respTotalPages);
    } catch (err) {
      console.warn('Failed to load more orders:', err);
    } finally {
      if (currentFetchId === activeFetchId.current) {
        setLoadingMore(false);
        isFetchingMoreRef.current = false;
      }
    }
  }, [
    token,
    loading,
    refreshing,
    loadingMore,
    isFilterScanning,
    hasMore,
    page,
    totalPages,
    filteredLineItems.length,
    selectedStatus,
    hydrateReviewsForOrders,
  ]);

  // Automatically scan subsequent pages if current loaded orders don't contain any
  // orders matching the selected status filter, up until all pages are exhausted.
  useEffect(() => {
    if (loading || refreshing || loadingMore || isFilterScanning || !hasMore || !token) {
      return;
    }

    const hasMatching = orders.some(
      (o) => isLegitimateCustomerOrder(o) && isStatusMatching(o.status, selectedStatus)
    );

    if (!hasMatching && hasMore) {
      let isMounted = true;
      const fetchId = activeFetchId.current;

      const scanNextPage = async () => {
        setIsFilterScanning(true);
        isFetchingMoreRef.current = true;
        const nextPage = page + 1;

        try {
          const response = await getMyOrders(token, nextPage, ORDERS_PER_PAGE, selectedStatus);
          if (!isMounted || fetchId !== activeFetchId.current) return;

          const nextBatch = (response?.orders || []).filter(isLegitimateCustomerOrder);
          if (nextBatch.length > 0) {
            setOrders((prev) => {
              const existingIds = new Set(prev.map((o) => o.id));
              const newOrders = nextBatch.filter((o) => !existingIds.has(o.id));
              return [...prev, ...newOrders];
            });
            hydrateReviewsForOrders(nextBatch);
          }

          const respPage = typeof response?.page === 'number' ? response.page : nextPage;
          const respTotalPages = typeof response?.totalPages === 'number' ? response.totalPages : totalPages;
          setPage(respPage);
          setTotalPages(respTotalPages);
          setHasMore(respPage < respTotalPages);
        } catch (scanErr) {
          console.warn('Filter scan error:', scanErr);
        } finally {
          if (isMounted && fetchId === activeFetchId.current) {
            setIsFilterScanning(false);
            isFetchingMoreRef.current = false;
          }
        }
      };

      scanNextPage();

      return () => {
        isMounted = false;
      };
    }
  }, [
    selectedStatus,
    orders,
    hasMore,
    page,
    totalPages,
    loading,
    refreshing,
    loadingMore,
    isFilterScanning,
    token,
    hydrateReviewsForOrders,
  ]);

  const handleRateProduct = useCallback(
    (
      productId: number,
      productName: string,
      productImage: string,
      initialRating: number,
      existingReview?: ReviewData | null
    ) => {
      const statusInfo = getStatusDisplay('DELIVERED');
      onRateProduct?.(
        {
          productId,
          productName,
          productImage,
          deliveryDate: statusInfo.dateStr,
        },
        initialRating,
        existingReview
      );
    },
    [onRateProduct, getStatusDisplay]
  );

  const renderProductCardItem = useCallback(
    ({ item }: { item: OrderLineItemCardData }) => {
      const statusInfo = getStatusDisplay(item.orderStatus, item.orderCreatedAt);
      const isCancellable = isOrderCancellable(item.orderStatus);
      const isCancelling = cancellingOrderId === item.orderId;
      const paymentDisplay = getOrderPaymentDisplay(
        item.paymentMethod,
        item.paymentStatus,
        item.orderStatus,
        item.order.total
      );
      const savedReview = item.productId ? productReviews[item.productId] : undefined;

      return (
        <OrderProductCard
          card={item}
          statusInfo={statusInfo}
          paymentDisplay={paymentDisplay}
          isCancellable={isCancellable}
          isCancelling={isCancelling}
          onPay={() => handlePayOrder(item.order)}
          isPaying={payingOrderId === item.orderId}
          onPress={() => onOrderPress && onOrderPress(item.order)}
          onTrack={onTrackOrder ? () => onTrackOrder(item.orderId) : undefined}
          onCancel={() => handleCancelOrder(item.order)}
          onRate={handleRateProduct}
          savedReview={savedReview}
        />
      );
    },
    [
      getStatusDisplay,
      cancellingOrderId,
      payingOrderId,
      productReviews,
      onOrderPress,
      onTrackOrder,
      handleCancelOrder,
      handlePayOrder,
      handleRateProduct,
    ]
  );

  const renderEmptyOrders = useCallback(() => {
    if (loading || isFilterScanning) {
      return (
        <View style={styles.scanningEmptyContainer}>
          <ActivityIndicator size="small" color={theme.colors.brandBlue || theme.colors.primary} />
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary, marginTop: 8 }]}>
            Loading {STATUS_FILTERS.find((s) => s.key === selectedStatus)?.label.toLowerCase() || 'orders'}...
          </Text>
        </View>
      );
    }

    let title = 'No orders yet';
    let subtitle = 'When you place orders, they will appear here with live tracking.';

    if (debouncedSearch.trim().length > 0) {
      title = 'No matching orders found';
      subtitle = `No orders matching "${debouncedSearch.trim()}". Try clearing your search query or selecting a different status filter.`;
    } else {
      switch (selectedStatus) {
        case 'CONFIRMED':
          title = 'No confirmed orders yet';
          subtitle = 'You do not have any confirmed orders in progress.';
          break;
        case 'SHIPPED':
          title = 'No shipped orders yet';
          subtitle = 'You do not have any orders currently in transit.';
          break;
        case 'PENDING':
          title = 'No pending orders yet';
          subtitle = 'You do not have any orders waiting to be processed.';
          break;
        case 'CANCELLED':
          title = 'No cancelled orders yet';
          subtitle = 'You do not have any cancelled orders.';
          break;
        case 'DELIVERED':
          title = 'No delivered orders yet';
          subtitle = 'You do not have any completed deliveries yet.';
          break;
        case 'ALL':
        default:
          title = orders.length === 0 ? 'No orders yet' : 'No matching orders found';
          subtitle =
            orders.length === 0
              ? 'When you place orders, they will appear here with live tracking.'
              : 'Try clearing your search query or selecting a different status filter.';
          break;
      }
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={{ marginBottom: 14 }}>
          <Icon name="package" size={44} color={theme.colors.textMuted} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
          {subtitle}
        </Text>
        {debouncedSearch.trim().length > 0 ? (
          <Pressable
            style={[styles.primaryActionBtn, { backgroundColor: theme.colors.primary }]}
            onPress={handleClearSearch}
          >
            <Text style={[styles.primaryActionText, { color: theme.colors.primaryText }]}>Clear Search</Text>
          </Pressable>
        ) : selectedStatus !== 'ALL' ? (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            {onStartShopping && (
              <Pressable
                style={[styles.primaryActionBtn, { backgroundColor: theme.colors.primary }]}
                onPress={onStartShopping}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.primaryActionText, { color: theme.colors.primaryText }]}>Start Shopping</Text>
                  <Icon name="chevron-right" size={15} color={theme.colors.primaryText} strokeWidth={2.5} />
                </View>
              </Pressable>
            )}
            <Pressable
              style={[
                styles.primaryActionBtn,
                { backgroundColor: theme.colors.surfaceSubtle, borderWidth: 1, borderColor: theme.colors.border },
              ]}
              onPress={() => handleStatusChange('ALL')}
            >
              <Text style={[styles.primaryActionText, { color: theme.colors.text }]}>View All Orders</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.primaryActionBtn, { backgroundColor: theme.colors.primary }]}
            onPress={onStartShopping}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.primaryActionText, { color: theme.colors.primaryText }]}>Start Shopping</Text>
              <Icon name="chevron-right" size={15} color={theme.colors.primaryText} strokeWidth={2.5} />
            </View>
          </Pressable>
        )}
      </View>
    );
  }, [
    loading,
    isFilterScanning,
    debouncedSearch,
    selectedStatus,
    orders.length,
    theme.colors,
    handleClearSearch,
    handleStatusChange,
    onStartShopping,
  ]);

  // Guest view if not signed in
  if (!user) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
        <View
          style={[
            styles.headerBar,
            {
              backgroundColor: theme.colors.card,
              borderBottomColor: theme.colors.borderLight,
            },
          ]}
        >
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
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            My Orders
          </Text>
        </View>

        <View style={styles.centerContainer}>
          <View
            style={[
              styles.guestIconCircle,
              { backgroundColor: theme.colors.surfaceSubtle },
            ]}
          >
            <Icon name="orders" size={44} color={theme.colors.textMuted} />
          </View>
          <Text style={[styles.guestTitle, { color: theme.colors.text }]}>
            Sign In to View Orders
          </Text>
          <Text style={[styles.guestSubtitle, { color: theme.colors.textSecondary }]}>
            Please sign in with your account to view your purchase history, track active orders, and write reviews.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            style={({ pressed }) => [
              styles.primaryActionBtn,
              {
                backgroundColor: theme.colors.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={onNavigateToLogin}
          >
            <Text style={[styles.primaryActionText, { color: theme.colors.primaryText }]}>Sign In Now</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
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
        <View style={styles.headerLeftCol}>
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
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            My Orders
          </Text>
        </View>
      </View>

      {/* Search Bar for Orders */}
      <View
        style={[
          styles.searchBoxContainer,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View style={{ marginRight: 8 }}>
          <Icon name="search" size={18} color={theme.colors.textMuted} />
        </View>
        <TextInput
          accessibilityLabel="Search in your orders"
          placeholder="Search by order ID or product name..."
          placeholderTextColor={theme.colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => setDebouncedSearch(searchQuery)}
          style={[styles.searchInput, { color: theme.colors.text }]}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={handleClearSearch} style={styles.clearBtn}>
            <Icon name="close" size={16} color={theme.colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Filter Status Chips */}
      <View style={styles.filterChipsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsContent}
        >
          {STATUS_FILTERS.map((item) => {
            const isSelected = selectedStatus === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${item.label}`}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.chipSelectedBg
                      : theme.colors.chipUnselectedBg,
                    borderColor: isSelected
                      ? theme.colors.chipSelectedBg
                      : theme.colors.border,
                  },
                ]}
                onPress={() => handleStatusChange(item.key)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isSelected
                        ? theme.colors.chipSelectedText
                        : theme.colors.chipUnselectedText,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Order List */}
      {loading && orders.length === 0 ? (
        <FullPageContentLoader message="Loading your Orders..." />
      ) : error && orders.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={{ marginBottom: 12 }}>
            <Icon name="alert-triangle" size={38} color={theme.colors.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            Unable to load orders
          </Text>
          <Text
            style={[
              styles.emptySubtitle,
              { color: theme.colors.textSecondary },
            ]}
          >
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading orders"
            style={[styles.primaryActionBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => fetchOrders()}
          >
            <Text style={[styles.primaryActionText, { color: theme.colors.primaryText }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.contentWrapper}>
          <FlatList
            data={filteredLineItems}
            keyExtractor={(item) => item.cardKey}
            renderItem={renderProductCardItem}
            contentContainerStyle={
              filteredLineItems.length === 0
                ? styles.emptyListContent
                : styles.listContent
            }
            ListEmptyComponent={renderEmptyOrders}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            onMomentumScrollBegin={() => {
              onEndReachedCalledDuringMomentum.current = false;
            }}
            onEndReached={loadMoreOrders}
            onEndReachedThreshold={0.4}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['transparent']}
                tintColor="transparent"
                progressBackgroundColor="transparent"
              />
            }
            ListFooterComponent={
              loadingMore && filteredLineItems.length > 0 ? (
                <View style={styles.listFooterContainer}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 }}>
                    <ActivityIndicator size="small" color={theme.colors.brandBlue || theme.colors.primary} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary }}>
                      Loading more orders...
                    </Text>
                  </View>
                  <View style={styles.bottomSpacer} />
                </View>
              ) : !hasMore && filteredLineItems.length > 0 ? (
                <View style={styles.listFooterContainer}>
                  <View style={styles.endOfListRow}>
                    <View
                      style={[
                        styles.endOfListDivider,
                        { backgroundColor: theme.colors.borderLight },
                      ]}
                    />
                    <View
                      style={[
                        styles.endOfListBadge,
                        {
                          backgroundColor: theme.colors.surfaceSubtle,
                          borderColor: theme.colors.borderLight,
                        },
                      ]}
                    >
                      <Icon
                        name="check"
                        size={12}
                        color={theme.colors.textMuted}
                        strokeWidth={2.4}
                      />
                      <Text
                        style={[
                          styles.endOfListText,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        All {filteredLineItems.length} orders loaded
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.endOfListDivider,
                        { backgroundColor: theme.colors.borderLight },
                      ]}
                    />
                  </View>
                  <View style={styles.bottomSpacer} />
                </View>
              ) : (
                <View style={styles.bottomSpacer} />
              )
            }
            showsVerticalScrollIndicator={false}
          />
          {refreshing && (
            <FullPageContentLoader
              message="Loading your Orders..."
              overlay
            />
          )}
        </View>
      )}

      {/* Modern Order Cancellation Confirmation Dialog */}
      <ConfirmDialog
        visible={!!orderToCancel}
        title="Cancel Order?"
        message={
          orderToCancel
            ? `Are you sure you want to cancel order #${orderToCancel.id}? This action cannot be undone.`
            : ''
        }
        icon="alert-triangle"
        cancelText="Keep Order"
        confirmText="Yes, Cancel Order"
        isDestructive={true}
        loading={cancellingOrderId !== null}
        onCancel={() => setOrderToCancel(null)}
        onConfirm={executeCancelOrder}
      />

      {/* Payment Options Dialog */}
      <AppDialog
        visible={!!orderForPaymentDialog}
        onClose={() => setOrderForPaymentDialog(null)}
        title={
          orderForPaymentDialog?.paymentStatus === 'FAILED'
            ? 'Retry Payment'
            : 'Complete Payment'
        }
        subtitle={`Order #${orderForPaymentDialog?.id} · Total: ${orderForPaymentDialog ? formatPrice(orderForPaymentDialog.total) : ''
          }`}
        icon="credit-card"
        iconColor={theme.colors.primary}
        iconBgColor={theme.colors.surfaceSubtle}
      >
        {orderForPaymentDialog && (
          <View style={{ gap: 12, marginTop: 8 }}>
            <Text style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 }}>
              {orderForPaymentDialog.paymentMethod?.toUpperCase() === 'COD'
                ? 'Pay online now to avoid cash handling and confirm your order instantly.'
                : 'Your previous payment attempt was not completed. You can retry paying online or switch to Cash on Delivery.'}
            </Text>

            {/* Option 1: Razorpay Online Payment */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pay Online with Razorpay"
              style={[
                styles.paymentOptionButton,
                { backgroundColor: theme.colors.primary },
              ]}
              onPress={() => handlePayOnlineWithRazorpay(orderForPaymentDialog)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Icon name="shield" size={16} color={theme.colors.primaryText} />
                <Text style={[styles.paymentOptionButtonText, { color: theme.colors.primaryText }]}>
                  {orderForPaymentDialog.paymentStatus === 'FAILED'
                    ? 'Retry Razorpay Online'
                    : 'Pay Online with Razorpay'}
                </Text>
              </View>
            </Pressable>

            {/* Option 2: Switch to COD if currently Razorpay/Online */}
            {orderForPaymentDialog.paymentMethod?.toUpperCase() !== 'COD' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Switch to Cash on Delivery"
                style={[
                  styles.paymentOptionButton,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: theme.colors.border,
                    borderWidth: 1,
                  },
                ]}
                onPress={() => handleSwitchToCod(orderForPaymentDialog)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Icon name="truck" size={16} color={theme.colors.text} />
                  <Text style={[styles.paymentOptionButtonText, { color: theme.colors.text }]}>
                    Switch to Cash on Delivery (COD)
                  </Text>
                </View>
              </Pressable>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={styles.paymentCancelButton}
              onPress={() => setOrderForPaymentDialog(null)}
            >
              <Text style={{ fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', fontWeight: '600' }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        )}
      </AppDialog>

      {/* Alert Dialog (Feedback for cancellation / payment / error) */}
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
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  searchBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  filterChipsRow: {
    marginBottom: 8,
  },
  filterChipsContent: {
    paddingHorizontal: 12,
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 24,
  },
  orderCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  cardMainRow: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  thumbnailContainer: {
    width: 72,
    height: 72,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    marginRight: 12,
    flexShrink: 0,
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
  },
  cardInfoCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  statusTitleText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  orderProductName: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    marginBottom: 2,
  },
  statusDescText: {
    fontSize: 11,
    marginBottom: 6,
  },
  orderMetaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  orderIdBadge: {
    fontSize: 11,
    fontWeight: '600',
  },
  paymentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  paymentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  orderMetaBottomRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'wrap',
  },
  orderPriceBadge: {
    fontSize: 13,
    fontWeight: '800',
  },
  orderItemCountText: {
    fontSize: 11,
    fontWeight: '500',
  },
  chevronCol: {
    paddingLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardBottomActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addressContainer: {
    flex: 1,
    minWidth: 130,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  orderPlacedOnText: {
    fontSize: 11,
  },
  trackOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  trackOrderBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cancelOrderTextBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cancelOrderText: {
    fontSize: 12,
    fontWeight: '700',
  },
  deliveredRatingSection: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ratingSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  ratingStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineStarPressable: {
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rateActionTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  rateActionTextLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  guestIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  guestSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryActionBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    maxWidth: 320,
  },
  scanningEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  payOrderBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  payOrderBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  paymentOptionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentOptionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  paymentCancelButton: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listFooterContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  endOfListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  endOfListDivider: {
    flex: 1,
    height: 1,
  },
  endOfListBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 10,
  },
  endOfListText: {
    fontSize: 11,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 20,
  },
});
