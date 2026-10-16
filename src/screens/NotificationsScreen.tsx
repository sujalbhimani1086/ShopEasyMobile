import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../config/queryKeys';
import { Icon } from '../components/Icon';
import { ScreenHeader, LoadingState, ErrorState, EmptyState, FullScreenRefreshLoader, FullPageContentLoader } from '../components/common';
import { withRandomLoadingDuration } from '../utils/loadingUtils';
import type { NotificationItem, NotificationsResponse } from '../types/notification';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
} from '../services/notificationApi';

export interface NotificationsScreenProps {
  onBack: () => void;
  onNavigateToOrder?: (orderId: number) => void;
  onOrderPress?: (orderId: number) => void;
  onNavigateToSupport?: () => void;
  onNavigateToLogin?: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  onBack,
  onNavigateToOrder,
  onOrderPress,
  onNavigateToSupport,
  onNavigateToLogin,
  onUnreadCountChange,
}) => {
  const theme = useAppTheme();
  const feedback = useFeedback();
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // TanStack Query for notifications (Single Source of Truth)
  const {
    data: notifsData,
    isLoading: isNotifsLoading,
    isRefetching,
    error: notifsError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.notifications(user?.id),
    queryFn: async () => {
      if (!token || !user) return { notifications: [], unreadCount: 0 };
      return await getNotifications(token);
    },
    enabled: !!token && !!user,
  });

  const notifications = notifsData?.notifications ?? [];
  const unreadCount = notifsData?.unreadCount ?? 0;
  const hasUsableData = notifsData !== undefined;
  const loading = isNotifsLoading && !hasUsableData;
  const error =
    !hasUsableData && notifsError
      ? (notifsError as any)?.message || 'Could not load notifications.'
      : null;

  // Keep parent unread count synchronized safely without triggering infinite re-render loops
  const onUnreadCountChangeRef = useRef(onUnreadCountChange);
  onUnreadCountChangeRef.current = onUnreadCountChange;
  const lastReportedCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (
      typeof notifsData?.unreadCount === 'number' &&
      lastReportedCountRef.current !== notifsData.unreadCount
    ) {
      lastReportedCountRef.current = notifsData.unreadCount;
      onUnreadCountChangeRef.current?.(notifsData.unreadCount);
    }
  }, [notifsData?.unreadCount]);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refetch();
    } catch {
      // Background error handled by TanStack Query
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, refetch]);

  const handleMarkAllRead = async () => {
    if (!token || !user || unreadCount === 0) return;
    const previousData = queryClient.getQueryData<NotificationsResponse>(
      queryKeys.notifications(user.id)
    );

    // Optimistically mark all notifications read
    queryClient.setQueryData<NotificationsResponse>(
      queryKeys.notifications(user.id),
      (old) => ({
        notifications: (old?.notifications || []).map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      })
    );
    onUnreadCountChange?.(0);

    try {
      await markAllNotificationsRead(token);
    } catch (err) {
      // Revert optimistic update on failure
      if (previousData) {
        queryClient.setQueryData(queryKeys.notifications(user.id), previousData);
        onUnreadCountChange?.(previousData.unreadCount);
      }
      feedback.toast.error('Failed to mark all notifications as read. Please try again.');
    } finally {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(user.id) });
    }
  };

  const handlePressItem = async (item: NotificationItem) => {
    if (!token || !user) return;

    if (!item.isRead) {
      const previousData = queryClient.getQueryData<NotificationsResponse>(
        queryKeys.notifications(user.id)
      );

      const nextCount = Math.max(0, (previousData?.unreadCount ?? 1) - 1);

      // Optimistically update read status
      queryClient.setQueryData<NotificationsResponse>(
        queryKeys.notifications(user.id),
        (old) => {
          if (!old) return { notifications: [], unreadCount: 0 };
          const updated = old.notifications.map((n) =>
            n.id === item.id ? { ...n, isRead: true } : n
          );
          return { notifications: updated, unreadCount: nextCount };
        }
      );
      onUnreadCountChange?.(nextCount);

      try {
        await markNotificationRead(item.id, token);
      } catch (err) {
        // Revert optimistic update on failure
        if (previousData) {
          queryClient.setQueryData(queryKeys.notifications(user.id), previousData);
          onUnreadCountChange?.(previousData.unreadCount);
        }
        feedback.toast.error('Could not mark notification as read.');
      } finally {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications(user.id) });
      }
    }

    // Parse notification data for smart deep-linking
    let parsedData: any = null;
    try {
      if (item.data) {
        parsedData = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
      }
    } catch {}

    const orderHandler = onNavigateToOrder || onOrderPress;
    const orderId = parsedData?.orderId ? Number(parsedData.orderId) : null;
    if ((item.type === 'ORDER' || item.type === 'PAYMENT') && orderId && orderHandler) {
      orderHandler(orderId);
    } else if (item.type === 'SUPPORT' && onNavigateToSupport) {
      onNavigateToSupport();
    }
  };

  const handleDismiss = async (id: number) => {
    if (!token || !user) return;
    const target = notifications.find((n) => n.id === id);
    const wasUnread = target ? !target.isRead : false;
    const previousData = queryClient.getQueryData<NotificationsResponse>(
      queryKeys.notifications(user.id)
    );

    // Optimistically remove notification
    queryClient.setQueryData<NotificationsResponse>(
      queryKeys.notifications(user.id),
      (old) => {
        if (!old) return { notifications: [], unreadCount: 0 };
        const updated = old.notifications.filter((n) => n.id !== id);
        const nextCount = wasUnread ? Math.max(0, old.unreadCount - 1) : old.unreadCount;
        return { notifications: updated, unreadCount: nextCount };
      }
    );
    if (wasUnread) {
      onUnreadCountChange?.(Math.max(0, unreadCount - 1));
    }

    try {
      await dismissNotification(id, token);
    } catch (err) {
      // Revert optimistic update on failure
      if (previousData) {
        queryClient.setQueryData(queryKeys.notifications(user.id), previousData);
        onUnreadCountChange?.(previousData.unreadCount);
      }
      feedback.toast.error('Could not dismiss notification.');
    } finally {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(user.id) });
    }
  };

  // Unauthenticated customer empty / sign in state
  if (!user || !token) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['top', 'left', 'right']}
      >
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
        <ScreenHeader title="Notifications" onBack={onBack} />
        <View style={styles.emptyListContent}>
          <EmptyState
            icon="bell"
            title="Sign in to view notifications"
            subtitle="Please log in to your account to view your order updates, shipments, and special offers."
            actionTitle="Sign In"
            onAction={onNavigateToLogin}
          />
        </View>
      </SafeAreaView>
    );
  }

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  const getIconForType = (type: string) => {
    switch (type.toUpperCase()) {
      case 'ORDER':
        return { name: 'package' as const, color: theme.colors.primary };
      case 'PAYMENT':
        return { name: 'credit-card' as const, color: '#10b981' };
      case 'SUPPORT':
        return { name: 'message' as const, color: theme.colors.textSecondary };
      case 'PROMO':
        return { name: 'tag' as const, color: '#f59e0b' };
      default:
        return { name: 'bell' as const, color: theme.colors.textMuted };
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const iconInfo = getIconForType(item.type);

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Notification: ${item.title}`}
        onPress={() => handlePressItem(item)}
        style={({ pressed }) => [
          styles.itemCard,
          {
            backgroundColor: item.isRead
              ? theme.colors.card
              : theme.isDark
              ? 'rgba(255, 255, 255, 0.04)'
              : 'rgba(0, 0, 0, 0.02)',
            borderColor: item.isRead ? theme.colors.border : theme.colors.primary,
            borderLeftWidth: item.isRead ? 1 : 4,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <View style={styles.itemRow}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: theme.colors.surfaceSubtle },
            ]}
          >
            <Icon name={iconInfo.name} size={18} color={iconInfo.color} />
          </View>

          <View style={styles.itemContent}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.itemTitle,
                  {
                    color: theme.colors.text,
                    fontWeight: item.isRead ? '600' : '700',
                  },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
                {formatTime(item.createdAt)}
              </Text>
            </View>

            <Text
              style={[styles.messageText, { color: theme.colors.textSecondary }]}
              numberOfLines={2}
            >
              {item.message}
            </Text>
          </View>

          <Pressable
            onPress={() => handleDismiss(item.id)}
            style={styles.dismissBtn}
            hitSlop={8}
            accessibilityLabel="Dismiss notification"
          >
            <Icon name="close" size={14} color={theme.colors.textMuted} />
          </Pressable>
        </View>
      </Pressable>
    );
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
      <ScreenHeader
        title="Notifications"
        onBack={onBack}
        rightActionText={unreadCount > 0 ? 'Mark all read' : undefined}
        onRightAction={unreadCount > 0 ? handleMarkAllRead : undefined}
        rightActionAccessibilityLabel="Mark all as read"
      />

      {/* Content */}
      {loading ? (
        <FullPageContentLoader message="Loading notifications..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => refetch()} />
      ) : (
        <View style={styles.contentWrapper}>
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={
              notifications.length === 0
                ? styles.emptyListContent
                : styles.listContent
            }
            ListEmptyComponent={
              <EmptyState
                icon="bell"
                title="No notifications yet"
                subtitle="You will receive updates here for orders, shipments, payment confirmations, and special offers."
              />
            }
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.colors.primary]}
                tintColor={theme.colors.primary}
              />
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
    position: 'relative',
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
  markAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  markAllBtnText: {
    fontSize: 13,
    fontWeight: '600',
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
  listContent: {
    padding: 16,
    gap: 10,
  },
  itemCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    elevation: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  itemContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 14,
    flex: 1,
    marginRight: 6,
  },
  timeText: {
    fontSize: 11,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  dismissBtn: {
    padding: 4,
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
