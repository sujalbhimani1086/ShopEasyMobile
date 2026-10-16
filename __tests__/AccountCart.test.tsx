import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartProvider, useCart } from '../src/context/CartContext';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import {
  getCartStorageKey,
  clearAuthSession,
  saveAuthSession,
  GUEST_CART_STORAGE_KEY,
} from '../src/services/authStorage';
import type { Product } from '../src/types/product';
import type { User } from '../src/types/auth';

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });

// Sample product factory
function createSampleProduct(id: number, name: string, price: number = 100): Product {
  return {
    id,
    name,
    category: 'Electronics',
    price,
    image: `item_${id}.png`,
    stock: 20,
    discount: 0,
  };
}

describe('Account-Specific Cart Implementation', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('Storage Key Resolution', () => {
    it('generates distinct, account-specific storage keys based on user ID', () => {
      expect(getCartStorageKey(101)).toBe('@shopeasy_cart_user_101_v1');
      expect(getCartStorageKey(202)).toBe('@shopeasy_cart_user_202_v1');
      expect(getCartStorageKey(1)).toBe('@shopeasy_cart_user_1_v1');
    });

    it('generates isolated guest key when user ID is null or undefined', () => {
      expect(getCartStorageKey(null)).toBe(GUEST_CART_STORAGE_KEY);
      expect(getCartStorageKey(undefined)).toBe(GUEST_CART_STORAGE_KEY);
      expect(getCartStorageKey(null)).not.toBe(getCartStorageKey(101));
    });
  });

  describe('Cart Isolation Across Accounts', () => {
    // Helper component to exercise cart actions
    let cartContextRef: ReturnType<typeof useCart> | null = null;
    let authContextRef: ReturnType<typeof useAuth> | null = null;

    function TestConsumer() {
      cartContextRef = useCart();
      authContextRef = useAuth();
      return null;
    }

    function renderTestApp() {
      return ReactTestRenderer.create(
        <AuthProvider>
          <CartProvider>
            <TestConsumer />
          </CartProvider>
        </AuthProvider>
      );
    }

    const userA: User = {
      id: 101,
      name: 'User A',
      email: 'usera@example.com',
      role: 'CUSTOMER',
      status: 'APPROVED',
    };

    const userB: User = {
      id: 202,
      name: 'User B',
      email: 'userb@example.com',
      role: 'CUSTOMER',
      status: 'APPROVED',
    };

    it('maintains completely separate carts between Account A and Account B', async () => {
      // 1. Start with User A logged in
      await saveAuthSession('token_a', userA);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderTestApp();
      });

      // Wait for auth & cart hydration
      await act(async () => {
        await delay(50);
      });

      expect(authContextRef?.user?.id).toBe(101);
      expect(cartContextRef?.cartItems).toEqual([]);

      // 2. Add 5 cart items to Account A
      const product1 = createSampleProduct(1, 'Product 1');
      const product2 = createSampleProduct(2, 'Product 2');
      const product3 = createSampleProduct(3, 'Product 3');
      const product4 = createSampleProduct(4, 'Product 4');
      const product5 = createSampleProduct(5, 'Product 5');

      await act(async () => {
        cartContextRef?.addToCart(product1);
        cartContextRef?.addToCart(product2);
        cartContextRef?.addToCart(product3);
        cartContextRef?.addToCart(product4);
        cartContextRef?.addToCart(product5);
      });

      // Wait for persistence to complete
      await act(async () => {
        await delay(50);
      });

      expect(cartContextRef?.cartItems.length).toBe(5);
      expect(cartContextRef?.totalItemsCount).toBe(5);

      // Verify persisted under User A's key
      const keyA = getCartStorageKey(101);
      const rawStoredA = await AsyncStorage.getItem(keyA);
      expect(rawStoredA).toBeTruthy();
      const parsedA = JSON.parse(rawStoredA!);
      expect(parsedA.length).toBe(5);

      // 3. Log out User A
      await act(async () => {
        await authContextRef?.logout();
      });

      await act(async () => {
        await delay(50);
      });

      // Active cart must be empty after logout
      expect(cartContextRef?.cartItems.length).toBe(0);
      expect(cartContextRef?.totalItemsCount).toBe(0);

      // User A's saved cart in storage MUST NOT be deleted
      const storedAAfterLogout = await AsyncStorage.getItem(keyA);
      expect(storedAAfterLogout).toBeTruthy();
      expect(JSON.parse(storedAAfterLogout!).length).toBe(5);

      // 4. Log in as Account B
      await act(async () => {
        await saveAuthSession('token_b', userB);
      });

      await act(async () => {
        renderer!.unmount();
      });

      await act(async () => {
        renderer = renderTestApp();
      });

      await act(async () => {
        await delay(50);
      });

      expect(authContextRef?.user?.id).toBe(202);
      // Account B must NOT see Account A's items
      expect(cartContextRef?.cartItems.length).toBe(0);
      expect(cartContextRef?.totalItemsCount).toBe(0);

      // 5. Add 2 items to Account B's cart
      const productB1 = createSampleProduct(10, 'Product B1');
      const productB2 = createSampleProduct(11, 'Product B2');

      await act(async () => {
        cartContextRef?.addToCart(productB1);
        cartContextRef?.addToCart(productB2);
      });

      await act(async () => {
        await delay(50);
      });

      expect(cartContextRef?.cartItems.length).toBe(2);
      expect(cartContextRef?.totalItemsCount).toBe(2);

      // Verify Account B's items saved under User B's key
      const keyB = getCartStorageKey(202);
      const rawStoredB = await AsyncStorage.getItem(keyB);
      expect(rawStoredB).toBeTruthy();
      expect(JSON.parse(rawStoredB!).length).toBe(2);

      // 6. Switch back to Account A
      await act(async () => {
        await authContextRef?.logout();
        await saveAuthSession('token_a', userA);
      });

      await act(async () => {
        renderer!.unmount();
      });

      await act(async () => {
        renderer = renderTestApp();
      });

      await act(async () => {
        await delay(50);
      });

      expect(authContextRef?.user?.id).toBe(101);
      // Account A's 5 items must be fully restored!
      expect(cartContextRef?.cartItems.length).toBe(5);
      expect(cartContextRef?.totalItemsCount).toBe(5);
      const restoredIds = cartContextRef?.cartItems.map((i) => i.product.id);
      expect(restoredIds).toEqual([1, 2, 3, 4, 5]);

      // Account B's cart in storage must still be intact with its 2 items
      const storedBStillIntact = await AsyncStorage.getItem(keyB);
      expect(storedBStillIntact).toBeTruthy();
      expect(JSON.parse(storedBStillIntact!).length).toBe(2);

      await act(async () => {
        renderer!.unmount();
      });
    });

    it('keeps guest cart data completely separate from authenticated user carts', async () => {
      // 1. Start as Guest (no session stored)
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderTestApp();
      });

      await act(async () => {
        await delay(50);
      });

      expect(authContextRef?.user).toBeNull();
      expect(cartContextRef?.cartItems).toEqual([]);

      // 2. Guest adds an item
      const guestProduct = createSampleProduct(99, 'Guest Special Item');
      await act(async () => {
        cartContextRef?.addToCart(guestProduct);
      });

      await act(async () => {
        await delay(50);
      });

      expect(cartContextRef?.cartItems.length).toBe(1);
      const guestKey = GUEST_CART_STORAGE_KEY;
      const guestStored = await AsyncStorage.getItem(guestKey);
      expect(guestStored).toBeTruthy();
      expect(JSON.parse(guestStored!)[0].product.id).toBe(99);

      // 3. User A logs in
      await act(async () => {
        await saveAuthSession('token_a', userA);
      });

      await act(async () => {
        renderer!.unmount();
      });

      await act(async () => {
        renderer = renderTestApp();
      });

      await act(async () => {
        await delay(50);
      });

      expect(authContextRef?.user?.id).toBe(101);
      // User A's cart must NOT contain the guest item
      const hasGuestItem = cartContextRef?.cartItems.some((i) => i.product.id === 99);
      expect(hasGuestItem).toBe(false);

      await act(async () => {
        renderer!.unmount();
      });
    });

    it('clears active cart state on clearCart without deleting another user cart', async () => {
      // Pre-populate carts for User A and User B
      const keyA = getCartStorageKey(101);
      const keyB = getCartStorageKey(202);
      const itemA = [{ product: createSampleProduct(1, 'Item A'), quantity: 1 }];
      const itemB = [{ product: createSampleProduct(2, 'Item B'), quantity: 2 }];

      await AsyncStorage.setItem(keyA, JSON.stringify(itemA));
      await AsyncStorage.setItem(keyB, JSON.stringify(itemB));

      // Login as User A
      await saveAuthSession('token_a', userA);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderTestApp();
      });

      await act(async () => {
        await delay(50);
      });

      expect(cartContextRef?.cartItems.length).toBe(1);
      expect(cartContextRef?.cartItems[0].product.id).toBe(1);

      // User A clears cart
      await act(async () => {
        cartContextRef?.clearCart();
      });

      await act(async () => {
        await delay(50);
      });

      expect(cartContextRef?.cartItems.length).toBe(0);

      // User A's stored cart is now empty
      const updatedKeyA = await AsyncStorage.getItem(keyA);
      expect(JSON.parse(updatedKeyA!)).toEqual([]);

      // User B's stored cart is UNTOUCHED
      const updatedKeyB = await AsyncStorage.getItem(keyB);
      expect(JSON.parse(updatedKeyB!).length).toBe(1);
      expect(JSON.parse(updatedKeyB!)[0].product.id).toBe(2);

      await act(async () => {
        renderer!.unmount();
      });
    });

    it('prevents asynchronous storage operations from saving old cart data into the newly selected account', async () => {
      // Pre-seed User A with 3 items in storage
      const keyA = getCartStorageKey(101);
      const keyB = getCartStorageKey(202);
      const itemsA = [
        { product: createSampleProduct(1, 'Item 1'), quantity: 1 },
        { product: createSampleProduct(2, 'Item 2'), quantity: 1 },
        { product: createSampleProduct(3, 'Item 3'), quantity: 1 },
      ];
      await AsyncStorage.setItem(keyA, JSON.stringify(itemsA));

      // User B initially has an empty cart
      await AsyncStorage.setItem(keyB, JSON.stringify([]));

      // 1. Mount with User A
      await saveAuthSession('token_a', userA);
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderTestApp();
      });

      await act(async () => {
        await delay(50);
      });

      expect(cartContextRef?.cartItems.length).toBe(3);

      // 2. Rapidly switch to User B (simulate user switching accounts immediately)
      await act(async () => {
        await authContextRef?.logout();
        await saveAuthSession('token_b', userB);
      });

      await act(async () => {
        renderer!.unmount();
        renderer = renderTestApp();
      });

      // Cart state must immediately be empty, not showing User A's items
      expect(cartContextRef?.cartItems.length).toBe(0);

      await act(async () => {
        await delay(60);
      });

      // Verify that User B's storage key NEVER got polluted with User A's 3 items
      const userBStorage = await AsyncStorage.getItem(keyB);
      expect(userBStorage).toBeTruthy();
      expect(JSON.parse(userBStorage!)).toEqual([]);

      // User A's storage key remains intact with 3 items
      const userAStorage = await AsyncStorage.getItem(keyA);
      expect(JSON.parse(userAStorage!).length).toBe(3);

      await act(async () => {
        renderer!.unmount();
      });
    });
  });
});
