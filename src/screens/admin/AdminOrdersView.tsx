import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/theme';
import { useFeedback } from '../../context/FeedbackContext';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../config/queryKeys';
import { queryClient } from '../../config/queryClient';
import { Icon } from '../../components/Icon';
import { FullPageContentLoader } from '../../components/common';
import { withRandomLoadingDuration } from '../../utils/loadingUtils';
import { resolveImageUrl, FALLBACK_PRODUCT_IMAGE } from '../../config/api';
import type { AdminOrder, AdminOrderStatus } from '../../types/admin';
import { ADMIN_ORDER_STATUSES } from '../../types/admin';
import {
  getAdminOrders,
  updateAdminOrderStatus,
  deleteAdminOrder,
} from '../../services/adminApi';

interface AdminOrdersViewProps {
  token: string;
}

export const AdminOrdersView: React.FC<AdminOrdersViewProps> = ({ token }) => {
  const theme = useAppTheme();
  const feedback = useFeedback();
  const { height: windowHeight } = useWindowDimensions();

  let insetsTop = 0;
  let insetsBottom = 0;
  try {
    const insets = useSafeAreaInsets();
    insetsTop = insets?.top || 0;
    insetsBottom = insets?.bottom || 0;
  } catch {
    insetsTop = 0;
    insetsBottom = 0;
  }

  const modalMaxHeight = useMemo(() => {
    return Math.max(
      320,
      Math.min(windowHeight - insetsTop - insetsBottom - 28, Math.round(windowHeight * 0.88))
    );
  }, [windowHeight, insetsTop, insetsBottom]);

  const [search, setSearch] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  // Order Details Modal State
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<AdminOrder | null>(null);

  // Change Status Modal State
  const [statusModalOrder, setStatusModalOrder] = useState<AdminOrder | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // TanStack Query for Admin Orders
  const {
    data: adminOrdersData,
    isLoading: isOrdersLoading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.adminOrders(),
    queryFn: async () => {
      const data = await withRandomLoadingDuration(() => getAdminOrders(token));
      return data || [];
    },
    enabled: !!token,
  });

  const [localOrders, setLocalOrders] = useState<AdminOrder[] | null>(null);
  const orders = localOrders || adminOrdersData || [];
  const loading = isOrdersLoading && orders.length === 0;

  const loadOrders = useCallback(async () => {
    try {
      const res = await refetch();
      if (res.data) setLocalOrders(res.data);
    } catch (err: any) {
      feedback.toast.error(err.message || 'Could not load orders');
    }
  }, [refetch, feedback]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadOrders();
    } finally {
      setRefreshing(false);
    }
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    let list = [...orders];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          String(o.id).includes(q) ||
          (o.name && o.name.toLowerCase().includes(q)) ||
          (o.email && o.email.toLowerCase().includes(q)) ||
          (o.user && o.user.email.toLowerCase().includes(q))
      );
    }
    if (selectedStatusFilter !== 'ALL') {
      list = list.filter((o) => o.status.toUpperCase() === selectedStatusFilter.toUpperCase());
    }
    return list;
  }, [orders, search, selectedStatusFilter]);

  const handleUpdateStatus = async (newStatus: AdminOrderStatus) => {
    if (!statusModalOrder) return;
    setUpdatingStatus(true);
    try {
      await updateAdminOrderStatus(token, statusModalOrder.id, newStatus);
      setLocalOrders((prev) =>
        (prev || orders).map((o) => (o.id === statusModalOrder.id ? { ...o, status: newStatus } : o))
      );
      if (selectedOrderDetail && selectedOrderDetail.id === statusModalOrder.id) {
        setSelectedOrderDetail((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
      feedback.toast.success(`Order #${statusModalOrder.id} status updated to ${newStatus}`);
      setStatusModalOrder(null);
    } catch (err: any) {
      feedback.toast.error(err.message || 'Failed to update order status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteOrder = (order: AdminOrder) => {
    feedback.showConfirm({
      title: 'Delete Order Record',
      message: `Are you sure you want to delete Order #${order.id}? This will permanently remove it from the database.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteAdminOrder(token, order.id);
          setLocalOrders((prev) => (prev || orders).filter((o) => o.id !== order.id));
          if (selectedOrderDetail && selectedOrderDetail.id === order.id) {
            setSelectedOrderDetail(null);
          }
          queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
          feedback.toast.success(`Order #${order.id} removed`);
        } catch (err: any) {
          feedback.toast.error(err.message || 'Failed to delete order');
        }
      },
    });
  };

  const getStatusBadgeStyle = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'COMPLETED' || s === 'DELIVERED') {
      return { bg: '#DCFCE7', text: '#15803D' };
    }
    if (s === 'CANCELLED') {
      return { bg: '#FEE2E2', text: '#DC2626' };
    }
    if (s === 'SHIPPED') {
      return { bg: '#E0E7FF', text: '#4338CA' };
    }
    if (s === 'CONFIRMED' || s === 'PACKED') {
      return { bg: '#E0F2FE', text: '#0369A1' };
    }
    return { bg: '#FEF3C7', text: '#D97706' };
  };

  const getPaymentBadgeStyle = (paymentStatus?: string | null) => {
    const ps = (paymentStatus || 'PENDING').toUpperCase();
    if (ps === 'PAID' || ps === 'COMPLETED' || ps === 'SUCCESS') {
      return { bg: '#DCFCE7', text: '#15803D', label: 'PAID' };
    }
    if (ps === 'FAILED') {
      return { bg: '#FEE2E2', text: '#DC2626', label: 'FAILED' };
    }
    return { bg: '#FEF3C7', text: '#D97706', label: 'PENDING' };
  };

  if (loading && !refreshing) {
    return <FullPageContentLoader message="Loading orders..." />;
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.topBar}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: theme.isDark ? '#1C1C1E' : '#F4F4F6',
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Icon name="search" size={18} color={theme.colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search by Order ID or Customer Email..."
            placeholderTextColor={theme.colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <Icon name="close" size={16} color={theme.colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Status Filter Chips */}
      <View style={styles.chipScrollContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['ALL', ...ADMIN_ORDER_STATUSES]}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.chipList}
          renderItem={({ item }) => {
            const isSelected = selectedStatusFilter.toUpperCase() === item.toUpperCase();
            return (
              <Pressable
                onPress={() => setSelectedStatusFilter(item)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected
                      ? theme.isDark
                        ? '#FFFFFF'
                        : '#000000'
                      : theme.isDark
                        ? '#222224'
                        : '#EEEEEE',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isSelected
                        ? theme.isDark
                          ? '#000000'
                          : '#FFFFFF'
                        : theme.colors.text,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Compact Orders List */}
      <View style={{ flex: 1 }}>
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['transparent']}
              tintColor="transparent"
              progressBackgroundColor="transparent"
            />
          }
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="orders" size={48} color={theme.colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Orders Found</Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                {search ? 'Try clearing your search query' : 'Customer orders will appear here'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusBadge = getStatusBadgeStyle(item.status);
            const paymentBadge = getPaymentBadgeStyle(item.paymentStatus);

            // Formatted product names and quantities summary
            const productsSummary =
              item.items && item.items.length > 0
                ? item.items
                  .map(
                    (it) =>
                      `${it.product?.name || it.productName || 'Product'} (×${it.quantity})`
                  )
                  .join(', ')
                : 'No items in this order';

            const totalItemsCount =
              item.items?.reduce((acc, it) => acc + (it.quantity || 1), 0) || 0;

            return (
              <Pressable
                testID={`order-card-${item.id}`}
                style={[
                  styles.compactCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => setSelectedOrderDetail(item)}
              >
                {/* Header: Order ID & Status Badge */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.orderIdGroup}>
                    <Text style={[styles.orderIdText, { color: theme.colors.text }]}>
                      Order #{item.id}
                    </Text>
                    <Text style={[styles.itemCountTag, { color: theme.colors.textMuted }]}>
                      {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
                    </Text>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusBadge.text }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>

                {/* Products Names and Quantities */}
                <View style={styles.productsSummaryRow}>
                  <Icon name="box" size={13} color={theme.colors.textMuted} />
                  <Text
                    style={[styles.productsSummaryText, { color: theme.colors.text }]}
                    numberOfLines={2}
                  >
                    {productsSummary}
                  </Text>
                </View>

                {/* Footer: Payment Status & Order Total Price */}
                <View
                  style={[
                    styles.cardFooterRow,
                    { borderTopColor: theme.isDark ? '#262629' : '#F0F0F2' },
                  ]}
                >
                  <View style={[styles.paymentBadge, { backgroundColor: paymentBadge.bg }]}>
                    <Text style={[styles.paymentBadgeText, { color: paymentBadge.text }]}>
                      {paymentBadge.label}
                    </Text>
                  </View>

                  <View style={styles.totalPriceGroup}>
                    <Text style={[styles.totalLabelSmall, { color: theme.colors.textMuted }]}>
                      Total
                    </Text>
                    <Text style={[styles.totalPriceText, { color: theme.colors.text }]}>
                      ₹{item.total.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Tap affordance hint */}
                <View style={styles.viewDetailHint}>
                  <Text style={[styles.viewDetailText, { color: theme.colors.primary }]}>
                    Tap to view full details
                  </Text>
                  <Icon name="chevron-right" size={13} color={theme.colors.primary} />
                </View>
              </Pressable>
            );
          }}
        />
        {refreshing && (
          <FullPageContentLoader
            message="Loading Orders..."
            overlay
          />
        )}
      </View>

      {/* Full Order Details Modal (Task 2B) */}
      <Modal
        visible={!!selectedOrderDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedOrderDetail(null)}
      >
        <Pressable
          style={[
            styles.modalBackdrop,
            {
              paddingTop: Math.max(insetsTop + 10, 16),
              paddingBottom: Math.max(insetsBottom + 10, 16),
            },
          ]}
          onPress={() => setSelectedOrderDetail(null)}
        >
          <View
            style={[
              styles.detailModalCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                maxHeight: modalMaxHeight,
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {(() => {
              const activeOrder = selectedOrderDetail || orders[0];
              if (!activeOrder) return null;

              return (
                <>
                  {/* Modal Header (Fixed at top) */}
                  <View
                    style={[
                      styles.detailModalHeader,
                      {
                        borderBottomColor: theme.colors.borderLight,
                        backgroundColor: theme.colors.card,
                      },
                    ]}
                  >
                    <View style={styles.detailModalHeaderLeft}>
                      <Text style={[styles.detailModalTitle, { color: theme.colors.text }]}>
                        Order #{activeOrder.id}
                      </Text>
                      <Text style={[styles.detailModalDate, { color: theme.colors.textMuted }]}>
                        {new Date(activeOrder.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>

                    <Pressable
                      style={({ pressed }) => [
                        styles.closeIconBtn,
                        {
                          backgroundColor: theme.colors.surfaceSubtle,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Close order details"
                      onPress={() => setSelectedOrderDetail(null)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Icon name="close" size={18} color={theme.colors.text} />
                    </Pressable>
                  </View>

                  {/* Scrollable Order Details Body */}
                  <ScrollView
                    style={styles.detailScrollArea}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                    bounces={false}
                    contentContainerStyle={styles.detailScrollContent}
                  >
                    {/* Status & Quick Action Row */}
                    <View
                      style={[
                        styles.statusActionBox,
                        {
                          backgroundColor: theme.isDark ? '#1C1C1E' : '#F9FAFB',
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <View style={styles.statusGroup}>
                        <Text style={[styles.sectionHeadingSmall, { color: theme.colors.textMuted }]}>
                          ORDER STATUS
                        </Text>
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: getStatusBadgeStyle(activeOrder.status).bg,
                              marginTop: 4,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              {
                                color: getStatusBadgeStyle(activeOrder.status).text,
                              },
                            ]}
                          >
                            {activeOrder.status}
                          </Text>
                        </View>
                      </View>

                      <Pressable
                        style={[
                          styles.changeStatusSmallBtn,
                          { backgroundColor: theme.colors.primary },
                        ]}
                        onPress={() => setStatusModalOrder(activeOrder)}
                      >
                        <Icon name="refresh" size={13} color={theme.colors.primaryText} />
                        <Text
                          style={[
                            styles.changeStatusSmallBtnText,
                            { color: theme.colors.primaryText },
                          ]}
                        >
                          Change Status
                        </Text>
                      </Pressable>
                    </View>

                    {/* Customer & Shipping Section */}
                    <View
                      style={[
                        styles.detailSection,
                        {
                          backgroundColor: theme.isDark ? '#1C1C1E' : '#F9FAFB',
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
                        Customer & Shipping Details
                      </Text>

                      <View style={styles.detailRow}>
                        <Icon name="user" size={14} color={theme.colors.textMuted} />
                        <Text style={[styles.detailRowLabel, { color: theme.colors.textMuted }]}>
                          Customer:
                        </Text>
                        <Text style={[styles.detailRowValue, { color: theme.colors.text }]}>
                          {activeOrder.name || activeOrder.user?.name || 'Customer'}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Icon name="mail" size={14} color={theme.colors.textMuted} />
                        <Text style={[styles.detailRowLabel, { color: theme.colors.textMuted }]}>
                          Email:
                        </Text>
                        <Text style={[styles.detailRowValue, { color: theme.colors.text }]}>
                          {activeOrder.email || activeOrder.user?.email || 'N/A'}
                        </Text>
                      </View>

                      <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
                        <Icon name="map-pin" size={14} color={theme.colors.textMuted} />
                        <Text style={[styles.detailRowLabel, { color: theme.colors.textMuted }]}>
                          Address:
                        </Text>
                        <Text style={[styles.detailRowValue, { color: theme.colors.text, flex: 1 }]}>
                          {activeOrder.address
                            ? `${activeOrder.address}, ${activeOrder.city || ''} ${activeOrder.pincode || ''}`
                            : 'No shipping address provided'}
                        </Text>
                      </View>
                    </View>

                    {/* Ordered Items Breakdown */}
                    <View
                      style={[
                        styles.detailSection,
                        {
                          backgroundColor: theme.isDark ? '#1C1C1E' : '#F9FAFB',
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
                        Ordered Products ({activeOrder.items?.length || 0})
                      </Text>

                      {activeOrder.items?.map((orderItem) => {
                        const productImg =
                          orderItem.product?.image ||
                          orderItem.productImage ||
                          FALLBACK_PRODUCT_IMAGE;
                        const productName =
                          orderItem.product?.name || orderItem.productName || 'Order Product';

                        return (
                          <View
                            key={String(orderItem.id)}
                            style={[
                              styles.detailItemRow,
                              { borderBottomColor: theme.colors.borderLight },
                            ]}
                          >
                            <Image
                              source={{ uri: resolveImageUrl(productImg) }}
                              defaultSource={{ uri: FALLBACK_PRODUCT_IMAGE }}
                              style={styles.detailItemThumb}
                              resizeMode="cover"
                            />
                            <View style={styles.detailItemInfo}>
                              <Text
                                style={[styles.detailItemName, { color: theme.colors.text }]}
                                numberOfLines={2}
                              >
                                {productName}
                              </Text>
                              <Text
                                style={[
                                  styles.detailItemPriceMath,
                                  { color: theme.colors.textMuted },
                                ]}
                              >
                                ₹{orderItem.price.toLocaleString()} × {orderItem.quantity}
                              </Text>
                            </View>
                            <Text style={[styles.detailItemTotal, { color: theme.colors.text }]}>
                              ₹{(orderItem.price * orderItem.quantity).toLocaleString()}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Payment & Price Summary */}
                    <View
                      style={[
                        styles.detailSection,
                        {
                          backgroundColor: theme.isDark ? '#1C1C1E' : '#F9FAFB',
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
                        Financial Summary
                      </Text>

                      <View style={styles.summaryLine}>
                        <Text style={[styles.summaryLabel, { color: theme.colors.textMuted }]}>
                          Subtotal
                        </Text>
                        <Text style={[styles.summaryVal, { color: theme.colors.text }]}>
                          ₹
                          {(
                            activeOrder.subtotal ?? activeOrder.total
                          ).toLocaleString()}
                        </Text>
                      </View>

                      {activeOrder.discount ? (
                        <View style={styles.summaryLine}>
                          <Text style={[styles.summaryLabel, { color: '#EF4444' }]}>
                            Discount {activeOrder.couponCode ? `(${activeOrder.couponCode})` : ''}
                          </Text>
                          <Text style={[styles.summaryVal, { color: '#EF4444' }]}>
                            -₹{activeOrder.discount.toLocaleString()}
                          </Text>
                        </View>
                      ) : null}

                      <View
                        style={[
                          styles.summaryLineTotal,
                          { borderTopColor: theme.colors.border },
                        ]}
                      >
                        <Text style={[styles.summaryTotalLabel, { color: theme.colors.text }]}>
                          Order Total
                        </Text>
                        <Text style={[styles.summaryTotalVal, { color: theme.colors.text }]}>
                          ₹{activeOrder.total.toLocaleString()}
                        </Text>
                      </View>

                      <View style={[styles.summaryLine, { marginTop: 8 }]}>
                        <Text style={[styles.summaryLabel, { color: theme.colors.textMuted }]}>
                          Payment Method
                        </Text>
                        <Text style={[styles.summaryVal, { color: theme.colors.text }]}>
                          {(activeOrder.paymentMethod || 'RAZORPAY').toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.summaryLine}>
                        <Text style={[styles.summaryLabel, { color: theme.colors.textMuted }]}>
                          Payment Status
                        </Text>
                        <View
                          style={[
                            styles.paymentBadge,
                            {
                              backgroundColor: getPaymentBadgeStyle(
                                activeOrder.paymentStatus
                              ).bg,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.paymentBadgeText,
                              {
                                color: getPaymentBadgeStyle(
                                  activeOrder.paymentStatus
                                ).text,
                              },
                            ]}
                          >
                            {getPaymentBadgeStyle(activeOrder.paymentStatus).label}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </ScrollView>

                  {/* Fixed Modal Action Buttons Footer (Dedicated bottom section) */}
                  <View
                    style={[
                      styles.modalActionButtonsRow,
                      {
                        borderTopColor: theme.colors.borderLight,
                        backgroundColor: theme.colors.card,
                      },
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Delete Order Record"
                      style={({ pressed }) => [
                        styles.deleteOrderBigBtn,
                        {
                          borderColor: '#EF4444',
                          backgroundColor: theme.isDark
                            ? 'rgba(239, 68, 68, 0.12)'
                            : '#FEF2F2',
                          opacity: pressed ? 0.75 : 1,
                        },
                      ]}
                      onPress={() => handleDeleteOrder(activeOrder)}
                    >
                      <Icon name="trash" size={15} color="#EF4444" />
                      <Text style={styles.deleteOrderBigBtnText}>Delete Order Record</Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Done"
                      style={({ pressed }) => [
                        styles.closeOrderDetailsBtn,
                        {
                          backgroundColor: theme.colors.primary,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                      onPress={() => setSelectedOrderDetail(null)}
                    >
                      <Text
                        style={[
                          styles.closeOrderDetailsBtnText,
                          { color: theme.colors.primaryText },
                        ]}
                      >
                        Done
                      </Text>
                    </Pressable>
                  </View>
                </>
              );
            })()}
          </View>
        </Pressable>
      </Modal>

      {/* Change Status Modal */}
      <Modal
        visible={!!statusModalOrder}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusModalOrder(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setStatusModalOrder(null)}
        >
          <View
            style={[
              styles.statusModalCard,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.statusModalTitle, { color: theme.colors.text }]}>
              Update Order Status
            </Text>
            <Text
              style={[
                styles.statusModalSubtitle,
                { color: theme.colors.textSecondary },
              ]}
            >
              Order #{statusModalOrder?.id} • Currently: {statusModalOrder?.status}
            </Text>

            {updatingStatus ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={{ marginTop: 10, color: theme.colors.textSecondary }}>
                  Updating status...
                </Text>
              </View>
            ) : (
              <View style={styles.statusOptionsList}>
                {ADMIN_ORDER_STATUSES.map((status) => {
                  const isCurrent = statusModalOrder?.status.toUpperCase() === status;
                  return (
                    <Pressable
                      key={status}
                      style={[
                        styles.statusOptionItem,
                        {
                          backgroundColor: isCurrent
                            ? theme.isDark
                              ? '#333'
                              : '#E5E7EB'
                            : theme.isDark
                              ? '#222'
                              : '#F9FAFB',
                          borderColor: theme.colors.borderLight,
                        },
                      ]}
                      onPress={() => handleUpdateStatus(status)}
                    >
                      <Text
                        style={[
                          styles.statusOptionText,
                          {
                            color: theme.colors.text,
                            fontWeight: isCurrent ? '700' : '500',
                          },
                        ]}
                      >
                        {status}
                      </Text>
                      {isCurrent && <Icon name="check" size={16} color={theme.colors.text} />}
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Pressable
              style={[styles.closeModalBtn, { borderColor: theme.colors.border }]}
              onPress={() => setStatusModalOrder(null)}
            >
              <Text style={[styles.closeModalBtnText, { color: theme.colors.text }]}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  chipScrollContainer: {
    paddingBottom: 8,
  },
  chipList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterChipText: {
    fontSize: 12,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },

  // Compact Card (Task 2A)
  compactCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderIdGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderIdText: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemCountTag: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  productsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productsSummaryText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 2,
  },
  paymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paymentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  totalPriceGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  totalLabelSmall: {
    fontSize: 11,
  },
  totalPriceText: {
    fontSize: 16,
    fontWeight: '800',
  },
  viewDetailHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: 2,
  },
  viewDetailText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Order Details Modal (Task 2B)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  detailModalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  detailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailModalHeaderLeft: {
    flex: 1,
    marginRight: 10,
  },
  detailModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  detailModalDate: {
    fontSize: 12,
    marginTop: 2,
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailScrollArea: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
  },
  detailScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  statusActionBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusGroup: {
    gap: 2,
  },
  sectionHeadingSmall: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  changeStatusSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  changeStatusSmallBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailSection: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailRowLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  detailRowValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  detailItemThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  detailItemInfo: {
    flex: 1,
  },
  detailItemName: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailItemPriceMath: {
    fontSize: 11,
    marginTop: 2,
  },
  detailItemTotal: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
  },
  summaryVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryLineTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 4,
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  summaryTotalVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalActionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  deleteOrderBigBtn: {
    flex: 1.15,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  deleteOrderBigBtnText: {
    color: '#EF4444',
    fontSize: 12.5,
    fontWeight: '700',
  },
  closeOrderDetailsBtn: {
    flex: 0.85,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  closeOrderDetailsBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },

  // Status Modal
  statusModalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  statusModalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  statusModalSubtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  statusOptionsList: {
    gap: 8,
  },
  statusOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusOptionText: {
    fontSize: 13,
  },
  closeModalBtn: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  closeModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

