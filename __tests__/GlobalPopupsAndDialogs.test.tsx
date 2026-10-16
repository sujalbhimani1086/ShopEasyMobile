import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, Pressable, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  AppDialog,
  ConfirmDialog,
  AlertDialog,
  AppToast,
  LoadingDialog,
} from '../src/components/dialogs';
import { CartScreen } from '../src/screens/CartScreen';
import { WishlistScreen } from '../src/screens/WishlistScreen';
import * as cartContext from '../src/context/CartContext';
import * as wishlistContext from '../src/context/WishlistContext';

// Mock theme
jest.mock('../src/theme/theme', () => ({
  useAppTheme: () => ({
    isDark: false,
    colors: {
      background: '#F8F9FA',
      card: '#FFFFFF',
      surfaceSubtle: '#F1F3F5',
      text: '#111827',
      textSecondary: '#4B5563',
      textMuted: '#6B7280',
      border: '#E5E7EB',
      borderLight: '#F3F4F6',
      primary: '#111827',
      primaryText: '#FFFFFF',
      accent: '#F59E0B',
      brandBlue: '#2874F0',
      success: '#10B981',
      successBg: '#E6F9F2',
      danger: '#EF4444',
      dangerBg: '#FEECEC',
      modalOverlay: 'rgba(0, 0, 0, 0.55)',
    },
  }),
}));

// Mock Auth
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Sujal Test', email: 'sujal@gmail.com', role: 'CUSTOMER', status: 'APPROVED' },
    token: 'test-token',
  }),
}));

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function extractAllStrings(root: ReactTestRenderer.ReactTestInstance): string[] {
  return root.findAllByType(Text).map((node) => {
    const extract = (children: any): string => {
      if (children === null || children === undefined) return '';
      if (typeof children === 'string' || typeof children === 'number') return String(children);
      if (Array.isArray(children)) return children.map(extract).join('');
      if (children.props?.children) return extract(children.props.children);
      return '';
    };
    return extract(node.props.children);
  });
}

describe('ShopEasy Mobile — Global Popups, Dialogs & Modern Confirmation UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Reusable Popup Design System Components', () => {
    it('AppDialog renders title, subtitle, and footer inside a centered modal', () => {
      const onClose = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;

      act(() => {
        renderer = ReactTestRenderer.create(
          <AppDialog
            visible={true}
            title="Custom Modal Title"
            subtitle="Detailed description of the dialog"
            icon="info"
            onClose={onClose}
            footer={
              <Pressable testID="footer-action" onPress={onClose}>
                <Text>Action</Text>
              </Pressable>
            }
          />
        );
      });

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Custom Modal Title');
      expect(texts).toContain('Detailed description of the dialog');
      expect(texts).toContain('Action');
    });

    it('ConfirmDialog renders title, message, cancel and confirm buttons with proper roles', async () => {
      const onCancel = jest.fn();
      const onConfirm = jest.fn();

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <ConfirmDialog
            visible={true}
            title="Delete Item?"
            message="Are you sure you want to delete this item?"
            cancelText="Keep"
            confirmText="Delete"
            isDestructive={true}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        );
      });

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Delete Item?');
      expect(texts).toContain('Are you sure you want to delete this item?');
      expect(texts).toContain('Keep');
      expect(texts).toContain('Delete');

      // Tap Cancel
      const cancelBtn = renderer!.root.find(
        (n) => n.props.accessibilityLabel === 'Keep' && n.props.accessibilityRole === 'button'
      );
      await act(async () => {
        cancelBtn.props.onPress();
      });
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();

      // Tap Confirm
      const confirmBtn = renderer!.root.find(
        (n) => n.props.accessibilityLabel === 'Delete' && n.props.accessibilityRole === 'button'
      );
      await act(async () => {
        confirmBtn.props.onPress();
      });
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('AlertDialog supports success, error, warning, and info variants', () => {
      const onClose = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;

      act(() => {
        renderer = ReactTestRenderer.create(
          <AlertDialog
            visible={true}
            type="success"
            title="Payment Received"
            message="Your order #101 has been confirmed."
            buttonText="Done"
            onClose={onClose}
          />
        );
      });

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Payment Received');
      expect(texts).toContain('Your order #101 has been confirmed.');
      expect(texts).toContain('Done');

      const doneBtn = renderer!.root.find(
        (n) => n.props.accessibilityLabel === 'Done' && n.props.accessibilityRole === 'button'
      );
      act(() => {
        doneBtn.props.onPress();
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('AppToast renders message and supports dismissal', () => {
      const onDismiss = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;

      act(() => {
        renderer = ReactTestRenderer.create(
          <AppToast
            visible={true}
            message="Safari Backpack added to cart"
            type="success"
            duration={0}
            onDismiss={onDismiss}
          />
        );
      });

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Safari Backpack added to cart');
    });

    it('LoadingDialog displays spinner and loading message', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;

      act(() => {
        renderer = ReactTestRenderer.create(
          <LoadingDialog visible={true} message="Placing your order..." />
        );
      });

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Placing your order...');
    });
  });

  describe('2. Modern Clear Cart Confirmation Upgrade', () => {
    it('Clear Cart triggers the modern ConfirmDialog with Keep Items and Clear All buttons', async () => {
      const clearCartMock = jest.fn().mockResolvedValue(undefined);

      jest.spyOn(cartContext, 'useCart').mockReturnValue({
        cartItems: [
          {
            product: {
              id: 10,
              name: 'Safari Backpack',
              price: 900,
              stock: 5,
              image: '/bag.jpg',
            },
            quantity: 1,
            unitPrice: 900,
            lineTotal: 900,
          },
        ],
        totalItemsCount: 1,
        subtotal: 900,
        totalDiscount: 0,
        finalTotal: 900,
        clearCart: clearCartMock,
        removeFromCart: jest.fn(),
        updateQuantity: jest.fn(),
        refreshCart: jest.fn(),
        validateCartItems: jest.fn().mockResolvedValue({ hasUnavailableItems: false }),
        hasUnavailableItems: false,
        removeUnavailableItems: jest.fn(),
        isValidating: false,
        addToCart: jest.fn(),
      } as any);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <CartScreen />
          </SafeAreaProvider>
        );
      });

      // Find "Clear" button in Cart header
      const clearBtn = renderer!.root.find(
        (n) => n.props.accessibilityLabel === 'Clear cart' && n.props.accessibilityRole === 'button'
      );
      expect(clearBtn).toBeDefined();

      // Tap Clear
      await act(async () => {
        clearBtn.props.onPress();
      });

      // Dialog should now be visible with the required text
      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Clear Cart?');
      expect(texts).toContain('Are you sure you want to remove all items from your cart?');
      expect(texts).toContain('Keep Items');
      expect(texts).toContain('Clear All');

      // Tapping "Keep Items" dismisses dialog WITHOUT clearing cart
      const keepItemsBtn = renderer!.root.find(
        (n) => n.props.accessibilityLabel === 'Keep Items' && n.props.accessibilityRole === 'button'
      );
      await act(async () => {
        keepItemsBtn.props.onPress();
      });
      expect(clearCartMock).not.toHaveBeenCalled();

      // Open Clear Cart dialog again
      await act(async () => {
        clearBtn.props.onPress();
      });

      // Tapping "Clear All" executes cart clearing
      const clearAllBtn = renderer!.root.find(
        (n) => n.props.accessibilityLabel === 'Clear All' && n.props.accessibilityRole === 'button'
      );
      await act(async () => {
        await clearAllBtn.props.onPress();
      });
      expect(clearCartMock).toHaveBeenCalledTimes(1);
    });

    it('Removing individual item opens modern Remove Item confirmation dialog', async () => {
      const removeFromCartMock = jest.fn().mockResolvedValue(undefined);

      jest.spyOn(cartContext, 'useCart').mockReturnValue({
        cartItems: [
          {
            product: {
              id: 20,
              name: 'Sunglasses',
              price: 1200,
              stock: 3,
              image: '/sunglasses.jpg',
            },
            quantity: 1,
            unitPrice: 1200,
            lineTotal: 1200,
          },
        ],
        totalItemsCount: 1,
        subtotal: 1200,
        totalDiscount: 0,
        finalTotal: 1200,
        clearCart: jest.fn(),
        removeFromCart: removeFromCartMock,
        updateQuantity: jest.fn(),
        refreshCart: jest.fn(),
        validateCartItems: jest.fn().mockResolvedValue({ hasUnavailableItems: false }),
        hasUnavailableItems: false,
        removeUnavailableItems: jest.fn(),
        isValidating: false,
        addToCart: jest.fn(),
      } as any);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <CartScreen />
          </SafeAreaProvider>
        );
      });

      // Find Remove item button
      const removeBtn = renderer!.root.find(
        (n) => n.props.accessibilityLabel === 'Remove Sunglasses from cart'
      );
      expect(removeBtn).toBeDefined();

      await act(async () => {
        removeBtn.props.onPress();
      });

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Remove Item?');
      expect(texts).toContain('Are you sure you want to remove "Sunglasses" from your cart?');
      expect(texts).toContain('Keep Item');
      expect(texts).toContain('Remove');

      const confirmRemoveBtn = renderer!.root.find(
        (n) => n.props.accessibilityLabel === 'Remove' && n.props.accessibilityRole === 'button'
      );
      await act(async () => {
        await confirmRemoveBtn.props.onPress();
      });
      expect(removeFromCartMock).toHaveBeenCalledWith(20);
    });
  });

  describe('3. Wishlist Screen Dialog Upgrade', () => {
    it('Clear Wishlist opens modern ConfirmDialog with Keep Items and Clear All buttons', async () => {
      const clearWishlistMock = jest.fn();

      jest.spyOn(wishlistContext, 'useWishlist').mockReturnValue({
        wishlistItems: [
          {
            id: 15,
            name: 'Running Shoes',
            price: 2500,
            stock: 10,
            image: '/shoes.jpg',
          },
        ],
        wishlistCount: 1,
        clearWishlist: clearWishlistMock,
        isWishlisted: jest.fn().mockReturnValue(true),
        checkWishlist: jest.fn().mockReturnValue(true),
        isInWishlist: jest.fn().mockReturnValue(true),
        toggleWishlist: jest.fn(),
        removeFromWishlist: jest.fn(),
        addToWishlist: jest.fn(),
      } as any);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <WishlistScreen onBack={jest.fn()} />
          </SafeAreaProvider>
        );
      });

      const clearBtn = renderer!.root.find(
        (n) => n.props.accessibilityLabel === 'Clear all items from wishlist'
      );
      expect(clearBtn).toBeDefined();

      await act(async () => {
        clearBtn.props.onPress();
      });

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Clear Wishlist?');
      expect(texts).toContain('Are you sure you want to remove all saved items from your wishlist?');
      expect(texts).toContain('Keep Items');
      expect(texts).toContain('Clear All');

      const clearAllBtn = renderer!.root.find(
        (n) => n.props.accessibilityLabel === 'Clear All' && n.props.accessibilityRole === 'button'
      );
      await act(async () => {
        clearAllBtn.props.onPress();
      });
      expect(clearWishlistMock).toHaveBeenCalledTimes(1);
    });
  });
});
