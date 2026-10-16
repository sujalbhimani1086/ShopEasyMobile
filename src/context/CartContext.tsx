import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product } from '../types/product';
import { calculateFinalPrice } from '../utils/price';
import { getProductById } from '../services/api';

import { useAuth } from './AuthContext';
import { getCartStorageKey } from '../services/authStorage';
import {
  fetchServerCart,
  syncServerCart,
  clearServerCart,
} from '../services/cartApi';

export interface CartItem {
  product: Product;
  quantity: number;
  isUnavailable?: boolean;
  isOutOfStock?: boolean;
  unavailableReason?: string;
}

export interface AddToCartResult {
  success: boolean;
  message?: string;
}

export interface CartValidationResult {
  hasUnavailableItems: boolean;
  unavailableCount: number;
  outOfStockCount: number;
  adjustedCount: number;
  message?: string;
}

export interface CartContextType {
  cartItems: CartItem[];
  totalItemsCount: number;
  subtotal: number;
  totalDiscount: number;
  finalTotal: number;
  deliveryFee: number;
  isLoading: boolean;
  isValidating: boolean;
  validationError: string | null;
  hasUnavailableItems: boolean;
  addToCart: (product: Product, quantity?: number) => AddToCartResult;
  updateQuantity: (productId: number, quantity: number) => void;
  removeFromCart: (productId: number) => void;
  clearCart: () => void;
  validateCartItems: () => Promise<CartValidationResult>;
  removeUnavailableItems: () => void;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token, isLoading: isAuthLoading } = useAuth();
  // While auth session is restoring, userId is undefined. When ready, it's number or null (guest)
  const currentUserId = isAuthLoading ? undefined : (user?.id ?? null);

  const [activeUserId, setActiveUserId] = useState<number | null | undefined>(undefined);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Synchronous ref to prevent stale async callbacks from affecting the newly active account
  const currentUserIdRef = useRef<number | null | undefined>(currentUserId);
  currentUserIdRef.current = currentUserId;

  // Tracks which user ID the currently in-memory `cartItems` belongs to and is hydrated for
  const hydratedUserIdRef = useRef<number | null | undefined>(undefined);
  const activeLoadRequestIdRef = useRef<number>(0);
  const cartItemsRef = useRef<CartItem[]>(cartItems);
  cartItemsRef.current = cartItems;
  const isSyncingFromServerRef = useRef<boolean>(false);
  const mutationCounterRef = useRef<number>(0);

  // Immediately clear cart state when switching accounts (Task 3 & Task 5)
  // This guarantees that the previous account's items never appear for even a single frame
  if (currentUserId !== undefined && activeUserId !== currentUserId) {
    setActiveUserId(currentUserId);
    setCartItems([]);
    setIsLoading(true);
    hydratedUserIdRef.current = undefined;
  }

  /**
   * Validate all cart items against the latest backend database state.
   * Checks if products were deleted from the database (404),
   * if stock was reduced to 0, or if quantity exceeds current available stock.
   */
  const validateCartItems = useCallback(async (): Promise<CartValidationResult> => {
    const currentItems = cartItemsRef.current;
    const validatingUserId = currentUserIdRef.current;

    // If cart is empty, nothing to validate
    if (currentItems.length === 0) {
      return {
        hasUnavailableItems: false,
        unavailableCount: 0,
        outOfStockCount: 0,
        adjustedCount: 0,
      };
    }

    setIsValidating(true);
    setValidationError(null);

    try {
      // Query getProductById for each item in parallel (cache-busted via api.ts)
      const checks = await Promise.allSettled(
        currentItems.map((item) => getProductById(item.product.id))
      );

      // Guard against race conditions if user logged out or switched while network was active
      if (currentUserIdRef.current !== validatingUserId) {
        return {
          hasUnavailableItems: false,
          unavailableCount: 0,
          outOfStockCount: 0,
          adjustedCount: 0,
        };
      }

      let unavailableCount = 0;
      let outOfStockCount = 0;
      let adjustedCount = 0;

      const updated = currentItems.map((item, index) => {
        const checkResult = checks[index];

        if (checkResult.status === 'fulfilled') {
          const liveProduct = checkResult.value;

          // Product deleted from DB (404 or null)
          if (!liveProduct) {
            unavailableCount++;
            return {
              ...item,
              isUnavailable: true,
              isOutOfStock: false,
              unavailableReason: 'This product was removed from the store.',
            };
          }

          // Product exists: check stock
          const liveStock = typeof liveProduct.stock === 'number' ? liveProduct.stock : 0;
          if (liveStock <= 0) {
            outOfStockCount++;
            return {
              ...item,
              product: { ...item.product, ...liveProduct },
              isUnavailable: true,
              isOutOfStock: true,
              unavailableReason: 'Currently out of stock.',
            };
          }

          // Check if quantity exceeds live stock
          let newQuantity = item.quantity;
          if (item.quantity > liveStock) {
            newQuantity = liveStock;
            adjustedCount++;
          }

          return {
            ...item,
            product: { ...item.product, ...liveProduct }, // update with freshest name, price, discount, stock
            quantity: newQuantity,
            isUnavailable: false,
            isOutOfStock: false,
            unavailableReason: undefined,
          };
        }

        // On individual request failure (timeout), keep existing state
        return item;
      });

      // Commit validated items only if active account did not switch
      if (currentUserIdRef.current === validatingUserId) {
        setCartItems(updated);
      }

      const hasUnavailable = unavailableCount > 0 || outOfStockCount > 0;
      return {
        hasUnavailableItems: hasUnavailable,
        unavailableCount,
        outOfStockCount,
        adjustedCount,
      };
    } catch (err: any) {
      console.warn('CartContext: Error validating cart items:', err);
      const msg = err?.message || 'Unable to verify product availability';
      setValidationError(msg);
      return {
        hasUnavailableItems: false,
        unavailableCount: 0,
        outOfStockCount: 0,
        adjustedCount: 0,
        message: msg,
      };
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Load the active account's cart from persistent storage and backend database
  useEffect(() => {
    // If auth session is still being restored on boot, wait until account is known
    if (currentUserId === undefined) {
      return;
    }

    const loadRequestId = ++activeLoadRequestIdRef.current;
    let isMounted = true;

    async function loadCartForAccount(targetUserId: number | null) {
      try {
        const storageKey = getCartStorageKey(targetUserId);
        const stored = await AsyncStorage.getItem(storageKey);

        // Check if component unmounted or another user switch started
        if (!isMounted || activeLoadRequestIdRef.current !== loadRequestId) {
          return;
        }

        let localItems: CartItem[] = [];
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              localItems = parsed.filter(
                (item) =>
                  item &&
                  item.product &&
                  typeof item.product.id === 'number' &&
                  typeof item.quantity === 'number' &&
                  item.quantity > 0
              );
            }
          } catch (parseError) {
            console.warn('CartContext: Error parsing cart JSON:', parseError);
          }
        }

        if (isMounted && activeLoadRequestIdRef.current === loadRequestId) {
          setCartItems(localItems);
          hydratedUserIdRef.current = targetUserId;
          setIsLoading(false);
        }

        const startMutationCount = mutationCounterRef.current;

        // For authenticated users, synchronize with the backend SQL Server database
        if (targetUserId !== null && token) {
          try {
            const serverItems = await fetchServerCart(token);
            if (
              isMounted &&
              activeLoadRequestIdRef.current === loadRequestId &&
              currentUserIdRef.current === targetUserId &&
              mutationCounterRef.current === startMutationCount
            ) {
              if (serverItems.length === 0 && localItems.length > 0) {
                // If local items exist but server cart is empty, upload local items to server
                const payload = localItems.map((item) => ({
                  productId: item.product.id,
                  quantity: item.quantity,
                }));
                void syncServerCart(payload, token).catch(() => {});
              } else {
                const serverCartItems: CartItem[] = serverItems.map((item) => ({
                  product: {
                    id: item.productId ?? item.id,
                    name: item.name,
                    price: item.price,
                    discount: item.discount ?? 0,
                    category: item.category ?? '',
                    image: item.image,
                    stock: item.stock ?? 0,
                  },
                  quantity: item.quantity,
                  isUnavailable: item.stock <= 0,
                  isOutOfStock: item.stock <= 0,
                }));

                isSyncingFromServerRef.current = true;
                setCartItems(serverCartItems);
                await AsyncStorage.setItem(storageKey, JSON.stringify(serverCartItems));
              }
            }
          } catch (serverErr) {
            console.warn('CartContext: Backend cart sync fallback to local storage:', serverErr);
          }
        }
      } catch (error) {
        console.warn(`CartContext: Failed to load cart for account ${targetUserId}:`, error);
        if (isMounted && activeLoadRequestIdRef.current === loadRequestId) {
          setCartItems([]);
          hydratedUserIdRef.current = targetUserId;
          setIsLoading(false);
        }
      }
    }

    loadCartForAccount(currentUserId);

    return () => {
      isMounted = false;
    };
  }, [currentUserId, token]);

  // Save cart to persistent storage whenever cartItems change, and sync to backend
  useEffect(() => {
    // CRITICAL: Prevent saving old or unhydrated cart data into the newly selected account (Task 8)
    // 1. Auth must be resolved (currentUserId is not undefined)
    // 2. The in-memory cartItems must have completed hydration for this exact account
    // 3. The current user must still match the hydrated user
    if (
      currentUserId === undefined ||
      hydratedUserIdRef.current === undefined ||
      hydratedUserIdRef.current !== currentUserId
    ) {
      return;
    }

    const targetUserId = currentUserId;
    const itemsToPersist = cartItems;
    const storageKey = getCartStorageKey(targetUserId);

    async function persistCart() {
      try {
        // Race condition safety check before writing
        if (currentUserIdRef.current !== targetUserId) {
          return;
        }

        if (isSyncingFromServerRef.current) {
          isSyncingFromServerRef.current = false;
          return;
        }

        await AsyncStorage.setItem(storageKey, JSON.stringify(itemsToPersist));

        // If authenticated user, push to SQL Server backend
        if (targetUserId !== null && token) {
          const payload = itemsToPersist
            .filter((item) => !item.isUnavailable)
            .map((item) => ({
              productId: item.product.id,
              quantity: item.quantity,
            }));
          try {
            await syncServerCart(payload, token);
          } catch (syncErr) {
            console.warn('CartContext: Error syncing cart to backend:', syncErr);
          }
        }
      } catch (error) {
        console.warn(`CartContext: Failed to persist cart for account ${targetUserId}:`, error);
      }
    }

    persistCart();
  }, [cartItems, currentUserId, token]);

  /**
   * Refetches cart directly from SQL Server database (Task 4)
   */
  const refreshCart = useCallback(async (): Promise<void> => {
    const targetUserId = currentUserIdRef.current;
    if (targetUserId === undefined || targetUserId === null || !token) {
      return;
    }

    const startMutationCount = mutationCounterRef.current;
    try {
      const serverItems = await fetchServerCart(token);
      if (
        currentUserIdRef.current !== targetUserId ||
        mutationCounterRef.current !== startMutationCount
      ) {
        return;
      }

      const serverCartItems: CartItem[] = serverItems.map((item) => ({
        product: {
          id: item.productId ?? item.id,
          name: item.name,
          price: item.price,
          discount: item.discount ?? 0,
          category: item.category ?? '',
          image: item.image,
          stock: item.stock ?? 0,
        },
        quantity: item.quantity,
        isUnavailable: item.stock <= 0,
        isOutOfStock: item.stock <= 0,
      }));

      isSyncingFromServerRef.current = true;
      setCartItems(serverCartItems);
      const storageKey = getCartStorageKey(targetUserId);
      await AsyncStorage.setItem(storageKey, JSON.stringify(serverCartItems));
    } catch (err) {
      console.warn('CartContext: Error refreshing cart from server:', err);
    }
  }, [token]);

  // Refresh cart from server when mobile app regains focus / active state (Task 4)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        void refreshCart();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [refreshCart]);

  /**
   * Add a product to the cart or increase its quantity.
   * Respects stock constraints and prevents adding out-of-stock items.
   */
  const addToCart = useCallback((product: Product, addQuantity: number = 1): AddToCartResult => {
    mutationCounterRef.current++;
    if (!product || typeof product.id !== 'number') {
      return { success: false, message: 'Invalid product.' };
    }

    // Check available stock
    const availableStock = typeof product.stock === 'number' ? product.stock : 0;
    if (availableStock <= 0) {
      return {
        success: false,
        message: `"${product.name}" is currently out of stock.`,
      };
    }

    let result: AddToCartResult = { success: true };

    setCartItems((prevItems) => {
      const existingIndex = prevItems.findIndex((item) => item.product.id === product.id);

      if (existingIndex > -1) {
        const existing = prevItems[existingIndex];
        const newQuantity = existing.quantity + addQuantity;

        if (existing.quantity >= availableStock) {
          result = {
            success: false,
            message: `You already have all ${availableStock} available units of "${product.name}" in your cart.`,
          };
          return prevItems;
        }

        const cappedQuantity = Math.min(newQuantity, availableStock);
        if (cappedQuantity < newQuantity) {
          result = {
            success: true,
            message: `Added to cart. Adjusted to maximum available stock (${availableStock}).`,
          };
        } else {
          result = {
            success: true,
            message: `Added another "${product.name}" to your cart.`,
          };
        }

        const updated = [...prevItems];
        updated[existingIndex] = {
          ...existing,
          product: { ...existing.product, ...product }, // Update with freshest product data
          quantity: cappedQuantity,
          isUnavailable: false,
          isOutOfStock: false,
          unavailableReason: undefined,
        };
        return updated;
      } else {
        const initialQuantity = Math.min(Math.max(1, addQuantity), availableStock);
        result = {
          success: true,
          message: `Added "${product.name}" to your cart.`,
        };
        return [
          ...prevItems,
          {
            product,
            quantity: initialQuantity,
            isUnavailable: false,
            isOutOfStock: false,
          },
        ];
      }
    });

    return result;
  }, []);

  /**
   * Update quantity of a specific product.
   * If quantity <= 0, item is removed.
   */
  const updateQuantity = useCallback((productId: number, quantity: number) => {
    mutationCounterRef.current++;
    setCartItems((prevItems) => {
      if (quantity <= 0) {
        return prevItems.filter((item) => item.product.id !== productId);
      }

      return prevItems.map((item) => {
        if (item.product.id === productId) {
          const maxStock = typeof item.product.stock === 'number' ? item.product.stock : 99;
          const capped = Math.min(quantity, maxStock);
          return {
            ...item,
            quantity: capped,
          };
        }
        return item;
      });
    });
  }, []);

  /**
   * Remove a product from the cart completely.
   */
  const removeFromCart = useCallback((productId: number) => {
    mutationCounterRef.current++;
    setCartItems((prevItems) => prevItems.filter((item) => item.product.id !== productId));
  }, []);

  /**
   * Remove all unavailable or out-of-stock items from the cart.
   */
  const removeUnavailableItems = useCallback(() => {
    mutationCounterRef.current++;
    setCartItems((prevItems) =>
      prevItems.filter(
        (item) =>
          !item.isUnavailable &&
          !item.isOutOfStock &&
          (typeof item.product.stock !== 'number' || item.product.stock > 0)
      )
    );
  }, []);

  /**
   * Clear all items from the cart.
   */
  const clearCart = useCallback(() => {
    mutationCounterRef.current++;
    setCartItems([]);
    if (token) {
      void clearServerCart(token).catch(() => {});
    }
  }, [token]);

  // Check if any cart item is currently unavailable or out of stock
  const hasUnavailableItems = useMemo(() => {
    return cartItems.some(
      (item) =>
        item.isUnavailable ||
        item.isOutOfStock ||
        (typeof item.product.stock === 'number' && item.product.stock <= 0)
    );
  }, [cartItems]);

  // Purchasable available items only
  const availableItems = useMemo(() => {
    return cartItems.filter(
      (item) =>
        !item.isUnavailable &&
        !item.isOutOfStock &&
        (typeof item.product.stock !== 'number' || item.product.stock > 0)
    );
  }, [cartItems]);

  // Total quantity of all available items in cart
  const totalItemsCount = useMemo(() => {
    return availableItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [availableItems]);

  // Subtotal calculated with original prices of available items
  const subtotal = useMemo(() => {
    return availableItems.reduce((acc, item) => {
      const price = typeof item.product.price === 'number' ? item.product.price : 0;
      return acc + price * item.quantity;
    }, 0);
  }, [availableItems]);

  // Final total after item discounts of available items
  const finalTotal = useMemo(() => {
    return availableItems.reduce((acc, item) => {
      const discountedUnit = calculateFinalPrice(item.product.price, item.product.discount);
      return acc + discountedUnit * item.quantity;
    }, 0);
  }, [availableItems]);

  // Discount savings amount
  const totalDiscount = useMemo(() => {
    return Math.max(0, subtotal - finalTotal);
  }, [subtotal, finalTotal]);

  // Free delivery standard
  const deliveryFee = 0;

  const value = useMemo(
    () => ({
      cartItems,
      totalItemsCount,
      subtotal,
      totalDiscount,
      finalTotal,
      deliveryFee,
      isLoading,
      isValidating,
      validationError,
      hasUnavailableItems,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      validateCartItems,
      removeUnavailableItems,
      refreshCart,
    }),
    [
      cartItems,
      totalItemsCount,
      subtotal,
      totalDiscount,
      finalTotal,
      deliveryFee,
      isLoading,
      isValidating,
      validationError,
      hasUnavailableItems,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      validateCartItems,
      removeUnavailableItems,
      refreshCart,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
