import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, Pressable, ScrollView, Modal, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../src/theme/theme';
import { AdminOrdersView } from '../src/screens/admin/AdminOrdersView';
import type { AdminOrder } from '../src/types/admin';
import * as adminApi from '../src/services/adminApi';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderWithTheme(ui: React.ReactElement, isDark = false) {
  return ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ThemeProvider initialMode={isDark ? 'dark' : 'light'}>
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// Mock FeedbackContext
const mockFeedback = {
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
  showConfirm: jest.fn(),
  alert: jest.fn(),
};

jest.mock('../src/context/FeedbackContext', () => ({
  useFeedback: () => mockFeedback,
}));

// Mock API
jest.mock('../src/services/adminApi', () => ({
  getAdminOrders: jest.fn(),
  updateAdminOrderStatus: jest.fn(),
  deleteAdminOrder: jest.fn(),
}));

jest.mock('../src/utils/loadingUtils', () => ({
  withRandomLoadingDuration: (fn: any) => fn(),
  getRandomLoadingDuration: () => 0,
}));

const mockOrders: AdminOrder[] = [
  {
    id: 501,
    name: 'Arun Kumar',
    email: 'arun@example.com',
    user: {
      id: 10,
      name: 'Arun Kumar',
      email: 'arun@example.com',
    },
    address: '123 Tech Park, Whitefield',
    city: 'Bengaluru',
    pincode: '560066',
    status: 'CONFIRMED',
    total: 53498,
    subtotal: 53498,
    discount: 0,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    createdAt: new Date('2026-10-14T10:00:00Z').toISOString(),
    items: [
      {
        id: 1,
        productId: 101,
        quantity: 1,
        price: 49999,
        productName: 'PlayStation 5 Console',
        productImage: 'https://images.unsplash.com/ps5.jpg',
        product: {
          id: 101,
          name: 'PlayStation 5 Console',
          image: 'https://images.unsplash.com/ps5.jpg',
          price: 49999,
        },
      },
      {
        id: 2,
        productId: 102,
        quantity: 1,
        price: 3499,
        productName: 'DualSense Wireless Controller',
        productImage: 'https://images.unsplash.com/controller.jpg',
        product: {
          id: 102,
          name: 'DualSense Wireless Controller',
          image: 'https://images.unsplash.com/controller.jpg',
          price: 3499,
        },
      },
    ],
  },
];

describe('Admin Side → Orders → Order Details Modal Layout & Fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (adminApi.getAdminOrders as jest.Mock).mockResolvedValue(mockOrders);
  });

  it('1. Renders order details modal with fixed header, scrollable body, and fixed footer actions', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderWithTheme(<AdminOrdersView token="test-admin-token" />, false);
    });

    // Open order details modal for order 501
    const orderCard = renderer!.root.findByProps({ testID: 'order-card-501' });
    expect(orderCard).toBeDefined();

    await act(async () => {
      orderCard.props.onPress();
    });

    // Find the visible Order Details Modal
    const modal = renderer!.root
      .findAllByType(Modal)
      .find((m) => m.props.visible === true);
    expect(modal).toBeDefined();

    // Verify ScrollView exists inside the modal for content scrolling
    const scrollViews = modal!.findAllByType(ScrollView);
    expect(scrollViews.length).toBe(1);
    const scrollView = scrollViews[0];

    // ScrollView must have nestedScrollEnabled and vertical scrolling indicator
    expect(scrollView.props.nestedScrollEnabled).toBe(true);
    expect(scrollView.props.showsVerticalScrollIndicator).toBe(true);

    // Verify that the action buttons row is OUTSIDE the ScrollView (not a child of ScrollView)
    const scrollViewTextChildren = scrollView.findAllByType(Text).map((t) =>
      Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children)
    );
    expect(scrollViewTextChildren).not.toContain('Delete Order Record');
    expect(scrollViewTextChildren).not.toContain('Done');

    // Both action buttons exist in the modal root
    const deleteBtn = modal!.find(
      (node) =>
        node.props.accessibilityRole === 'button' &&
        node.props.accessibilityLabel === 'Delete Order Record'
    );
    expect(deleteBtn).toBeDefined();

    const doneBtn = modal!.find(
      (node) =>
        node.props.accessibilityRole === 'button' &&
        node.props.accessibilityLabel === 'Done'
    );
    expect(doneBtn).toBeDefined();
  });

  it('2. Preserves all order information inside the modal', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderWithTheme(<AdminOrdersView token="test-admin-token" />, false);
    });

    const orderCard = renderer!.root.findByProps({ testID: 'order-card-501' });
    await act(async () => {
      orderCard.props.onPress();
    });

    const modal = renderer!.root
      .findAllByType(Modal)
      .find((m) => m.props.visible === true);
    expect(modal).toBeDefined();

    const allTexts = modal!.findAllByType(Text).map((t) =>
      Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children)
    );

    // Header info
    expect(allTexts).toContain('Order #501');

    // Customer & shipping
    expect(allTexts).toContain('Arun Kumar');
    expect(allTexts).toContain('arun@example.com');
    expect(allTexts.some((t) => t.includes('123 Tech Park'))).toBe(true);

    // Products breakdown
    expect(allTexts).toContain('PlayStation 5 Console');
    expect(allTexts).toContain('DualSense Wireless Controller');

    // Financial & Payment
    expect(allTexts).toContain('Financial Summary');
    expect(allTexts.some((t) => t.includes('53,498'))).toBe(true);
    expect(allTexts).toContain('PAID');
    expect(allTexts).toContain('RAZORPAY');

    // Actions
    expect(allTexts).toContain('Delete Order Record');
    expect(allTexts).toContain('Done');
    expect(allTexts).toContain('Change Status');
  });

  it('3. Done button closes the modal cleanly', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderWithTheme(<AdminOrdersView token="test-admin-token" />, false);
    });

    const orderCard = renderer!.root.findByProps({ testID: 'order-card-501' });
    await act(async () => {
      orderCard.props.onPress();
    });

    let modal = renderer!.root.findAllByType(Modal).find((m) => m.props.visible === true);
    expect(modal).toBeDefined();

    const doneBtn = modal!.find(
      (node) =>
        node.props.accessibilityRole === 'button' &&
        node.props.accessibilityLabel === 'Done'
    );

    await act(async () => {
      doneBtn.props.onPress();
    });

    // Modal is closed
    const openModals = renderer!.root
      .findAllByType(Modal)
      .filter((m) => m.props.visible === true);
    expect(openModals.length).toBe(0);
  });

  it('4. Delete Order Record triggers confirmation dialog', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderWithTheme(<AdminOrdersView token="test-admin-token" />, false);
    });

    const orderCard = renderer!.root.findByProps({ testID: 'order-card-501' });
    await act(async () => {
      orderCard.props.onPress();
    });

    const modal = renderer!.root.findAllByType(Modal).find((m) => m.props.visible === true);
    const deleteBtn = modal!.find(
      (node) =>
        node.props.accessibilityRole === 'button' &&
        node.props.accessibilityLabel === 'Delete Order Record'
    );

    await act(async () => {
      deleteBtn.props.onPress();
    });

    expect(mockFeedback.showConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete Order Record',
        confirmText: 'Delete',
        isDestructive: true,
      })
    );
  });

  it('5. Renders without regressions in Dark Mode', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = renderWithTheme(<AdminOrdersView token="test-admin-token" />, true);
    });

    const orderCard = renderer!.root.findByProps({ testID: 'order-card-501' });
    await act(async () => {
      orderCard.props.onPress();
    });

    const modal = renderer!.root.findAllByType(Modal).find((m) => m.props.visible === true);
    expect(modal).toBeDefined();

    const deleteBtn = modal!.find(
      (node) =>
        node.props.accessibilityRole === 'button' &&
        node.props.accessibilityLabel === 'Delete Order Record'
    );
    expect(deleteBtn).toBeDefined();

    const doneBtn = modal!.find(
      (node) =>
        node.props.accessibilityRole === 'button' &&
        node.props.accessibilityLabel === 'Done'
    );
    expect(doneBtn).toBeDefined();
  });
});
