import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../config/queryKeys';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useAppTheme } from '../../theme/theme';
import { useFeedback } from '../../context/FeedbackContext';
import { Icon } from '../../components/Icon';
import type {
  OrderStatusChartPoint,
  SalesChartPoint,
  OrderStatusFilter,
  SalesPeriodFilter,
} from '../../types/admin';
import {
  getAdminAnalyticsStatus,
  getAdminAnalyticsSales,
} from '../../services/adminApi';
import { FullPageContentLoader } from '../../components/common';

interface AdminAnalyticsViewProps {
  token: string;
}

export const AdminAnalyticsView: React.FC<AdminAnalyticsViewProps> = ({ token }) => {
  const theme = useAppTheme();
  const feedback = useFeedback();

  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>('ALL');
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriodFilter>('date');
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: statusData = [],
    isLoading: statusLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: queryKeys.adminAnalyticsStatus(statusFilter),
    queryFn: async () => {
      return await getAdminAnalyticsStatus(token, statusFilter);
    },
    enabled: !!token,
  });

  const {
    data: salesData = [],
    isLoading: salesLoading,
    refetch: refetchSales,
  } = useQuery({
    queryKey: queryKeys.adminAnalyticsSales(salesPeriod),
    queryFn: async () => {
      return await getAdminAnalyticsSales(token, salesPeriod);
    },
    enabled: !!token,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchStatus(), refetchSales()]);
    } catch (err: any) {
      feedback.toast.error(err.message || 'Failed to refresh analytics');
    } finally {
      setRefreshing(false);
    }
  };

  // Calculations
  const totalOrdersCount = useMemo(() => {
    return statusData.reduce((acc, curr) => acc + curr.count, 0);
  }, [statusData]);

  const totalSalesAmount = useMemo(() => {
    return salesData.reduce((acc, curr) => acc + curr.sales, 0);
  }, [salesData]);

  const maxSale = useMemo(() => {
    const max = Math.max(...salesData.map((d) => d.sales), 1);
    return max === 0 ? 1 : max;
  }, [salesData]);

  const initialLoading =
    (statusLoading && statusData.length === 0) ||
    (salesLoading && salesData.length === 0);

  if (initialLoading && !refreshing) {
    return <FullPageContentLoader message="Loading analytics..." />;
  }

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
      {/* Overview Metric Cards */}
      <View style={styles.metricsGrid}>
        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: theme.isDark ? '#1C1C1E' : '#000000',
              borderColor: theme.isDark ? '#333' : '#000000',
            },
          ]}
        >
          <Icon name="bar-chart" size={20} color="#FFFFFF" />
          <Text style={styles.metricLabel}>Total Period Sales</Text>
          <Text style={styles.metricValue}>₹{totalSalesAmount.toLocaleString()}</Text>
        </View>

        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Icon name="orders" size={20} color={theme.colors.text} />
          <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>
            Recorded Orders
          </Text>
          <Text style={[styles.metricValue, { color: theme.colors.text }]}>
            {totalOrdersCount}
          </Text>
        </View>
      </View>

      {/* Section 1: Order Status Analytics */}
      <View
        style={[
          styles.sectionBox,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Order Status Breakdown
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>
              Distribution across database fulfillment stages
            </Text>
          </View>
        </View>

        {/* Status Filter Chips */}
        <View style={styles.filterPillsRow}>
          {(['ALL', 'PENDING', 'COMPLETED', 'DELIVERED'] as OrderStatusFilter[]).map((f) => {
            const isSelected = statusFilter === f;
            return (
              <Pressable
                key={f}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSelected
                      ? theme.isDark
                        ? '#FFFFFF'
                        : '#000000'
                      : theme.isDark
                      ? '#262629'
                      : '#F0F0F2',
                  },
                ]}
                onPress={() => setStatusFilter(f)}
              >
                <Text
                  style={[
                    styles.filterPillText,
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
                  {f}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {statusLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={[styles.smallLoadingText, { color: theme.colors.textMuted }]}>
              Calculating order statistics...
            </Text>
          </View>
        ) : (
          <View style={styles.statusItemsList}>
            {statusData.map((item) => {
              const pct = totalOrdersCount > 0 ? (item.count / totalOrdersCount) * 100 : 0;
              const barColor =
                item.label === 'Completed'
                  ? '#10B981'
                  : item.label === 'Delivered'
                  ? '#3B82F6'
                  : item.label === 'Pending'
                  ? '#F59E0B'
                  : theme.colors.primary;

              return (
                <View key={item.label} style={styles.statusRow}>
                  <View style={styles.statusLabelRow}>
                    <Text style={[styles.statusItemLabel, { color: theme.colors.text }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.statusItemCount, { color: theme.colors.text }]}>
                      {item.count} orders ({pct.toFixed(0)}%)
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.barTrack,
                      { backgroundColor: theme.isDark ? '#2C2C2E' : '#E5E7EB' },
                    ]}
                  >
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.max(pct, item.count > 0 ? 3 : 0)}%`,
                          backgroundColor: barColor,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Section 2: Sales Trends & Chart */}
      <View
        style={[
          styles.sectionBox,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Sales Performance Trend
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>
              Revenue trends calculated from settled customer orders
            </Text>
          </View>
        </View>

        {/* Period Filter Tabs */}
        <View style={styles.periodTabsRow}>
          <Pressable
            style={[
              styles.periodTab,
              {
                backgroundColor:
                  salesPeriod === 'date'
                    ? theme.isDark
                      ? '#FFFFFF'
                      : '#000000'
                    : theme.isDark
                    ? '#262629'
                    : '#F0F0F2',
              },
            ]}
            onPress={() => setSalesPeriod('date')}
          >
            <Text
              style={[
                styles.periodTabText,
                {
                  color:
                    salesPeriod === 'date'
                      ? theme.isDark
                        ? '#000000'
                        : '#FFFFFF'
                      : theme.colors.text,
                },
              ]}
            >
              Daily (14 Days)
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.periodTab,
              {
                backgroundColor:
                  salesPeriod === 'month'
                    ? theme.isDark
                      ? '#FFFFFF'
                      : '#000000'
                    : theme.isDark
                    ? '#262629'
                    : '#F0F0F2',
              },
            ]}
            onPress={() => setSalesPeriod('month')}
          >
            <Text
              style={[
                styles.periodTabText,
                {
                  color:
                    salesPeriod === 'month'
                      ? theme.isDark
                        ? '#000000'
                        : '#FFFFFF'
                      : theme.colors.text,
                },
              ]}
            >
              Monthly (Year)
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.periodTab,
              {
                backgroundColor:
                  salesPeriod === 'year'
                    ? theme.isDark
                      ? '#FFFFFF'
                      : '#000000'
                    : theme.isDark
                    ? '#262629'
                    : '#F0F0F2',
              },
            ]}
            onPress={() => setSalesPeriod('year')}
          >
            <Text
              style={[
                styles.periodTabText,
                {
                  color:
                    salesPeriod === 'year'
                      ? theme.isDark
                        ? '#000000'
                        : '#FFFFFF'
                      : theme.colors.text,
                },
              ]}
            >
              Yearly
            </Text>
          </Pressable>
        </View>

        {salesLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={[styles.smallLoadingText, { color: theme.colors.textMuted }]}>
              Loading sales trend analytics...
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
            <View style={styles.chartContainer}>
              {salesData.map((point, index) => {
                const barHeight = Math.max(8, (point.sales / maxSale) * 140);
                return (
                  <View key={`${point.label}-${index}`} style={styles.chartBarCol}>
                    <Text style={[styles.barValueText, { color: theme.colors.textMuted }]}>
                      {point.sales > 0
                        ? point.sales >= 1000
                          ? `₹${(point.sales / 1000).toFixed(1)}k`
                          : `₹${point.sales}`
                        : '₹0'}
                    </Text>

                    <View style={styles.barArea}>
                      <View
                        style={[
                          styles.verticalBar,
                          {
                            height: barHeight,
                            backgroundColor:
                              point.sales > 0
                                ? theme.isDark
                                  ? '#FFFFFF'
                                  : '#000000'
                                : theme.isDark
                                ? '#333336'
                                : '#E5E7EB',
                          },
                        ]}
                      />
                    </View>

                    <Text
                      style={[
                        styles.barLabelText,
                        {
                          color: point.sales > 0 ? theme.colors.text : theme.colors.textMuted,
                          fontWeight: point.sales > 0 ? '700' : '500',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {point.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
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
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  metricLabel: {
    fontSize: 11,
    color: '#CCCCCC',
    fontWeight: '600',
    marginTop: 6,
  },
  metricValue: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  sectionBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  filterPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterPillText: {
    fontSize: 11,
  },
  loadingBox: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  smallLoadingText: {
    fontSize: 12,
  },
  statusItemsList: {
    gap: 12,
    marginTop: 4,
  },
  statusRow: {
    gap: 6,
  },
  statusLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusItemLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusItemCount: {
    fontSize: 12,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  periodTabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  periodTab: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chartScroll: {
    marginTop: 10,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 200,
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 16,
  },
  chartBarCol: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 48,
    height: '100%',
  },
  barValueText: {
    fontSize: 9,
    marginBottom: 4,
  },
  barArea: {
    height: 140,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  verticalBar: {
    width: 22,
    borderRadius: 6,
  },
  barLabelText: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
});
