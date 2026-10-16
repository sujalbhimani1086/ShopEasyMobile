import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
  getOrderDetails,
  cancelOrder,
  isOrderCancellable,
  isOrderPayable,
  getOrderPaymentDisplay,
  updateOrderPaymentMethod,
} from '../services/orderApi';
import {
  executeRazorpayCheckout,
  parseRazorpayError,
} from '../services/paymentApi';
import { OrderTrackingTimeline } from '../components/OrderTrackingTimeline';
import { resolveImageUrl } from '../config/api';
import { formatPrice } from '../utils/price';
import type { Order, OrderItem } from '../types/order';
import { Icon, IconName } from '../components/Icon';
import { FullPageContentLoader } from '../components/common';
import { withRandomLoadingDuration } from '../utils/loadingUtils';
import {
  isOrderEligibleForInvoice,
  downloadOrderInvoice,
  openInvoicePdf,
} from '../services/invoiceService';


export interface OrderDetailsScreenProps {
  orderId: number;
  initialOrder?: Order;
  onBack: () => void;
  onProductPress?: (productId: number) => void;
  onOrderUpdated?: (updatedOrder: Order) => void;
  onTrackOrder?: (orderId: number) => void;
}

export const OrderDetailsScreen: React.FC<OrderDetailsScreenProps> = ({
  orderId,
  initialOrder,
  onBack,
  onProductPress,
  onOrderUpdated,
  onTrackOrder,
}) => {
  const theme = useAppTheme();
  const { token } = useAuth();

  const [localOrder, setLocalOrder] = useState<Order | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);

  // TanStack Query for order details
  const {
    data: fetchedOrderData,
    isLoading: isOrderLoading,
    error: orderQueryError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.order(orderId),
    queryFn: async () => {
      if (!token) return null;
      const fetched = await withRandomLoadingDuration(() =>
        getOrderDetails(orderId, token)
      );
      if (fetched && onOrderUpdated) {
        onOrderUpdated(fetched);
      }
      return fetched || null;
    },
    enabled: !!token,
    initialData: initialOrder,
  });

  const order = localOrder || fetchedOrderData || initialOrder || null;
  const loading = isOrderLoading && !order;
  const error = !order && orderQueryError ? (orderQueryError as any)?.message || 'Unable to load order details. Please retry.' : null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const [isCancelConfirmVisible, setIsCancelConfirmVisible] = useState(false);
  const [alertDialog, setAlertDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type?: AlertType;
  } | null>(null);

  // Invoice Download states and handlers
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const invoiceDownloadingRef = React.useRef(false);
  const [invoiceSuccessDialog, setInvoiceSuccessDialog] = useState<{
    visible: boolean;
    filePath: string;
    fileName: string;
  } | null>(null);

  const handleDownloadInvoice = async () => {
    if (!order || invoiceDownloadingRef.current) return;

    // Strict double-check validation before generation
    if (!isOrderEligibleForInvoice(order)) {
      setAlertDialog({
        visible: true,
        title: 'Invoice Unavailable',
        message: 'Invoices can only be downloaded for orders that are Delivered and have Verified Payment.',
        type: 'warning',
      });
      return;
    }

    invoiceDownloadingRef.current = true;
    setDownloadingInvoice(true);

    try {
      const result = await downloadOrderInvoice(order);
      setInvoiceSuccessDialog({
        visible: true,
        filePath: result.filePath,
        fileName: result.fileName,
      });
    } catch (err: any) {
      console.error('Invoice download failed:', err);
      setAlertDialog({
        visible: true,
        title: 'Invoice Download Failed',
        message: err?.message || 'Unable to generate or save PDF invoice. Please check storage permissions and retry.',
        type: 'error',
      });
    } finally {
      invoiceDownloadingRef.current = false;
      setDownloadingInvoice(false);
    }
  };

  const handleOpenDownloadedInvoice = async () => {
    if (!invoiceSuccessDialog?.filePath) return;
    try {
      await openInvoicePdf(invoiceSuccessDialog.filePath);
      setInvoiceSuccessDialog(null);
    } catch (err: any) {
      setAlertDialog({
        visible: true,
        title: 'Open PDF',
        message: err?.message || 'Unable to open PDF viewer. The file is saved in your Android Downloads folder.',
        type: 'info',
      });
    }
  };

  // Payment states and handlers
  const [isPaying, setIsPaying] = useState(false);
  const payingRef = React.useRef(false);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);

  const handlePayOnlineWithRazorpay = async () => {
    if (!order || !token || payingRef.current) return;
    payingRef.current = true;
    setIsPaying(true);
    setShowPaymentOptions(false);

    try {
      const updatedOrder = await executeRazorpayCheckout({
        orderId: order.id,
        amount: order.total,
        customerName: order.name || undefined,
        customerEmail: order.email || undefined,
        token,
      });

      setLocalOrder(updatedOrder);
      if (onOrderUpdated) {
        onOrderUpdated(updatedOrder);
      }

      setAlertDialog({
        visible: true,
        title: 'Payment Successful',
        message: `Payment of ${formatPrice(order.total)} for Order #${order.id} was verified successfully.`,
        type: 'success',
      });

      await refetch();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(order.id) });
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
    } catch (payErr: any) {
      console.log('Razorpay payment error in Order Details:', payErr);
      const parsed = parseRazorpayError(payErr);
      setAlertDialog({
        visible: true,
        title: parsed.title,
        message: parsed.message,
        type: parsed.isCancelled ? 'info' : 'error',
      });
    } finally {
      payingRef.current = false;
      setIsPaying(false);
    }
  };

  const handleSwitchToCod = async () => {
    if (!order || !token || payingRef.current) return;
    payingRef.current = true;
    setIsPaying(true);
    setShowPaymentOptions(false);

    try {
      const res = await updateOrderPaymentMethod(order.id, 'COD', token);
      if (res.order) {
        setLocalOrder(res.order);
        if (onOrderUpdated) {
          onOrderUpdated(res.order);
        }
      }
      setAlertDialog({
        visible: true,
        title: 'Switched to Cash on Delivery',
        message: `Order #${order.id} is now set to Cash on Delivery. You can pay ${formatPrice(order.total)} upon delivery.`,
        type: 'success',
      });
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(order.id) });
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
    } catch (err: any) {
      setAlertDialog({
        visible: true,
        title: 'Update Failed',
        message: err?.message || 'Could not change payment method to COD.',
        type: 'error',
      });
    } finally {
      payingRef.current = false;
      setIsPaying(false);
    }
  };

  // Handle Order Cancellation with confirmation modal
  const handleCancelOrder = () => {
    if (!order || !token) return;

    if (!isOrderCancellable(order.status)) {
      setAlertDialog({
        visible: true,
        title: 'Cancellation Not Available',
        message: 'This order has already shipped or been completed and can no longer be cancelled.',
        type: 'warning',
      });
      return;
    }

    setIsCancelConfirmVisible(true);
  };

  const executeCancelOrder = async () => {
    if (!order || !token) return;
    setCancelling(true);
    try {
      const res = await cancelOrder(order.id, token);
      setIsCancelConfirmVisible(false);
      setAlertDialog({
        visible: true,
        title: 'Order Cancelled',
        message: res.message || 'Your order has been cancelled.',
        type: 'success',
      });
      setLocalOrder((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(order.id) });
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
    } catch (err: any) {
      setIsCancelConfirmVisible(false);
      setAlertDialog({
        visible: true,
        title: 'Cancellation Status',
        message: err?.message || 'Unable to cancel this order. Please contact customer support.',
        type: 'error',
      });
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // Status Badge Colors, Label & Icon
  const getStatusStyle = (status: string): { bg: string; text: string; label: string; icon: IconName } => {
    const upper = (status || '').toUpperCase();
    switch (upper) {
      case 'DELIVERED':
      case 'COMPLETED':
        return {
          bg: theme.colors.successBg,
          text: theme.colors.success,
          label: 'Delivered',
          icon: 'check-circle',
        };
      case 'SHIPPED':
        return {
          bg: 'rgba(147, 51, 234, 0.12)',
          text: '#9333EA',
          label: 'Shipped',
          icon: 'truck',
        };
      case 'PACKED':
        return {
          bg: theme.colors.surfaceSubtle,
          text: theme.colors.primary,
          label: 'Packed',
          icon: 'package',
        };
      case 'CONFIRMED':
        return {
          bg: 'rgba(14, 165, 233, 0.12)',
          text: '#0EA5E9',
          label: 'Confirmed',
          icon: 'check',
        };
      case 'CANCELLED':
        return {
          bg: theme.colors.dangerBg,
          text: theme.colors.danger,
          label: 'Cancelled',
          icon: 'close',
        };
      case 'PENDING':
      default:
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          text: '#F59E0B',
          label: 'Order Placed',
          icon: 'clock',
        };
    }
  };

  if (loading && !order) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
        {/* Screen Header stays visible */}
        <View
          style={[
            styles.headerBar,
            {
              backgroundColor: theme.colors.card,
              borderBottomColor: theme.colors.borderLight,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.headerBtn,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={onBack}
          >
            <Icon name="arrow-left" size={20} color={theme.colors.text} />
          </Pressable>

          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Order #{orderId}
            </Text>
          </View>

          <View style={styles.headerBtn} />
        </View>

        <FullPageContentLoader message="Loading order details..." />
      </SafeAreaView>
    );
  }

  if (error && !order) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.centerContainer}>
          <View
            style={[
              styles.cardBox,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.borderLight,
              },
            ]}
          >
            <View style={{ marginBottom: 12 }}>
              <Icon name="alert-triangle" size={40} color={theme.colors.danger} />
            </View>
            <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
              {error}
            </Text>
            <View style={styles.errorBtnRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                style={[
                  styles.secondaryBtn,
                  { borderColor: theme.colors.borderLight },
                ]}
                onPress={onBack}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                  Go Back
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry"
                style={[
                  styles.primaryBtn,
                  { backgroundColor: theme.colors.primary },
                ]}
                onPress={() => refetch()}
              >
                <Text
                  style={{
                    color: theme.colors.primaryText,
                    fontWeight: '800',
                  }}
                >
                  Retry
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) return null;

  const statusInfo = getStatusStyle(order.status);
  const isCancellable = isOrderCancellable(order.status);
  const isCancelled = order.status?.toUpperCase() === 'CANCELLED';
  const totalItemsCount = order.items.reduce((acc, it) => acc + it.quantity, 0);
  const paymentDisplay = getOrderPaymentDisplay(
    order.paymentMethod,
    order.paymentStatus,
    order.status,
    order.total
  );
  const canDownloadInvoice = isOrderEligibleForInvoice(order);

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            styles.headerBtn,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={onBack}
        >
          <Icon name="arrow-left" size={20} color={theme.colors.text} />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Order #{order.id}
          </Text>
          <Text
            style={[styles.headerSubtitle, { color: theme.colors.textMuted }]}
          >
            {formatDate(order.createdAt)}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh order status"
          style={({ pressed }) => [
            styles.headerBtn,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={() => onRefresh()}
        >
          <Icon name="refresh" size={18} color={theme.colors.text} />
        </Pressable>
      </View>

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
        {/* Status & ID Summary Card */}
        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.borderLight,
            },
          ]}
        >
          <View style={styles.summaryTopRow}>
            <View>
              <Text
                style={[
                  styles.orderSummaryHeading,
                  { color: theme.colors.text },
                ]}
              >
                Order #{order.id}
              </Text>
              <Text
                style={[
                  styles.orderSummaryPlacedOn,
                  { color: theme.colors.textMuted },
                ]}
              >
                Placed on {formatDate(order.createdAt)}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusInfo.bg,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                },
              ]}
            >
              <Icon name={statusInfo.icon} size={13} color={statusInfo.text} />
              <Text style={[styles.statusBadgeText, { color: statusInfo.text }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>

          {/* Quick Stats Pill Row */}
          <View
            style={[
              styles.statsPillRow,
              { backgroundColor: theme.colors.surfaceSubtle },
            ]}
          >
            <View style={styles.statCol}>
              <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>
                Items
              </Text>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {totalItemsCount} item{totalItemsCount === 1 ? '' : 's'}
              </Text>
            </View>

            <View
              style={[
                styles.statDivider,
                { backgroundColor: theme.colors.borderLight },
              ]}
            />

            <View style={styles.statCol}>
              <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>
                Total
              </Text>
              <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                {formatPrice(order.total)}
              </Text>
            </View>

            <View
              style={[
                styles.statDivider,
                { backgroundColor: theme.colors.borderLight },
              ]}
            />

            <View style={styles.statCol}>
              <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>
                Payment
              </Text>
              {(() => {
                const paymentDisplay = getOrderPaymentDisplay(
                  order.paymentMethod,
                  order.paymentStatus,
                  order.status
                );
                return (
                  <Text
                    style={[
                      styles.statValue,
                      {
                        color: paymentDisplay.isPaid
                          ? theme.colors.success
                          : theme.colors.accent,
                      },
                    ]}
                  >
                    {paymentDisplay.label}
                  </Text>
                );
              })()}
            </View>
          </View>
        </View>

        {/* Live Order Tracking Action Card */}
        {onTrackOrder && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open live tracking for order #${order.id}`}
            style={({ pressed }) => [
              styles.trackOrderFullBtn,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={() => onTrackOrder(order.id)}
          >
            <View style={[styles.trackOrderIconCircle, { backgroundColor: theme.colors.surfaceSubtle }]}>
              <Icon name="truck" size={20} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.trackOrderBtnTitle, { color: theme.colors.text }]}>
                  Live Order Tracking
                </Text>
                <View style={[styles.liveDot, { backgroundColor: '#10b981' }]} />
              </View>
              <Text style={[styles.trackOrderBtnSub, { color: theme.colors.textSecondary }]}>
                View real-time 5-stage progress and timeline
              </Text>
            </View>
            <Icon name="chevron-right" size={18} color={theme.colors.primary} />
          </Pressable>
        )}

        {/* Tracking Timeline */}
        <OrderTrackingTimeline
          status={order.status}
          createdAt={order.createdAt}
        />

        {/* Cancellation Notice / Action Section */}
        {isCancelled ? (
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(239, 68, 68, 0.12)'
                  : 'rgba(239, 68, 68, 0.06)',
                borderColor: theme.isDark
                  ? 'rgba(239, 68, 68, 0.3)'
                  : 'rgba(239, 68, 68, 0.2)',
              },
            ]}
          >
            <View style={{ marginRight: 8, marginTop: 2 }}>
              <Icon name="close" size={18} color={theme.colors.danger} />
            </View>
            <View style={styles.infoTextCol}>
              <Text style={[styles.infoTitle, { color: theme.colors.danger }]}>
                Order Cancelled
              </Text>
              <Text
                style={[
                  styles.infoSubtitle,
                  { color: theme.isDark ? '#FCA5A5' : '#7F1D1D' },
                ]}
              >
                This order was cancelled and no amount will be charged.
              </Text>
            </View>
          </View>
        ) : isCancellable ? (
          <View
            style={[
              styles.cancellationActionCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.borderLight,
              },
            ]}
          >
            <View style={styles.cancellationHeader}>
              <Text
                style={[styles.cancellationTitle, { color: theme.colors.text }]}
              >
                Order Cancellation
              </Text>
              <Text
                style={[
                  styles.cancellationSubtitle,
                  { color: theme.colors.textMuted },
                ]}
              >
                Eligible for cancellation before delivery (Order Placed, Confirmed, Packed, or Shipped).
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Cancel Order #${order.id}`}
              disabled={cancelling}
              style={({ pressed }) => [
                styles.cancelOrderBtn,
                {
                  borderColor: theme.colors.danger,
                  backgroundColor: theme.isDark
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(239, 68, 68, 0.08)',
                  opacity: cancelling ? 0.6 : pressed ? 0.8 : 1,
                },
              ]}
              onPress={handleCancelOrder}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color={theme.colors.danger} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Icon name="close" size={15} color={theme.colors.danger} />
                  <Text
                    style={[
                      styles.cancelOrderBtnText,
                      { color: theme.colors.danger },
                    ]}
                  >
                    Cancel Order #{order.id}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        ) : (
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                borderColor: theme.colors.borderLight,
              },
            ]}
          >
            <View style={{ marginRight: 8, marginTop: 2 }}>
              <Icon name="info" size={18} color={theme.colors.textMuted} />
            </View>
            <View style={styles.infoTextCol}>
              <Text
                style={[styles.infoTitle, { color: theme.colors.text }]}
              >
                Shipped / Delivered Orders
              </Text>
              <Text
                style={[
                  styles.infoSubtitle,
                  { color: theme.colors.textSecondary },
                ]}
              >
                This order is in delivery transit or completed and can no longer be
                cancelled online. Please contact support if you need assistance.
              </Text>
            </View>
          </View>
        )}

        {/* Download Invoice Card (Strictly for Delivered and Paid Orders) */}
        {canDownloadInvoice && (
          <View
            style={[
              styles.invoiceCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.isDark ? '#059669' : '#10B981',
              },
            ]}
          >
            <View style={styles.invoiceHeaderRow}>
              <View
                style={[
                  styles.invoiceIconCircle,
                  {
                    backgroundColor: theme.isDark
                      ? 'rgba(16, 185, 129, 0.2)'
                      : '#ECFDF5',
                  },
                ]}
              >
                <Icon name="file-text" size={22} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.invoiceTitle, { color: theme.colors.text }]}>
                  Official Tax Invoice
                </Text>
                <Text
                  style={[
                    styles.invoiceSubtitle,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Order delivered & payment confirmed. Download genuine PDF receipt.
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Download Invoice"
              disabled={downloadingInvoice}
              style={({ pressed }) => [
                styles.downloadInvoiceBtn,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: downloadingInvoice ? 0.7 : pressed ? 0.85 : 1,
                },
              ]}
              onPress={handleDownloadInvoice}
            >
              {downloadingInvoice ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <ActivityIndicator size="small" color={theme.colors.primaryText} />
                  <Text
                    style={[
                      styles.downloadInvoiceBtnText,
                      { color: theme.colors.primaryText },
                    ]}
                  >
                    Generating & Saving PDF...
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Icon name="download" size={16} color={theme.colors.primaryText} />
                  <Text
                    style={[
                      styles.downloadInvoiceBtnText,
                      { color: theme.colors.primaryText },
                    ]}
                  >
                    Download Invoice
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        )}

        {/* Items List Card */}
        <View
          style={[
            styles.cardBox,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.borderLight,
            },
          ]}
        >
          <View style={styles.cardSectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Items Ordered ({order.items.length})
            </Text>
          </View>

          <View style={styles.itemsList}>
            {order.items.map((item, index) => {
              const productImg = item.productImage || item.product?.image;
              const productName =
                item.productName || item.product?.name || 'ShopEasy Product';
              const imgUri = resolveImageUrl(productImg);
              const isLast = index === order.items.length - 1;

              return (
                <View key={item.id || index}>
                  <Pressable
                    style={styles.itemRow}
                    onPress={() => {
                      if (item.productId && onProductPress) {
                        onProductPress(item.productId);
                      }
                    }}
                  >
                    <Image
                      source={{ uri: imgUri }}
                      style={styles.itemThumbnail}
                      resizeMode="contain"
                    />

                    <View style={styles.itemInfo}>
                      <Text
                        style={[styles.itemTitle, { color: theme.colors.text }]}
                        numberOfLines={2}
                      >
                        {productName}
                      </Text>
                      <Text
                        style={[
                          styles.itemMeta,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        Qty: {item.quantity} × {formatPrice(item.price)}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.itemPriceTotal,
                        { color: theme.colors.text },
                      ]}
                    >
                      {formatPrice(item.price * item.quantity)}
                    </Text>
                  </Pressable>

                  {!isLast && (
                    <View
                      style={[
                        styles.itemDivider,
                        { backgroundColor: theme.colors.borderLight },
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Delivery Address Card */}
        <View
          style={[
            styles.cardBox,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.borderLight,
            },
          ]}
        >
          <View style={styles.cardSectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Delivery Address
            </Text>
          </View>

          <View style={styles.addressContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Icon name="map-pin" size={15} color={theme.colors.primary} />
              <Text
                style={[styles.addressRecipient, { color: theme.colors.text }]}
              >
                {order.name || 'Recipient'}
              </Text>
            </View>
            {order.email ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Icon name="mail" size={14} color={theme.colors.textSecondary} />
                <Text
                  style={[styles.addressLine, { color: theme.colors.textSecondary }]}
                >
                  {order.email}
                </Text>
              </View>
            ) : null}
            <Text
              style={[styles.addressLine, { color: theme.colors.textSecondary }]}
            >
              {order.address || 'Street address'}
            </Text>
            <Text
              style={[styles.addressLine, { color: theme.colors.textSecondary }]}
            >
              {order.city ? `${order.city}` : ''}
              {order.pincode ? ` - ${order.pincode}` : ''}
            </Text>
          </View>
        </View>

        {/* Pricing Summary Breakdown */}
        <View
          style={[
            styles.cardBox,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.borderLight,
            },
          ]}
        >
          <View style={styles.cardSectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Payment Summary
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: theme.colors.textMuted }]}>
              Subtotal
            </Text>
            <Text style={[styles.priceValue, { color: theme.colors.text }]}>
              {formatPrice(order.subtotal ?? (order.total + (order.discount || 0)))}
            </Text>
          </View>

          {typeof order.discount === 'number' && order.discount > 0 && (
            <View style={styles.priceRow}>
              <Text
                style={[styles.priceLabel, { color: theme.colors.success }]}
              >
                Coupon Discount {order.couponCode ? `(${order.couponCode})` : ''}
              </Text>
              <Text
                style={[styles.priceValue, { color: theme.colors.success }]}
              >
                - {formatPrice(order.discount)}
              </Text>
            </View>
          )}

          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: theme.colors.textMuted }]}>
              Delivery Fee
            </Text>
            <Text style={[styles.priceValue, { color: theme.colors.success }]}>
              FREE
            </Text>
          </View>

          <View
            style={[
              styles.priceDivider,
              { backgroundColor: theme.colors.borderLight },
            ]}
          />

          {/* Payment Method Breakdown */}
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: theme.colors.textMuted }]}>
              Payment Method
            </Text>
            <Text style={[styles.priceValue, { color: theme.colors.text }]}>
              {paymentDisplay.method === 'Online' ? 'Online (Razorpay)' : 'Cash on Delivery (COD)'}
            </Text>
          </View>

          {/* Payment Status Breakdown */}
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: theme.colors.textMuted }]}>
              Payment Status
            </Text>
            <View
              style={[
                styles.paymentStatusBadge,
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
                  styles.paymentStatusBadgeText,
                  {
                    color: paymentDisplay.isPaid
                      ? '#10B981'
                      : paymentDisplay.statusText === 'Failed'
                      ? '#EF4444'
                      : '#F59E0B',
                  },
                ]}
              >
                {paymentDisplay.statusText}
              </Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text
              style={[
                styles.priceTotalLabel,
                { color: theme.colors.text },
              ]}
            >
              {paymentDisplay.isPaid ? 'Total Paid' : 'Total Payable'}
            </Text>
            <Text
              style={[
                styles.priceTotalValue,
                { color: theme.colors.primary },
              ]}
            >
              {formatPrice(order.total)}
            </Text>
          </View>

          {/* Pay Now / Retry Payment Button for Eligible Unpaid Orders */}
          {paymentDisplay.isPayable && (
            <View style={styles.paymentActionSection}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${paymentDisplay.actionLabel} for Order #${order.id}`}
                disabled={isPaying}
                style={({ pressed }) => [
                  styles.payDetailsBtn,
                  {
                    backgroundColor:
                      paymentDisplay.actionLabel === 'Retry Payment'
                        ? '#DC2626'
                        : theme.colors.primary,
                    opacity: isPaying ? 0.6 : pressed ? 0.85 : 1,
                  },
                ]}
                onPress={() => setShowPaymentOptions(true)}
              >
                {isPaying ? (
                  <ActivityIndicator size="small" color={theme.colors.primaryText} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Icon name="credit-card" size={16} color={theme.colors.primaryText} />
                    <Text style={[styles.payDetailsBtnText, { color: theme.colors.primaryText }]}>
                      {paymentDisplay.actionLabel} ({formatPrice(order.total)})
                    </Text>
                  </View>
                )}
              </Pressable>
              {paymentDisplay.method === 'COD' ? (
                <Text style={[styles.paymentHelpHint, { color: theme.colors.textMuted }]}>
                  Avoid carrying cash by completing payment online via Razorpay.
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {/* Help & Support note */}
        <View
          style={[
            styles.supportCard,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              borderColor: theme.colors.borderLight,
            },
          ]}
        >
          <Text style={[styles.supportTitle, { color: theme.colors.text }]}>
            Questions about your order?
          </Text>
          <Text
            style={[styles.supportSubtitle, { color: theme.colors.textMuted }]}
          >
            Please reference Order #{order.id} when reaching out to support.
          </Text>
        </View>
      </ScrollView>
      {refreshing && (
        <FullPageContentLoader
          message="Loading order details..."
          overlay
        />
      )}
    </View>

      {/* Modern Order Cancellation Confirmation Dialog */}
      <ConfirmDialog
        visible={isCancelConfirmVisible}
        title="Cancel Order?"
        message={
          order
            ? `Are you sure you want to cancel Order #${order.id}? This action cannot be undone.`
            : ''
        }
        icon="alert-triangle"
        cancelText="Keep Order"
        confirmText="Yes, Cancel Order"
        isDestructive={true}
        loading={cancelling}
        onCancel={() => setIsCancelConfirmVisible(false)}
        onConfirm={executeCancelOrder}
      />

      {/* Payment Options Dialog */}
      <AppDialog
        visible={showPaymentOptions}
        onClose={() => setShowPaymentOptions(false)}
        title={
          order?.paymentStatus === 'FAILED'
            ? 'Retry Payment'
            : 'Complete Payment'
        }
        subtitle={`Order #${order?.id} · Total: ${
          order ? formatPrice(order.total) : ''
        }`}
        icon="credit-card"
        iconColor={theme.colors.primary}
        iconBgColor={theme.colors.surfaceSubtle}
      >
        {order && (
          <View style={{ gap: 12, marginTop: 8 }}>
            <Text style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 }}>
              {order.paymentMethod?.toUpperCase() === 'COD'
                ? 'Pay online now to avoid cash handling and confirm your order instantly.'
                : 'Your previous payment attempt was not completed. You can retry paying online or switch to Cash on Delivery.'}
            </Text>

            {/* Option 1: Razorpay Online Payment */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pay Online with Razorpay"
              style={[
                styles.paymentOptionBtn,
                { backgroundColor: theme.colors.primary },
              ]}
              onPress={handlePayOnlineWithRazorpay}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Icon name="shield" size={16} color={theme.colors.primaryText} />
                <Text style={[styles.paymentOptionBtnText, { color: theme.colors.primaryText }]}>
                  {order.paymentStatus === 'FAILED'
                    ? 'Retry Razorpay Online'
                    : 'Pay Online with Razorpay'}
                </Text>
              </View>
            </Pressable>

            {/* Option 2: Switch to COD if currently Razorpay/Online */}
            {order.paymentMethod?.toUpperCase() !== 'COD' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Switch to Cash on Delivery"
                style={[
                  styles.paymentOptionBtn,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: theme.colors.border,
                    borderWidth: 1,
                  },
                ]}
                onPress={handleSwitchToCod}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Icon name="truck" size={16} color={theme.colors.text} />
                  <Text style={[styles.paymentOptionBtnText, { color: theme.colors.text }]}>
                    Switch to Cash on Delivery (COD)
                  </Text>
                </View>
              </Pressable>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={styles.paymentCancelBtn}
              onPress={() => setShowPaymentOptions(false)}
            >
              <Text style={{ fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', fontWeight: '600' }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        )}
      </AppDialog>

      {/* Invoice Saved Successfully Dialog with Open Option */}
      <ConfirmDialog
        visible={!!invoiceSuccessDialog?.visible}
        title="Invoice Saved to Downloads"
        message={
          invoiceSuccessDialog
            ? `Your invoice (${invoiceSuccessDialog.fileName}) has been successfully saved to your Android Downloads folder.`
            : ''
        }
        icon="check-circle"
        iconColor="#10B981"
        iconBgColor={theme.isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5'}
        cancelText="Done"
        confirmText="Open Invoice"
        confirmAccessibilityLabel="Open downloaded invoice PDF"
        isDestructive={false}
        onCancel={() => setInvoiceSuccessDialog(null)}
        onConfirm={handleOpenDownloadedInvoice}
      />

      {/* Alert Dialog (Feedback for cancellation / error) */}
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
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
  refreshIcon: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  stateText: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderSummaryHeading: {
    fontSize: 18,
    fontWeight: '800',
  },
  orderSummaryPlacedOn: {
    fontSize: 12,
    marginTop: 3,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statsPillRow: {
    flexDirection: 'row',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  cardBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  cardSectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  itemsList: {
    gap: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  itemMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  itemPriceTotal: {
    fontSize: 14,
    fontWeight: '800',
  },
  itemDivider: {
    height: 1,
    marginTop: 12,
  },
  addressContainer: {
    gap: 4,
  },
  addressRecipient: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  addressLine: {
    fontSize: 13,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  priceLabel: {
    fontSize: 13,
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  priceDivider: {
    height: 1,
    marginVertical: 10,
  },
  priceTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  priceTotalValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  cancellationActionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cancellationHeader: {
    gap: 2,
  },
  cancellationTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  cancellationSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  cancelOrderBtn: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelOrderBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  infoIcon: {
    fontSize: 20,
  },
  infoTextCol: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  infoSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  supportCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  supportTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  supportSubtitle: {
    fontSize: 11,
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 8,
    alignSelf: 'center',
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorBtnRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  secondaryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  primaryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  trackOrderFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  trackOrderIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackOrderBtnTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  trackOrderBtnSub: {
    fontSize: 11,
    marginTop: 2,
  },
  paymentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paymentStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  paymentActionSection: {
    marginTop: 14,
    gap: 6,
  },
  payDetailsBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payDetailsBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  paymentHelpHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  paymentOptionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentOptionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  paymentCancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  invoiceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  invoiceIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  invoiceSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  downloadInvoiceBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadInvoiceBtnText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
