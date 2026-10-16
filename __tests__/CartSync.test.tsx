import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { CartProvider, useCart } from '../src/context/CartContext';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { saveAuthSession, clearAuthSession } from '../src/services/authStorage';
import * as cartApi from '../src/services/cartApi';
import type { Product } from '../src/types/product';
import type { User } from '../src/types/auth';

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });

function createSampleProduct(id: number, name: string, price: number = 100): Product {
  return {
    id,
    name,
    category: 'Electronics',
    price,
    image: `item_${id}.png`,
    stock: 20,
    discount: 10,
  };
}

describe('Shared Cart Synchronization', () => {
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

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('hydrates cart from SQL Server backend when user logs in', async () => {
    const fetchSpy = jest.spyOn(cartApi, 'fetchServerCart').mockResolvedValue([
      {
        id: 1,
        productId: 5,
        name: 'Headphones',
        price: 200,
        discount: 20,
        category: 'Electronics',
        image: 'headphone.jpg',
        stock: 15,
        quantity: 2,
      },
    ]);

    await saveAuthSession('token_user_a', userA);

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderTestApp();
    });

    await act(async () => {
      await delay(50);
    });

    expect(fetchSpy).toHaveBeenCalledWith('token_user_a');
    expect(cartContextRef?.cartItems.length).toBe(1);
    expect(cartContextRef?.cartItems[0].product.id).toBe(5);
    expect(cartContextRef?.cartItems[0].quantity).toBe(2);
    expect(cartContextRef?.totalItemsCount).toBe(2);

    fetchSpy.mockRestore();
    await act(async () => {
      renderer!.unmount();
    });
  });

  it('pushes cart updates to SQL Server backend when adding or updating items', async () => {
    jest.spyOn(cartApi, 'fetchServerCart').mockResolvedValue([]);
    const syncSpy = jest.spyOn(cartApi, 'syncServerCart').mockResolvedValue(true);

    await saveAuthSession('token_user_a', userA);

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderTestApp();
    });

    await act(async () => {
      await delay(50);
    });

    const product = createSampleProduct(7, 'Smart Watch', 350);

    await act(async () => {
      cartContextRef?.addToCart(product, 3);
    });

    await act(async () => {
      await delay(50);
    });

    expect(syncSpy).toHaveBeenCalledWith(
      expect.arrayContaining([{ productId: 7, quantity: 3 }]),
      'token_user_a'
    );
    expect(cartContextRef?.cartItems.length).toBe(1);
    expect(cartContextRef?.totalItemsCount).toBe(3);

    syncSpy.mockRestore();
    await act(async () => {
      renderer!.unmount();
    });
  });

  it('refetches server cart when app regains focus via AppState', async () => {
    let callCount = 0;
    const fetchSpy = jest.spyOn(cartApi, 'fetchServerCart').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return [];
      }
      // On second call (e.g. simulated focus after PC added an item):
      return [
        {
          id: 9,
          productId: 9,
          name: 'Mechanical Keyboard',
          price: 500,
          discount: 0,
          category: 'Electronics',
          image: 'keyboard.jpg',
          stock: 10,
          quantity: 1,
        },
      ];
    });

    await saveAuthSession('token_user_a', userA);

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderTestApp();
    });

    await act(async () => {
      await delay(50);
    });

    expect(cartContextRef?.cartItems.length).toBe(0);

    // Simulate PC added an item and phone app regains active focus
    await act(async () => {
      // Trigger AppState change to active
      (AppState as any).emit?.('change', 'active');
      await delay(50);
    });

    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
    await act(async () => {
      renderer!.unmount();
    });
  });

  it('clears server cart when clearCart is called', async () => {
    jest.spyOn(cartApi, 'fetchServerCart').mockResolvedValue([]);
    const clearSpy = jest.spyOn(cartApi, 'clearServerCart').mockResolvedValue(true);

    await saveAuthSession('token_user_a', userA);

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderTestApp();
    });

    await act(async () => {
      await delay(50);
    });

    await act(async () => {
      cartContextRef?.clearCart();
    });

    await act(async () => {
      await delay(50);
    });

    expect(clearSpy).toHaveBeenCalledWith('token_user_a');
    expect(cartContextRef?.cartItems.length).toBe(0);

    clearSpy.mockRestore();
    await act(async () => {
      renderer!.unmount();
    });
  });
});
