import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/Icon';
import { resolveImageUrl } from '../config/api';
import type { OrderTrackingResponse } from '../types/tracking';
import { getOrderTracking } from '../services/trackingApi';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../config/queryKeys';
import { FullPageContentLoader } from '../components/common';
import { withRandomLoadingDuration } from '../utils/loadingUtils';

export interface OrderTrackingScreenProps {
  orderId: number;
  onBack: () => void;
  onViewOrderDetails?: () => void;
  onSupportPress?: (orderId: number) => void;
}

export const OrderTrackingScreen: React.FC<OrderTrackingScreenProps> = ({
  orderId,
  onBack,
  onViewOrderDetails,
  onSupportPress,
}) => {
  const theme = useAppTheme();
  const { token } = useAuth();

  const [refreshing, setRefreshing] = useState(false);

  // TanStack Query for order tracking
  const {
    data: trackingData,
    isLoading: isTrackingLoading,
    error: trackingError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.orderTracking(orderId),
    queryFn: async () => {
      if (!token) return null;
      return await withRandomLoadingDuration(() =>
        getOrderTracking(orderId, token)
      );
    },
    enabled: !!token,
  });

  const data = trackingData || null;
  const loading = isTrackingLoading && !data;
  const error = !data && trackingError ? (trackingError as any)?.message || 'Could not load order tracking information.' : null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatEstDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Within 3-5 business days';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
      />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Pressable
          onPress={onBack}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-left" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Live Order Tracking
        </Text>
        <Pressable
          onPress={() => onRefresh()}
          style={styles.refreshBtn}
          accessibilityLabel="Refresh tracking status"
        >
          <Icon name="refresh" size={20} color={theme.colors.primary} />
        </Pressable>
      </View>

      {loading && !refreshing ? (
        <FullPageContentLoader message="Connecting to live tracking server..." />
      ) : error ? (
        <View style={styles.centered}>
          <Icon name="alert-circle" size={44} color={theme.colors.danger} />
          <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={[styles.retryBtnText, { color: theme.colors.primaryText }]}>Retry</Text>
          </Pressable>
        </View>
      ) : data ? (
        <View style={{ flex: 1, position: 'relative' }}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
              />
            }
          >
          {/* Order Overview Card */}
          <View
            style={[
              styles.overviewCard,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.orderIdRow}>
              <View>
                <Text style={[styles.orderNumber, { color: theme.colors.text }]}>
                  Order #{data.orderId}
                </Text>
                <Text style={[styles.orderDateText, { color: theme.colors.textSecondary }]}>
                  Placed on {formatDate(data.orderDate)}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: data.isCancelled
                      ? 'rgba(239, 68, 68, 0.15)'
                      : data.currentStageIndex === 4
                      ? 'rgba(34, 197, 94, 0.15)'
                      : theme.colors.badgeBg,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    {
                      color: data.isCancelled
                        ? theme.colors.danger
                        : data.currentStageIndex === 4
                        ? '#16a34a'
                        : theme.colors.badgeText,
                    },
                  ]}
                >
                  {data.isCancelled ? 'CANCELLED' : data.status.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Estimated Delivery Highlight */}
            {!data.isCancelled && (
              <View
                style={[
                  styles.estDeliveryBox,
                  { backgroundColor: theme.colors.surfaceSubtle },
                ]}
              >
                <Icon name="truck" size={20} color={theme.colors.primary} />
                <View style={styles.estTextCol}>
                  <Text style={[styles.estLabel, { color: theme.colors.textSecondary }]}>
                    Estimated Delivery
                  </Text>
                  <Text style={[styles.estDate, { color: theme.colors.text }]}>
                    {formatEstDate(data.estimatedDeliveryDate)}
                  </Text>
                </View>
              </View>
            )}

            {/* Payment & Method Details */}
            <View style={[styles.metaRow, { borderTopColor: theme.colors.border }]}>
              <View style={styles.metaCol}>
                <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>
                  Payment Method
                </Text>
                <Text style={[styles.metaVal, { color: theme.colors.text }]}>
                  {data.paymentMethod === 'RAZORPAY' ? 'Online (Razorpay)' : 'Cash on Delivery'}
                </Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>
                  Payment Status
                </Text>
                <Text
                  style={[
                    styles.metaVal,
                    {
                      color:
                        data.paymentStatus === 'PAID'
                          ? '#16a34a'
                          : theme.colors.text,
                    },
                  ]}
                >
                  {data.paymentStatus === 'PAID' ? 'Paid ✓' : 'Pay on Delivery'}
                </Text>
              </View>
            </View>
          </View>

          {/* 5-Stage Live Timeline */}
          <View
            style={[
              styles.timelineCard,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Delivery Milestones
            </Text>

            {data.isCancelled ? (
              <View style={styles.cancelledBox}>
                <Icon name="alert-triangle" size={28} color={theme.colors.danger} />
                <Text style={[styles.cancelledTitle, { color: theme.colors.danger }]}>
                  This order was cancelled
                </Text>
                <Text style={[styles.cancelledDesc, { color: theme.colors.textSecondary }]}>
                  No further shipping progress will occur. If you made an online payment, a refund has been initiated.
                </Text>
              </View>
            ) : (
              <View style={styles.timelineList}>
                {data.timeline.map((stage, idx) => {
                  const isLast = idx === data.timeline.length - 1;
                  const isDone = stage.isCompleted;
                  const isCurrent = stage.isCurrent;

                  return (
                    <View key={stage.stageKey || `stage-${idx}`} style={styles.stageItem}>
                      {/* Left icon / dot column */}
                      <View style={styles.stageIndicatorCol}>
                        <View
                          style={[
                            styles.dot,
                            {
                              backgroundColor: isDone
                                ? theme.colors.primary
                                : theme.colors.surfaceSubtle,
                              borderColor: isCurrent
                                ? theme.colors.primary
                                : isDone
                                ? theme.colors.primary
                                : theme.colors.border,
                              borderWidth: isCurrent ? 2 : 1,
                            },
                          ]}
                        >
                          {isDone ? (
                            <Icon name="check" size={12} color={theme.colors.primaryText} />
                          ) : (
                            <View
                              style={[
                                styles.innerDot,
                                {
                                  backgroundColor: isCurrent
                                    ? theme.colors.primary
                                    : 'transparent',
                                },
                              ]}
                            />
                          )}
                        </View>
                        {!isLast && (
                          <View
                            style={[
                              styles.connectorLine,
                              {
                                backgroundColor: isDone
                                  ? theme.colors.primary
                                  : theme.colors.border,
                              },
                            ]}
                          />
                        )}
                      </View>

                      {/* Right content column */}
                      <View style={styles.stageContentCol}>
                        <View style={styles.stageTitleRow}>
                          <Text
                            style={[
                              styles.stageTitle,
                              {
                                color: isDone || isCurrent
                                  ? theme.colors.text
                                  : theme.colors.textMuted,
                                fontWeight: isCurrent ? '700' : isDone ? '600' : '400',
                              },
                            ]}
                          >
                            {stage.title}
                          </Text>
                          {stage.timestamp && (
                            <Text
                              style={[
                                styles.stageTimestamp,
                                { color: theme.colors.textSecondary },
                              ]}
                            >
                              {formatDate(stage.timestamp)}
                            </Text>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.stageDesc,
                            { color: theme.colors.textSecondary },
                          ]}
                        >
                          {stage.description}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Delivery Address Card */}
          <View
            style={[
              styles.infoCard,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.cardTitleRow}>
              <Icon name="map-pin" size={18} color={theme.colors.primary} />
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Delivery Destination
              </Text>
            </View>
            <Text style={[styles.destName, { color: theme.colors.text }]}>
              {data.shippingAddress?.name || 'Customer'}
            </Text>
            <Text style={[styles.destAddress, { color: theme.colors.textSecondary }]}>
              {data.shippingAddress?.address}
            </Text>
            <Text style={[styles.destCityPin, { color: theme.colors.text }]}>
              {data.shippingAddress?.city} — {data.shippingAddress?.pincode}
            </Text>
          </View>

          {/* Items Summary Preview */}
          <View
            style={[
              styles.infoCard,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.cardTitleRow}>
              <Icon name="box" size={18} color={theme.colors.primary} />
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Items in this Package ({data.items.length})
              </Text>
            </View>
            {data.items.map((item, idx) => (
              <View
                key={item.id ?? `item-${idx}`}
                style={[styles.itemRow, { borderBottomColor: theme.colors.border }]}
              >
                <Image
                  source={{ uri: resolveImageUrl(item.productImage) }}
                  style={styles.itemImage}
                  resizeMode="cover"
                />
                <View style={styles.itemInfo}>
                  <Text
                    style={[styles.itemName, { color: theme.colors.text }]}
                    numberOfLines={1}
                  >
                    {item.productName}
                  </Text>
                  <Text
                    style={[styles.itemQtyPrice, { color: theme.colors.textSecondary }]}
                  >
                    Qty: {item.quantity} × ₹{item.price}
                  </Text>
                </View>
                <Text style={[styles.itemTotal, { color: theme.colors.text }]}>
                  ₹{item.quantity * item.price}
                </Text>
              </View>
            ))}
          </View>

          {/* Full Order Details Button */}
          {onViewOrderDetails && (
            <Pressable
              onPress={onViewOrderDetails}
              style={[styles.viewDetailsBtn, { borderColor: theme.colors.border }]}
            >
              <Text style={[styles.viewDetailsBtnText, { color: theme.colors.primary }]}>
                View Full Invoice & Order Details →
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginLeft: 8,
  },
  refreshBtn: {
    padding: 6,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  overviewCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    elevation: 2,
  },
  orderIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 17,
    fontWeight: '700',
  },
  orderDateText: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  estDeliveryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  estTextCol: {
    flex: 1,
  },
  estLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  estDate: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  timelineCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  timelineList: {
    paddingLeft: 4,
  },
  stageItem: {
    flexDirection: 'row',
    minHeight: 64,
  },
  stageIndicatorCol: {
    alignItems: 'center',
    width: 28,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  innerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectorLine: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  stageContentCol: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 16,
  },
  stageTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stageTitle: {
    fontSize: 14,
  },
  stageTimestamp: {
    fontSize: 11,
  },
  stageDesc: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  cancelledBox: {
    alignItems: 'center',
    padding: 20,
  },
  cancelledTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  cancelledDesc: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  destName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  destAddress: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  destCityPin: {
    fontSize: 13,
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  itemImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
  },
  itemQtyPrice: {
    fontSize: 12,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '700',
  },
  viewDetailsBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  viewDetailsBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
