import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../config/queryKeys';
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
import { Icon } from '../../components/Icon';
import type { AdminRegistration } from '../../types/admin';
import {
  getAdminRegistrations,
  updateAdminRegistrationStatus,
} from '../../services/adminApi';
import { FullPageContentLoader } from '../../components/common';

interface AdminRegistrationsViewProps {
  token: string;
}

export const AdminRegistrationsView: React.FC<AdminRegistrationsViewProps> = ({ token }) => {
  const theme = useAppTheme();
  const feedback = useFeedback();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'DECLINED'>('ALL');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [selectedRegistration, setSelectedRegistration] = useState<AdminRegistration | null>(null);

  const {
    data,
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.adminRegistrations(search, statusFilter),
    queryFn: async () => {
      return await getAdminRegistrations(token, search, statusFilter);
    },
    enabled: !!token,
  });

  const registrations = data?.registrations || [];
  const pendingCount = data?.pendingCount || 0;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (err: any) {
      feedback.toast.error(err.message || 'Could not refresh registration requests');
    } finally {
      setRefreshing(false);
    }
  };

  const handleUpdateStatus = async (
    reg: AdminRegistration,
    status: 'APPROVED' | 'DECLINED'
  ) => {
    if (status === 'DECLINED') {
      feedback.showConfirm({
        title: 'Decline Registration Request?',
        message: `Are you sure you want to decline registration for "${reg.name}" (${reg.email})?`,
        confirmText: 'Decline',
        cancelText: 'Cancel',
        isDestructive: true,
        onConfirm: async () => {
          await executeStatusUpdate(reg.id, status);
        },
      });
      return;
    }

    await executeStatusUpdate(reg.id, 'APPROVED');
  };

  const executeStatusUpdate = async (id: number, status: 'APPROVED' | 'DECLINED') => {
    setProcessingId(id);
    try {
      await updateAdminRegistrationStatus(token, id, status);
      queryClient.invalidateQueries({ queryKey: ['admin', 'registrations'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
      if (status === 'APPROVED') {
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      }
      if (selectedRegistration && selectedRegistration.id === id) {
        setSelectedRegistration((prev) => (prev ? { ...prev, status } : null));
      }
      if (status === 'APPROVED') {
        feedback.toast.success('Registration approved');
      } else {
        feedback.toast.info('Registration declined');
      }
    } catch (err: any) {
      feedback.toast.error(err.message || `Failed to update status`);
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'APPROVED') {
      return { bg: '#DCFCE7', text: '#15803D' };
    }
    if (s === 'DECLINED') {
      return { bg: '#FEE2E2', text: '#DC2626' };
    }
    return { bg: '#FEF3C7', text: '#D97706' };
  };

  if (loading && registrations.length === 0 && !refreshing) {
    return <FullPageContentLoader message="Loading Registrations..." />;
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
            placeholder="Search registrations by name or email..."
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
      <View style={styles.filterRow}>
        {(['ALL', 'PENDING', 'APPROVED', 'DECLINED'] as const).map((filter) => {
          const isSelected = statusFilter === filter;
          const showPendingBadge = filter === 'PENDING' && pendingCount > 0;

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
              onPress={() => setStatusFilter(filter)}
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
                {filter === 'ALL' ? 'All Requests' : filter}
              </Text>
              {showPendingBadge && (
                <View style={styles.chipCountBadge}>
                  <Text style={styles.chipCountText}>{pendingCount}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Registrations List */}
      <View style={{ flex: 1, position: 'relative' }}>
        <FlatList
          data={registrations}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="transparent"
              colors={['transparent']}
              progressBackgroundColor="transparent"
            />
          }
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="user" size={48} color={theme.colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                No Registration Requests
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                {search ? 'Try clearing your search query' : 'Customer registration requests will appear here'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isPending = item.status === 'PENDING';
            const isProcessing = processingId === item.id;
            const badgeStyle = getStatusBadgeStyle(item.status);
            const reqDate = new Date(item.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <View
                style={[
                  styles.reqCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View style={styles.reqHeader}>
                  <View style={styles.customerInfo}>
                    <Text style={[styles.customerName, { color: theme.colors.text }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.customerEmail, { color: theme.colors.textMuted }]}>
                      {item.email}
                    </Text>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: badgeStyle.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badgeStyle.text }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
                    Request ID #{item.id} • Registered on {reqDate}
                  </Text>
                </View>

                {/* Action Buttons: Details & (if pending) Approve / Decline */}
                <View style={styles.actionsRow}>
                  <Pressable
                    style={[
                      styles.detailsSmallBtn,
                      { backgroundColor: theme.isDark ? '#262629' : '#F0F0F2' },
                    ]}
                    onPress={() => setSelectedRegistration(item)}
                  >
                    <Icon name="eye" size={13} color={theme.colors.text} />
                    <Text style={[styles.detailsSmallBtnText, { color: theme.colors.text }]}>
                      Details
                    </Text>
                  </Pressable>

                  {isPending && (
                    isProcessing ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} style={{ flex: 1 }} />
                    ) : (
                      <>
                        <Pressable
                          style={[styles.approveBtn, { backgroundColor: '#10B981' }]}
                          onPress={() => handleUpdateStatus(item, 'APPROVED')}
                        >
                          <Icon name="check" size={13} color="#FFFFFF" strokeWidth={2.5} />
                          <Text style={styles.actionBtnText}>Approve</Text>
                        </Pressable>

                        <Pressable
                          style={[styles.declineBtn, { backgroundColor: '#EF4444' }]}
                          onPress={() => handleUpdateStatus(item, 'DECLINED')}
                        >
                          <Icon name="close" size={13} color="#FFFFFF" strokeWidth={2.5} />
                          <Text style={styles.actionBtnText}>Decline</Text>
                        </Pressable>
                      </>
                    )
                  )}
                </View>
              </View>
            );
          }}
        />
        {refreshing && (
          <FullPageContentLoader
            message="Loading Registrations..."
            overlay
          />
        )}
      </View>

      {/* Registration Details Modal */}
      <Modal
        visible={!!selectedRegistration}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRegistration(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedRegistration(null)}
        >
          <View
            style={[
              styles.detailModalCard,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {selectedRegistration && (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalTitle, { color: theme.colors.text }]} numberOfLines={1}>
                      {selectedRegistration.name}
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: theme.colors.textMuted }]}>
                      Request #{selectedRegistration.id}
                    </Text>
                  </View>

                  <Pressable
                    style={{ padding: 4 }}
                    onPress={() => setSelectedRegistration(null)}
                  >
                    <Icon name="close" size={20} color={theme.colors.text} />
                  </Pressable>
                </View>

                <View style={styles.modalBody}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Email:</Text>
                    <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                      {selectedRegistration.email}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Role:</Text>
                    <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                      {selectedRegistration.role || 'CUSTOMER'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Status:</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusBadgeStyle(selectedRegistration.status).bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: getStatusBadgeStyle(selectedRegistration.status).text },
                        ]}
                      >
                        {selectedRegistration.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>Applied On:</Text>
                    <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                      {new Date(selectedRegistration.createdAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>

                  {selectedRegistration.status === 'PENDING' && (
                    <View style={styles.modalActionRow}>
                      <Pressable
                        style={[styles.approveBtn, { backgroundColor: '#10B981' }]}
                        onPress={() => handleUpdateStatus(selectedRegistration, 'APPROVED')}
                        disabled={processingId === selectedRegistration.id}
                      >
                        {processingId === selectedRegistration.id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Icon name="check" size={14} color="#FFFFFF" strokeWidth={2.5} />
                            <Text style={styles.actionBtnText}>Approve Request</Text>
                          </>
                        )}
                      </Pressable>

                      <Pressable
                        style={[styles.declineBtn, { backgroundColor: '#EF4444' }]}
                        onPress={() => handleUpdateStatus(selectedRegistration, 'DECLINED')}
                        disabled={processingId === selectedRegistration.id}
                      >
                        {processingId === selectedRegistration.id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Icon name="close" size={14} color="#FFFFFF" strokeWidth={2.5} />
                            <Text style={styles.actionBtnText}>Decline Request</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  )}
                </View>

                <Pressable
                  style={[styles.closeModalBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={() => setSelectedRegistration(null)}
                >
                  <Text style={[styles.closeModalBtnText, { color: theme.colors.primaryText }]}>
                    Close
                  </Text>
                </Pressable>
              </>
            )}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  filterChipText: {
    fontSize: 12,
  },
  chipCountBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
  },
  chipCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
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
  reqCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  reqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
  },
  customerEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
  },
  metaText: {
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  approveBtn: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  declineBtn: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  detailsSmallBtn: {
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailsSmallBtnText: {
    fontSize: 12,
    fontWeight: '600',
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
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalBody: {
    gap: 12,
    marginBottom: 18,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  closeModalBtn: {
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
