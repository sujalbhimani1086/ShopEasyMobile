import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar, StyleSheet, BackHandler, View, Platform, AppState, ActivityIndicator, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useAppTheme } from './src/theme/theme';
import type { User } from './src/types/auth';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProductsScreen } from './src/screens/ProductsScreen';
import { CategoriesScreen } from './src/screens/CategoriesScreen';
import { OrdersScreen } from './src/screens/OrdersScreen';
import { ProductDetailsScreen } from './src/screens/ProductDetailsScreen';
import { CartScreen } from './src/screens/CartScreen';
import { CheckoutScreen } from './src/screens/CheckoutScreen';
import { OrderDetailsScreen } from './src/screens/OrderDetailsScreen';
import { WishlistScreen } from './src/screens/WishlistScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { RatingReviewScreen } from './src/screens/RatingReviewScreen';
import { AddressScreen } from './src/screens/AddressScreen';
import { OrderTrackingScreen } from './src/screens/OrderTrackingScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { HelpSupportScreen } from './src/screens/HelpSupportScreen';
import { AdminDashboardScreen } from './src/screens/admin/AdminDashboardScreen';
import { getNotifications } from './src/services/notificationApi';
import { UserProfileModal } from './src/components/UserProfileModal';
import { BottomNavigation, BottomNavTab } from './src/components/BottomNavigation';
import { ScreenTransitionView, AuthTransitionOverlay } from './src/components/animated';
import { CartProvider, useCart } from './src/context/CartContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { WishlistProvider } from './src/context/WishlistContext';
import { FeedbackProvider, useFeedback } from './src/context/FeedbackContext';
import type { Product } from './src/types/product';
import type { Order } from './src/types/order';
import type { AdminSection } from './src/types/admin';
import { setCachedReview, type ReviewData } from './src/services/reviewApi';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from './src/config/queryClient';
import { queryKeys } from './src/config/queryKeys';

type ScreenRoute =
  | { name: 'home' }
  | {
    name: 'products';
    category?: string;
    search?: string;
    autoFocusSearch?: boolean;
    searchFocusKey?: number;
  }
  | { name: 'categories'; category?: string }
  | { name: 'orders' }
  | { name: 'wishlist' }
  | { name: 'productDetails'; productId: number }
  | { name: 'cart' }
  | { name: 'checkout' }
  | { name: 'orderDetails'; orderId: number; order?: Order }
  | { name: 'orderTracking'; orderId: number }
  | { name: 'addresses' }
  | { name: 'notifications' }
  | { name: 'helpSupport'; orderId?: number }
  | { name: 'login' }
  | { name: 'register' }
  | { name: 'admin'; section?: AdminSection }
  | {
    name: 'ratingReview';
    productId: number;
    productName: string;
    productImage?: string;
    deliveryDate?: string;
    initialRating?: number;
    existingReview?: ReviewData | null;
  };

function AppContent(): React.JSX.Element {
  const theme = useAppTheme();
  const feedback = useFeedback();
  const { totalItemsCount, addToCart } = useCart();
  const { user, token, logout, isLoading } = useAuth();
  const [initialRouteSet, setInitialRouteSet] = useState(false);
  const [navStack, setNavStack] = useState<ScreenRoute[]>([{ name: 'home' }]);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  // TanStack Query for authoritative customer notifications count & synchronization
  const { data: notifsData } = useQuery({
    queryKey: queryKeys.notifications(user?.id),
    queryFn: async () => {
      if (!token || !user) return { notifications: [], unreadCount: 0 };
      return await getNotifications(token);
    },
    enabled: !!token && !!user,
    staleTime: 30 * 1000,
  });

  const unreadNotifications = token && user ? notifsData?.unreadCount ?? 0 : 0;
  const [authTransition, setAuthTransition] = useState<{
    visible: boolean;
    mode: 'login' | 'logout';
  }>({
    visible: false,
    mode: 'login',
  });
  const logoutInProgressRef = React.useRef(false);

  // Synchronize initial route based on authenticated role upon cold start / reopening
  useEffect(() => {
    if (!isLoading && !initialRouteSet) {
      if (user?.role === 'ADMIN') {
        setNavStack([{ name: 'admin' }]);
      } else {
        setNavStack([{ name: 'home' }]);
      }
      setInitialRouteSet(true);
    }
  }, [isLoading, initialRouteSet, user?.role]);

  // Periodic and app foreground refocus synchronization
  useEffect(() => {
    const interval = setInterval(() => {
      if (token && user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications(user.id) });
      }
    }, 30000);

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && token && user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications(user.id) });
      }
    };
    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [token, user?.id]);

  const currentRoute = navStack[navStack.length - 1] || { name: 'home' };

  // Re-synchronize unread notifications when navigating between screens
  useEffect(() => {
    if (token && user?.id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(user.id) });
    }
  }, [currentRoute.name, token, user?.id]);

  // Strict Admin route guard: if user is not ADMIN, bounce back to customer home immediately
  useEffect(() => {
    if (currentRoute.name === 'admin') {
      if (!isLoading && (!user || user.role !== 'ADMIN')) {
        feedback.toast.error('Access Denied: Admin authorization required.');
        setNavStack([{ name: 'home' }]);
      }
    }
  }, [currentRoute.name, user, isLoading, feedback]);

  // Determine active bottom tab (if currently on a main tab)
  const isMainTab =
    currentRoute.name === 'home' ||
    currentRoute.name === 'products' ||
    currentRoute.name === 'categories' ||
    currentRoute.name === 'orders' ||
    currentRoute.name === 'cart';

  const activeBottomTab: BottomNavTab =
    currentRoute.name === 'products'
      ? 'products'
      : currentRoute.name === 'categories'
        ? 'categories'
        : currentRoute.name === 'orders'
          ? 'orders'
          : currentRoute.name === 'cart'
            ? 'cart'
            : 'home';

  const handleTabSelect = useCallback((tab: BottomNavTab) => {
    setNavStack([{ name: tab }]);
  }, []);

  const searchFocusCounterRef = React.useRef(0);

  const navigateToProducts = useCallback(
    (category?: string, search?: string, autoFocusSearch?: boolean) => {
      const focusKey = autoFocusSearch ? ++searchFocusCounterRef.current : undefined;
      setNavStack((prev) => {
        const lastRoute = prev[prev.length - 1];
        if (lastRoute && lastRoute.name === 'products') {
          // If already on Products screen, update in-place without resetting or re-mounting
          const updatedRoute: ScreenRoute = {
            ...lastRoute,
            category: category !== undefined ? category : lastRoute.category,
            search: search !== undefined ? search : lastRoute.search,
            autoFocusSearch: autoFocusSearch ?? false,
            searchFocusKey: focusKey ?? lastRoute.searchFocusKey,
          };
          return [...prev.slice(0, prev.length - 1), updatedRoute];
        }
        return [
          ...prev,
          {
            name: 'products',
            category,
            search,
            autoFocusSearch: autoFocusSearch ?? false,
            searchFocusKey: focusKey,
          },
        ];
      });
    },
    []
  );

  const handleConsumeAutoFocus = useCallback(() => {
    setNavStack((prev) => {
      const lastIndex = prev.length - 1;
      const lastRoute = prev[lastIndex];
      if (lastRoute && lastRoute.name === 'products' && lastRoute.autoFocusSearch) {
        const updated = [...prev];
        updated[lastIndex] = {
          ...lastRoute,
          autoFocusSearch: false,
        };
        return updated;
      }
      return prev;
    });
  }, []);

  const navigateToCategories = useCallback((category?: string) => {
    setNavStack((prev) => [...prev, { name: 'categories', category }]);
  }, []);

  const navigateToProductDetails = useCallback((productId: number) => {
    setNavStack((prev) => [...prev, { name: 'productDetails', productId }]);
  }, []);

  const navigateToCart = useCallback(() => {
    setNavStack((prev) => [...prev, { name: 'cart' }]);
  }, []);

  const navigateToWishlist = useCallback(() => {
    setNavStack((prev) => [...prev, { name: 'wishlist' }]);
  }, []);

  const navigateToCheckout = useCallback(() => {
    setNavStack((prev) => [...prev, { name: 'checkout' }]);
  }, []);

  const navigateToOrders = useCallback(() => {
    setNavStack((prev) => [...prev, { name: 'orders' }]);
  }, []);

  const navigateToOrderDetails = useCallback((orderId: number, order?: Order) => {
    setNavStack((prev) => [...prev, { name: 'orderDetails', orderId, order }]);
  }, []);

  const navigateToOrderTracking = useCallback((orderId: number) => {
    setNavStack((prev) => [...prev, { name: 'orderTracking', orderId }]);
  }, []);

  const navigateToAddresses = useCallback(() => {
    setNavStack((prev) => [...prev, { name: 'addresses' }]);
  }, []);

  const navigateToNotifications = useCallback(() => {
    setNavStack((prev) => [...prev, { name: 'notifications' }]);
  }, []);

  const navigateToHelpSupport = useCallback((orderId?: number) => {
    setNavStack((prev) => [...prev, { name: 'helpSupport', orderId }]);
  }, []);

  const navigateToLogin = useCallback(() => {
    setNavStack((prev) => [...prev, { name: 'login' }]);
  }, []);

  const navigateToRegister = useCallback(() => {
    setNavStack((prev) => [...prev, { name: 'register' }]);
  }, []);

  const navigateToAdmin = useCallback(
    (section?: AdminSection) => {
      if (!user || user.role !== 'ADMIN') {
        feedback.toast.error('Access Denied: Admin authorization required.');
        return;
      }
      setNavStack((prev) => [...prev, { name: 'admin', section }]);
    },
    [user, feedback]
  );

  const handleLogout = useCallback(async () => {
    // Prevent duplicate logout transitions
    if (logoutInProgressRef.current) return;
    logoutInProgressRef.current = true;
    setIsProfileModalVisible(false);

    // 1. Immediately launch black logout transition overlay
    setAuthTransition({
      visible: true,
      mode: 'logout',
    });

    // 2. Under the black transition, switch navigation directly to Sign In screen
    setNavStack([{ name: 'login' }]);
  }, []);

  const handleTransitionComplete = useCallback(async () => {
    if (authTransition.mode === 'logout') {
      try {
        await logout();
      } finally {
        setNavStack([{ name: 'login' }]);
        setAuthTransition((prev) => ({ ...prev, visible: false }));
        logoutInProgressRef.current = false;
      }
    } else {
      // Login transition finished — dismiss overlay
      setAuthTransition((prev) => ({ ...prev, visible: false }));
    }
  }, [authTransition.mode, logout]);

  const handleLoginSuccess = useCallback(
    (loggedInUser?: User) => {
      const role = loggedInUser?.role || user?.role || 'CUSTOMER';

      // 1. Immediately launch full-screen black login transition animation
      setAuthTransition({
        visible: true,
        mode: 'login',
      });

      // 2. Immediately reset navigation stack to destination screen UNDER the black transition
      //    (Admin Dashboard for Admin, Customer Home for Customer).
      //    This guarantees:
      //    - Sign In screen is immediately unmounted under the opaque black screen
      //    - Pressing Back will never navigate back to Sign In
      //    - When the black animation fades out, it reveals ONLY the destination screen
      if (role === 'ADMIN') {
        setNavStack([{ name: 'admin' }]);
        feedback.toast.success('Signed in as Administrator');
      } else {
        setNavStack([{ name: 'home' }]);
      }
    },
    [user?.role, feedback]
  );

  const goBack = useCallback(() => {
    setNavStack((prev) => {
      if (prev.length > 1) {
        return prev.slice(0, prev.length - 1);
      }
      return prev;
    });
  }, []);

  const handleAdminBack = useCallback(() => {
    if (navStack.length > 1) {
      goBack();
    }
    // Never show sign out confirmation when pressing back!
  }, [navStack.length, goBack]);

  const navigateToRatingReview = useCallback(
    (
      item: {
        productId: number;
        productName: string;
        productImage?: string;
        deliveryDate?: string;
      },
      initialRating: number,
      existingReview?: ReviewData | null
    ) => {
      setNavStack((prev) => [
        ...prev,
        {
          name: 'ratingReview',
          productId: item.productId,
          productName: item.productName,
          productImage: item.productImage,
          deliveryDate: item.deliveryDate,
          initialRating,
          existingReview,
        },
      ]);
    },
    []
  );

  const handleAccountPress = useCallback(() => {
    if (user) {
      setIsProfileModalVisible(true);
    } else {
      navigateToLogin();
    }
  }, [user, navigateToLogin]);

  // Shared Add to Cart action with instant feedback
  const handleAddToCart = useCallback(
    (product: Product) => {
      const res = addToCart(product);
      if (res.success) {
        feedback.showConfirm({
          title: 'Added to Cart!',
          message: `"${product.name}" has been added to your shopping cart.`,
          icon: 'cart',
          cancelText: 'Continue Shopping',
          confirmText: 'View Cart',
          isDestructive: false,
          onConfirm: navigateToCart,
        });
      } else if (res.message) {
        feedback.showAlert({
          title: 'Cart',
          message: res.message,
          type: 'warning',
        });
      }
    },
    [addToCart, navigateToCart, feedback]
  );

  const navStackRef = React.useRef(navStack);
  navStackRef.current = navStack;

  // Hardware Android back button handling
  useEffect(() => {
    const onBackPress = () => {
      if (navStackRef.current.length > 1) {
        setNavStack((prev) => {
          if (prev.length > 1) {
            return prev.slice(0, prev.length - 1);
          }
          return prev;
        });
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      (StatusBar as any).setBackgroundColor?.(
        currentRoute.name === 'home' || currentRoute.name === 'productDetails'
          ? '#000000'
          : theme.isDark
            ? '#121212'
            : '#F8F9FA'
      );
    }
  }, [currentRoute.name, theme.isDark]);

  if (isLoading || !initialRouteSet) {
    return (
      <SafeAreaProvider
        style={[
          styles.container,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <StatusBar
          barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        />
        <View style={styles.splashLoadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider
      style={[
        styles.container,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <StatusBar
        barStyle={
          currentRoute.name === 'home' || currentRoute.name === 'productDetails'
            ? 'light-content'
            : theme.isDark
              ? 'light-content'
              : 'dark-content'
        }
      />

      <ScreenTransitionView
        routeKey={currentRoute.name}
        style={[
          styles.screenContainer,
          { backgroundColor: theme.colors.background },
        ]}
      >
        {navStack.map((route, index) => {
          const isTop = index === navStack.length - 1;
          return (
            <View
              key={`stack-screen-${route.name}-${index}`}
              style={[
                styles.screenContainer,
                !isTop && styles.hiddenScreen,
              ]}
              pointerEvents={isTop ? 'auto' : 'none'}
            >
              {/* 1. HOME SCREEN */}
              {route.name === 'home' && (
                <HomeScreen
                  key="home-screen"
                  isActive={isTop}
                  onNavigateToProducts={navigateToProducts}
                  onSearchPress={() => navigateToProducts(undefined, undefined, true)}
                  onNavigateToCategories={navigateToCategories}
                  onProductPress={navigateToProductDetails}
                  onCartPress={navigateToCart}
                  onWishlistPress={navigateToWishlist}
                  onAddToCart={handleAddToCart}
                  onAccountPress={handleAccountPress}
                  isLoggedIn={!!user}
                  userName={user?.name}
                  cartItemCount={totalItemsCount}
                  notificationCount={unreadNotifications}
                  onNotificationsPress={navigateToNotifications}
                />
              )}

              {/* 2. PRODUCTS SCREEN */}
              {route.name === 'products' && (
                <ProductsScreen
                  key={`products-${index}`}
                  isActive={isTop}
                  initialCategory={route.category || 'All'}
                  initialSearch={route.search || ''}
                  autoFocusSearch={route.autoFocusSearch}
                  searchFocusKey={route.searchFocusKey}
                  onConsumeAutoFocus={handleConsumeAutoFocus}
                  onBack={navStack.length > 1 ? goBack : undefined}
                  onProductPress={navigateToProductDetails}
                  onCartPress={navigateToCart}
                  onWishlistPress={navigateToWishlist}
                  onAddToCart={handleAddToCart}
                  onAccountPress={handleAccountPress}
                  isLoggedIn={!!user}
                  userName={user?.name}
                  cartItemCount={totalItemsCount}
                />
              )}

              {/* 3. CATEGORIES SCREEN */}
              {route.name === 'categories' && (
                <CategoriesScreen
                  key={`categories-${index}`}
                  isActive={isTop}
                  initialCategory={route.category}
                  onProductPress={navigateToProductDetails}
                  onNavigateToProducts={navigateToProducts}
                  onCartPress={navigateToCart}
                  onWishlistPress={navigateToWishlist}
                  onSearchPress={() => navigateToProducts(undefined, undefined, true)}
                  cartItemCount={totalItemsCount}
                />
              )}

              {/* 4. MY ORDERS SCREEN */}
              {route.name === 'orders' && (
                <OrdersScreen
                  key={`orders-${index}`}
                  onBack={navStack.length > 1 ? goBack : undefined}
                  onOrderPress={(order) => navigateToOrderDetails(order.id, order)}
                  onTrackOrder={navigateToOrderTracking}
                  onStartShopping={() => setNavStack([{ name: 'home' }])}
                  onProductPress={navigateToProductDetails}
                  onNavigateToLogin={navigateToLogin}
                  onRateProduct={navigateToRatingReview}
                />
              )}

              {/* 5. PRODUCT DETAILS SCREEN */}
              {route.name === 'productDetails' && (
                <ProductDetailsScreen
                  key={`product-details-${route.productId}-${index}`}
                  productId={route.productId}
                  onBack={goBack}
                  onAddToCart={handleAddToCart}
                  onCartPress={navigateToCart}
                  cartItemCount={totalItemsCount}
                />
              )}

              {/* 6. WISHLIST SCREEN */}
              {route.name === 'wishlist' && (
                <WishlistScreen
                  key={`wishlist-${index}`}
                  onBack={goBack}
                  onProductPress={navigateToProductDetails}
                  onAddToCart={handleAddToCart}
                  onStartShopping={() => setNavStack([{ name: 'home' }])}
                />
              )}

              {/* 7. CART SCREEN */}
              {route.name === 'cart' && (
                <CartScreen
                  key={`cart-${index}`}
                  onBack={navStack.length > 1 ? goBack : undefined}
                  onProductPress={navigateToProductDetails}
                  onStartShopping={() => setNavStack([{ name: 'home' }])}
                  onProceedToCheckout={navigateToCheckout}
                />
              )}

              {/* 8. CHECKOUT SCREEN */}
              {route.name === 'checkout' && (
                <CheckoutScreen
                  key={`checkout-${index}`}
                  onBack={goBack}
                  onNavigateToLogin={navigateToLogin}
                  onNavigateToOrders={navigateToOrders}
                  onStartShopping={() => setNavStack([{ name: 'home' }])}
                  onProductPress={navigateToProductDetails}
                />
              )}

              {/* 9. ORDER DETAILS SCREEN */}
              {route.name === 'orderDetails' && (
                <OrderDetailsScreen
                  key={`orderDetails-${route.orderId}-${index}`}
                  orderId={route.orderId}
                  initialOrder={route.order}
                  onBack={goBack}
                  onProductPress={navigateToProductDetails}
                  onTrackOrder={navigateToOrderTracking}
                />
              )}

              {/* 10. LOGIN SCREEN */}
              {route.name === 'login' && (
                <LoginScreen
                  onBack={goBack}
                  onNavigateToRegister={navigateToRegister}
                  onLoginSuccess={handleLoginSuccess}
                />
              )}

              {/* 11. REGISTER SCREEN */}
              {route.name === 'register' && (
                <RegisterScreen
                  onBack={goBack}
                  onNavigateToLogin={() => {
                    setNavStack((prev) => [
                      ...prev.filter((r) => r.name !== 'register'),
                      { name: 'login' },
                    ]);
                  }}
                  onGoHome={() => setNavStack([{ name: 'home' }])}
                />
              )}

              {/* 12. RATING & REVIEW SCREEN */}
              {route.name === 'ratingReview' && (
                <RatingReviewScreen
                  key={`ratingReview-${route.productId}-${index}`}
                  productId={route.productId}
                  productName={route.productName}
                  productImage={route.productImage}
                  deliveryDate={route.deliveryDate}
                  initialRating={route.initialRating}
                  existingReview={route.existingReview}
                  onBack={goBack}
                  onReviewSubmitted={(review) => {
                    if (review) {
                      setCachedReview(review);
                    }
                  }}
                />
              )}

              {/* 13. ADDRESS MANAGEMENT SCREEN */}
              {route.name === 'addresses' && (
                <AddressScreen
                  key={`address-${index}`}
                  onBack={goBack}
                  onNavigateToLogin={navigateToLogin}
                />
              )}

              {/* 14. LIVE ORDER TRACKING SCREEN */}
              {route.name === 'orderTracking' && (
                <OrderTrackingScreen
                  key={`orderTracking-${route.orderId}-${index}`}
                  orderId={route.orderId}
                  onBack={goBack}
                  onSupportPress={(orderId) => navigateToHelpSupport(orderId)}
                />
              )}

              {/* 15. PUSH NOTIFICATIONS SCREEN */}
              {route.name === 'notifications' && (
                <NotificationsScreen
                  key={`notifications-${index}`}
                  onBack={goBack}
                  onOrderPress={(orderId) => navigateToOrderTracking(orderId)}
                  onNavigateToOrder={(orderId) => navigateToOrderTracking(orderId)}
                  onNavigateToSupport={() => navigateToHelpSupport()}
                  onNavigateToLogin={navigateToLogin}
                />
              )}

              {/* 16. CUSTOMER SUPPORT SCREEN */}
              {route.name === 'helpSupport' && (
                <HelpSupportScreen
                  key={`help-support-${index}`}
                  onBack={goBack}
                  initialOrderId={route.orderId}
                  onNavigateToLogin={navigateToLogin}
                />
              )}

              {/* 17. SECURE ADMIN CONSOLE (Protected: Accessible ONLY by authenticated ADMIN) */}
              {route.name === 'admin' && user?.role === 'ADMIN' && (
                <AdminDashboardScreen
                  key="admin-dashboard-screen"
                  initialSection={route.section}
                  onBack={handleAdminBack}
                  onLogout={handleLogout}
                />
              )}
            </View>
          );
        })}
      </ScreenTransitionView>

      {/* Fixed Bottom Navigation Bar visible on the 5 main tabs */}
      {isMainTab && (
        <BottomNavigation
          activeTab={activeBottomTab}
          onTabSelect={handleTabSelect}
          cartItemCount={totalItemsCount}
        />
      )}

      {/* User Profile Details Modal */}
      <UserProfileModal
        visible={isProfileModalVisible}
        user={user}
        onClose={() => setIsProfileModalVisible(false)}
        onLogout={handleLogout}
        onMyOrders={navigateToOrders}
        onAddressBook={navigateToAddresses}
        onNotifications={navigateToNotifications}
        onHelpSupport={() => navigateToHelpSupport()}
      />

      {/* Black Transition Animation for Login & Logout */}
      <AuthTransitionOverlay
        visible={authTransition.visible}
        mode={authTransition.mode}
        onComplete={handleTransitionComplete}
      />
    </SafeAreaProvider>
  );
}

function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <WishlistProvider>
            <CartProvider>
              <FeedbackProvider>
                <AppContent />
              </FeedbackProvider>
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  hiddenScreen: {
    opacity: 0,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  splashLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
