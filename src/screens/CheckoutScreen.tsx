import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView, KeyboardAwareScrollViewRef } from '../components/keyboard';
import { useAppTheme } from '../theme/theme';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { queryClient } from '../config/queryClient';
import { queryKeys } from '../config/queryKeys';
import { ConfirmDialog, AlertDialog, LoadingDialog, type AlertType } from '../components/dialogs';
import RazorpayCheckout, {
  type RazorpayCheckoutOptions,
  type RazorpaySuccessResponse,
  type RazorpayErrorResponse,
} from 'react-native-razorpay';
import { createOrder } from '../services/orderApi';
import { resolveImageUrl } from '../config/api';
import { calculateFinalPrice, formatPrice } from '../utils/price';
import type { Order } from '../types/order';
import type { Address } from '../types/address';
import type { Coupon, AppliedCouponInfo } from '../types/coupon';
import type { PaymentMethod } from '../types/payment';
import { getAddresses } from '../services/addressApi';
import { getAvailableCoupons, validateCoupon } from '../services/couponApi';
import { createRazorpayOrder, verifyRazorpayPayment, parseRazorpayError } from '../services/paymentApi';
import { syncServerCart } from '../services/cartApi';
import { Icon } from '../components/Icon';
import { ScalePressable, FadeInView } from '../components/animated';

export interface CheckoutScreenProps {
  onBack: () => void;
  onOrderSuccess?: (order: Order) => void;
  onNavigateToLogin: () => void;
  onNavigateToOrders?: () => void;
  onStartShopping?: () => void;
  onProductPress?: (productId: number) => void;
}

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({
  onBack,
  onOrderSuccess,
  onNavigateToLogin,
  onNavigateToOrders,
  onStartShopping,
  onProductPress: _onProductPress,
}) => {
  const theme = useAppTheme();
  const {
    cartItems,
    totalItemsCount,
    subtotal,
    totalDiscount,
    finalTotal,
    clearCart,
    validateCartItems,
    removeUnavailableItems,
    hasUnavailableItems,
  } = useCart();
  const { user, token } = useAuth();
  const checkoutScrollRef = useRef<KeyboardAwareScrollViewRef>(null);

  // Form Fields
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');

  // Field Errors
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    address?: string;
    city?: string;
    pincode?: string;
  }>({});

  // Status States
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  // Saved Addresses State
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [showAddressPicker, setShowAddressPicker] = useState(false);

  // Coupon / Promo Code State
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCouponInfo | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [_couponError, setCouponError] = useState<string | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [showCouponsModal, setShowCouponsModal] = useState(false);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentLoadingText, setPaymentLoadingText] = useState('Initializing secure checkout...');

  // Duplicate Submission & Pending Order Tracking
  const submittingRef = useRef(false);
  const pendingOrderIdRef = useRef<number | null>(null);

  // Invalidate pending online order reference if cart items change
  const previousCartItemsRef = useRef(cartItems);
  useEffect(() => {
    if (previousCartItemsRef.current !== cartItems) {
      previousCartItemsRef.current = cartItems;
      pendingOrderIdRef.current = null;
    }
  }, [cartItems]);

  // Auto-fill user credentials when user state changes
  useEffect(() => {
    if (user) {
      if (user.name && !name) setName(user.name);
      if (user.email && !email) setEmail(user.email);
    }
  }, [user, name, email]);

  // Load Saved Addresses & Available Coupons
  useEffect(() => {
    if (token) {
      getAddresses(token)
        .then((list) => {
          setSavedAddresses(list);
          const def = list.find((a) => a.isDefault) || list[0];
          if (def) {
            setSelectedAddress(def);
            setName(def.name);
            setAddress(
              def.addressLine1 +
              (def.addressLine2 ? `, ${def.addressLine2}` : '') +
              (def.landmark ? ` (Near ${def.landmark})` : '')
            );
            setCity(def.city);
            setPincode(def.pincode);
          }
        })
        .catch(() => { });

      getAvailableCoupons(token)
        .then(setAvailableCoupons)
        .catch(() => { });
    }
  }, [token]);

  // Initial stock and price verification on mount
  useEffect(() => {
    let isMounted = true;
    async function verify() {
      setIsVerifying(true);
      await validateCartItems();
      if (isMounted) {
        setIsVerifying(false);
      }
    }
    verify();
    return () => {
      isMounted = false;
    };
  }, [validateCartItems]);

  const couponDiscountAmount = appliedCoupon?.discountAmount || 0;
  const finalPayable = Math.max(0, finalTotal - couponDiscountAmount);

  const [alertDialog, setAlertDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type?: AlertType;
    buttonText?: string;
    onClose?: () => void;
  } | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    icon?: any;
    cancelText?: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  } | null>(null);

  const handleApplyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply || couponCode).trim().toUpperCase();
    if (!code) {
      setAlertDialog({
        visible: true,
        title: 'Coupon Required',
        message: 'Please enter a coupon code.',
        type: 'info',
      });
      return;
    }
    if (!token) {
      setConfirmDialog({
        visible: true,
        title: 'Sign In Required',
        message: 'Please sign in to apply coupons.',
        cancelText: 'Cancel',
        confirmText: 'Sign In',
        isDestructive: false,
        onConfirm: () => onNavigateToLogin?.(),
      });
      return;
    }

    setIsApplyingCoupon(true);
    setCouponError(null);
    try {
      const res = await validateCoupon(code, subtotal, token);
      if (res.valid && res.coupon) {
        setAppliedCoupon(res.coupon);
        setCouponCode(res.coupon.code);
        setShowCouponsModal(false);
        setAlertDialog({
          visible: true,
          title: 'Coupon Applied!',
          message: res.message,
          type: 'success',
        });
      }
    } catch (err: any) {
      const msg = err?.message || 'Invalid coupon code.';
      setCouponError(msg);
      setAlertDialog({
        visible: true,
        title: 'Coupon Error',
        message: msg,
        type: 'error',
      });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError(null);
  };

  const handleSelectSavedAddress = (addr: Address) => {
    setSelectedAddress(addr);
    setName(addr.name);
    setAddress(
      addr.addressLine1 +
      (addr.addressLine2 ? `, ${addr.addressLine2}` : '') +
      (addr.landmark ? ` (Near ${addr.landmark})` : '')
    );
    setCity(addr.city);
    setPincode(addr.pincode);
    setShowAddressPicker(false);
    setErrors({});
  };

  // Form Validation
  const validateForm = (): boolean => {
    const newErrors: {
      name?: string;
      email?: string;
      address?: string;
      city?: string;
      pincode?: string;
    } = {};

    if (!name.trim()) {
      newErrors.name = 'Please enter your full name.';
    }

    if (!email.trim()) {
      newErrors.email = 'Please enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!address.trim()) {
      newErrors.address = 'Please enter your street delivery address.';
    }

    if (!city.trim()) {
      newErrors.city = 'Please enter your city.';
    }

    if (!pincode.trim()) {
      newErrors.pincode = 'Please enter your 6-digit postal pincode.';
    } else if (!/^\d{6}$/.test(pincode.trim())) {
      newErrors.pincode = 'Pincode must be exactly 6 digits.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Place Order Handler
  const handlePlaceOrder = async () => {
    // Prevent duplicate calls
    if (submittingRef.current || isSubmitting) {
      return;
    }

    // 1. Authentication Check
    if (!user || !token) {
      setConfirmDialog({
        visible: true,
        title: 'Sign In Required',
        message: 'You must be signed in to place an order. Please sign in to continue.',
        cancelText: 'Cancel',
        confirmText: 'Sign In',
        isDestructive: false,
        onConfirm: () => onNavigateToLogin?.(),
      });
      return;
    }

    // 2. Account Approval Check
    if (user.role !== 'ADMIN' && user.status !== 'APPROVED') {
      setAlertDialog({
        visible: true,
        title: 'Account Pending Approval',
        message: 'Your registration is awaiting admin approval. Orders can only be placed once your account is approved.',
        type: 'warning',
      });
      return;
    }

    // 3. Form Validation
    if (!validateForm()) {
      setAlertDialog({
        visible: true,
        title: 'Required Fields',
        message: 'Please fill in all delivery details correctly.',
        type: 'warning',
      });
      return;
    }

    // 4. Cart Availability Check
    if (cartItems.length === 0 || totalItemsCount <= 0) {
      setAlertDialog({
        visible: true,
        title: 'Empty Cart',
        message: 'Your cart is empty. Please add products to your cart.',
        type: 'info',
      });
      return;
    }

    if (hasUnavailableItems) {
      setConfirmDialog({
        visible: true,
        title: 'Unavailable Items',
        message: 'Your cart contains products that are no longer available. Please remove them before checkout.',
        cancelText: 'Cancel',
        confirmText: 'Remove Unavailable Items',
        isDestructive: true,
        onConfirm: removeUnavailableItems,
      });
      return;
    }

    // 5. Final Live Inventory Check
    setIsSubmitting(true);
    submittingRef.current = true;
    setSubmitError(null);

    try {
      const checkResult = await validateCartItems();
      if (checkResult.hasUnavailableItems) {
        setIsSubmitting(false);
        submittingRef.current = false;
        setConfirmDialog({
          visible: true,
          title: 'Inventory Changed',
          message: 'One or more items in your cart were removed or went out of stock. Please review your cart.',
          cancelText: 'Cancel',
          confirmText: 'Remove Unavailable Items',
          isDestructive: true,
          onConfirm: removeUnavailableItems,
        });
        return;
      }

      // 5.5 Prevent stale or invalid UPI selections from reaching checkout
      if ((paymentMethod as string) === 'UPI' || (paymentMethod !== 'COD' && paymentMethod !== 'RAZORPAY')) {
        setPaymentMethod('COD');
        setAlertDialog({
          visible: true,
          title: 'Payment Method Unavailable',
          message: 'UPI is currently unavailable. Please choose Cards, Netbanking, Wallets, or Cash on Delivery.',
          type: 'warning',
        });
        return;
      }

      // 6. Reuse or create pending order to prevent duplicate orders
      let currentOrder: Order;
      const isOnlinePayment = paymentMethod === 'RAZORPAY';
      if (isOnlinePayment && pendingOrderIdRef.current) {
        // Reuse previously created pending order for this checkout attempt
        currentOrder = { id: pendingOrderIdRef.current } as Order;
      } else {
        const payload = {
          name: name.trim(),
          email: email.trim(),
          address: address.trim(),
          city: city.trim(),
          pincode: pincode.trim(),
          items: cartItems
            .filter((item) => !item.isUnavailable && (!item.product.stock || item.product.stock > 0))
            .map((item) => ({
              productId: item.product.id,
              quantity: item.quantity,
            })),
          couponCode: appliedCoupon ? appliedCoupon.code : undefined,
          paymentMethod,
          paymentStatus: 'PENDING',
        };

        const result = await createOrder(payload, token);
        if (!result.success || !result.order) {
          throw new Error(result.message || 'Could not place order');
        }
        currentOrder = result.order;
        if (isOnlinePayment) {
          pendingOrderIdRef.current = currentOrder.id;
        }
      }

      // 7. Handle Payment Methods
      if (isOnlinePayment) {
        setPaymentLoadingText('Connecting to Razorpay gateway...');
        setPaymentProcessing(true);

        try {
          const rzp = await createRazorpayOrder(finalPayable, currentOrder.id, token);

          const options: RazorpayCheckoutOptions = {
            description: `Order #${currentOrder.id} - ShopEasy`,
            image: 'https://raw.githubusercontent.com/sujalbhimani1086/ShopEasy/main/public/logo-icon.png',
            currency: rzp.currency || 'INR',
            key: rzp.keyId,
            amount: rzp.amount,
            name: 'ShopEasy Store',
            order_id: rzp.orderId,
            prefill: {
              email: email.trim() || user.email || '',
              contact: '9876543210',
              name: name.trim() || user.name || '',
            },
            theme: {
              color: '#000000',
            },
            modal: {
              confirm_close: true,
              animation: true,
            },
            retry: {
              enabled: true,
              max_count: 3,
            },
            send_sms_hash: true,
          };

          // Dismiss loading dialog before opening native Razorpay checkout sheet
          setPaymentProcessing(false);
          setIsSubmitting(false);
          submittingRef.current = false;

          // Open official native Razorpay checkout experience
          const data: RazorpaySuccessResponse = await RazorpayCheckout.open(options);

          // Payment successful in Razorpay - now verify server signature
          setPaymentLoadingText('Verifying payment with bank...');
          setPaymentProcessing(true);

          const verifyRes = await verifyRazorpayPayment(
            {
              orderId: currentOrder.id,
              razorpayOrderId: data.razorpay_order_id || rzp.orderId,
              razorpayPaymentId: data.razorpay_payment_id,
              razorpaySignature: data.razorpay_signature || '',
            },
            token
          );

          if (verifyRes.success && verifyRes.order) {
            pendingOrderIdRef.current = null;
            clearCart();
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
            queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            setPlacedOrder(verifyRes.order);
            if (onOrderSuccess) {
              onOrderSuccess(verifyRes.order);
            }
          } else {
            throw new Error(verifyRes.message || 'Payment signature verification failed.');
          }
          return;
        } catch (payErr: any) {
          console.log('Razorpay Checkout error/cancel:', payErr);
          const parsed = parseRazorpayError(payErr);

          // Restore server cart so that background/foreground sync does not wipe the preserved cart
          if (token && cartItems.length > 0) {
            const payload = cartItems
              .filter((item) => !item.isUnavailable)
              .map((item) => ({
                productId: item.product.id,
                quantity: item.quantity,
              }));
            if (payload.length > 0) {
              void syncServerCart(payload, token).catch(() => {});
            }
          }

          if (parsed.isCancelled) {
            setAlertDialog({
              visible: true,
              title: parsed.title,
              message: parsed.message,
              type: 'info',
            });
          } else {
            setAlertDialog({
              visible: true,
              title: parsed.title,
              message: parsed.message,
              type: 'error',
            });
          }
          return;
        } finally {
          setPaymentProcessing(false);
          setIsSubmitting(false);
          submittingRef.current = false;
        }
      }

      // Cash on delivery: clear cart & show order placed confirmation
      pendingOrderIdRef.current = null;
      clearCart();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setPlacedOrder(currentOrder);
      if (onOrderSuccess) {
        onOrderSuccess(currentOrder);
      }
    } catch (err: any) {
      console.error('Order Placement Error:', err);
      const msg = err?.message || 'Could not place order. Please check your connection and retry.';
      setSubmitError(msg);
      setAlertDialog({
        visible: true,
        title: 'Order Placement Failed',
        message: msg,
        type: 'error',
      });
    } finally {
      if (paymentMethod === 'COD') {
        setIsSubmitting(false);
        submittingRef.current = false;
      }
    }
  };

  // Render Order Confirmation Screen
  if (placedOrder) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
        <ScrollView
          contentContainerStyle={styles.successScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Success Checkmark Circle with Smooth Entrance */}
          <FadeInView duration={350} slideDistance={18}>
            <View style={styles.successIconOuterCircle}>
              <View
                style={[
                  styles.successIconCircle,
                  { backgroundColor: theme.colors.success },
                ]}
              >
                <Icon name="check" size={32} color="#FFFFFF" strokeWidth={3} />
              </View>
            </View>
          </FadeInView>

          <Text style={[styles.successTitle, { color: theme.colors.text }]}>
            Order Placed Successfully!
          </Text>
          <Text
            style={[
              styles.successSubtitle,
              { color: theme.colors.textSecondary },
            ]}
          >
            Thank you for your order. We are preparing it for delivery.
          </Text>

          {/* Order Details Card */}
          <View
            style={[
              styles.successCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.borderLight,
              },
            ]}
          >
            <View style={styles.orderIdRow}>
              <Text style={[styles.orderIdLabel, { color: theme.colors.textMuted }]}>
                Order Number
              </Text>
              <View
                style={[
                  styles.orderIdBadge,
                  { backgroundColor: theme.colors.surfaceSubtle },
                ]}
              >
                <Text style={[styles.orderIdText, { color: theme.colors.primary }]}>
                  #{placedOrder.id}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>
                Order Status
              </Text>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: 'rgba(245, 158, 11, 0.15)' },
                ]}
              >
                <Text style={[styles.statusPillText, { color: '#F59E0B' }]}>
                  ● {placedOrder.status || 'PENDING'}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>
                Delivery To
              </Text>
              <Text
                style={[styles.detailValue, { color: theme.colors.text }]}
                numberOfLines={2}
              >
                {placedOrder.name} ({placedOrder.city}, {placedOrder.pincode})
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>
                Shipping Address
              </Text>
              <Text
                style={[styles.detailValue, { color: theme.colors.text }]}
                numberOfLines={2}
              >
                {placedOrder.address}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={[styles.totalPaidLabel, { color: theme.colors.text }]}>
                Total Paid
              </Text>
              <Text style={[styles.totalPaidValue, { color: theme.colors.primary }]}>
                {formatPrice(placedOrder.total)}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.successActionsContainer}>
            {onNavigateToOrders && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View my orders"
                style={({ pressed }) => [
                  styles.primaryActionBtn,
                  {
                    backgroundColor: theme.colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={onNavigateToOrders}
              >
                <Text
                  style={[
                    styles.primaryActionBtnText,
                    { color: theme.colors.primaryText },
                  ]}
                >
                  View My Orders →
                </Text>
              </Pressable>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue shopping"
              style={({ pressed }) => [
                styles.secondaryActionBtn,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surfaceSubtle,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              onPress={onStartShopping || onBack}
            >
              <Text
                style={[
                  styles.secondaryActionBtnText,
                  { color: theme.colors.text },
                ]}
              >
                Continue Shopping
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      {/* Screen Header */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: theme.colors.card,
            borderBottomColor: theme.colors.borderLight,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to cart"
          style={({ pressed }) => [
            styles.backButton,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={onBack}
        >
          <Icon name="arrow-left" size={20} color={theme.colors.text} />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Checkout
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textMuted }]}>
            {totalItemsCount} item{totalItemsCount === 1 ? '' : 's'} ·{' '}
            {formatPrice(finalTotal)}
          </Text>
        </View>

        <View style={styles.headerPlaceholder} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <KeyboardAwareScrollView
          ref={checkoutScrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          extraScrollHeight={90}
        >
          {/* User Sign In Banner if not authenticated */}
          {!user && (
            <View
              style={[
                styles.authNoticeCard,
                {
                  backgroundColor: theme.isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
                  borderColor: theme.colors.accent,
                },
              ]}
            >
              <View style={styles.authNoticeLeft}>
                <Icon name="lock" size={20} color={theme.colors.accent} />
                <View style={styles.authNoticeTextGroup}>
                  <Text style={[styles.authNoticeTitle, { color: theme.colors.text }]}>
                    Sign In Required
                  </Text>
                  <Text
                    style={[
                      styles.authNoticeSubtitle,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Please sign in with your ShopEasy account to complete this order.
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign in now"
                style={({ pressed }) => [
                  styles.authNoticeBtn,
                  {
                    backgroundColor: theme.colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={onNavigateToLogin}
              >
                <Text
                  style={[
                    styles.authNoticeBtnText,
                    { color: theme.colors.primaryText },
                  ]}
                >
                  Sign In
                </Text>
              </Pressable>
            </View>
          )}

          {/* Account Approval Warning if user is not approved */}
          {user && user.role !== 'ADMIN' && user.status !== 'APPROVED' && (
            <View
              style={[
                styles.warningCard,
                {
                  backgroundColor: theme.colors.dangerBg,
                  borderColor: theme.colors.danger,
                },
              ]}
            >
              <Text style={styles.warningIcon}>⏳</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.warningTitle, { color: theme.colors.danger }]}>
                  Account Approval Pending
                </Text>
                <Text
                  style={[
                    styles.warningSubtitle,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Your registration is currently under review by store administrators.
                  Order placement will be enabled once your account is approved.
                </Text>
              </View>
            </View>
          )}

          {/* Verification Loading Indicator */}
          {isVerifying && (
            <View style={styles.verifyingBanner}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text
                style={[
                  styles.verifyingText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Verifying live prices and stock availability...
              </Text>
            </View>
          )}

          {/* Submit Error Banner */}
          {submitError && (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: theme.colors.dangerBg,
                  borderColor: theme.colors.danger,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                },
              ]}
            >
              <Icon name="alert-triangle" size={18} color={theme.colors.danger} />
              <Text
                style={[
                  styles.errorBannerText,
                  { color: theme.colors.danger, flex: 1 },
                ]}
              >
                {submitError}
              </Text>
            </View>
          )}

          {/* Section: Delivery Address Form */}
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.borderLight,
              },
            ]}
          >
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Delivery Address
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="map-pin" size={13} color={theme.colors.primary} />
                <Text style={styles.sectionBadge}>Delivery Details</Text>
              </View>
            </View>

            {/* Saved Address Quick Selector */}
            {savedAddresses.length > 0 && (
              <View
                style={[
                  styles.savedAddressBanner,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.savedAddressBannerTitle, { color: theme.colors.text }]}>
                    {selectedAddress ? `Delivering to: ${selectedAddress.name}` : 'Saved Address Available'}
                  </Text>
                  {selectedAddress && (
                    <Text
                      style={[styles.savedAddressBannerSub, { color: theme.colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {selectedAddress.addressLine1}, {selectedAddress.city} ({selectedAddress.pincode})
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() => setShowAddressPicker(true)}
                  style={[
                    styles.changeAddressBtn,
                    { borderColor: theme.colors.primary },
                  ]}
                >
                  <Text style={[styles.changeAddressBtnText, { color: theme.colors.primary }]}>
                    Change
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Full Name <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                accessibilityLabel="Full name"
                placeholder="Enter recipient's full name"
                placeholderTextColor={theme.colors.textMuted}
                value={name}
                onChangeText={(val) => {
                  setName(val);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                onFocus={() => checkoutScrollRef.current?.scrollToInput(0)}
                style={[
                  styles.textInput,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: errors.name ? theme.colors.danger : theme.colors.border,
                  },
                ]}
                autoCapitalize="words"
              />
              {errors.name ? (
                <Text style={[styles.fieldError, { color: theme.colors.danger }]}>
                  {errors.name}
                </Text>
              ) : null}
            </View>

            {/* Email Address */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Email Address <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                accessibilityLabel="Email address"
                placeholder="Enter email for order confirmation"
                placeholderTextColor={theme.colors.textMuted}
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                onFocus={() => checkoutScrollRef.current?.scrollToInput(60)}
                style={[
                  styles.textInput,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: errors.email ? theme.colors.danger : theme.colors.border,
                  },
                ]}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors.email ? (
                <Text style={[styles.fieldError, { color: theme.colors.danger }]}>
                  {errors.email}
                </Text>
              ) : null}
            </View>

            {/* Street Address */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Street Address <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                accessibilityLabel="Street address"
                placeholder="Flat / House No., Apartment, Street, Landmark"
                placeholderTextColor={theme.colors.textMuted}
                value={address}
                onChangeText={(val) => {
                  setAddress(val);
                  if (errors.address) setErrors((prev) => ({ ...prev, address: undefined }));
                }}
                onFocus={() => checkoutScrollRef.current?.scrollToInput(120)}
                style={[
                  styles.textInputMulti,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: errors.address ? theme.colors.danger : theme.colors.border,
                  },
                ]}
                multiline
                numberOfLines={3}
              />
              {errors.address ? (
                <Text style={[styles.fieldError, { color: theme.colors.danger }]}>
                  {errors.address}
                </Text>
              ) : null}
            </View>

            {/* City & Pincode Row */}
            <View style={styles.twoColRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                  City <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <TextInput
                  accessibilityLabel="City"
                  placeholder="City / Town"
                  placeholderTextColor={theme.colors.textMuted}
                  value={city}
                  onChangeText={(val) => {
                    setCity(val);
                    if (errors.city) setErrors((prev) => ({ ...prev, city: undefined }));
                  }}
                  onFocus={() => checkoutScrollRef.current?.scrollToInput(180)}
                  style={[
                    styles.textInput,
                    {
                      color: theme.colors.text,
                      backgroundColor: theme.colors.surfaceSubtle,
                      borderColor: errors.city ? theme.colors.danger : theme.colors.border,
                    },
                  ]}
                />
                {errors.city ? (
                  <Text style={[styles.fieldError, { color: theme.colors.danger }]}>
                    {errors.city}
                  </Text>
                ) : null}
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                  Pincode <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <TextInput
                  accessibilityLabel="Pincode"
                  placeholder="6-digit PIN"
                  placeholderTextColor={theme.colors.textMuted}
                  value={pincode}
                  onChangeText={(val) => {
                    setPincode(val.replace(/\D/g, '').slice(0, 6));
                    if (errors.pincode) setErrors((prev) => ({ ...prev, pincode: undefined }));
                  }}
                  onFocus={() => checkoutScrollRef.current?.scrollToInput(180)}
                  style={[
                    styles.textInput,
                    {
                      color: theme.colors.text,
                      backgroundColor: theme.colors.surfaceSubtle,
                      borderColor: errors.pincode ? theme.colors.danger : theme.colors.border,
                    },
                  ]}
                  keyboardType="numeric"
                  maxLength={6}
                />
                {errors.pincode ? (
                  <Text style={[styles.fieldError, { color: theme.colors.danger }]}>
                    {errors.pincode}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Section: Order Items Summary */}
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.borderLight,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Order Summary ({totalItemsCount} item{totalItemsCount === 1 ? '' : 's'})
            </Text>

            <View style={styles.itemsListContainer}>
              {cartItems.map((item, itemIdx) => {
                const discountedPrice = calculateFinalPrice(
                  item.product.price,
                  item.product.discount
                );
                const itemTotal = discountedPrice * item.quantity;
                const isUnavailable =
                  item.isUnavailable ||
                  (typeof item.product.stock === 'number' && item.product.stock <= 0);

                return (
                  <View
                    key={item.product?.id ?? `cart-item-${itemIdx}`}
                    style={[
                      styles.orderItemRow,
                      { borderBottomColor: theme.colors.borderLight },
                    ]}
                  >
                    <Image
                      source={{ uri: resolveImageUrl(item.product.image) }}
                      style={styles.itemThumbnail}
                      resizeMode="contain"
                    />

                    <View style={styles.itemInfoCol}>
                      <Text
                        style={[
                          styles.itemName,
                          { color: isUnavailable ? theme.colors.danger : theme.colors.text },
                        ]}
                        numberOfLines={1}
                      >
                        {item.product.name}
                      </Text>
                      {isUnavailable ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Icon name="alert-triangle" size={12} color={theme.colors.danger} />
                          <Text style={[styles.itemUnavailableTag, { color: theme.colors.danger }]}>
                            {item.unavailableReason || 'Unavailable'}
                          </Text>
                        </View>
                      ) : (
                        <Text
                          style={[
                            styles.itemQtyPrice,
                            { color: theme.colors.textMuted },
                          ]}
                        >
                          Qty: {item.quantity} × {formatPrice(discountedPrice)}
                        </Text>
                      )}
                    </View>

                    <Text
                      style={[
                        styles.itemTotalAmount,
                        {
                          color: isUnavailable ? theme.colors.danger : theme.colors.text,
                          textDecorationLine: isUnavailable ? 'line-through' : 'none',
                        },
                      ]}
                    >
                      {formatPrice(itemTotal)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Section: Coupons & Promo Codes */}
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.borderLight,
              },
            ]}
          >
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Coupons & Offers
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="tag" size={13} color={theme.colors.primary} />
                <Text style={styles.sectionBadge}>Discounts</Text>
              </View>
            </View>

            {appliedCoupon ? (
              <View
                style={[
                  styles.appliedCouponCard,
                  { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10b981' },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="check" size={16} color="#10b981" />
                    <Text style={styles.appliedCouponCode}>{appliedCoupon.code}</Text>
                  </View>
                  <Text style={[styles.appliedCouponSavings, { color: theme.colors.textSecondary }]}>
                    Saved {formatPrice(appliedCoupon.discountAmount)} on this order
                  </Text>
                </View>
                <Pressable
                  onPress={handleRemoveCoupon}
                  style={styles.removeCouponBtn}
                >
                  <Text style={styles.removeCouponBtnText}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.couponInputRow}>
                <TextInput
                  style={[
                    styles.couponTextInput,
                    {
                      backgroundColor: theme.colors.surfaceSubtle,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  placeholder="Enter promo code (e.g. WELCOME10)"
                  placeholderTextColor={theme.colors.textMuted}
                  value={couponCode}
                  onChangeText={setCouponCode}
                  onFocus={() => checkoutScrollRef.current?.scrollToInput(360)}
                  autoCapitalize="characters"
                />
                <Pressable
                  onPress={() => handleApplyCoupon()}
                  style={[
                    styles.applyCouponBtn,
                    {
                      backgroundColor: theme.colors.primary,
                      opacity: isApplyingCoupon || !couponCode.trim() ? 0.7 : 1,
                    },
                  ]}
                  disabled={isApplyingCoupon || !couponCode.trim()}
                >
                  {isApplyingCoupon ? (
                    <ActivityIndicator size="small" color={theme.colors.primaryText} />
                  ) : (
                    <Text style={[styles.applyCouponBtnText, { color: theme.colors.primaryText }]}>Apply</Text>
                  )}
                </Pressable>
              </View>
            )}

            {availableCoupons.length > 0 && !appliedCoupon && (
              <Pressable
                onPress={() => setShowCouponsModal(true)}
                style={styles.viewCouponsLink}
              >
                <Icon name="tag" size={14} color={theme.colors.primary} />
                <Text style={[styles.viewCouponsLinkText, { color: theme.colors.primary }]}>
                  View available coupons ({availableCoupons.length}) →
                </Text>
              </Pressable>
            )}
          </View>

          {/* Section: Payment Method */}
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.borderLight,
              },
            ]}
          >
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Payment Method
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="credit-card" size={13} color={theme.colors.primary} />
                <Text style={styles.sectionBadge}>Secure Checkout</Text>
              </View>
            </View>

            {/* Radio 1: Cash on Delivery */}
            <Pressable
              testID="payment-option-cod"
              onPress={() => {
                setPaymentMethod('COD');
                pendingOrderIdRef.current = null;
              }}
              style={[
                styles.paymentOptionCard,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor:
                    paymentMethod === 'COD'
                      ? theme.colors.primary
                      : theme.colors.border,
                  borderWidth: paymentMethod === 'COD' ? 2 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.radioCircle,
                  {
                    borderColor:
                      paymentMethod === 'COD'
                        ? theme.colors.primary
                        : theme.colors.border,
                  },
                ]}
              >
                {paymentMethod === 'COD' && (
                  <View
                    style={[
                      styles.radioDot,
                      { backgroundColor: theme.colors.primary },
                    ]}
                  />
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.paymentOptionTitle, { color: theme.colors.text }]}>
                  Cash on Delivery (COD)
                </Text>
                <Text
                  style={[
                    styles.paymentOptionSub,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Pay with cash when your order is delivered to your doorstep.
                </Text>
              </View>
              <Icon name="truck" size={22} color={theme.colors.textSecondary} />
            </Pressable>

            {/* Radio 3: Cards, Netbanking & Wallets (Razorpay) */}
            <Pressable
              testID="payment-option-razorpay"
              onPress={() => setPaymentMethod('RAZORPAY')}
              style={[
                styles.paymentOptionCard,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor:
                    paymentMethod === 'RAZORPAY'
                      ? theme.colors.primary
                      : theme.colors.border,
                  borderWidth: paymentMethod === 'RAZORPAY' ? 2 : 1,
                  marginTop: 10,
                },
              ]}
            >
              <View
                style={[
                  styles.radioCircle,
                  {
                    borderColor:
                      paymentMethod === 'RAZORPAY'
                        ? theme.colors.primary
                        : theme.colors.border,
                  },
                ]}
              >
                {paymentMethod === 'RAZORPAY' && (
                  <View
                    style={[
                      styles.radioDot,
                      { backgroundColor: theme.colors.primary },
                    ]}
                  />
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.paymentOptionTitle, { color: theme.colors.text }]}>
                  Cards, NetBanking & Wallets
                </Text>
                <Text
                  style={[
                    styles.paymentOptionSub,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Credit & Debit Cards, NetBanking, and Wallets via Razorpay.
                </Text>
              </View>
              <Icon name="credit-card" size={22} color={paymentMethod === 'RAZORPAY' ? theme.colors.primary : theme.colors.textSecondary} />
            </Pressable>
          </View>

          {/* Section: Price Breakdown */}
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.borderLight,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Price Details
            </Text>

            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: theme.colors.textSecondary }]}>
                Items Subtotal
              </Text>
              <Text style={[styles.priceValue, { color: theme.colors.textSecondary }]}>
                {formatPrice(subtotal)}
              </Text>
            </View>

            {totalDiscount > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: theme.colors.success }]}>
                  Product Discount
                </Text>
                <Text style={[styles.priceValue, { color: theme.colors.success, fontWeight: '700' }]}>
                  − {formatPrice(totalDiscount)}
                </Text>
              </View>
            )}

            {couponDiscountAmount > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: '#10b981' }]}>
                  Coupon Discount ({appliedCoupon?.code})
                </Text>
                <Text style={[styles.priceValue, { color: '#10b981', fontWeight: '700' }]}>
                  − {formatPrice(couponDiscountAmount)}
                </Text>
              </View>
            )}

            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: theme.colors.textSecondary }]}>
                Delivery Charges
              </Text>
              <Text style={[styles.priceValue, { color: theme.colors.success, fontWeight: '700' }]}>
                FREE
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.borderLight }]} />

            <View style={styles.finalTotalRow}>
              <View>
                <Text style={[styles.finalTotalLabel, { color: theme.colors.text }]}>
                  Total Payable
                </Text>
                <Text style={[styles.inclusiveTaxesText, { color: theme.colors.textMuted }]}>
                  Inclusive of all taxes
                </Text>
              </View>
              <Text style={[styles.finalTotalAmount, { color: theme.colors.primary }]}>
                {formatPrice(finalPayable)}
              </Text>
            </View>
          </View>

          <View style={styles.extraBottomSpace} />
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>

      {/* Sticky Bottom Place Order Action Bar */}
      <View
        style={[
          styles.stickyBottomBar,
          {
            backgroundColor: theme.colors.card,
            borderTopColor: theme.colors.borderLight,
          },
        ]}
      >
        <View style={styles.stickyTotalCol}>
          <Text style={[styles.stickyTotalLabel, { color: theme.colors.textMuted }]}>
            Total Amount
          </Text>
          <Text style={[styles.stickyTotalValue, { color: theme.colors.text }]}>
            {formatPrice(finalPayable)}
          </Text>
        </View>

        <ScalePressable
          testID="place-order-button"
          accessibilityRole="button"
          accessibilityLabel="Place Order"
          disabled={isSubmitting || isVerifying}
          style={[
            styles.placeOrderBtn,
            {
              backgroundColor:
                isSubmitting || isVerifying
                  ? theme.colors.border
                  : theme.colors.primary,
            },
          ]}
          activeScale={0.96}
          onPress={handlePlaceOrder}
        >
          {isSubmitting ? (
            <View style={styles.submittingContent}>
              <ActivityIndicator size="small" color={theme.colors.primaryText} />
              <Text
                style={[
                  styles.placeOrderBtnText,
                  { color: theme.colors.primaryText, marginLeft: 8 },
                ]}
              >
                Processing...
              </Text>
            </View>
          ) : (
            <Text
              style={[
                styles.placeOrderBtnText,
                { color: theme.colors.primaryText },
              ]}
            >
              {paymentMethod === 'RAZORPAY'
                ? `Pay & Place Order (${formatPrice(finalPayable)}) →`
                : `Place Order (${formatPrice(finalPayable)}) →`}
            </Text>
          )}
        </ScalePressable>
      </View>

      {/* Modal: Saved Address Picker */}
      <Modal
        visible={showAddressPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddressPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <View style={[styles.modalSheetHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalSheetTitle, { color: theme.colors.text }]}>
                Select Delivery Address
              </Text>
              <Pressable onPress={() => setShowAddressPicker(false)}>
                <Icon name="close" size={20} color={theme.colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 380, padding: 16 }}>
              {savedAddresses.map((addr, addrIdx) => {
                const isSelected = selectedAddress?.id === addr.id;
                return (
                  <Pressable
                    key={addr.id ?? `addr-${addrIdx}`}
                    onPress={() => handleSelectSavedAddress(addr)}
                    style={[
                      styles.addressPickCard,
                      {
                        backgroundColor: theme.colors.surfaceSubtle,
                        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[styles.pickName, { color: theme.colors.text }]}>
                        {addr.name}
                      </Text>
                      {addr.isDefault && (
                        <View style={[styles.defaultBadgeSmall, { backgroundColor: theme.colors.badgeBg }]}>
                          <Text style={[styles.defaultBadgeSmallText, { color: theme.colors.badgeText }]}>
                            DEFAULT
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.pickDetails, { color: theme.colors.textSecondary }]}>
                      {addr.addressLine1}, {addr.city} — {addr.pincode}
                    </Text>
                    <Text style={[styles.pickPhone, { color: theme.colors.textMuted }]}>
                      📞 +91 {addr.phone}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Available Coupons */}
      <Modal
        visible={showCouponsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCouponsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <View style={[styles.modalSheetHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalSheetTitle, { color: theme.colors.text }]}>
                Available Coupons
              </Text>
              <Pressable onPress={() => setShowCouponsModal(false)}>
                <Icon name="close" size={20} color={theme.colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 380, padding: 16 }}>
              {availableCoupons.map((c, cIdx) => (
                <View
                  key={c.id ?? c.code ?? `coupon-${cIdx}`}
                  style={[
                    styles.couponItemCard,
                    { backgroundColor: theme.colors.surfaceSubtle, borderColor: theme.colors.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.couponItemCode}>{c.code}</Text>
                    <Text style={[styles.couponItemDesc, { color: theme.colors.textSecondary }]}>
                      {c.discountType === 'PERCENTAGE'
                        ? `Get ${c.discountValue}% OFF (up to ${formatPrice(c.maxDiscount || 1000)})`
                        : `Get flat ${formatPrice(c.discountValue)} OFF`}
                    </Text>
                    <Text style={[styles.couponItemMin, { color: theme.colors.textMuted }]}>
                      Min. order amount: {formatPrice(c.minOrderAmount)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleApplyCoupon(c.code)}
                    style={[styles.applyItemBtn, { backgroundColor: theme.colors.primary }]}
                  >
                    <Text style={[styles.applyItemBtnText, { color: theme.colors.primaryText }]}>Apply</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Loading Dialog for online payment processing and signature verification */}
      <LoadingDialog
        visible={paymentProcessing || (isSubmitting && paymentMethod === 'RAZORPAY')}
        message={paymentLoadingText}
      />

      {/* Modern Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          visible={confirmDialog.visible}
          title={confirmDialog.title}
          message={confirmDialog.message}
          icon={confirmDialog.icon}
          cancelText={confirmDialog.cancelText}
          confirmText={confirmDialog.confirmText}
          isDestructive={confirmDialog.isDestructive}
          onCancel={() => {
            const onCancel = confirmDialog.onCancel;
            setConfirmDialog(null);
            onCancel?.();
          }}
          onConfirm={() => {
            const onConfirm = confirmDialog.onConfirm;
            setConfirmDialog(null);
            onConfirm();
          }}
        />
      )}

      {/* Modern Alert Dialog */}
      <AlertDialog
        visible={alertDialog?.visible || false}
        title={alertDialog?.title || ''}
        message={alertDialog?.message || ''}
        type={alertDialog?.type || 'info'}
        buttonText={alertDialog?.buttonText || 'OK'}
        onClose={() => {
          const cb = alertDialog?.onClose;
          setAlertDialog(null);
          cb?.();
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerPlaceholder: {
    width: 38,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  authNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  authNoticeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  authNoticeIcon: {
    fontSize: 22,
  },
  authNoticeTextGroup: {
    flex: 1,
  },
  authNoticeTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  authNoticeSubtitle: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  authNoticeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  authNoticeBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  warningIcon: {
    fontSize: 20,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  warningSubtitle: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  verifyingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  verifyingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  errorBannerIcon: {
    fontSize: 16,
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  sectionBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0EA5E9',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  requiredAsterisk: {
    color: '#EF4444',
  },
  textInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textInputMulti: {
    minHeight: 70,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldError: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  itemsListContainer: {
    gap: 10,
  },
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  itemThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  itemInfoCol: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
  },
  itemQtyPrice: {
    fontSize: 11,
    marginTop: 2,
  },
  itemUnavailableTag: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  itemTotalAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 13,
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 4,
    backgroundColor: '#E5E7EB',
  },
  finalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  finalTotalLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  inclusiveTaxesText: {
    fontSize: 11,
    marginTop: 2,
  },
  finalTotalAmount: {
    fontSize: 20,
    fontWeight: '900',
  },
  extraBottomSpace: {
    height: 80,
  },
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  stickyTotalCol: {
    justifyContent: 'center',
  },
  stickyTotalLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  stickyTotalValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  placeOrderBtn: {
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 170,
  },
  placeOrderBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  submittingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  successScrollContent: {
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  successIconOuterCircle: {
    padding: 12,
    borderRadius: 60,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    marginTop: 20,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCheckmark: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ffffff',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  successCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  orderIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderIdLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  orderIdBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  orderIdText: {
    fontSize: 14,
    fontWeight: '800',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  totalPaidLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  totalPaidValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  successActionsContainer: {
    width: '100%',
    gap: 10,
    marginTop: 10,
  },
  primaryActionBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryActionBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  savedAddressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  savedAddressBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  savedAddressBannerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  changeAddressBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 8,
  },
  changeAddressBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  appliedCouponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  appliedCouponCode: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10b981',
  },
  appliedCouponSavings: {
    fontSize: 12,
    marginTop: 2,
  },
  removeCouponBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  removeCouponBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  couponInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  couponTextInput: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  applyCouponBtn: {
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyCouponBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  viewCouponsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  viewCouponsLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  paymentOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  paymentOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  paymentOptionSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  modalSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalSheetTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  addressPickCard: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  pickName: {
    fontSize: 14,
    fontWeight: '700',
  },
  defaultBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeSmallText: {
    fontSize: 10,
    fontWeight: '800',
  },
  pickDetails: {
    fontSize: 12,
    marginTop: 4,
  },
  pickPhone: {
    fontSize: 11,
    marginTop: 4,
  },
  couponItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    gap: 10,
  },
  couponItemCode: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0EA5E9',
  },
  couponItemDesc: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  couponItemMin: {
    fontSize: 11,
    marginTop: 2,
  },
  applyItemBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applyItemBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});






