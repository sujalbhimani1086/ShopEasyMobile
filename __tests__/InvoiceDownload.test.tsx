import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { OrderDetailsScreen } from '../src/screens/OrderDetailsScreen';
import {
  isOrderEligibleForInvoice,
  generateInvoiceNumber,
  generateInvoiceHtml,
  downloadOrderInvoice,
  openInvoicePdf,
} from '../src/services/invoiceService';
import type { Order } from '../src/types/order';
import { generatePDF } from 'react-native-html-to-pdf';
import ReactNativeBlobUtil from 'react-native-blob-util';

// Mock AuthContext
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'test-customer-token',
    user: { id: 101, name: 'Sujal Customer', email: 'customer@example.com' },
  }),
}));

// Mock loading delay to resolve immediately in tests
jest.mock('../src/utils/loadingUtils', () => ({
  withRandomLoadingDuration: jest.fn((fn) => fn()),
}));

let mockCurrentOrder: Order | null = null;

// Mock API call to return the order
jest.mock('../src/services/orderApi', () => {
  const actual = jest.requireActual('../src/services/orderApi');
  return {
    ...actual,
    getOrderDetails: jest.fn(async () => mockCurrentOrder),
  };
});

describe('ShopEasy Mobile — Download PDF Invoice for Delivered and Paid Orders', () => {
  const baseOrder: Order = {
    id: 150,
    userId: 101,
    name: 'Sujal Customer',
    email: 'customer@example.com',
    address: '123 Tech Park, MG Road',
    city: 'Bangalore',
    pincode: '560001',
    subtotal: 3000,
    discount: 500,
    couponCode: 'OFFER500',
    total: 2500,
    status: 'DELIVERED',
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    paymentId: 'pay_test_online999',
    createdAt: '2026-04-10T14:20:00.000Z',
    items: [
      {
        id: 1,
        orderId: 150,
        productId: 5,
        productName: 'Ergonomic Mechanical Keyboard RGB Backlit',
        quantity: 1,
        price: 2500,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Invoice Eligibility Logic (Strict Gate)', () => {
    it('returns true when order is DELIVERED and payment is PAID', () => {
      expect(isOrderEligibleForInvoice(baseOrder)).toBe(true);
    });

    it('returns true when order is COMPLETED and payment is PAID', () => {
      const completedOrder: Order = { ...baseOrder, status: 'COMPLETED' };
      expect(isOrderEligibleForInvoice(completedOrder)).toBe(true);
    });

    it('returns true when order is DELIVERED and COD (automatically verified paid on delivery)', () => {
      const codDeliveredOrder: Order = {
        ...baseOrder,
        status: 'DELIVERED',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
      };
      expect(isOrderEligibleForInvoice(codDeliveredOrder)).toBe(true);
    });

    it('returns false when order is DELIVERED but payment is UNPAID (FAILED / PENDING on online order)', () => {
      const deliveredUnpaid: Order = {
        ...baseOrder,
        status: 'DELIVERED',
        paymentMethod: 'ONLINE',
        paymentStatus: 'PENDING',
      };
      expect(isOrderEligibleForInvoice(deliveredUnpaid)).toBe(false);

      const deliveredFailed: Order = {
        ...baseOrder,
        status: 'DELIVERED',
        paymentMethod: 'ONLINE',
        paymentStatus: 'FAILED',
      };
      expect(isOrderEligibleForInvoice(deliveredFailed)).toBe(false);
    });

    it('returns false when order is PAID but NOT delivered (SHIPPED, PACKED, CONFIRMED, PENDING)', () => {
      expect(isOrderEligibleForInvoice({ ...baseOrder, status: 'SHIPPED' })).toBe(false);
      expect(isOrderEligibleForInvoice({ ...baseOrder, status: 'PACKED' })).toBe(false);
      expect(isOrderEligibleForInvoice({ ...baseOrder, status: 'CONFIRMED' })).toBe(false);
      expect(isOrderEligibleForInvoice({ ...baseOrder, status: 'PENDING' })).toBe(false);
    });

    it('returns false when order is CANCELLED regardless of payment status', () => {
      expect(isOrderEligibleForInvoice({ ...baseOrder, status: 'CANCELLED' })).toBe(false);
    });

    it('returns false when order is null or undefined', () => {
      expect(isOrderEligibleForInvoice(null)).toBe(false);
      expect(isOrderEligibleForInvoice(undefined)).toBe(false);
    });
  });

  describe('2. OrderDetailsScreen Download Invoice Button Visibility', () => {
    it('1. Delivered + Paid order → Download Invoice button appears', async () => {
      const deliveredPaidOrder: Order = {
        ...baseOrder,
        status: 'DELIVERED',
        paymentStatus: 'PAID',
      };
      mockCurrentOrder = deliveredPaidOrder;

      let renderer: ReactTestRenderer.ReactTestRenderer | null = null;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <OrderDetailsScreen
            orderId={deliveredPaidOrder.id}
            initialOrder={deliveredPaidOrder}
            onBack={jest.fn()}
          />
        );
      });

      const buttons = renderer!.root.findAll(
        (node) =>
          node.props.accessibilityRole === 'button' &&
          node.props.accessibilityLabel === 'Download Invoice'
      );
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it('2. Delivered + Unpaid order → Download Invoice button is HIDDEN', async () => {
      const deliveredUnpaidOrder: Order = {
        ...baseOrder,
        status: 'DELIVERED',
        paymentMethod: 'ONLINE',
        paymentStatus: 'FAILED',
      };
      mockCurrentOrder = deliveredUnpaidOrder;

      let renderer: ReactTestRenderer.ReactTestRenderer | null = null;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <OrderDetailsScreen
            orderId={deliveredUnpaidOrder.id}
            initialOrder={deliveredUnpaidOrder}
            onBack={jest.fn()}
          />
        );
      });

      const buttons = renderer!.root.findAll(
        (node) =>
          node.props.accessibilityRole === 'button' &&
          node.props.accessibilityLabel === 'Download Invoice'
      );
      expect(buttons.length).toBe(0);
    });

    it('3. Paid + Not Delivered order (SHIPPED) → Download Invoice button is HIDDEN', async () => {
      const shippedPaidOrder: Order = {
        ...baseOrder,
        status: 'SHIPPED',
        paymentStatus: 'PAID',
      };
      mockCurrentOrder = shippedPaidOrder;

      let renderer: ReactTestRenderer.ReactTestRenderer | null = null;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <OrderDetailsScreen
            orderId={shippedPaidOrder.id}
            initialOrder={shippedPaidOrder}
            onBack={jest.fn()}
          />
        );
      });

      const buttons = renderer!.root.findAll(
        (node) =>
          node.props.accessibilityRole === 'button' &&
          node.props.accessibilityLabel === 'Download Invoice'
      );
      expect(buttons.length).toBe(0);
    });

    it('4. Other statuses (PENDING, CANCELLED) → Download Invoice button is HIDDEN', async () => {
      const pendingOrder: Order = {
        ...baseOrder,
        status: 'PENDING',
        paymentStatus: 'PENDING',
      };
      mockCurrentOrder = pendingOrder;

      let renderer: ReactTestRenderer.ReactTestRenderer | null = null;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <OrderDetailsScreen
            orderId={pendingOrder.id}
            initialOrder={pendingOrder}
            onBack={jest.fn()}
          />
        );
      });

      const buttons = renderer!.root.findAll(
        (node) =>
          node.props.accessibilityRole === 'button' &&
          node.props.accessibilityLabel === 'Download Invoice'
      );
      expect(buttons.length).toBe(0);
    });
  });

  describe('3. Professional PDF Invoice Content and Formatting', () => {
    it('generates a stable, unique invoice number for each order', () => {
      const invNum1 = generateInvoiceNumber(150, '2026-04-10T14:20:00.000Z');
      const invNum2 = generateInvoiceNumber(150, '2026-04-10T14:20:00.000Z');
      expect(invNum1).toBe(invNum2);
      expect(invNum1).toBe('SE-INV-2026-000150');
    });

    it('generates genuine invoice HTML with correct order, customer, pricing, and payment details in INR', () => {
      const html = generateInvoiceHtml(baseOrder);

      // Branding
      expect(html).toContain('ShopEasy');
      expect(html).toContain('TAX INVOICE');
      expect(html).toContain('DELIVERED & PAID');

      // Order & Invoice identifiers
      expect(html).toContain('SE-INV-2026-000150');
      expect(html).toContain('#150');

      // Customer and Shipping Address
      expect(html).toContain('Sujal Customer');
      expect(html).toContain('customer@example.com');
      expect(html).toContain('123 Tech Park, MG Road');
      expect(html).toContain('Bangalore - 560001');

      // Product Details
      expect(html).toContain('Ergonomic Mechanical Keyboard RGB Backlit');
      expect(html).toContain('₹2,500');

      // Payment Details
      expect(html).toContain('Online Payment (Razorpay)');
      expect(html).toContain('Verified Paid');
      expect(html).toContain('pay_test_online999');

      // Monetary Breakdown in INR
      expect(html).toContain('₹3,000'); // Subtotal
      expect(html).toContain('- ₹500');  // Discount
      expect(html).toContain('OFFER500');
      expect(html).toContain('FREE');    // Delivery
      expect(html).toContain('₹2,500'); // Grand Total
    });
  });

  describe('4. PDF Generation & Android Downloads Saving', () => {
    it('compiles PDF and saves to Android MediaStore/Downloads collection', async () => {
      const result = await downloadOrderInvoice(baseOrder);

      expect(generatePDF).toHaveBeenCalledTimes(1);
      expect(generatePDF).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: 'ShopEasy_Invoice_ORDER150',
          shouldPrintBackgrounds: true,
        })
      );

      expect(ReactNativeBlobUtil.MediaCollection.copyToMediaStore).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.fileName).toBe('ShopEasy_Invoice_ORDER150.pdf');
    });

    it('rejects downloading if order is not delivered and paid', async () => {
      const invalidOrder: Order = {
        ...baseOrder,
        status: 'SHIPPED',
        paymentStatus: 'PAID',
      };

      await expect(downloadOrderInvoice(invalidOrder)).rejects.toThrow(
        /Invoices are only available for orders that are Delivered and have Verified Payment/
      );
    });

    it('launches Android PDF action intent when opening saved invoice', async () => {
      const success = await openInvoicePdf('/mock/Downloads/ShopEasy_Invoice_ORDER150.pdf');
      expect(success).toBe(true);
      expect(ReactNativeBlobUtil.android.actionViewIntent).toHaveBeenCalledWith(
        '/mock/Downloads/ShopEasy_Invoice_ORDER150.pdf',
        'application/pdf'
      );
    });
  });
});
