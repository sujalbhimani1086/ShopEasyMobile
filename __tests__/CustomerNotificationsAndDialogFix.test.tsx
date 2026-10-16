import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme/theme';
import { NotificationsScreen } from '../src/screens/NotificationsScreen';
import { Header } from '../src/components/Header';
import { ConfirmDialog } from '../src/components/dialogs/ConfirmDialog';
import { queryKeys } from '../src/config/queryKeys';
import type { NotificationItem } from '../src/types/notification';
import * as notificationApi from '../src/services/notificationApi';

// Mock Auth
let mockUser: any = { id: 1, name: 'Customer Test', email: 'customer@shopeasy.com', role: 'CUSTOMER' };
let mockToken: string | null = 'valid-customer-token';

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    token: mockToken,
    logout: jest.fn(),
  }),
}));

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function renderWithClient(ui: React.ReactElement, client = createTestQueryClient()) {
  return ReactTestRenderer.create(
    <QueryClientProvider client={client}>
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <ThemeProvider initialMode="light">
          {ui}
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

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

describe('ShopEasyMobile — Customer Notifications & Add-to-Cart Dialog Suite', () => {
  beforeEach(() => {
    mockUser = { id: 1, name: 'Customer Test', email: 'customer@shopeasy.com', role: 'CUSTOMER' };
    mockToken = 'valid-customer-token';
    jest.clearAllMocks();
  });

  describe('Task 1: Customer Notifications and Badge Count', () => {
    const mockNotificationsList: NotificationItem[] = [
      {
        id: 101,
        userId: 1,
        title: 'Order Placed Successfully',
        message: 'Your order #8821 has been placed.',
        type: 'ORDER',
        data: JSON.stringify({ orderId: 8821 }),
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 102,
        userId: 1,
        title: 'Flash Sale 50% Off',
        message: 'Get ready for our big electronics sale.',
        type: 'PROMO',
        data: null,
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 103,
        userId: 1,
        title: 'Welcome to ShopEasy',
        message: 'Thank you for signing up with ShopEasy.',
        type: 'ACCOUNT',
        data: null,
        isRead: true,
        createdAt: new Date().toISOString(),
      },
    ];

    it('1. Loads and renders notification items when API returns data', async () => {
      jest.spyOn(notificationApi, 'getNotifications').mockResolvedValue({
        notifications: mockNotificationsList,
        unreadCount: 2,
      });

      const queryClient = createTestQueryClient();
      await queryClient.prefetchQuery({
        queryKey: queryKeys.notifications(1),
        queryFn: () => notificationApi.getNotifications('valid-customer-token'),
      });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithClient(<NotificationsScreen onBack={jest.fn()} />, queryClient);
      });

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Order Placed Successfully');
      expect(texts).toContain('Flash Sale 50% Off');
      expect(texts).toContain('Welcome to ShopEasy');
      expect(texts).toContain('Mark all read');
    });

    it('2. Shows empty state ("No notifications yet") only after successful empty response', async () => {
      jest.spyOn(notificationApi, 'getNotifications').mockResolvedValue({
        notifications: [],
        unreadCount: 0,
      });

      const queryClient = createTestQueryClient();
      await queryClient.prefetchQuery({
        queryKey: queryKeys.notifications(1),
        queryFn: () => notificationApi.getNotifications('valid-customer-token'),
      });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithClient(<NotificationsScreen onBack={jest.fn()} />, queryClient);
      });

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('No notifications yet');
      expect(texts).not.toContain('Loading notifications...');
    });

    it('3. Does NOT show "No notifications yet" during loading', async () => {
      jest.spyOn(notificationApi, 'getNotifications').mockReturnValue(new Promise(() => {}));

      const queryClient = createTestQueryClient();
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithClient(<NotificationsScreen onBack={jest.fn()} />, queryClient);
      });

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Loading notifications...');
      expect(texts).not.toContain('No notifications yet');
    });

    it('4. Displays error state with retry on initial fetch failure', async () => {
      jest.spyOn(notificationApi, 'getNotifications').mockRejectedValue(new Error('Network connection timeout'));

      const queryClient = createTestQueryClient();
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithClient(<NotificationsScreen onBack={jest.fn()} />, queryClient);
      });
      await act(async () => {
        await new Promise((r) => setTimeout(() => r(null), 60));
      });

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Network connection timeout');
      expect(texts).not.toContain('No notifications yet');
    });

    it('5. Prompts unauthenticated customer to sign in instead of showing empty notifications', async () => {
      mockUser = null;
      mockToken = null;

      const onNavigateToLogin = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = renderWithClient(
          <NotificationsScreen onBack={jest.fn()} onNavigateToLogin={onNavigateToLogin} />
        );
      });

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Sign in to view notifications');
      expect(texts).toContain('Sign In');
    });

    it('6. Header notification badge reflects authoritative unread count and hides when 0', () => {
      let rendererWithBadge: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        rendererWithBadge = ReactTestRenderer.create(
          <Header
            isLoggedIn={true}
            notificationCount={5}
            onNotificationsPress={jest.fn()}
          />
        );
      });
      let texts = extractAllStrings(rendererWithBadge!.root);
      expect(texts).toContain('5');

      // Hide badge when 0
      let rendererZero: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        rendererZero = ReactTestRenderer.create(
          <Header
            isLoggedIn={true}
            notificationCount={0}
            onNotificationsPress={jest.fn()}
          />
        );
      });
      texts = extractAllStrings(rendererZero!.root);
      expect(texts).not.toContain('0');

      // Hide badge when user is logged out even if count > 0
      let rendererLoggedOut: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        rendererLoggedOut = ReactTestRenderer.create(
          <Header
            isLoggedIn={false}
            notificationCount={3}
            onNotificationsPress={jest.fn()}
          />
        );
      });
      texts = extractAllStrings(rendererLoggedOut!.root);
      expect(texts).not.toContain('3');
    });

    it('7. Header notification badge displays "99+" for large counts cleanly', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <Header
            isLoggedIn={true}
            notificationCount={120}
            onNotificationsPress={jest.fn()}
          />
        );
      });
      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('99+');
    });

    it('8. Marking notification as read updates unread count and triggers API', async () => {
      jest.spyOn(notificationApi, 'getNotifications').mockResolvedValue({
        notifications: mockNotificationsList,
        unreadCount: 2,
      });
      const markSpy = jest.spyOn(notificationApi, 'markNotificationRead').mockResolvedValue();

      const onUnreadCountChange = jest.fn();
      const queryClient = createTestQueryClient();
      await queryClient.prefetchQuery({
        queryKey: queryKeys.notifications(1),
        queryFn: () => notificationApi.getNotifications('valid-customer-token'),
      });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithClient(
          <NotificationsScreen onBack={jest.fn()} onUnreadCountChange={onUnreadCountChange} />,
          queryClient
        );
      });

      // Tap unread notification item #101
      const notifItem = renderer!.root.find(
        (node) => node.props.accessibilityLabel === 'Notification: Order Placed Successfully' && node.props.accessibilityRole === 'button'
      );
      await act(async () => {
        notifItem.props.onPress();
      });

      expect(markSpy).toHaveBeenCalledWith(101, 'valid-customer-token');
      expect(onUnreadCountChange).toHaveBeenCalledWith(1);
    });

    it('9. Reverts optimistic update if markNotificationRead fails on server', async () => {
      jest.spyOn(notificationApi, 'getNotifications').mockResolvedValue({
        notifications: mockNotificationsList,
        unreadCount: 2,
      });
      jest.spyOn(notificationApi, 'markNotificationRead').mockRejectedValue(new Error('Server error 500'));

      const onUnreadCountChange = jest.fn();
      const queryClient = createTestQueryClient();
      await queryClient.prefetchQuery({
        queryKey: queryKeys.notifications(1),
        queryFn: () => notificationApi.getNotifications('valid-customer-token'),
      });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithClient(
          <NotificationsScreen onBack={jest.fn()} onUnreadCountChange={onUnreadCountChange} />,
          queryClient
        );
      });

      const notifItem = renderer!.root.find(
        (node) => node.props.accessibilityLabel === 'Notification: Order Placed Successfully' && node.props.accessibilityRole === 'button'
      );
      await act(async () => {
        await notifItem.props.onPress();
      });

      // Restores unread count to 2 after failure
      expect(onUnreadCountChange).toHaveBeenLastCalledWith(2);
    });

    it('10. Mark all as read marks all items read and sets unread count to 0', async () => {
      jest.spyOn(notificationApi, 'getNotifications').mockResolvedValue({
        notifications: mockNotificationsList,
        unreadCount: 2,
      });
      const markAllSpy = jest.spyOn(notificationApi, 'markAllNotificationsRead').mockResolvedValue();

      const onUnreadCountChange = jest.fn();
      const queryClient = createTestQueryClient();
      await queryClient.prefetchQuery({
        queryKey: queryKeys.notifications(1),
        queryFn: () => notificationApi.getNotifications('valid-customer-token'),
      });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithClient(
          <NotificationsScreen onBack={jest.fn()} onUnreadCountChange={onUnreadCountChange} />,
          queryClient
        );
      });

      const markAllBtn = renderer!.root.find(
        (node) => node.props.accessibilityLabel === 'Mark all as read' && node.props.accessibilityRole === 'button'
      );
      await act(async () => {
        markAllBtn.props.onPress();
      });

      expect(markAllSpy).toHaveBeenCalledWith('valid-customer-token');
      expect(onUnreadCountChange).toHaveBeenCalledWith(0);
    });

    it('11. Order notification deep-linking works with onOrderPress', async () => {
      jest.spyOn(notificationApi, 'getNotifications').mockResolvedValue({
        notifications: mockNotificationsList,
        unreadCount: 2,
      });
      jest.spyOn(notificationApi, 'markNotificationRead').mockResolvedValue();

      const onOrderPress = jest.fn();
      const queryClient = createTestQueryClient();
      await queryClient.prefetchQuery({
        queryKey: queryKeys.notifications(1),
        queryFn: () => notificationApi.getNotifications('valid-customer-token'),
      });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = renderWithClient(
          <NotificationsScreen onBack={jest.fn()} onOrderPress={onOrderPress} />,
          queryClient
        );
      });

      const notifItem = renderer!.root.find(
        (node) => node.props.accessibilityLabel === 'Notification: Order Placed Successfully' && node.props.accessibilityRole === 'button'
      );
      await act(async () => {
        notifItem.props.onPress();
      });

      expect(onOrderPress).toHaveBeenCalledWith(8821);
    });
  });

  describe('Task 2: Add-to-Cart Dialog Button Text', () => {
    it('12. Renders "Continue Shopping" and "View Cart" fully without numberOfLines={1} truncation', () => {
      const onCancel = jest.fn();
      const onConfirm = jest.fn();

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <ConfirmDialog
            visible={true}
            title="Added to Cart!"
            message='"Noise Cancelling Headphones" has been added to your shopping cart.'
            cancelText="Continue Shopping"
            confirmText="View Cart"
            isDestructive={false}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        );
      });

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Added to Cart!');
      expect(texts).toContain('Continue Shopping');
      expect(texts).toContain('View Cart');

      // Verify Text components do NOT have numberOfLines={1} set
      const textNodes = renderer!.root.findAllByType(Text);
      const continueShoppingNode = textNodes.find((n) => {
        const c = n.props.children;
        return c === 'Continue Shopping' || (Array.isArray(c) && c.join('') === 'Continue Shopping');
      });
      expect(continueShoppingNode).toBeDefined();
      expect(continueShoppingNode!.props.numberOfLines).toBeUndefined();

      const viewCartNode = textNodes.find((n) => {
        const c = n.props.children;
        return c === 'View Cart' || (Array.isArray(c) && c.join('') === 'View Cart');
      });
      expect(viewCartNode).toBeDefined();
      expect(viewCartNode!.props.numberOfLines).toBeUndefined();
    });

    it('13. Supports vertical column layout for narrow viewports', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <ConfirmDialog
            visible={true}
            title="Added to Cart!"
            message="Item added."
            cancelText="Continue Shopping"
            confirmText="View Cart"
            buttonLayout="column"
            isDestructive={false}
            onCancel={jest.fn()}
            onConfirm={jest.fn()}
          />
        );
      });

      const texts = extractAllStrings(renderer!.root);
      expect(texts).toContain('Continue Shopping');
      expect(texts).toContain('View Cart');

      const continueBtn = renderer!.root.find(
        (n) => n.props.accessibilityLabel === 'Continue Shopping' && n.props.accessibilityRole === 'button'
      );
      const viewCartBtn = renderer!.root.find(
        (n) => n.props.accessibilityLabel === 'View Cart' && n.props.accessibilityRole === 'button'
      );
      expect(continueBtn).toBeDefined();
      expect(viewCartBtn).toBeDefined();
    });

    it('14. "Continue Shopping" invokes onCancel to dismiss dialog and stay on screen', async () => {
      const onCancel = jest.fn();
      const onConfirm = jest.fn();

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <ConfirmDialog
            visible={true}
            title="Added to Cart!"
            message="Item added."
            cancelText="Continue Shopping"
            confirmText="View Cart"
            isDestructive={false}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        );
      });

      const continueBtn = renderer!.root.find(
        (n) => n.props.accessibilityLabel === 'Continue Shopping' && n.props.accessibilityRole === 'button'
      );
      await act(async () => {
        continueBtn.props.onPress();
      });

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('15. "View Cart" invokes onConfirm to navigate to Cart screen', async () => {
      const onCancel = jest.fn();
      const onConfirm = jest.fn();

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <ConfirmDialog
            visible={true}
            title="Added to Cart!"
            message="Item added."
            cancelText="Continue Shopping"
            confirmText="View Cart"
            isDestructive={false}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        );
      });

      const viewCartBtn = renderer!.root.find(
        (n) => n.props.accessibilityLabel === 'View Cart' && n.props.accessibilityRole === 'button'
      );
      await act(async () => {
        await viewCartBtn.props.onPress();
      });

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    });
  });
});
