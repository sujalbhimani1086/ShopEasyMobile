import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAppTheme } from '../../theme/theme';
import { useFeedback } from '../../context/FeedbackContext';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../config/queryKeys';
import { Icon } from '../../components/Icon';
import { AdminOverviewCard } from '../../components/admin/AdminOverviewCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { FullPageContentLoader } from '../../components/common';
import { withRandomLoadingDuration } from '../../utils/loadingUtils';
import { resolveImageUrl } from '../../config/api';
import type {
  AdminSection,
  AdminOrder,
  AdminProduct,
  AdminCategory,
  AdminUser,
  AdminCoupon,
} from '../../types/admin';
import {
  getAdminOrders,
  getAdminProducts,
  getAdminCategories,
  getAdminUsers,
  getAdminCoupons,
  getAdminReviews,
  getAdminRegistrations,
} from '../../services/adminApi';

export interface AdminOverviewViewProps {
  token: string;
  onNavigateToSection: (section: AdminSection) => void;
}

interface DayMetric {
  key: string;
  label: string;
  full: string;
  dayIndex: number;
  orderCount: number;
  salesTotal: number;
}

export const AdminOverviewView: React.FC<AdminOverviewViewProps> = ({
  token,
  onNavigateToSection,
}) => {
  const theme = useAppTheme();
  const feedback = useFeedback();

  const [refreshing, setRefreshing] = useState(false);

  // TanStack Query for Admin Dashboard Overview
  const {
    data: overviewData,
    isLoading: isOverviewLoading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.adminOverview,
    queryFn: async () => {
      const [
        ordersData,
        productsData,
        categoriesData,
        usersData,
        couponsData,
        reviewsData,
        registrationsData,
      ] = await withRandomLoadingDuration(() =>
        Promise.all([
          getAdminOrders(token).catch(() => []),
          getAdminProducts(token).catch(() => []),
          getAdminCategories(token).catch(() => []),
          getAdminUsers(token).catch(() => []),
          getAdminCoupons(token).catch(() => []),
          getAdminReviews(token, 1, 5).catch(() => ({ total: 0, reviews: [] })),
          getAdminRegistrations(token).catch(() => ({ pendingCount: 0, registrations: [] })),
        ])
      );

      return {
        orders: Array.isArray(ordersData) ? ordersData : [],
        products: Array.isArray(productsData) ? productsData : [],
        categories: Array.isArray(categoriesData) ? categoriesData : [],
        users: Array.isArray(usersData) ? usersData : [],
        coupons: Array.isArray(couponsData) ? couponsData : [],
        reviewCount: reviewsData?.total || 0,
        pendingRegCount:
          registrationsData?.pendingCount !== undefined
            ? registrationsData.pendingCount
            : (registrationsData?.registrations || []).filter(
                (r: any) => r.status === 'PENDING'
              ).length,
      };
    },
    enabled: !!token,
  });

  const orders = overviewData?.orders || [];
  const products = overviewData?.products || [];
  const categories = overviewData?.categories || [];
  const users = overviewData?.users || [];
  const coupons = overviewData?.coupons || [];
  const reviewCount = overviewData?.reviewCount || 0;
  const pendingRegCount = overviewData?.pendingRegCount || 0;

  const loading = isOverviewLoading && !overviewData;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Weekly Distribution Calculation from Real Orders
  const weeklyAnalytics = useMemo(() => {
    const daysConfig: { key: string; label: string; full: string; dayIndex: number }[] = [
      { key: 'Mon', label: 'Mon', full: 'Monday', dayIndex: 1 },
      { key: 'Tue', label: 'Tue', full: 'Tuesday', dayIndex: 2 },
      { key: 'Wed', label: 'Wed', full: 'Wednesday', dayIndex: 3 },
      { key: 'Thu', label: 'Thu', full: 'Thursday', dayIndex: 4 },
      { key: 'Fri', label: 'Fri', full: 'Friday', dayIndex: 5 },
      { key: 'Sat', label: 'Sat', full: 'Saturday', dayIndex: 6 },
      { key: 'Sun', label: 'Sun', full: 'Sunday', dayIndex: 0 },
    ];

    const dayMap = new Map<number, { count: number; sales: number }>();
    daysConfig.forEach((d) => dayMap.set(d.dayIndex, { count: 0, sales: 0 }));

    orders.forEach((order) => {
      try {
        const d = new Date(order.createdAt);
        if (!isNaN(d.getTime())) {
          const dayIdx = d.getDay();
          const entry = dayMap.get(dayIdx);
          if (entry) {
            entry.count += 1;
            entry.sales += Number(order.total || 0);
          }
        }
      } catch {
        // Skip malformed dates
      }
    });

    const metrics: DayMetric[] = daysConfig.map((d) => {
      const entry = dayMap.get(d.dayIndex) || { count: 0, sales: 0 };
      return {
        ...d,
        orderCount: entry.count,
        salesTotal: entry.sales,
      };
    });

    // Find peak day (highest order count)
    let peakDay = metrics[0];
    metrics.forEach((m) => {
      if (m.orderCount > peakDay.orderCount) {
        peakDay = m;
      }
    });

    const weeklyTotalOrders = metrics.reduce((acc, m) => acc + m.orderCount, 0);
    const weeklyTotalSales = metrics.reduce((acc, m) => acc + m.salesTotal, 0);
    const dailyAverage = weeklyTotalOrders > 0 ? weeklyTotalOrders / 7 : 0;
    const maxDayCount = Math.max(...metrics.map((m) => m.orderCount), 1);

    return {
      metrics,
      peakDay,
      weeklyTotalOrders,
      weeklyTotalSales,
      dailyAverage,
      maxDayCount,
    };
  }, [orders]);

  // Overall store summary
  const totalRevenue = useMemo(() => {
    return orders.reduce((acc, o) => acc + Number(o.total || 0), 0);
  }, [orders]);

  const pendingOrdersCount = useMemo(() => {
    return orders.filter((o) => (o.status || '').toUpperCase() === 'PENDING').length;
  }, [orders]);

  const completedOrdersCount = useMemo(() => {
    return orders.filter((o) =>
      ['DELIVERED', 'COMPLETED', 'SHIPPED'].includes((o.status || '').toUpperCase())
    ).length;
  }, [orders]);

  if (loading && !refreshing) {
    return <FullPageContentLoader message="Loading Admin Overview..." />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.isDark ? '#FFFFFF' : '#000000'}
            colors={[theme.isDark ? '#FFFFFF' : '#000000']}
          />
        }
      >
        {/* ================================================================= */}
        {/* 1. KEY PERFORMANCE METRICS (7 MANAGEMENT CARDS)                   */}
        {/* ================================================================= */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
              Key Performance Metrics
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>
              Real-time synchronized store statistics
            </Text>
          </View>
        </View>

        <View style={styles.cardsGrid}>
          {/* 1. Orders Card */}
          <AdminOverviewCard
            testID="overview-card-orders"
            title="ORDERS"
            value={orders.length}
            description="Recorded"
            icon="shopping-bag"
            onPress={() => onNavigateToSection('orders')}
            style={styles.cardItem}
          />

          {/* 2. Products Card */}
          <AdminOverviewCard
            testID="overview-card-products"
            title="PRODUCTS"
            value={products.length}
            description="In catalog"
            icon="package"
            onPress={() => onNavigateToSection('products')}
            style={styles.cardItem}
          />

          {/* 3. Categories Card */}
          <AdminOverviewCard
            testID="overview-card-categories"
            title="CATEGORIES"
            value={categories.length}
            description="Taxonomies"
            icon="grid"
            onPress={() => onNavigateToSection('categories')}
            style={styles.cardItem}
          />

          {/* 4. Users Card */}
          <AdminOverviewCard
            testID="overview-card-users"
            title="USERS"
            value={users.length}
            description="Registered"
            icon="users"
            onPress={() => onNavigateToSection('users')}
            style={styles.cardItem}
          />

          {/* 5. Coupons Card */}
          <AdminOverviewCard
            testID="overview-card-coupons"
            title="COUPONS"
            value={coupons.length}
            description="Available"
            icon="tag"
            onPress={() => onNavigateToSection('coupons')}
            style={styles.cardItem}
          />

          {/* 6. Reviews Card */}
          <AdminOverviewCard
            testID="overview-card-reviews"
            title="REVIEWS"
            value={reviewCount}
            description="Customer reviews"
            icon="star"
            onPress={() => onNavigateToSection('reviews')}
            style={styles.cardItem}
          />

          {/* 7. Registrations Card */}
          <AdminOverviewCard
            testID="overview-card-registrations"
            title="REGISTRATIONS"
            value={pendingRegCount}
            description="Pending requests"
            icon="check-circle"
            onPress={() => onNavigateToSection('registrations')}
            style={styles.cardItem}
          />
        </View>

        {/* ================================================================= */}
        {/* 2. WEEKLY SALES & ORDER DISTRIBUTION (STORE ANALYTICS)            */}
        {/* ================================================================= */}
        <View
          style={[
            styles.analyticsContainer,
            {
              backgroundColor: theme.isDark ? '#1C1C1E' : '#FFFFFF',
              borderColor: theme.isDark ? '#2C2C2E' : '#E5E7EB',
            },
          ]}
        >
          {/* Header Row with Title and Peak Badge */}
          <View style={styles.chartHeaderRow}>
            <View style={styles.chartTitleColumn}>
              <Text style={[styles.chartTitle, { color: theme.colors.text }]}>
                Weekly Sales & Order Distribution
              </Text>
              <Text style={[styles.chartSubtitle, { color: theme.colors.textMuted }]}>
                Order volume trends calculated from transactions
              </Text>
            </View>

            {weeklyAnalytics.peakDay && (
              <View
                style={[
                  styles.peakBadge,
                  {
                    backgroundColor: theme.isDark ? '#FFFFFF' : '#000000',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.peakBadgeText,
                    {
                      color: theme.isDark ? '#000000' : '#FFFFFF',
                    },
                  ]}
                >
                  {weeklyAnalytics.peakDay.label}: {weeklyAnalytics.peakDay.orderCount} orders
                </Text>
              </View>
            )}
          </View>

          {/* 7-Day Bar Chart */}
          <View style={styles.chartArea}>
            <View style={styles.chartBarsRow}>
              {weeklyAnalytics.metrics.map((day, dayIdx) => {
                const isPeak =
                  weeklyAnalytics.peakDay.orderCount > 0 &&
                  day.key === weeklyAnalytics.peakDay.key;
                const heightPercent =
                  weeklyAnalytics.maxDayCount > 0
                    ? Math.max(12, (day.orderCount / weeklyAnalytics.maxDayCount) * 110)
                    : 12;

                return (
                  <View key={day.key || `metric-day-${dayIdx}`} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: heightPercent,
                            backgroundColor: isPeak
                              ? theme.isDark
                                ? '#FFFFFF'
                                : '#000000'
                              : theme.isDark
                                ? '#3A3A3C'
                                : '#E5E7EB',
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.barLabel,
                        {
                          color: isPeak
                            ? theme.colors.text
                            : theme.colors.textMuted,
                          fontWeight: isPeak ? '800' : '600',
                        },
                      ]}
                    >
                      {day.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Performance Summary 3-Column Row */}
          <View
            style={[
              styles.summaryRow,
              {
                borderTopColor: theme.isDark ? '#2C2C2E' : '#F3F4F6',
              },
            ]}
          >
            <View style={styles.summaryCol}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textMuted }]}>
                Weekly Total
              </Text>
              <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                {weeklyAnalytics.weeklyTotalOrders} Orders
              </Text>
            </View>

            <View style={styles.summaryCol}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textMuted }]}>
                Daily Average
              </Text>
              <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                {weeklyAnalytics.dailyAverage.toFixed(1)} / day
              </Text>
            </View>

            <View style={styles.summaryCol}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textMuted }]}>
                Peak Day
              </Text>
              <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                {weeklyAnalytics.peakDay.full || 'None'}
              </Text>
            </View>
          </View>

          {/* Store Revenue & Fulfillment Strip */}
          <View
            style={[
              styles.metricsStrip,
              {
                backgroundColor: theme.isDark ? '#262629' : '#F9FAFB',
              },
            ]}
          >
            <View style={styles.stripItem}>
              <Text style={[styles.stripLabel, { color: theme.colors.textMuted }]}>
                Total Sales
              </Text>
              <Text style={[styles.stripVal, { color: theme.colors.text }]}>
                ₹{totalRevenue.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.stripDivider} />
            <View style={styles.stripItem}>
              <Text style={[styles.stripLabel, { color: theme.colors.textMuted }]}>
                Pending
              </Text>
              <Text style={[styles.stripVal, { color: '#F59E0B' }]}>
                {pendingOrdersCount}
              </Text>
            </View>
            <View style={styles.stripDivider} />
            <View style={styles.stripItem}>
              <Text style={[styles.stripLabel, { color: theme.colors.textMuted }]}>
                Completed
              </Text>
              <Text style={[styles.stripVal, { color: '#10B981' }]}>
                {completedOrdersCount}
              </Text>
            </View>
          </View>
        </View>

        {/* ================================================================= */}
        {/* 3. QUICK MANAGEMENT ACTIONS                                       */}
        {/* ================================================================= */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
              Quick Management Actions
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>
              Rapid operational commands
            </Text>
          </View>
        </View>

        <View style={styles.actionsGrid}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add Product"
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: theme.isDark ? '#262629' : '#F3F4F6',
                borderColor: theme.isDark ? '#3A3A3C' : '#E5E7EB',
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            onPress={() => onNavigateToSection('products')}
          >
            <Icon name="plus" size={16} color={theme.colors.text} strokeWidth={2.4} />
            <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>
              Add Product
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add Category"
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: theme.isDark ? '#262629' : '#F3F4F6',
                borderColor: theme.isDark ? '#3A3A3C' : '#E5E7EB',
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            onPress={() => onNavigateToSection('categories')}
          >
            <Icon name="plus" size={16} color={theme.colors.text} strokeWidth={2.4} />
            <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>
              Add Category
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage Orders"
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: theme.isDark ? '#262629' : '#F3F4F6',
                borderColor: theme.isDark ? '#3A3A3C' : '#E5E7EB',
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            onPress={() => onNavigateToSection('orders')}
          >
            <Icon name="orders" size={16} color={theme.colors.text} strokeWidth={2.2} />
            <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>
              Manage Orders
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage Coupons"
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: theme.isDark ? '#262629' : '#F3F4F6',
                borderColor: theme.isDark ? '#3A3A3C' : '#E5E7EB',
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            onPress={() => onNavigateToSection('coupons')}
          >
            <Icon name="tag" size={16} color={theme.colors.text} strokeWidth={2.2} />
            <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>
              Manage Coupons
            </Text>
          </Pressable>

          {/* <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review Registrations"
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: theme.isDark ? '#262629' : '#F3F4F6',
                borderColor: theme.isDark ? '#3A3A3C' : '#E5E7EB',
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            onPress={() => onNavigateToSection('registrations')}
          >
            <Icon name="check-circle" size={16} color={theme.colors.text} strokeWidth={2.2} />
            <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>
              Review Registrations
            </Text>
          </Pressable> */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review Registrations"
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: theme.isDark ? '#262629' : '#F3F4F6',
                borderColor: theme.isDark ? '#3A3A3C' : '#E5E7EB',
                opacity: pressed ? 0.75 : 1,

                // Keep the existing height; increase width for the full label
                minWidth: 190,
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 14,
                gap: 8,
              },
            ]}
            onPress={() => onNavigateToSection('registrations')}
          >
            <Icon
              name="check-circle"
              size={16}
              color={theme.colors.text}
              strokeWidth={2.2}
            />

            <Text
              style={[
                styles.actionButtonText,
                {
                  color: theme.colors.text,
                  flexShrink: 0,
                  includeFontPadding: false,
                },
              ]}
            >
              Review Registrations
            </Text>
          </Pressable>
        </View>

        {/* ================================================================= */}
        {/* 4. RECENT ORDERS SECTION                                          */}
        {/* ================================================================= */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
              Recent Orders
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>
              Latest customer purchases
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View All Orders"
            style={({ pressed }) => [
              styles.viewAllPill,
              {
                backgroundColor: theme.isDark ? '#262629' : '#F3F4F6',
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={() => onNavigateToSection('orders')}
          >
            <Text style={[styles.viewAllText, { color: theme.colors.text }]}>
              View All
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.listContainer,
            {
              backgroundColor: theme.isDark ? '#1C1C1E' : '#FFFFFF',
              borderColor: theme.isDark ? '#2C2C2E' : '#E5E7EB',
            },
          ]}
        >
          {orders.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                No recorded orders found.
              </Text>
            </View>
          ) : (
            orders.slice(0, 4).map((order, idx) => {
              const customerName =
                order.name || order.user?.name || (order.email ? order.email.split('@')[0] : 'Customer');
              const statusStr = (order.status || 'PENDING').toUpperCase();

              return (
                <Pressable
                  key={order.id ?? `overview-order-${idx}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Order #${order.id} by ${customerName}, total ₹${order.total}, status ${statusStr}`}
                  style={({ pressed }) => [
                    styles.orderRow,
                    idx > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: theme.isDark ? '#2C2C2E' : '#F3F4F6',
                    },
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={() => onNavigateToSection('orders')}
                >
                  <View style={styles.orderLeft}>
                    <Text style={[styles.orderId, { color: theme.colors.textMuted }]}>
                      #{order.id}
                    </Text>
                    <View style={styles.orderNameBlock}>
                      <Text
                        numberOfLines={1}
                        style={[styles.orderCustomerName, { color: theme.colors.text }]}
                      >
                        {customerName}
                      </Text>
                      <Text style={[styles.orderAmount, { color: theme.colors.textMuted }]}>
                        ₹{Number(order.total || 0).toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.orderRight}>
                    <StatusBadge label={statusStr} size="sm" />
                    <Icon
                      name="chevron-right"
                      size={14}
                      color={theme.colors.textMuted}
                      strokeWidth={2.4}
                    />
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        {/* ================================================================= */}
        {/* 5. PRODUCT CATALOG PREVIEW                                        */}
        {/* ================================================================= */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
              Product Catalog Preview
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>
              Inventory items in stock
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage All Products"
            style={({ pressed }) => [
              styles.viewAllPill,
              {
                backgroundColor: theme.isDark ? '#262629' : '#F3F4F6',
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={() => onNavigateToSection('products')}
          >
            <Text style={[styles.viewAllText, { color: theme.colors.text }]}>
              Manage All
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.listContainer,
            {
              backgroundColor: theme.isDark ? '#1C1C1E' : '#FFFFFF',
              borderColor: theme.isDark ? '#2C2C2E' : '#E5E7EB',
            },
          ]}
        >
          {products.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                No products currently available in catalog.
              </Text>
            </View>
          ) : (
            products.slice(0, 4).map((product, idx) => {
              const imageUri = resolveImageUrl(product.image);

              return (
                <Pressable
                  key={product.id ?? `overview-product-${idx}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${product.name}, ${product.category}, ${product.stock} in stock, ₹${product.price}`}
                  style={({ pressed }) => [
                    styles.productRow,
                    idx > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: theme.isDark ? '#2C2C2E' : '#F3F4F6',
                    },
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={() => onNavigateToSection('products')}
                >
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.productThumb}
                    resizeMode="cover"
                  />
                  <View style={styles.productInfo}>
                    <Text
                      numberOfLines={1}
                      style={[styles.productName, { color: theme.colors.text }]}
                    >
                      {product.name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.productMeta, { color: theme.colors.textMuted }]}>
                      {product.category} • {product.stock} in stock
                    </Text>
                  </View>
                  <Text style={[styles.productPrice, { color: theme.colors.text }]}>
                    ₹{Number(product.price || 0).toFixed(2)}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  cardItem: {
    width: '48.5%',
  },
  analyticsContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  chartTitleColumn: {
    flex: 1,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  chartSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  peakBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  peakBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  chartArea: {
    height: 140,
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  chartBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    paddingHorizontal: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 140,
  },
  barTrack: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  barFill: {
    width: 22,
    borderRadius: 6,
    minHeight: 12,
  },
  barLabel: {
    fontSize: 11,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
  },
  summaryCol: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  metricsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  stripItem: {
    alignItems: 'center',
  },
  stripLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stripVal: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  stripDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    width: '48.5%',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  viewAllPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  viewAllText: {
    fontSize: 11,
    fontWeight: '700',
  },
  listContainer: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  orderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  orderId: {
    fontSize: 13,
    fontWeight: '700',
    width: 38,
  },
  orderNameBlock: {
    flex: 1,
  },
  orderCustomerName: {
    fontSize: 13,
    fontWeight: '700',
  },
  orderAmount: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  orderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  productThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
  },
  productMeta: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '800',
  },
});
