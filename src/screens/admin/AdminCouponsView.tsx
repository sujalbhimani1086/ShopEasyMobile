import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../config/queryKeys';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Switch,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useKeyboardAware, KeyboardAwareScrollView, KeyboardAwareScrollViewRef } from '../../components/keyboard';
import { useAppTheme } from '../../theme/theme';
import { useFeedback } from '../../context/FeedbackContext';
import { Icon } from '../../components/Icon';
import type { AdminCoupon } from '../../types/admin';
import {
  getAdminCoupons,
  createAdminCoupon,
  updateAdminCoupon,
  deleteAdminCoupon,
} from '../../services/adminApi';
import { FullPageContentLoader } from '../../components/common';

interface AdminCouponsViewProps {
  token: string;
}

export const AdminCouponsView: React.FC<AdminCouponsViewProps> = ({ token }) => {
  const theme = useAppTheme();
  const feedback = useFeedback();
  const queryClient = useQueryClient();
  const { keyboardHeight, isKeyboardVisible, screenHeight } = useKeyboardAware();
  const couponScrollRef = useRef<KeyboardAwareScrollViewRef>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Form Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<AdminCoupon | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [formValue, setFormValue] = useState('');
  const [formMinOrder, setFormMinOrder] = useState('0');
  const [formMaxDiscount, setFormMaxDiscount] = useState('');
  const [formUsageLimit, setFormUsageLimit] = useState('');
  const [formExpiresAt, setFormExpiresAt] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const {
    data: coupons = [],
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.adminCoupons(search, statusFilter),
    queryFn: async () => {
      return await getAdminCoupons(token, search, statusFilter);
    },
    enabled: !!token,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (err: any) {
      feedback.toast.error(err.message || 'Could not refresh coupons');
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleActive = async (coupon: AdminCoupon, currentVal: boolean) => {
    const nextVal = !currentVal;
    try {
      await updateAdminCoupon(token, coupon.id, { isActive: nextVal });
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
      feedback.toast.success(`Coupon ${coupon.code} is now ${nextVal ? 'Active' : 'Inactive'}`);
    } catch (err: any) {
      feedback.toast.error(err.message || 'Failed to update coupon status');
    }
  };

  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormCode('');
    setFormType('PERCENTAGE');
    setFormValue('');
    setFormMinOrder('0');
    setFormMaxDiscount('');
    setFormUsageLimit('');
    setFormExpiresAt('');
    setFormIsActive(true);
    setIsModalVisible(true);
  };

  const openEditModal = (coupon: AdminCoupon) => {
    setEditingCoupon(coupon);
    setFormCode(coupon.code);
    setFormType(coupon.discountType);
    setFormValue(String(coupon.discountValue));
    setFormMinOrder(String(coupon.minOrderAmount || 0));
    setFormMaxDiscount(coupon.maxDiscount ? String(coupon.maxDiscount) : '');
    setFormUsageLimit(coupon.usageLimit ? String(coupon.usageLimit) : '');
    setFormExpiresAt(coupon.expiresAt ? coupon.expiresAt.split('T')[0] : '');
    setFormIsActive(coupon.isActive);
    setIsModalVisible(true);
  };

  const handleSaveCoupon = async () => {
    if (!formCode.trim()) {
      feedback.toast.error('Coupon code is required');
      return;
    }
    const val = parseInt(formValue, 10);
    if (isNaN(val) || val <= 0) {
      feedback.toast.error('Please enter a valid positive discount value');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        code: formCode.trim().toUpperCase(),
        discountType: formType,
        discountValue: val,
        minOrderAmount: parseInt(formMinOrder, 10) || 0,
        maxDiscount: formMaxDiscount ? parseInt(formMaxDiscount, 10) : null,
        usageLimit: formUsageLimit ? parseInt(formUsageLimit, 10) : null,
        expiresAt: formExpiresAt.trim() ? new Date(formExpiresAt).toISOString() : null,
        isActive: formIsActive,
      };

      if (editingCoupon) {
        await updateAdminCoupon(token, editingCoupon.id, payload);
        feedback.toast.success(`Coupon ${payload.code} updated`);
      } else {
        await createAdminCoupon(token, payload);
        feedback.toast.success(`Coupon ${payload.code} created`);
      }
      setIsModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
    } catch (err: any) {
      feedback.toast.error(err.message || 'Failed to save coupon');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCoupon = (coupon: AdminCoupon) => {
    feedback.showConfirm({
      title: 'Delete Coupon',
      message: `Are you sure you want to delete coupon code "${coupon.code}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteAdminCoupon(token, coupon.id);
          queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
          queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
          feedback.toast.success(`Coupon ${coupon.code} deleted`);
        } catch (err: any) {
          feedback.toast.error(err.message || 'Failed to delete coupon');
        }
      },
    });
  };

  if (loading && coupons.length === 0 && !refreshing) {
    return <FullPageContentLoader message="Loading Coupons..." />;
  }

  return (
    <View style={styles.container}>
      {/* Search & Add Bar */}
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
            placeholder="Search coupon codes..."
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

        <Pressable
          style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
          onPress={openCreateModal}
        >
          <Icon name="plus" size={18} color={theme.colors.primaryText} strokeWidth={2.5} />
          <Text style={[styles.addBtnText, { color: theme.colors.primaryText }]}>New</Text>
        </Pressable>
      </View>

      {/* Status Filter Chips */}
      <View style={styles.filterRow}>
        {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((filter) => {
          const isSelected = statusFilter === filter;
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
                {filter}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Coupons List */}
      <View style={{ flex: 1, position: 'relative' }}>
        <FlatList
          data={coupons}
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
              <Icon name="tag" size={48} color={theme.colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Coupons Found</Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                {search ? 'Try clearing your search query' : 'Create a promo coupon to boost sales'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();
            const expiryStr = item.expiresAt
              ? new Date(item.expiresAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
              : 'No Expiry';

            return (
              <View
                style={[
                  styles.couponCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                {/* Header: Code & Active Switch */}
                <View style={styles.cardHeader}>
                  <View style={styles.codeRow}>
                    <View style={styles.codeBadge}>
                      <Text style={styles.codeText}>{item.code}</Text>
                    </View>
                    <View
                      style={[
                        styles.discountPill,
                        {
                          backgroundColor:
                            item.discountType === 'PERCENTAGE' ? '#FEF3C7' : '#E0E7FF',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.discountPillText,
                          {
                            color:
                              item.discountType === 'PERCENTAGE' ? '#B45309' : '#3730A3',
                          },
                        ]}
                      >
                        {item.discountType === 'PERCENTAGE'
                          ? `${item.discountValue}% OFF`
                          : `₹${item.discountValue} FLAT`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.switchRow}>
                    <Text
                      style={[
                        styles.switchLabel,
                        { color: item.isActive ? '#15803D' : theme.colors.textMuted },
                      ]}
                    >
                      {item.isActive ? 'Active' : 'Inactive'}
                    </Text>
                    <Switch
                      value={item.isActive}
                      onValueChange={() => handleToggleActive(item, item.isActive)}
                      trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </View>

                {/* Details Grid */}
                <View
                  style={[
                    styles.detailsBox,
                    {
                      backgroundColor: theme.isDark ? '#1C1C1E' : '#F9FAFB',
                      borderColor: theme.colors.borderLight,
                    },
                  ]}
                >
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>
                      Min. Order:
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                      ₹{item.minOrderAmount}
                    </Text>
                  </View>

                  {item.maxDiscount ? (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>
                        Max. Discount:
                      </Text>
                      <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                        ₹{item.maxDiscount}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>
                      Redemptions:
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                      {item.usedCount} {item.usageLimit ? `/ ${item.usageLimit}` : 'times'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>
                      Valid Until:
                    </Text>
                    <Text
                      style={[
                        styles.detailValue,
                        { color: isExpired ? '#DC2626' : theme.colors.text },
                      ]}
                    >
                      {expiryStr} {isExpired ? '(Expired)' : ''}
                    </Text>
                  </View>
                </View>

                {/* Card Footer Actions */}
                <View style={styles.cardFooter}>
                  <Pressable
                    style={[styles.footerActionBtn, { backgroundColor: theme.isDark ? '#262629' : '#F0F0F2' }]}
                    onPress={() => openEditModal(item)}
                  >
                    <Icon name="edit" size={14} color={theme.colors.text} />
                    <Text style={[styles.footerActionText, { color: theme.colors.text }]}>Edit</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.footerActionBtn, { backgroundColor: '#FEE2E2' }]}
                    onPress={() => handleDeleteCoupon(item)}
                  >
                    <Icon name="trash" size={14} color="#DC2626" />
                    <Text style={[styles.footerActionText, { color: '#DC2626' }]}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
        {refreshing && (
          <FullPageContentLoader
            message="Loading Coupons..."
            overlay
          />
        )}
      </View>

      {/* Create / Edit Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setIsModalVisible(false)}>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  maxHeight: isKeyboardVisible
                    ? Math.max(280, screenHeight - keyboardHeight - (Platform.OS === 'android' ? 24 : 40))
                    : '90%',
                },
              ]}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  {editingCoupon ? 'Edit Coupon' : 'Create Coupon Code'}
                </Text>
                <Pressable onPress={() => setIsModalVisible(false)}>
                  <Icon name="close" size={20} color={theme.colors.text} />
                </Pressable>
              </View>

              <KeyboardAwareScrollView
                ref={couponScrollRef}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.formContainer}
                extraScrollHeight={60}
              >
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                  Coupon Code *
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      color: theme.colors.text,
                      backgroundColor: theme.isDark ? '#222' : '#F9FAFB',
                      borderColor: theme.colors.border,
                      textTransform: 'uppercase',
                    },
                  ]}
                  placeholder="e.g. WELCOME20"
                  placeholderTextColor={theme.colors.textMuted}
                  value={formCode}
                  onChangeText={setFormCode}
                  onFocus={() => couponScrollRef.current?.scrollToInput(0)}
                />

                {/* Discount Type Selector */}
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                  Discount Type *
                </Text>
                <View style={styles.typeSelectorRow}>
                  <Pressable
                    style={[
                      styles.typeSelectorBtn,
                      {
                        backgroundColor:
                          formType === 'PERCENTAGE'
                            ? theme.isDark
                              ? '#FFFFFF'
                              : '#000000'
                            : theme.isDark
                              ? '#222'
                              : '#EEEEEE',
                      },
                    ]}
                    onPress={() => setFormType('PERCENTAGE')}
                  >
                    <Text
                      style={[
                        styles.typeSelectorText,
                        {
                          color:
                            formType === 'PERCENTAGE'
                              ? theme.isDark
                                ? '#000000'
                                : '#FFFFFF'
                              : theme.colors.text,
                        },
                      ]}
                    >
                      Percentage (%)
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.typeSelectorBtn,
                      {
                        backgroundColor:
                          formType === 'FIXED'
                            ? theme.isDark
                              ? '#FFFFFF'
                              : '#000000'
                            : theme.isDark
                              ? '#222'
                              : '#EEEEEE',
                      },
                    ]}
                    onPress={() => setFormType('FIXED')}
                  >
                    <Text
                      style={[
                        styles.typeSelectorText,
                        {
                          color:
                            formType === 'FIXED'
                              ? theme.isDark
                                ? '#000000'
                                : '#FFFFFF'
                              : theme.colors.text,
                        },
                      ]}
                    >
                      Fixed Amount (₹)
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                      Value ({formType === 'PERCENTAGE' ? '%' : '₹'}) *
                    </Text>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          color: theme.colors.text,
                          backgroundColor: theme.isDark ? '#222' : '#F9FAFB',
                          borderColor: theme.colors.border,
                        },
                      ]}
                      placeholder="20"
                      keyboardType="numeric"
                      placeholderTextColor={theme.colors.textMuted}
                      value={formValue}
                      onChangeText={setFormValue}
                      onFocus={() => couponScrollRef.current?.scrollToInput(100)}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                      Min. Order (₹)
                    </Text>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          color: theme.colors.text,
                          backgroundColor: theme.isDark ? '#222' : '#F9FAFB',
                          borderColor: theme.colors.border,
                        },
                      ]}
                      placeholder="500"
                      keyboardType="numeric"
                      placeholderTextColor={theme.colors.textMuted}
                      value={formMinOrder}
                      onChangeText={setFormMinOrder}
                      onFocus={() => couponScrollRef.current?.scrollToInput(100)}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                      Max Discount (₹)
                    </Text>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          color: theme.colors.text,
                          backgroundColor: theme.isDark ? '#222' : '#F9FAFB',
                          borderColor: theme.colors.border,
                        },
                      ]}
                      placeholder="Optional"
                      keyboardType="numeric"
                      placeholderTextColor={theme.colors.textMuted}
                      value={formMaxDiscount}
                      onChangeText={setFormMaxDiscount}
                      onFocus={() => couponScrollRef.current?.scrollToInput(160)}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                      Usage Limit
                    </Text>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          color: theme.colors.text,
                          backgroundColor: theme.isDark ? '#222' : '#F9FAFB',
                          borderColor: theme.colors.border,
                        },
                      ]}
                      placeholder="Optional"
                      keyboardType="numeric"
                      placeholderTextColor={theme.colors.textMuted}
                      value={formUsageLimit}
                      onChangeText={setFormUsageLimit}
                      onFocus={() => couponScrollRef.current?.scrollToInput(160)}
                    />
                  </View>
                </View>

                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                  Expiry Date (YYYY-MM-DD)
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      color: theme.colors.text,
                      backgroundColor: theme.isDark ? '#222' : '#F9FAFB',
                      borderColor: theme.colors.border,
                    },
                  ]}
                  placeholder="2026-12-31"
                  placeholderTextColor={theme.colors.textMuted}
                  value={formExpiresAt}
                  onChangeText={setFormExpiresAt}
                  onFocus={() => couponScrollRef.current?.scrollToInput(220)}
                />
              </KeyboardAwareScrollView>

              <View style={styles.modalFooter}>
                <Pressable
                  style={[styles.cancelBtn, { borderColor: theme.colors.border }]}
                  onPress={() => setIsModalVisible(false)}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={handleSaveCoupon}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={theme.colors.primaryText} />
                  ) : (
                    <Text style={[styles.saveBtnText, { color: theme.colors.primaryText }]}>
                      {editingCoupon ? 'Update' : 'Create'}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBox: {
    flex: 1,
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
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
  couponCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeBadge: {
    backgroundColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  codeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  discountPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switchLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  detailsBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 12,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  footerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  footerActionText: {
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
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    maxHeight: '90%',
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
  formContainer: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  formInput: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeSelectorBtn: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeSelectorText: {
    fontSize: 12,
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
