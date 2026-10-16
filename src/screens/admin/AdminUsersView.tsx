import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { useAppTheme } from '../../theme/theme';
import { useFeedback } from '../../context/FeedbackContext';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../config/queryKeys';
import { queryClient } from '../../config/queryClient';
import { Icon } from '../../components/Icon';
import { FullPageContentLoader } from '../../components/common';
import { withRandomLoadingDuration } from '../../utils/loadingUtils';
import type { AdminUser, AdminUserDetail } from '../../types/admin';
import { useAuth } from '../../context/AuthContext';
import {
  getAdminUsers,
  getAdminUserDetail,
  updateAdminUserRole,
  deleteAdminUser,
} from '../../services/adminApi';

interface AdminUsersViewProps {
  token: string;
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({ token }) => {
  const theme = useAppTheme();
  const feedback = useFeedback();

  let currentUser: any = null;
  try {
    const auth = useAuth();
    currentUser = auth?.user ?? null;
  } catch {
    currentUser = null;
  }

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'CUSTOMER' | 'ADMIN'>('ALL');
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // User Details Modal
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // TanStack Query for Admin Users
  const {
    data: usersData,
    isLoading: isUsersLoading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.adminUsers(search, roleFilter),
    queryFn: async () => {
      const data = await withRandomLoadingDuration(() =>
        getAdminUsers(token, search, roleFilter)
      );
      return data || [];
    },
    enabled: !!token,
  });

  const [localUsers, setLocalUsers] = useState<AdminUser[] | null>(null);
  const users = localUsers || usersData || [];
  const loading = isUsersLoading && users.length === 0;

  const loadUsers = useCallback(async () => {
    try {
      const res = await refetch();
      if (res.data) setLocalUsers(res.data);
    } catch (err: any) {
      feedback.toast.error(err.message || 'Could not load users');
    }
  }, [refetch, feedback]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadUsers();
    } finally {
      setRefreshing(false);
    }
  }, [loadUsers]);

  const handleToggleRole = (user: AdminUser) => {
    const nextRole: 'CUSTOMER' | 'ADMIN' = user.role === 'ADMIN' ? 'CUSTOMER' : 'ADMIN';

    feedback.showConfirm({
      title: `Change Role to ${nextRole}?`,
      message: `Are you sure you want to change "${user.name}" (${user.email}) to ${nextRole}?`,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      isDestructive: nextRole === 'CUSTOMER',
      onConfirm: async () => {
        try {
          await updateAdminUserRole(token, user.id, nextRole);
          setLocalUsers((prev) =>
            (prev || users).map((u) => (u.id === user.id ? { ...u, role: nextRole } : u))
          );
          queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
          queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
          feedback.toast.success(`Role updated to ${nextRole} for ${user.name}`);
        } catch (err: any) {
          feedback.toast.error(err.message || 'Failed to update user role');
        }
      },
    });
  };

  const handleDeleteUser = (user: AdminUser | { id: number; name: string; email: string; role: string }) => {
    // 1. Guard against self-deletion
    if (currentUser && Number(currentUser.id) === user.id) {
      feedback.showAlert({
        title: 'Cannot Delete Account',
        message: 'You cannot delete your own administrator account while logged in.',
        type: 'warning',
      });
      return;
    }

    // 2. Guard against deleting the last admin
    if (user.role === 'ADMIN') {
      const adminCount = users.filter((u) => u.role === 'ADMIN').length;
      if (adminCount <= 1) {
        feedback.showAlert({
          title: 'Cannot Delete Admin',
          message: 'Cannot delete the only remaining administrator account in the system.',
          type: 'warning',
        });
        return;
      }
    }

    // 3. Confirmation Dialog
    feedback.showConfirm({
      title: 'Permanently Delete User?',
      message: `Are you sure you want to delete user "${user.name}" (${user.email})?\n\nThis will permanently remove the user account, associated order history, wishlist, and cart records from the database. This action cannot be undone.`,
      confirmText: 'Delete User',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        setDeletingUserId(user.id);
        try {
          await deleteAdminUser(token, user.id);
          setLocalUsers((prev) => (prev || users).filter((u) => u.id !== user.id));
          if (selectedUserDetail && selectedUserDetail.id === user.id) {
            setSelectedUserDetail(null);
          }
          queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
          queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
          feedback.toast.success(`User "${user.name}" deleted successfully`);
          loadUsers();
        } catch (err: any) {
          feedback.toast.error(err.message || 'Failed to delete user');
        } finally {
          setDeletingUserId(null);
        }
      },
    });
  };

  const handleOpenDetail = async (user: AdminUser) => {
    setLoadingDetail(true);
    try {
      const detail = await getAdminUserDetail(token, user.id);
      setSelectedUserDetail(detail);
    } catch (err: any) {
      feedback.toast.error(err.message || 'Could not fetch user details');
    } finally {
      setLoadingDetail(false);
    }
  };

  if (loading && !refreshing) {
    return <FullPageContentLoader message="Loading users..." />;
  }

  return (
    <View style={styles.container}>
      {/* Search Input */}
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
            placeholder="Search users by name or email..."
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

      {/* Role Filter Chips */}
      <View style={styles.filterRow}>
        {(['ALL', 'CUSTOMER', 'ADMIN'] as const).map((filter) => {
          const isSelected = roleFilter === filter;
          return (
            <Pressable
              key={filter}
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
              onPress={() => setRoleFilter(filter)}
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
                {filter === 'ALL' ? 'All Roles' : filter}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Users List */}
      <View style={{ flex: 1 }}>
        <FlatList
          data={users}
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
            <Icon name="users" size={48} color={theme.colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Users Found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              {search ? 'Try clearing your search query' : 'Registered members will appear here'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const joinedDate = new Date(item.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
          const isAdmin = item.role === 'ADMIN';

          return (
            <View
              style={[
                styles.userCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              {/* Header: User Info & Role Badge */}
              <View style={styles.userHeader}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitial}>
                    {(item.name || item.email || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.userMainInfo}>
                  <Text style={[styles.userName, { color: theme.colors.text }]} numberOfLines={1}>
                    {item.name || 'Unnamed User'}
                  </Text>
                  <Text style={[styles.userEmail, { color: theme.colors.textMuted }]} numberOfLines={1}>
                    {item.email}
                  </Text>
                </View>

                <View
                  style={[
                    styles.roleBadge,
                    {
                      backgroundColor: isAdmin ? '#000000' : theme.isDark ? '#2C2C2E' : '#E5E7EB',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.roleBadgeText,
                      {
                        color: isAdmin ? '#FFFFFF' : theme.colors.text,
                      },
                    ]}
                  >
                    {item.role}
                  </Text>
                </View>
              </View>

              {/* Stats Bar: Orders, Wishlist, Cart, Joined */}
              <View
                style={[
                  styles.statsBar,
                  {
                    backgroundColor: theme.isDark ? '#1C1C1E' : '#F9FAFB',
                    borderColor: theme.colors.borderLight,
                  },
                ]}
              >
                <View style={styles.statCol}>
                  <Text style={[styles.statNum, { color: theme.colors.text }]}>
                    {item.orderCount}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Orders</Text>
                </View>

                <View style={styles.statCol}>
                  <Text style={[styles.statNum, { color: theme.colors.text }]}>
                    {item.cartItemCount}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>In Cart</Text>
                </View>

                <View style={styles.statCol}>
                  <Text style={[styles.statNum, { color: theme.colors.text }]}>
                    {item.wishlistCount}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Wishlist</Text>
                </View>

                <View style={styles.statCol}>
                  <Text style={[styles.statNum, { color: theme.colors.text }]}>{joinedDate}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Joined</Text>
                </View>
              </View>

              {/* Actions: View Details, Change Role & Delete User */}
              <View style={styles.actionsRow}>
                <Pressable
                  style={[styles.detailsBtn, { backgroundColor: theme.isDark ? '#262629' : '#F0F0F2' }]}
                  onPress={() => handleOpenDetail(item)}
                >
                  <Icon name="eye" size={14} color={theme.colors.text} />
                  <Text style={[styles.detailsBtnText, { color: theme.colors.text }]}>Details</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.roleToggleBtn,
                    {
                      backgroundColor: isAdmin ? '#FEF3C7' : '#000000',
                    },
                  ]}
                  onPress={() => handleToggleRole(item)}
                >
                  <Icon
                    name="shield"
                    size={14}
                    color={isAdmin ? '#B45309' : '#FFFFFF'}
                  />
                  <Text
                    style={[
                      styles.roleToggleBtnText,
                      { color: isAdmin ? '#B45309' : '#FFFFFF' },
                    ]}
                  >
                    {isAdmin ? 'Demote' : 'Make Admin'}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.deleteUserBtn,
                    {
                      borderColor: '#EF4444',
                      backgroundColor: theme.isDark ? '#2D1515' : '#FEF2F2',
                    },
                  ]}
                  onPress={() => handleDeleteUser(item)}
                  disabled={deletingUserId === item.id}
                >
                  {deletingUserId === item.id ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Icon name="trash" size={14} color="#EF4444" />
                  )}
                </Pressable>
              </View>
            </View>
          );
        }}
        />
        {refreshing && (
          <FullPageContentLoader
            message="Loading users..."
            overlay
          />
        )}
      </View>

      {/* User Details Modal */}
      <Modal
        visible={!!selectedUserDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedUserDetail(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedUserDetail(null)}>
          <View
            style={[
              styles.detailModalCard,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  {selectedUserDetail?.name}
                </Text>
                <Text style={[styles.modalSubtitle, { color: theme.colors.textMuted }]}>
                  {selectedUserDetail?.email} • {selectedUserDetail?.role}
                </Text>
              </View>
              <Pressable onPress={() => setSelectedUserDetail(null)}>
                <Icon name="close" size={20} color={theme.colors.text} />
              </Pressable>
            </View>

            <FlatList
              data={selectedUserDetail?.orders || []}
              keyExtractor={(o) => String(o.id)}
              contentContainerStyle={{ gap: 10, paddingVertical: 10 }}
              ListHeaderComponent={
                <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
                  Order History ({selectedUserDetail?.orders?.length || 0})
                </Text>
              }
              ListEmptyComponent={
                <Text style={[styles.emptyHistoryText, { color: theme.colors.textMuted }]}>
                  No orders placed yet.
                </Text>
              }
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.orderRow,
                    {
                      backgroundColor: theme.isDark ? '#222' : '#F9FAFB',
                      borderColor: theme.colors.borderLight,
                    },
                  ]}
                >
                  <View>
                    <Text style={[styles.orderHistoryId, { color: theme.colors.text }]}>
                      Order #{item.id}
                    </Text>
                    <Text style={[styles.orderHistoryMeta, { color: theme.colors.textMuted }]}>
                      {new Date(item.createdAt).toLocaleDateString()} • {item.itemCount} items
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.orderHistoryTotal, { color: theme.colors.text }]}>
                      ₹{item.total.toLocaleString()}
                    </Text>
                    <Text style={[styles.orderHistoryStatus, { color: theme.colors.accent }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
              )}
            />

            <View style={styles.modalFooterActions}>
              <Pressable
                style={[
                  styles.modalDeleteBtn,
                  {
                    borderColor: '#EF4444',
                    backgroundColor: theme.isDark ? '#2D1515' : '#FEF2F2',
                  },
                ]}
                onPress={() => {
                  if (selectedUserDetail) {
                    handleDeleteUser(selectedUserDetail);
                  }
                }}
                disabled={deletingUserId === selectedUserDetail?.id}
              >
                {deletingUserId === selectedUserDetail?.id ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <>
                    <Icon name="trash" size={14} color="#EF4444" />
                    <Text style={styles.modalDeleteBtnText}>Delete User</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={[styles.closeBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => setSelectedUserDetail(null)}
              >
                <Text style={[styles.closeBtnText, { color: theme.colors.primaryText }]}>Close</Text>
              </Pressable>
            </View>
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
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
  userCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  userMainInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 12,
    marginTop: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  statCol: {
    alignItems: 'center',
  },
  statNum: {
    fontSize: 13,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  detailsBtn: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  detailsBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  roleToggleBtn: {
    flex: 1.2,
    height: 36,
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  roleToggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailModalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyHistoryText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 10,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  orderHistoryId: {
    fontSize: 13,
    fontWeight: '700',
  },
  orderHistoryMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  orderHistoryTotal: {
    fontSize: 13,
    fontWeight: '700',
  },
  orderHistoryStatus: {
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  deleteUserBtn: {
    width: 38,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFooterActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  modalDeleteBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  modalDeleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
});
