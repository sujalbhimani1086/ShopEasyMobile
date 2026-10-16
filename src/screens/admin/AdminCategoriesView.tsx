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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAppTheme } from '../../theme/theme';
import { useFeedback } from '../../context/FeedbackContext';
import { Icon } from '../../components/Icon';
import { FullPageContentLoader } from '../../components/common';
import type { AdminCategory } from '../../types/admin';
import {
  getAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
} from '../../services/adminApi';

interface AdminCategoriesViewProps {
  token: string;
}

export const AdminCategoriesView: React.FC<AdminCategoriesViewProps> = ({ token }) => {
  const theme = useAppTheme();
  const feedback = useFeedback();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Add / Edit Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const {
    data: categories = [],
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.adminCategories,
    queryFn: async () => {
      return await getAdminCategories(token);
    },
    enabled: !!token,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (err: any) {
      feedback.toast.error(err.message || 'Could not refresh categories');
    } finally {
      setRefreshing(false);
    }
  };

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, search]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setCategoryName('');
    setIsModalVisible(true);
  };

  const openEditModal = (cat: AdminCategory) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setIsModalVisible(true);
  };

  const handleSaveCategory = async () => {
    const trimmed = categoryName.trim();
    if (!trimmed) {
      feedback.toast.error('Category name cannot be empty');
      return;
    }

    setSubmitting(true);
    try {
      if (editingCategory) {
        await updateAdminCategory(token, editingCategory.id, trimmed);
        feedback.toast.success(`Category "${trimmed}" updated`);
      } else {
        await createAdminCategory(token, trimmed);
        feedback.toast.success(`Category "${trimmed}" created`);
      }
      setIsModalVisible(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.adminCategories });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
    } catch (err: any) {
      feedback.toast.error(err.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = (cat: AdminCategory) => {
    feedback.showConfirm({
      title: 'Delete Category',
      message: `Are you sure you want to delete category "${cat.name}"? Products currently in this category will need updating.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteAdminCategory(token, cat.id);
          queryClient.invalidateQueries({ queryKey: queryKeys.adminCategories });
          queryClient.invalidateQueries({ queryKey: queryKeys.categories });
          queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
          feedback.toast.success(`Category "${cat.name}" deleted`);
        } catch (err: any) {
          feedback.toast.error(err.message || 'Could not delete category');
        }
      },
    });
  };

  if (loading && categories.length === 0 && !refreshing) {
    return <FullPageContentLoader message="Loading Categories..." />;
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
            placeholder="Search categories..."
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
          <Text style={[styles.addBtnText, { color: theme.colors.primaryText }]}>Add Category</Text>
        </Pressable>
      </View>

      {/* Categories List */}
      <View style={{ flex: 1 }}>
        <FlatList
          data={filteredCategories}
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
              <Icon name="grid" size={48} color={theme.colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Categories Found</Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                {search ? 'Try clearing your search query' : 'Create product categories to organize catalog'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const dateStr = item.createdAt
              ? new Date(item.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
              : '';

            return (
              <View
                style={[
                  styles.categoryCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View style={styles.categoryLeft}>
                  <View
                    style={[
                      styles.iconBox,
                      { backgroundColor: theme.isDark ? '#2C2C2E' : '#F3F4F6' },
                    ]}
                  >
                    <Icon name="grid" size={20} color={theme.colors.text} />
                  </View>

                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                      {item.name}
                    </Text>
                    <View style={styles.metaRow}>
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>
                          {item.productCount ?? 0} Products
                        </Text>
                      </View>
                      {dateStr ? (
                        <Text style={[styles.createdDate, { color: theme.colors.textMuted }]}>
                          Created {dateStr}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: theme.isDark ? '#262629' : '#F0F0F2' }]}
                    onPress={() => openEditModal(item)}
                  >
                    <Icon name="edit" size={14} color={theme.colors.text} />
                  </Pressable>

                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]}
                    onPress={() => handleDeleteCategory(item)}
                  >
                    <Icon name="trash" size={14} color="#DC2626" />
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
        {refreshing && (
          <FullPageContentLoader
            message="Loading categories..."
            overlay
          />
        )}
      </View>

      {/* Add / Edit Category Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setIsModalVisible(false)}>
            <View
              style={[
                styles.dialogCard,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
              onStartShouldSetResponder={() => true}
            >
              <Text style={[styles.dialogTitle, { color: theme.colors.text }]}>
                {editingCategory ? 'Edit Category' : 'New Category'}
              </Text>

              <TextInput
                style={[
                  styles.categoryInput,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.isDark ? '#222' : '#F9FAFB',
                    borderColor: theme.colors.border,
                  },
                ]}
                placeholder="e.g. Footwear"
                placeholderTextColor={theme.colors.textMuted}
                value={categoryName}
                onChangeText={setCategoryName}
                autoFocus
              />

              <View style={styles.dialogActions}>
                <Pressable
                  style={[styles.dialogCancelBtn, { borderColor: theme.colors.border }]}
                  onPress={() => setIsModalVisible(false)}
                >
                  <Text style={[styles.dialogBtnText, { color: theme.colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.dialogConfirmBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={handleSaveCategory}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={theme.colors.primaryText} />
                  ) : (
                    <Text style={[styles.dialogBtnText, { color: theme.colors.primaryText }]}>
                      {editingCategory ? 'Save' : 'Create'}
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
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 10,
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
  categoryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  countBadge: {
    backgroundColor: '#000000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  createdDate: {
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  categoryInput: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  dialogCancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogConfirmBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
