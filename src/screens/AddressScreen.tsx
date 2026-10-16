import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../config/queryKeys';
import { queryClient } from '../config/queryClient';
import { Icon } from '../components/Icon';
import { ConfirmDialog, AlertDialog, type AlertType } from '../components/dialogs';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
  useKeyboardAware,
} from '../components/keyboard';
import type { Address, CreateAddressPayload } from '../types/address';
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '../services/addressApi';

export interface AddressScreenProps {
  onBack: () => void;
  onSelectAddress?: (address: Address) => void;
  selectionMode?: boolean;
  selectedAddressId?: number | null;
  onNavigateToLogin?: () => void;
}

const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

export const AddressScreen: React.FC<AddressScreenProps> = ({
  onBack,
  onSelectAddress,
  selectionMode = false,
  selectedAddressId = null,
  onNavigateToLogin: _onNavigateToLogin,
}) => {
  const theme = useAppTheme();
  const { user, token } = useAuth();

  // TanStack Query for addresses
  const {
    data: fetchedAddresses,
    isLoading: isAddressesLoading,
    error: addressesQueryError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.addresses(user?.id),
    queryFn: async () => {
      if (!token) return [];
      return await getAddresses(token);
    },
    enabled: !!token,
  });

  const [localAddresses, setLocalAddresses] = useState<Address[] | null>(null);
  const addresses = localAddresses || fetchedAddresses || [];
  const loading = !token ? false : (isAddressesLoading && addresses.length === 0);
  const error = addresses.length === 0 && addressesQueryError ? (addressesQueryError as any)?.message || 'Could not load saved addresses.' : null;

  // Keyboard and Scroll Handling
  const modalScrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const { isKeyboardVisible, keyboardHeight, screenHeight } = useKeyboardAware();

  // Modal State for Add/Edit
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLine1, setFormLine1] = useState('');
  const [formLine2, setFormLine2] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formPincode, setFormPincode] = useState('');
  const [formLandmark, setFormLandmark] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  const fetchAddresses = useCallback(async () => {
    if (!token) return;
    try {
      const res = await refetch();
      if (res.data) {
        setLocalAddresses(res.data);
      }
    } catch (err: any) {
      console.warn('Failed to refetch addresses:', err);
    }
  }, [token, refetch]);

  const openAddModal = () => {
    setEditingAddress(null);
    setFormName(user?.name || '');
    setFormPhone('');
    setFormLine1('');
    setFormLine2('');
    setFormCity('');
    setFormState('');
    setFormPincode('');
    setFormLandmark('');
    setFormIsDefault(addresses.length === 0);
    setIsModalVisible(true);
  };

  const openEditModal = (addr: Address) => {
    setEditingAddress(addr);
    setFormName(addr.name);
    setFormPhone(addr.phone);
    setFormLine1(addr.addressLine1);
    setFormLine2(addr.addressLine2 || '');
    setFormCity(addr.city);
    setFormState(addr.state);
    setFormPincode(addr.pincode);
    setFormLandmark(addr.landmark || '');
    setFormIsDefault(addr.isDefault);
    setIsModalVisible(true);
  };

  const handleSave = async () => {
    if (!token) return;

    // Validate
    if (!formName.trim()) {
      setAlertDialog({
        visible: true,
        title: 'Validation Error',
        message: 'Please enter recipient name.',
        type: 'warning',
      });
      return;
    }
    const cleanPhone = formPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setAlertDialog({
        visible: true,
        title: 'Validation Error',
        message: 'Please enter a valid 10-digit mobile number.',
        type: 'warning',
      });
      return;
    }
    if (!formLine1.trim()) {
      setAlertDialog({
        visible: true,
        title: 'Validation Error',
        message: 'Please enter Address Line 1.',
        type: 'warning',
      });
      return;
    }
    if (!formCity.trim()) {
      setAlertDialog({
        visible: true,
        title: 'Validation Error',
        message: 'Please enter city.',
        type: 'warning',
      });
      return;
    }
    if (!formState.trim()) {
      setAlertDialog({
        visible: true,
        title: 'Validation Error',
        message: 'Please enter state.',
        type: 'warning',
      });
      return;
    }
    const cleanPin = formPincode.trim();
    if (!PINCODE_REGEX.test(cleanPin)) {
      setAlertDialog({
        visible: true,
        title: 'Validation Error',
        message: 'Please enter a valid 6-digit PIN code.',
        type: 'warning',
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload: CreateAddressPayload = {
        name: formName.trim(),
        phone: cleanPhone,
        addressLine1: formLine1.trim(),
        addressLine2: formLine2.trim() || undefined,
        city: formCity.trim(),
        state: formState.trim(),
        pincode: cleanPin,
        landmark: formLandmark.trim() || undefined,
        isDefault: formIsDefault,
      };

      if (editingAddress) {
        await updateAddress(editingAddress.id, payload, token);
      } else {
        await createAddress(payload, token);
      }

      setIsModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      await fetchAddresses();
    } catch (err: any) {
      setAlertDialog({
        visible: true,
        title: 'Error',
        message: err?.message || 'Failed to save address.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const [addressToDelete, setAddressToDelete] = useState<Address | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [alertDialog, setAlertDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type?: AlertType;
  } | null>(null);

  const handleDelete = (addr: Address) => {
    setAddressToDelete(addr);
  };

  const executeDeleteAddress = async () => {
    if (!addressToDelete || !token) return;
    setIsDeleting(true);
    try {
      await deleteAddress(addressToDelete.id, token);
      setAddressToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      await fetchAddresses();
    } catch (err: any) {
      setAddressToDelete(null);
      setAlertDialog({
        visible: true,
        title: 'Error',
        message: err?.message || 'Could not delete address.',
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetDefault = async (addr: Address) => {
    if (!token || addr.isDefault) return;
    try {
      await setDefaultAddress(addr.id, token);
      await fetchAddresses();
    } catch (err: any) {
      setAlertDialog({
        visible: true,
        title: 'Error',
        message: err?.message || 'Could not set default address.',
        type: 'error',
      });
    }
  };

  const renderAddressCard = ({ item }: { item: Address }) => {
    const isSelected = selectionMode && selectedAddressId === item.id;

    return (
      <Pressable
        onPress={() => {
          if (selectionMode && onSelectAddress) {
            onSelectAddress(item);
          }
        }}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: theme.colors.card,
            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
            borderWidth: isSelected ? 2 : 1,
            opacity: pressed && selectionMode ? 0.9 : 1,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.nameRow}>
            <Text style={[styles.recipientName, { color: theme.colors.text }]}>
              {item.name}
            </Text>
            {item.isDefault && (
              <View
                style={[
                  styles.defaultBadge,
                  { backgroundColor: theme.colors.badgeBg },
                ]}
              >
                <Text style={[styles.defaultBadgeText, { color: theme.colors.badgeText }]}>
                  DEFAULT
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.phoneText, { color: theme.colors.textSecondary }]}>
            📞 +91 {item.phone}
          </Text>
        </View>

        <Text style={[styles.addressText, { color: theme.colors.textSecondary }]}>
          {item.addressLine1}
          {item.addressLine2 ? `, ${item.addressLine2}` : ''}
          {item.landmark ? ` (Near ${item.landmark})` : ''}
        </Text>
        <Text style={[styles.cityStatePin, { color: theme.colors.text }]}>
          {item.city}, {item.state} — {item.pincode}
        </Text>

        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        <View style={styles.cardActions}>
          {!item.isDefault && !selectionMode && (
            <Pressable
              onPress={() => handleSetDefault(item)}
              style={styles.actionBtn}
            >
              <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>
                Set Default
              </Text>
            </Pressable>
          )}

          <View style={styles.rightActions}>
            <Pressable
              onPress={() => openEditModal(item)}
              style={styles.iconActionBtn}
              accessibilityLabel="Edit Address"
            >
              <Icon name="pencil" size={16} color={theme.colors.textSecondary} />
              <Text style={[styles.actionBtnText, { color: theme.colors.textSecondary }]}>
                Edit
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleDelete(item)}
              style={styles.iconActionBtn}
              accessibilityLabel="Delete Address"
            >
              <Icon name="trash" size={16} color={theme.colors.danger} />
              <Text style={[styles.actionBtnText, { color: theme.colors.danger }]}>
                Delete
              </Text>
            </Pressable>
          </View>
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
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Pressable
          onPress={onBack}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-left" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {selectionMode ? 'Select Delivery Address' : 'Address Book'}
        </Text>
        <Pressable
          onPress={openAddModal}
          style={[styles.addHeaderBtn, { backgroundColor: theme.colors.primary }]}
          accessibilityLabel="Add New Address"
        >
          <Icon name="plus" size={16} color={theme.colors.primaryText} />
          <Text style={[styles.addHeaderBtnText, { color: theme.colors.primaryText }]}>Add</Text>
        </Pressable>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading saved addresses...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Icon name="alert-circle" size={40} color={theme.colors.danger} />
          <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
          <Pressable
            onPress={fetchAddresses}
            style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={[styles.retryBtnText, { color: theme.colors.primaryText }]}>Retry</Text>
          </Pressable>
        </View>
      ) : addresses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: theme.colors.surfaceSubtle }]}>
            <Icon name="map-pin" size={40} color={theme.colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            No saved addresses
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
            Add a delivery address to ensure fast and seamless checkout for all your orders.
          </Text>
          <Pressable
            onPress={openAddModal}
            style={[styles.addNewBigBtn, { backgroundColor: theme.colors.primary }]}
          >
            <Icon name="plus" size={18} color={theme.colors.primaryText} />
            <Text style={[styles.addNewBigBtnText, { color: theme.colors.primaryText }]}>Add New Address</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderAddressCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add / Edit Address Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View
            style={[
              styles.modalContainer,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                maxHeight: isKeyboardVisible
                  ? Math.max(260, screenHeight - keyboardHeight - (Platform.OS === 'android' ? 24 : 40))
                  : '85%',
              },
            ]}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {editingAddress ? 'Edit Address' : 'Add New Address'}
              </Text>
              <Pressable
                onPress={() => setIsModalVisible(false)}
                style={styles.closeModalBtn}
              >
                <Icon name="close" size={20} color={theme.colors.textSecondary} />
              </Pressable>
            </View>

            {/* Modal Body Form */}
            <KeyboardAwareScrollView
              ref={modalScrollRef}
              style={styles.modalScroll}
              extraScrollHeight={80}
            >
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Recipient Full Name *
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor={theme.colors.textMuted}
                value={formName}
                onChangeText={setFormName}
                onFocus={() => modalScrollRef.current?.scrollToInput(0)}
              />

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Mobile Phone (10 digits) *
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                placeholder="e.g. 9876543210"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="phone-pad"
                maxLength={10}
                value={formPhone}
                onChangeText={setFormPhone}
                onFocus={() => modalScrollRef.current?.scrollToInput(60)}
              />

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Flat, House No., Building, Street *
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                placeholder="e.g. Flat 302, Green Valley Apartments"
                placeholderTextColor={theme.colors.textMuted}
                value={formLine1}
                onChangeText={setFormLine1}
                onFocus={() => modalScrollRef.current?.scrollToInput(120)}
              />

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Area, Sector, Colony (Optional)
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                placeholder="e.g. Sector 18, Indira Nagar"
                placeholderTextColor={theme.colors.textMuted}
                value={formLine2}
                onChangeText={setFormLine2}
                onFocus={() => modalScrollRef.current?.scrollToInput(180)}
              />

              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                    City *
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.colors.surfaceSubtle,
                        borderColor: theme.colors.border,
                        color: theme.colors.text,
                      },
                    ]}
                    placeholder="e.g. Mumbai"
                    placeholderTextColor={theme.colors.textMuted}
                    value={formCity}
                    onChangeText={setFormCity}
                    onFocus={() => modalScrollRef.current?.scrollToInput(240)}
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                    State *
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.colors.surfaceSubtle,
                        borderColor: theme.colors.border,
                        color: theme.colors.text,
                      },
                    ]}
                    placeholder="e.g. Maharashtra"
                    placeholderTextColor={theme.colors.textMuted}
                    value={formState}
                    onChangeText={setFormState}
                    onFocus={() => modalScrollRef.current?.scrollToInput(280)}
                  />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                    PIN Code (6 digits) *
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.colors.surfaceSubtle,
                        borderColor: theme.colors.border,
                        color: theme.colors.text,
                      },
                    ]}
                    placeholder="e.g. 400001"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="numeric"
                    maxLength={6}
                    value={formPincode}
                    onChangeText={setFormPincode}
                    onFocus={() => modalScrollRef.current?.scrollToInput(340)}
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                    Landmark
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.colors.surfaceSubtle,
                        borderColor: theme.colors.border,
                        color: theme.colors.text,
                      },
                    ]}
                    placeholder="e.g. Near Metro Station"
                    placeholderTextColor={theme.colors.textMuted}
                    value={formLandmark}
                    onChangeText={setFormLandmark}
                    onFocus={() => modalScrollRef.current?.scrollToInput(380)}
                  />
                </View>
              </View>

              {/* Set Default Checkbox */}
              <Pressable
                onPress={() => setFormIsDefault(!formIsDefault)}
                style={styles.defaultCheckboxRow}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    {
                      borderColor: formIsDefault
                        ? theme.colors.primary
                        : theme.colors.border,
                      backgroundColor: formIsDefault
                        ? theme.colors.primary
                        : 'transparent',
                    },
                  ]}
                >
                  {formIsDefault && <Icon name="check" size={14} color={theme.colors.primaryText} />}
                </View>
                <Text style={[styles.defaultCheckboxText, { color: theme.colors.text }]}>
                  Make this my default delivery address
                </Text>
              </Pressable>
            </KeyboardAwareScrollView>

            {/* Modal Actions */}
            <View style={[styles.modalFooter, { borderTopColor: theme.colors.border }]}>
              <Pressable
                onPress={() => setIsModalVisible(false)}
                style={[styles.cancelBtn, { borderColor: theme.colors.border }]}
                disabled={isSaving}
              >
                <Text style={[styles.cancelBtnText, { color: theme.colors.textSecondary }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                style={[
                  styles.saveBtn,
                  { backgroundColor: theme.colors.primary, opacity: isSaving ? 0.7 : 1 },
                ]}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={theme.colors.primaryText} />
                ) : (
                  <Text style={[styles.saveBtnText, { color: theme.colors.primaryText }]}>Save Address</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Address Confirmation Dialog */}
      <ConfirmDialog
        visible={!!addressToDelete}
        title="Delete Address?"
        message={
          addressToDelete
            ? `Are you sure you want to delete delivery address for "${addressToDelete.name}"?`
            : ''
        }
        icon="trash"
        cancelText="Cancel"
        confirmText="Delete"
        isDestructive={true}
        loading={isDeleting}
        onCancel={() => setAddressToDelete(null)}
        onConfirm={executeDeleteAddress}
      />

      {/* Alert Dialog (Validation / Errors) */}
      <AlertDialog
        visible={alertDialog?.visible || false}
        title={alertDialog?.title || ''}
        message={alertDialog?.message || ''}
        type={alertDialog?.type || 'info'}
        onClose={() => setAlertDialog(null)}
      />
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
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 6,
  },
  addHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addHeaderBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
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
    gap: 12,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '700',
  },
  defaultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  phoneText: {
    fontSize: 13,
  },
  addressText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  cityStatePin: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginLeft: 'auto',
  },
  actionBtn: {
    paddingVertical: 4,
  },
  iconActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
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
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 20,
  },
  addNewBigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addNewBigBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeModalBtn: {
    padding: 6,
  },
  modalScroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexShrink: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  defaultCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    marginBottom: 24,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultCheckboxText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
