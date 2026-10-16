import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../types/auth';

const TOKEN_KEY = '@shopeasy_auth_token_v1';
const USER_KEY = '@shopeasy_auth_user_v1';
export const GUEST_CART_STORAGE_KEY = '@shopeasy_cart_guest_v1';

/**
 * Resolves the storage key for an account-specific cart or guest cart.
 * Each authenticated user gets a distinct key based on their unique ID.
 */
export function getCartStorageKey(userId?: number | null): string {
  if (userId !== undefined && userId !== null) {
    return `@shopeasy_cart_user_${userId}_v1`;
  }
  return GUEST_CART_STORAGE_KEY;
}

/**
 * Stores the authenticated session token and sanitized user profile.
 * Passwords are NEVER persisted.
 */
export async function saveAuthSession(
  token: string | null,
  user: User
): Promise<void> {
  try {
    const promises: Promise<void>[] = [
      AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
    ];
    if (token) {
      promises.push(AsyncStorage.setItem(TOKEN_KEY, token));
    } else {
      promises.push(AsyncStorage.removeItem(TOKEN_KEY));
    }
    await Promise.all(promises);
  } catch (error) {
    console.error('Error saving auth session:', error);
  }
}

/**
 * Retrieves the stored session token and user profile.
 */
export async function getAuthSession(): Promise<{
  token: string | null;
  user: User | null;
}> {
  try {
    const [storedToken, storedUser] = await Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(USER_KEY),
    ]);

    let parsedUser: User | null = null;
    if (storedUser) {
      try {
        parsedUser = JSON.parse(storedUser);
      } catch {
        parsedUser = null;
      }
    }

    return {
      token: storedToken || null,
      user: parsedUser,
    };
  } catch (error) {
    console.error('Error reading auth session:', error);
    return { token: null, user: null };
  }
}

/**
 * Retrieves the stored auth token string.
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Clears the stored session token, user profile, and active guest cart.
 * Authenticated users' saved carts (@shopeasy_cart_user_${id}_v1) are intentionally
 * preserved so account-specific carts remain intact across future logins.
 */
export async function clearAuthSession(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
      AsyncStorage.removeItem(GUEST_CART_STORAGE_KEY),
    ]);
  } catch (error) {
    console.error('Error clearing auth session:', error);
  }
}

/**
 * Clears the guest cart storage.
 */
export async function clearGuestCart(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GUEST_CART_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing guest cart:', error);
  }
}

/**
 * Reads stored cart items for a specific user ID or guest.
 */
export async function getStoredCart(userId?: number | null): Promise<any[]> {
  try {
    const key = getCartStorageKey(userId);
    const data = await AsyncStorage.getItem(key);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`Error reading cart for user ${userId}:`, error);
    return [];
  }
}

/**
 * Persists cart items for a specific user ID or guest.
 */
export async function saveStoredCart(
  cartItems: any[],
  userId?: number | null
): Promise<void> {
  try {
    const key = getCartStorageKey(userId);
    await AsyncStorage.setItem(key, JSON.stringify(cartItems));
  } catch (error) {
    console.warn(`Error persisting cart for user ${userId}:`, error);
  }
}

/**
 * Clears stored cart items for a specific user ID or guest.
 */
export async function clearStoredCart(userId?: number | null): Promise<void> {
  try {
    const key = getCartStorageKey(userId);
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.warn(`Error clearing cart for user ${userId}:`, error);
  }
}
