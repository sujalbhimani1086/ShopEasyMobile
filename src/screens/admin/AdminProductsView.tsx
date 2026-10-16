import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../config/queryKeys';
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
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useKeyboardAware, KeyboardAwareScrollView, KeyboardAwareScrollViewRef } from '../../components/keyboard';
import { useAppTheme } from '../../theme/theme';
import { useFeedback } from '../../context/FeedbackContext';
import { Icon } from '../../components/Icon';
import { FullPageContentLoader } from '../../components/common';
import { withRandomLoadingDuration } from '../../utils/loadingUtils';
import { resolveImageUrl, FALLBACK_PRODUCT_IMAGE } from '../../config/api';
import type { AdminProduct } from '../../types/admin';
import {
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  updateAdminProductStock,
  deleteAdminProduct,
  getAdminCategories,
} from '../../services/adminApi';

interface AdminProductsViewProps {
  token: string;
}

export const AdminProductsView: React.FC<AdminProductsViewProps> = ({ token }) => {
  const theme = useAppTheme();
  const feedback = useFeedback();
  const queryClient = useQueryClient();
  const { keyboardHeight, isKeyboardVisible, screenHeight } = useKeyboardAware();
  const formScrollRef = useRef<KeyboardAwareScrollViewRef>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [sortBy, setSortBy] = useState<'default' | 'price_asc' | 'price_desc' | 'stock_asc'>('default');

  // Restock Modal State
  const [restockProduct, setRestockProduct] = useState<AdminProduct | null>(null);
  const [restockAmount, setRestockAmount] = useState('0');
  const [savingStock, setSavingStock] = useState(false);

  // Add/Edit Product Modal State
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [isCategoryPickerVisible, setIsCategoryPickerVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDiscount, setFormDiscount] = useState('0');
  const [formStock, setFormStock] = useState('10');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [imageLoadError, setImageLoadError] = useState(false);
  const [submittingForm, setSubmittingForm] = useState(false);

  // TanStack Query for products
  const {
    data: products = [],
    isLoading: loading,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ['admin', 'products', 'list'],
    queryFn: async () => {
      return await getAdminProducts(token);
    },
    enabled: !!token,
  });

  // TanStack Query for categories
  const {
    data: rawCategories = [],
    refetch: refetchCategories,
  } = useQuery({
    queryKey: queryKeys.adminCategories,
    queryFn: async () => {
      return await getAdminCategories(token);
    },
    enabled: !!token,
  });

  const categoryNames = useMemo<string[]>(() => {
    if (!Array.isArray(rawCategories)) return [];
    return rawCategories
      .map((item: any) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item.name === 'string') return item.name.trim();
        return '';
      })
      .filter((name): name is string => Boolean(name) && name.toUpperCase() !== 'ALL');
  }, [rawCategories]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchProducts(),
        refetchCategories(),
      ]);
    } catch (err: any) {
      feedback.toast.error(err.message || 'Could not refresh products');
    } finally {
      setRefreshing(false);
    }
  };

  // Filter & Sort
  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          String(p.id).includes(q)
      );
    }
    if (selectedCategory && selectedCategory.toUpperCase() !== 'ALL') {
      list = list.filter((p) => (p.category || '').toLowerCase() === selectedCategory.toLowerCase());
    }
    if (sortBy === 'price_asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'stock_asc') {
      list.sort((a, b) => a.stock - b.stock);
    }
    return list;
  }, [products, search, selectedCategory, sortBy]);

  // Open Restock Modal
  const openRestockModal = (product: AdminProduct) => {
    setRestockProduct(product);
    setRestockAmount(String(product.stock));
  };

  const handleSaveStock = async () => {
    if (!restockProduct) return;
    const trimmed = restockAmount.trim();
    if (!/^\d+$/.test(trimmed)) {
      feedback.toast.error('Please enter a valid non-negative integer stock value');
      return;
    }
    const newStock = parseInt(trimmed, 10);
    if (isNaN(newStock) || newStock < 0) {
      feedback.toast.error('Please enter a valid stock number (0 or higher).');
      return;
    }
    setSavingStock(true);
    try {
      await updateAdminProductStock(token, restockProduct, newStock);
      queryClient.setQueryData(['admin', 'products', 'list'], (old: AdminProduct[] | undefined) =>
        (old || []).map((p) => (p.id === restockProduct.id ? { ...p, stock: newStock } : p))
      );
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
      feedback.toast.success(`Stock updated for ${restockProduct.name} to ${newStock}`);
      setRestockProduct(null);
    } catch (err: any) {
      feedback.toast.error(err.message || 'Failed to update stock');
    } finally {
      setSavingStock(false);
    }
  };

  // Open Add/Edit Modal
  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormCategory(categoryNames[0] || 'Electronics');
    setFormPrice('');
    setFormDiscount('0');
    setFormStock('10');
    setFormImageUrl('');
    setImageLoadError(false);
    setIsFormModalVisible(true);
  };

  const openEditModal = (p: AdminProduct) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormPrice(String(p.price));
    setFormDiscount(String(p.discount || 0));
    setFormStock(String(p.stock));
    setFormImageUrl(p.image || '');
    setImageLoadError(false);
    setIsFormModalVisible(true);
  };

  const handleChooseImage = () => {
    feedback.showAlert({
      title: 'Choose Image from Device',
      message:
        'Direct phone storage / gallery file picking requires the "react-native-image-picker" native package to be linked in Android.\n\nYou can use any direct web image URL (HTTP / HTTPS) in the Image URL field below with live preview.',
      type: 'info',
    });
  };

  const handleSaveProduct = async () => {
    if (!formName.trim()) {
      feedback.toast.error('Product name is required');
      return;
    }
    if (!formCategory.trim()) {
      feedback.toast.error('Category is required');
      return;
    }
    const priceNum = parseInt(formPrice, 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      feedback.toast.error('Please enter a valid positive price');
      return;
    }
    const discountNum = parseInt(formDiscount, 10) || 0;
    if (isNaN(discountNum) || discountNum < 0 || discountNum > 100) {
      feedback.toast.error('Discount must be between 0 and 100%');
      return;
    }
    const stockNum = parseInt(formStock, 10);
    if (isNaN(stockNum) || stockNum < 0) {
      feedback.toast.error('Please enter a valid non-negative stock count');
      return;
    }

    const cleanUrl = formImageUrl.trim();
    if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      feedback.toast.error('Image URL must start with http:// or https://');
      return;
    }

    setSubmittingForm(true);
    try {
      if (editingProduct) {
        await updateAdminProduct(token, {
          id: editingProduct.id,
          name: formName.trim(),
          category: formCategory.trim(),
          price: priceNum,
          discount: discountNum,
          stock: stockNum,
          imageUrl: cleanUrl,
        });
        feedback.toast.success('Product updated successfully');
      } else {
        await createAdminProduct(token, {
          name: formName.trim(),
          category: formCategory.trim(),
          price: priceNum,
          discount: discountNum,
          stock: stockNum,
          imageUrl: cleanUrl,
        });
        feedback.toast.success('Product created successfully');
      }
      setIsFormModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    } catch (err: any) {
      feedback.toast.error(err.message || 'Failed to save product');
    } finally {
      setSubmittingForm(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = (p: AdminProduct) => {
    if (p.stock > 0) {
      feedback.showAlert({
        title: 'Cannot Delete In-Stock Product',
        message: `"${p.name}" has ${p.stock} units in stock. The database requires stock to be 0 before deletion to protect inventory integrity. Please restock to 0 first if you wish to remove it.`,
        type: 'warning',
      });
      return;
    }

    feedback.showConfirm({
      title: 'Delete Product',
      message: `Are you sure you want to permanently delete "${p.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteAdminProduct(token, p.id);
          queryClient.setQueryData(['admin', 'products', 'list'], (old: AdminProduct[] | undefined) =>
            (old || []).filter((item) => item.id !== p.id)
          );
          queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
          queryClient.invalidateQueries({ queryKey: ['products'] });
          queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
          feedback.toast.success('Product deleted successfully');
        } catch (err: any) {
          feedback.toast.error(err.message || 'Could not delete product');
        }
      },
    });
  };

  if (loading && products.length === 0 && !refreshing) {
    return <FullPageContentLoader message="Loading Products..." />;
  }

  return (
    <View style={styles.container}>
      {/* Search & Action Bar */}
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
            placeholder="Search products "
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
          accessibilityRole="button"
          accessibilityLabel="Add New Product"
          style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
          onPress={openAddModal}
        >
          <Icon name="plus" size={18} color={theme.colors.primaryText} strokeWidth={2.5} />
          <Text style={[styles.addButtonText, { color: theme.colors.primaryText }]}>Add Product</Text>
        </Pressable>
      </View>

      {/* Category Filter Chips */}
      <View style={styles.chipScrollContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['ALL', ...categoryNames]}
          keyExtractor={(item, index) =>
            typeof item === 'string' && item ? `cat-chip-${item}` : `cat-chip-${index}`
          }
          contentContainerStyle={styles.chipList}
          renderItem={({ item }) => {
            const itemStr = typeof item === 'string' ? item : (item as any)?.name || '';
            const isSelected = selectedCategory.toLowerCase() === itemStr.toLowerCase();
            return (
              <Pressable
                onPress={() => setSelectedCategory(itemStr)}
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
                  {itemStr}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Products List */}
      <View style={{ flex: 1 }}>
        <FlatList
          data={filteredProducts}
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
              <Icon name="package" size={48} color={theme.colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Products Found</Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                {search ? 'Try clearing your search query' : 'Add products to start managing inventory'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.productCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Image
                source={{ uri: resolveImageUrl(item.image) }}
                defaultSource={{ uri: FALLBACK_PRODUCT_IMAGE }}
                style={styles.productImage}
                resizeMode="cover"
              />
              <View style={styles.productInfo}>
                <View style={styles.productHeaderRow}>
                  <Text style={[styles.productCategory, { color: theme.colors.textMuted }]}>
                    {item.category.toUpperCase()} • ID #{item.id}
                  </Text>
                  <View
                    style={[
                      styles.stockBadge,
                      {
                        backgroundColor:
                          item.stock === 0
                            ? '#FEE2E2'
                            : item.stock < 10
                              ? '#FEF3C7'
                              : '#DCFCE7',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.stockBadgeText,
                        {
                          color:
                            item.stock === 0
                              ? '#DC2626'
                              : item.stock < 10
                                ? '#D97706'
                                : '#15803D',
                        },
                      ]}
                    >
                      {item.stock === 0 ? 'Out of Stock' : `${item.stock} in stock`}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.productName, { color: theme.colors.text }]} numberOfLines={2}>
                  {item.name}
                </Text>

                <View style={styles.priceRow}>
                  <Text style={[styles.productPrice, { color: theme.colors.text }]}>
                    ₹{item.price.toLocaleString()}
                  </Text>
                  {item.discount > 0 && (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountText}>{item.discount}% OFF</Text>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionsRow}>
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: theme.isDark ? '#262629' : '#F0F0F2' }]}
                    onPress={() => openRestockModal(item)}
                  >
                    <Icon name="refresh" size={14} color={theme.colors.text} />
                    <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>Restock</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: theme.isDark ? '#262629' : '#F0F0F2' }]}
                    onPress={() => openEditModal(item)}
                  >
                    <Icon name="edit" size={14} color={theme.colors.text} />
                    <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>Edit</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: item.stock === 0 ? '#FEE2E2' : theme.isDark ? '#262629' : '#F0F0F2',
                        opacity: item.stock === 0 ? 1 : 0.6,
                      },
                    ]}
                    onPress={() => handleDeleteProduct(item)}
                  >
                    <Icon
                      name="trash"
                      size={14}
                      color={item.stock === 0 ? '#DC2626' : theme.colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        { color: item.stock === 0 ? '#DC2626' : theme.colors.textMuted },
                      ]}
                    >
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        />
        {refreshing && (
          <FullPageContentLoader
            message="Loading Products..."
            overlay
          />
        )}
      </View>

      {/* Restock Modal */}
      <Modal
        visible={!!restockProduct}
        transparent
        animationType="fade"
        onRequestClose={() => setRestockProduct(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setRestockProduct(null)}>
            <View
              style={[
                styles.dialogCard,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
              onStartShouldSetResponder={() => true}
            >
              <Text style={[styles.dialogTitle, { color: theme.colors.text }]}>Update Stock</Text>
              <Text style={[styles.dialogSubtitle, { color: theme.colors.textSecondary }]}>
                {restockProduct?.name}
              </Text>

              <View style={styles.counterRow}>
                <Pressable
                  style={[styles.counterBtn, { backgroundColor: theme.isDark ? '#333' : '#E5E7EB' }]}
                  onPress={() => {
                    const val = Math.max(0, parseInt(restockAmount, 10) - 1);
                    setRestockAmount(String(isNaN(val) ? 0 : val));
                  }}
                >
                  <Icon name="minus" size={18} color={theme.colors.text} strokeWidth={2.5} />
                </Pressable>

                <TextInput
                  style={[
                    styles.counterInput,
                    {
                      color: theme.colors.text,
                      backgroundColor: theme.isDark ? '#222' : '#F9FAFB',
                      borderColor: theme.colors.border,
                    },
                  ]}
                  keyboardType="numeric"
                  value={restockAmount}
                  onChangeText={(t) => setRestockAmount(t.replace(/[^0-9]/g, ''))}
                />

                <Pressable
                  style={[styles.counterBtn, { backgroundColor: theme.isDark ? '#333' : '#E5E7EB' }]}
                  onPress={() => {
                    const val = parseInt(restockAmount, 10) + 1;
                    setRestockAmount(String(isNaN(val) ? 1 : val));
                  }}
                >
                  <Icon name="plus" size={18} color={theme.colors.text} strokeWidth={2.5} />
                </Pressable>
              </View>

              <View style={styles.dialogActions}>
                <Pressable
                  style={[styles.dialogCancelBtn, { borderColor: theme.colors.border }]}
                  onPress={() => setRestockProduct(null)}
                >
                  <Text style={[styles.dialogBtnText, { color: theme.colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.dialogConfirmBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={handleSaveStock}
                  disabled={savingStock}
                >
                  {savingStock ? (
                    <ActivityIndicator size="small" color={theme.colors.primaryText} />
                  ) : (
                    <Text style={[styles.dialogBtnText, { color: theme.colors.primaryText }]}>Save Stock</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add / Edit Product Modal */}
      <Modal
        visible={isFormModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFormModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setIsFormModalVisible(false)}>
            <View
              style={[
                styles.formModalCard,
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
              <View style={styles.formHeader}>
                <Text style={[styles.dialogTitle, { color: theme.colors.text }]}>
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </Text>
                <Pressable onPress={() => setIsFormModalVisible(false)}>
                  <Icon name="close" size={20} color={theme.colors.text} />
                </Pressable>
              </View>

              <KeyboardAwareScrollView
                ref={formScrollRef}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.formBody}
                extraScrollHeight={70}
              >
                {/* Product Name */}
                <View>
                  <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Product Name *</Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      {
                        color: theme.colors.text,
                        backgroundColor: theme.isDark ? '#222' : '#F9FAFB',
                        borderColor: theme.colors.border,
                      },
                    ]}
                    placeholder="e.g. Wireless Headphones"
                    placeholderTextColor={theme.colors.textMuted}
                    value={formName}
                    onChangeText={setFormName}
                    onFocus={() => formScrollRef.current?.scrollToInput(0)}
                  />
                </View>

                {/* Category Dropdown Picker */}
                <View>
                  <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Category *</Text>
                  <Pressable
                    style={[
                      styles.categorySelectBtn,
                      {
                        backgroundColor: theme.isDark ? '#222' : '#F9FAFB',
                        borderColor: theme.colors.border,
                      },
                    ]}
                    onPress={() => setIsCategoryPickerVisible(true)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Icon name="tag" size={15} color={theme.colors.primary} />
                      <Text
                        style={[
                          styles.categorySelectText,
                          { color: formCategory ? theme.colors.text : theme.colors.textMuted },
                        ]}
                        numberOfLines={1}
                      >
                        {formCategory || 'Select a Category'}
                      </Text>
                    </View>
                    <Icon name="chevron-down" size={14} color={theme.colors.textMuted} />
                  </Pressable>
                </View>

                {/* Price & Discount */}
                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Price (₹) *</Text>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          color: theme.colors.text,
                          backgroundColor: theme.isDark ? '#222' : '#F9FAFB',
                          borderColor: theme.colors.border,
                        },
                      ]}
                      placeholder="999"
                      keyboardType="numeric"
                      placeholderTextColor={theme.colors.textMuted}
                      value={formPrice}
                      onChangeText={setFormPrice}
                      onFocus={() => formScrollRef.current?.scrollToInput(100)}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Discount (%)</Text>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          color: theme.colors.text,
                          backgroundColor: theme.isDark ? '#222' : '#F9FAFB',
                          borderColor: theme.colors.border,
                        },
                      ]}
                      placeholder="0"
                      keyboardType="numeric"
                      placeholderTextColor={theme.colors.textMuted}
                      value={formDiscount}
                      onChangeText={setFormDiscount}
                      onFocus={() => formScrollRef.current?.scrollToInput(100)}
                    />
                  </View>
                </View>

                {/* Initial Stock */}
                <View>
                  <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Stock Quantity *</Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      {
                        color: theme.colors.text,
                        backgroundColor: theme.isDark ? '#222' : '#F9FAFB',
                        borderColor: theme.colors.border,
                      },
                    ]}
                    placeholder="10"
                    keyboardType="numeric"
                    placeholderTextColor={theme.colors.textMuted}
                    value={formStock}
                    onChangeText={setFormStock}
                    onFocus={() => formScrollRef.current?.scrollToInput(160)}
                  />
                </View>

                {/* Image Section: Phone Upload & Online URL */}
                <View style={styles.imageSection}>
                  <View style={styles.imageSectionHeader}>
                    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary, marginBottom: 0 }]}>
                      Product Image
                    </Text>
                    <Pressable
                      style={[styles.chooseImageBtn, { backgroundColor: theme.isDark ? '#333' : '#E5E7EB' }]}
                      onPress={handleChooseImage}
                    >
                      <Icon name="image" size={13} color={theme.colors.text} />
                      <Text style={[styles.chooseImageBtnText, { color: theme.colors.text }]}>Choose / Upload</Text>
                    </Pressable>
                  </View>

                  <TextInput
                    style={[
                      styles.formInput,
                      {
                        color: theme.colors.text,
                        backgroundColor: theme.isDark ? '#222' : '#F9FAFB',
                        borderColor: theme.colors.border,
                        marginTop: 6,
                      },
                    ]}
                    placeholder="Online Image URL (https://...)"
                    placeholderTextColor={theme.colors.textMuted}
                    value={formImageUrl}
                    onChangeText={(text) => {
                      setFormImageUrl(text);
                      setImageLoadError(false);
                    }}
                    autoCapitalize="none"
                    onFocus={() => formScrollRef.current?.scrollToInput(220)}
                  />

                  {/* Live Image Preview */}
                  {formImageUrl.trim() ? (
                    <View
                      style={[
                        styles.imagePreviewContainer,
                        {
                          backgroundColor: theme.isDark ? '#1C1C1E' : '#F4F4F6',
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: formImageUrl.trim() }}
                        style={styles.imagePreviewBox}
                        resizeMode="cover"
                        onError={() => setImageLoadError(true)}
                        onLoad={() => setImageLoadError(false)}
                      />
                      <View style={styles.imagePreviewDetails}>
                        <Text
                          style={[
                            styles.imagePreviewStatus,
                            { color: imageLoadError ? '#EF4444' : '#10B981' },
                          ]}
                        >
                          {imageLoadError ? '⚠️ Image preview failed' : '✓ Image loaded'}
                        </Text>
                        <Pressable
                          style={styles.removeImageBtn}
                          onPress={() => {
                            setFormImageUrl('');
                            setImageLoadError(false);
                          }}
                        >
                          <Icon name="trash" size={13} color="#EF4444" />
                          <Text style={styles.removeImageText}>Remove Image</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              </KeyboardAwareScrollView>

              <View style={styles.formFooter}>
                <Pressable
                  style={[styles.dialogCancelBtn, { borderColor: theme.colors.border }]}
                  onPress={() => setIsFormModalVisible(false)}
                >
                  <Text style={[styles.dialogBtnText, { color: theme.colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.dialogConfirmBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={handleSaveProduct}
                  disabled={submittingForm}
                >
                  {submittingForm ? (
                    <ActivityIndicator size="small" color={theme.colors.primaryText} />
                  ) : (
                    <Text style={[styles.dialogBtnText, { color: theme.colors.primaryText }]}>
                      {editingProduct ? 'Save Changes' : 'Create Product'}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Category Picker Dropdown Modal */}
      <Modal
        visible={isCategoryPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCategoryPickerVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsCategoryPickerVisible(false)}>
          <View
            style={[
              styles.categoryModalCard,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.categoryModalHeader}>
              <Text style={[styles.dialogTitle, { color: theme.colors.text }]}>Select Category</Text>
              <Pressable onPress={() => setIsCategoryPickerVisible(false)}>
                <Icon name="close" size={20} color={theme.colors.text} />
              </Pressable>
            </View>

            <FlatList
              data={categoryNames}
              keyExtractor={(item, index) =>
                typeof item === 'string' && item ? `cat-opt-${item}` : `cat-opt-${index}`
              }
              style={{ maxHeight: 280 }}
              renderItem={({ item }) => {
                const itemStr = typeof item === 'string' ? item : (item as any)?.name || '';
                const isSelected = formCategory.toLowerCase() === itemStr.toLowerCase();
                return (
                  <Pressable
                    style={[
                      styles.categoryOptionItem,
                      {
                        backgroundColor: isSelected
                          ? theme.isDark
                            ? '#333336'
                            : '#F3F4F6'
                          : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      setFormCategory(itemStr);
                      setIsCategoryPickerVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        {
                          color: theme.colors.text,
                          fontWeight: isSelected ? '700' : '400',
                        },
                      ]}
                    >
                      {itemStr}
                    </Text>
                    {isSelected && <Icon name="check" size={18} color={theme.colors.primary} strokeWidth={2.5} />}
                  </Pressable>
                );
              }}
            />
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '700',
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
  productCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  productImage: {
    width: 86,
    height: 86,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  productHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productCategory: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  stockBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stockBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700',
  },
  discountBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
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
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  dialogSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 24,
  },
  counterBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterInput: {
    width: 80,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
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
  formModalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    maxHeight: '90%',
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  formBody: {
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
  formRow: {
    flexDirection: 'row',
  },
  formFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  categorySelectBtn: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categorySelectText: {
    fontSize: 14,
  },
  imageSection: {
    gap: 6,
  },
  imageSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chooseImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  chooseImageBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
  },
  imagePreviewBox: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  imagePreviewDetails: {
    flex: 1,
    gap: 4,
  },
  imagePreviewStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  removeImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  removeImageText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },
  categoryModalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  categoryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  categoryOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  categoryOptionText: {
    fontSize: 14,
  },
});
