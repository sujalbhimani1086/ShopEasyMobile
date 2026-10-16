import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product } from '../types/product';
import { useAuth } from './AuthContext';
import { fetchServerWishlist, toggleServerWishlist } from '../services/wishlistApi';

export interface WishlistContextType {
  wishlistItems: Product[];
  wishlistCount: number;
  isWishlisted: (productId: number) => boolean;
  toggleWishlist: (product: Product) => Promise<boolean>;
  removeFromWishlist: (productId: number) => Promise<void>;
  clearWishlist: () => void;
  refreshWishlist: () => Promise<void>;
  isLoading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

function getWishlistStorageKey(userId: number | null | undefined): string {
  if (typeof userId === 'number' && userId > 0) {
    return `@shopeasy_wishlist_user_${userId}_v1`;
  }
  return '@shopeasy_wishlist_guest_v1';
}

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const currentUserId = isAuthLoading ? undefined : (user?.id ?? null);

  const [wishlistItems, setWishlistItems] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const wishlistMap = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const item of wishlistItems) {
      if (item && typeof item.id === 'number') {
        map.set(item.id, true);
      }
    }
    return map;
  }, [wishlistItems]);

  const currentUserIdRef = useRef<number | null | undefined>(currentUserId);
  currentUserIdRef.current = currentUserId;

  // Hydrate wishlist for current user
  useEffect(() => {
    if (currentUserId === undefined) return;

    let isMounted = true;
    const targetUserId = currentUserId;
    const storageKey = getWishlistStorageKey(targetUserId);

    async function loadWishlist() {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        let localItems: Product[] = [];
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              localItems = parsed.filter((p) => p && typeof p.id === 'number');
            }
          } catch {}
        }

        if (isMounted && currentUserIdRef.current === targetUserId) {
          setWishlistItems(localItems);
          setIsLoading(false);
        }

        // If authenticated, sync with server
        if (targetUserId !== null && token) {
          try {
            const serverProducts = await fetchServerWishlist(token);
            if (isMounted && currentUserIdRef.current === targetUserId) {
              if (serverProducts.length > 0) {
                setWishlistItems(serverProducts);
                await AsyncStorage.setItem(storageKey, JSON.stringify(serverProducts));
              } else if (localItems.length > 0) {
                // Upload local items to server
                for (const item of localItems) {
                  await toggleServerWishlist(item.id, token).catch(() => {});
                }
              }
            }
          } catch (serverErr) {
            console.warn('WishlistContext: Backend sync fallback to local storage:', serverErr);
          }
        }
      } catch (err) {
        console.warn('WishlistContext: Error loading wishlist:', err);
        if (isMounted) {
          setWishlistItems([]);
          setIsLoading(false);
        }
      }
    }

    loadWishlist();

    return () => {
      isMounted = false;
    };
  }, [currentUserId, token]);

  const isWishlisted = useCallback(
    (productId: number): boolean => {
      return wishlistMap.has(productId);
    },
    [wishlistMap]
  );

  const toggleWishlist = useCallback(
    async (product: Product): Promise<boolean> => {
      if (!product || typeof product.id !== 'number') return false;

      const targetUserId = currentUserIdRef.current;
      const storageKey = getWishlistStorageKey(targetUserId);
      const isCurrentlyWishlisted = wishlistMap.has(product.id);
      const willBeWishlisted = !isCurrentlyWishlisted;

      setWishlistItems((prev) => {
        let updated: Product[];
        if (isCurrentlyWishlisted) {
          updated = prev.filter((p) => p.id !== product.id);
        } else {
          updated = [product, ...prev.filter((p) => p.id !== product.id)];
        }

        AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(() => {});
        return updated;
      });

      // Synchronize with backend if logged in
      if (token) {
        try {
          await toggleServerWishlist(product.id, token);
        } catch (serverErr) {
          console.warn('WishlistContext: Error updating server wishlist:', serverErr);
        }
      }

      return willBeWishlisted;
    },
    [wishlistMap, token]
  );

  const removeFromWishlist = useCallback(
    async (productId: number): Promise<void> => {
      if (!Number.isInteger(productId) || productId <= 0) return;

      const targetUserId = currentUserIdRef.current;
      const storageKey = getWishlistStorageKey(targetUserId);

      setWishlistItems((prev) => {
        const updated = prev.filter((p) => p.id !== productId);
        AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(() => {});
        return updated;
      });

      if (token) {
        try {
          await toggleServerWishlist(productId, token);
        } catch (serverErr) {
          console.warn('WishlistContext: Error removing from server wishlist:', serverErr);
        }
      }
    },
    [token]
  );

  const clearWishlist = useCallback(() => {
    const targetUserId = currentUserIdRef.current;
    const storageKey = getWishlistStorageKey(targetUserId);
    setWishlistItems([]);
    AsyncStorage.removeItem(storageKey).catch(() => {});
  }, []);

  const refreshWishlist = useCallback(async (): Promise<void> => {
    const targetUserId = currentUserIdRef.current;
    if (targetUserId === undefined) return;
    const storageKey = getWishlistStorageKey(targetUserId);

    try {
      if (targetUserId !== null && token) {
        try {
          const serverProducts = await fetchServerWishlist(token);
          if (currentUserIdRef.current === targetUserId) {
            setWishlistItems(serverProducts);
            await AsyncStorage.setItem(storageKey, JSON.stringify(serverProducts));
            return;
          }
        } catch (serverErr) {
          console.warn('WishlistContext: Backend sync fallback to local storage:', serverErr);
        }
      }

      // Guest or offline: re-read local storage
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored && currentUserIdRef.current === targetUserId) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setWishlistItems(parsed.filter((p) => p && typeof p.id === 'number'));
          }
        } catch {}
      }
    } catch (err) {
      console.warn('WishlistContext: Error refreshing wishlist:', err);
    }
  }, [token]);

  const value = useMemo(
    () => ({
      wishlistItems,
      wishlistCount: wishlistItems.length,
      isWishlisted,
      toggleWishlist,
      removeFromWishlist,
      clearWishlist,
      refreshWishlist,
      isLoading,
    }),
    [wishlistItems, isWishlisted, toggleWishlist, removeFromWishlist, clearWishlist, refreshWishlist, isLoading]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

const defaultWishlistContext: WishlistContextType = {
  wishlistItems: [],
  wishlistCount: 0,
  isWishlisted: () => false,
  toggleWishlist: async (_product: Product) => false,
  removeFromWishlist: async (_productId: number) => {},
  clearWishlist: () => {},
  refreshWishlist: async () => {},
  isLoading: false,
};

export function useWishlist(): WishlistContextType {
  const context = useContext(WishlistContext);
  return context || defaultWishlistContext;
}
