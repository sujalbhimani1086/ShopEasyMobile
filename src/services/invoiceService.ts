import { Platform } from 'react-native';
import type { Order } from '../types/order';
import { formatPrice } from '../utils/price';
import { getOrderPaymentDisplay } from './orderApi';

/**
 * Lazy-load react-native-html-to-pdf safely without crashing at module evaluation time.
 */
function getHtmlToPdf(): any {
  try {
    const mod = require('react-native-html-to-pdf');
    return mod;
  } catch (err) {
    console.warn('react-native-html-to-pdf not available in current native build:', err);
    return null;
  }
}

/**
 * Lazy-load react-native-blob-util safely without crashing at module evaluation time.
 */
function getBlobUtil(): any {
  try {
    const mod = require('react-native-blob-util');
    return mod.default || mod;
  } catch (err) {
    console.warn('react-native-blob-util not available in current native build:', err);
    return null;
  }
}


/**
 * Validates whether an order is strictly eligible for an invoice.
 * Requirement:
 * - Order status MUST be DELIVERED (or COMPLETED).
 * - Payment status MUST be PAID (confirmed by trusted order data).
 */
export function isOrderEligibleForInvoice(order?: Order | null): boolean {
  if (!order) return false;

  const statusUpper = (order.status || '').trim().toUpperCase();
  const isDelivered = statusUpper === 'DELIVERED' || statusUpper === 'COMPLETED';

  // Check verified payment status
  const paymentDisplay = getOrderPaymentDisplay(
    order.paymentMethod,
    order.paymentStatus,
    order.status,
    order.total
  );

  const isPaid =
    (order.paymentStatus || '').trim().toUpperCase() === 'PAID' ||
    paymentDisplay.isPaid;

  return isDelivered && isPaid;
}

/**
 * Generates a stable, unique invoice number for the order.
 */
export function generateInvoiceNumber(orderId: number, createdAt?: string): string {
  let year = 2026;
  if (createdAt) {
    try {
      const parsedYear = new Date(createdAt).getFullYear();
      if (!Number.isNaN(parsedYear) && parsedYear > 2000) {
        year = parsedYear;
      }
    } catch {
      // Keep default
    }
  }
  return `SE-INV-${year}-${String(orderId).padStart(6, '0')}`;
}

/**
 * Formats a date string safely into readable format.
 */
function formatReadableDate(dateStr?: string): string {
  if (!dateStr) return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Escapes HTML characters to prevent rendering issues or injection.
 */
function escapeHtml(text?: string | null): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates a clean, professional HTML document for the invoice.
 * Adheres strictly to ShopEasy branding, INR formatting, and multi-page print compatibility.
 */
export function generateInvoiceHtml(order: Order): string {
  const invoiceNumber = generateInvoiceNumber(order.id, order.createdAt);
  const orderDate = formatReadableDate(order.createdAt);
  const invoiceDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const paymentDisplay = getOrderPaymentDisplay(
    order.paymentMethod,
    order.paymentStatus,
    order.status,
    order.total
  );

  const subtotal = order.subtotal ?? (order.total + (order.discount || 0));
  const hasDiscount = typeof order.discount === 'number' && order.discount > 0;
  const paymentMethodLabel =
    paymentDisplay.method === 'Online'
      ? 'Online Payment (Razorpay)'
      : 'Cash on Delivery (COD)';

  // Build items rows
  const itemRowsHtml = (order.items || [])
    .map((item, index) => {
      const name = escapeHtml(item.productName || item.product?.name || 'ShopEasy Product');
      const qty = item.quantity || 1;
      const unitPrice = formatPrice(item.price);
      const lineTotal = formatPrice(item.price * qty);

      return `
        <tr class="item-row">
          <td class="text-center col-num">${index + 1}</td>
          <td class="col-desc">
            <span class="product-title">${name}</span>
          </td>
          <td class="text-center col-qty">${qty}</td>
          <td class="text-right col-price">${unitPrice}</td>
          <td class="text-right col-total font-semibold">${lineTotal}</td>
        </tr>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice #${escapeHtml(invoiceNumber)}</title>
  <style>
    @page {
      size: A4;
      margin: 16mm 14mm 16mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background: #FFFFFF;
      margin: 0;
      padding: 0;
      font-size: 13px;
      line-height: 1.5;
    }
    .invoice-container {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
    }
    
    /* Header Section */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #111827;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #000000;
      margin: 0;
      text-transform: uppercase;
    }
    .brand-tagline {
      font-size: 11px;
      color: #6B7280;
      font-weight: 500;
      margin-top: 2px;
    }
    .invoice-badge-title {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
      text-align: right;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .invoice-badge-sub {
      font-size: 11px;
      color: #059669;
      font-weight: 700;
      text-align: right;
      margin-top: 2px;
      background: #ECFDF5;
      padding: 3px 8px;
      border-radius: 4px;
      display: inline-block;
    }

    /* Meta Info Grid */
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .meta-box {
      width: 50%;
      vertical-align: top;
    }
    .meta-box-right {
      width: 50%;
      vertical-align: top;
      text-align: right;
    }
    .section-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #6B7280;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }
    .meta-text-bold {
      font-size: 14px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 2px;
    }
    .meta-text {
      font-size: 12px;
      color: #374151;
      margin-bottom: 2px;
      line-height: 1.4;
    }
    
    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .items-table th {
      background-color: #F3F4F6;
      color: #1F2937;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 12px;
      border-top: 1px solid #E5E7EB;
      border-bottom: 2px solid #E5E7EB;
    }
    .item-row {
      page-break-inside: avoid;
    }
    .item-row td {
      padding: 12px;
      border-bottom: 1px solid #F3F4F6;
      font-size: 12px;
      vertical-align: middle;
    }
    .product-title {
      font-weight: 600;
      color: #111827;
      word-break: break-word;
      display: block;
    }
    .col-num { width: 6%; }
    .col-desc { width: 50%; }
    .col-qty { width: 12%; }
    .col-price { width: 16%; }
    .col-total { width: 16%; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-semibold { font-weight: 600; }

    /* Summary Section */
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 28px;
      page-break-inside: avoid;
    }
    .payment-info-col {
      width: 55%;
      vertical-align: top;
      padding-right: 20px;
    }
    .calculation-col {
      width: 45%;
      vertical-align: top;
    }
    .calc-row-table {
      width: 100%;
      border-collapse: collapse;
    }
    .calc-row-table td {
      padding: 6px 0;
      font-size: 13px;
    }
    .calc-label {
      color: #4B5563;
      text-align: left;
    }
    .calc-value {
      color: #111827;
      font-weight: 600;
      text-align: right;
    }
    .discount-label {
      color: #059669;
    }
    .discount-value {
      color: #059669;
      font-weight: 600;
      text-align: right;
    }
    .total-divider {
      border-top: 2px solid #111827;
      margin-top: 8px;
      padding-top: 8px;
    }
    .total-label {
      font-size: 15px;
      font-weight: 800;
      color: #111827;
      text-transform: uppercase;
    }
    .total-value {
      font-size: 17px;
      font-weight: 800;
      color: #111827;
      text-align: right;
    }

    .payment-box {
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 6px;
      padding: 12px 14px;
    }
    .payment-status-tag {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      background: #D1FAE5;
      color: #065F46;
      margin-top: 4px;
    }

    /* Footer */
    .footer {
      border-top: 1px solid #E5E7EB;
      padding-top: 16px;
      text-align: center;
      font-size: 11px;
      color: #6B7280;
      page-break-inside: avoid;
    }
    .footer p {
      margin: 3px 0;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td style="vertical-align: middle;">
          <h1 class="brand-title">ShopEasy</h1>
          <div class="brand-tagline">Official Store Invoice & Receipt</div>
        </td>
        <td style="vertical-align: middle; text-align: right;">
          <div class="invoice-badge-title">TAX INVOICE</div>
          <div class="invoice-badge-sub">✓ DELIVERED & PAID</div>
        </td>
      </tr>
    </table>

    <!-- Meta Details (Billed To & Order Details) -->
    <table class="meta-table">
      <tr>
        <td class="meta-box">
          <div class="section-label">Billed & Shipped To:</div>
          <div class="meta-text-bold">${escapeHtml(order.name || 'Valued Customer')}</div>
          ${order.email ? `<div class="meta-text">${escapeHtml(order.email)}</div>` : ''}
          <div class="meta-text">${escapeHtml(order.address || 'Delivery Address')}</div>
          <div class="meta-text">${escapeHtml(order.city || '')}${order.pincode ? ` - ${escapeHtml(order.pincode)}` : ''}</div>
        </td>
        <td class="meta-box-right">
          <div class="section-label">Invoice Details:</div>
          <div class="meta-text"><strong>Invoice No:</strong> ${escapeHtml(invoiceNumber)}</div>
          <div class="meta-text"><strong>Order ID:</strong> #${order.id}</div>
          <div class="meta-text"><strong>Order Date:</strong> ${escapeHtml(orderDate)}</div>
          <div class="meta-text"><strong>Invoice Date:</strong> ${escapeHtml(invoiceDate)}</div>
        </td>
      </tr>
    </table>

    <!-- Ordered Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th class="text-center col-num">#</th>
          <th class="col-desc">Item Description</th>
          <th class="text-center col-qty">Qty</th>
          <th class="text-right col-price">Unit Price</th>
          <th class="text-right col-total">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRowsHtml}
      </tbody>
    </table>

    <!-- Summary & Payment Info -->
    <table class="summary-table">
      <tr>
        <td class="payment-info-col">
          <div class="payment-box">
            <div class="section-label" style="margin-bottom: 4px;">Payment Information</div>
            <div style="font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 2px;">
              ${escapeHtml(paymentMethodLabel)}
            </div>
            <div>
              <span class="payment-status-tag">Status: Verified Paid</span>
            </div>
            ${order.paymentId ? `<div style="font-size: 11px; color: #6B7280; margin-top: 6px;">Ref: ${escapeHtml(order.paymentId)}</div>` : ''}
          </div>
        </td>
        <td class="calculation-col">
          <table class="calc-row-table">
            <tr>
              <td class="calc-label">Subtotal</td>
              <td class="calc-value">${formatPrice(subtotal)}</td>
            </tr>
            ${
              hasDiscount
                ? `
            <tr>
              <td class="calc-label discount-label">Coupon Discount ${order.couponCode ? `(${escapeHtml(order.couponCode)})` : ''}</td>
              <td class="calc-value discount-value">- ${formatPrice(order.discount)}</td>
            </tr>`
                : ''
            }
            <tr>
              <td class="calc-label">Shipping Charges</td>
              <td class="calc-value" style="color: #059669;">FREE</td>
            </tr>
            <tr class="total-divider">
              <td class="total-label">Grand Total</td>
              <td class="total-value">${formatPrice(order.total)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Footer -->
    <div class="footer">
      <p>Thank you for shopping with <strong>ShopEasy</strong>!</p>
      <p>This is a computer-generated invoice for verified delivered orders. No signature is required.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generates and downloads the PDF invoice to the Android device.
 * Respects Android Scoped Storage by using MediaCollection/Downloads.
 */
export async function downloadOrderInvoice(order: Order): Promise<{
  success: boolean;
  filePath: string;
  fileName: string;
}> {
  // Re-verify authorization criteria
  if (!isOrderEligibleForInvoice(order)) {
    throw new Error(
      'Invoices are only available for orders that are Delivered and have Verified Payment.'
    );
  }

  const fileName = `ShopEasy_Invoice_ORDER${order.id}`;
  const fullFileName = `${fileName}.pdf`;
  const html = generateInvoiceHtml(order);

  // 1. Generate the real PDF using react-native-html-to-pdf
  const htmlToPdf = getHtmlToPdf();
  if (!htmlToPdf || typeof htmlToPdf.generatePDF !== 'function') {
    throw new Error(
      'PDF generation module is not installed in the currently running application binary. Please install the updated app APK on this device to enable PDF downloads.'
    );
  }

  const pdfResult = await htmlToPdf.generatePDF({
    html,
    fileName,
    shouldPrintBackgrounds: true,
  });

  if (!pdfResult || !pdfResult.filePath) {
    throw new Error('Failed to generate PDF invoice document.');
  }

  const generatedPath = pdfResult.filePath;
  let finalSavedPath = generatedPath;

  // 2. On Android: Save to public Downloads directory
  const blobUtil = getBlobUtil();
  if (blobUtil && (Platform.OS === 'android' || blobUtil.MediaCollection)) {
    try {
      // Modern Android 10+ (API 29 to 34+ / Samsung S24): copy to MediaStore Download collection
      if (
        blobUtil.MediaCollection &&
        typeof blobUtil.MediaCollection.copyToMediaStore === 'function'
      ) {
        try {
          const mediaUri = await blobUtil.MediaCollection.copyToMediaStore(
            {
              name: fullFileName,
              parentFolder: '',
              mimeType: 'application/pdf',
            },
            'Download',
            generatedPath
          );
          if (mediaUri) {
            finalSavedPath = mediaUri;
          }
        } catch (mediaError) {
          console.warn('copyToMediaStore failed, falling back to direct DownloadDir:', mediaError);
        }
      }

      // Also ensure it is physically copied to DownloadDir if reachable
      const downloadDir = blobUtil.fs?.dirs?.DownloadDir;
      if (downloadDir) {
        const destPath = `${downloadDir}/${fullFileName}`;
        try {
          await blobUtil.fs.cp(generatedPath, destPath);
          finalSavedPath = destPath;

          // Notify Media Scanner so the file immediately appears in the Downloads app
          if (
            blobUtil.fs?.scanFile &&
            typeof blobUtil.fs.scanFile === 'function'
          ) {
            await blobUtil.fs.scanFile([
              { path: destPath, mime: 'application/pdf' },
            ]);
          }
        } catch (cpError) {
          console.warn('Copy to DownloadDir failed, keeping generatedPath:', cpError);
        }
      }
    } catch (androidSaveError: any) {
      console.warn('Android storage copy warning:', androidSaveError);
    }
  }

  return {
    success: true,
    filePath: finalSavedPath,
    fileName: fullFileName,
  };
}

/**
 * Opens the saved PDF file in the system default or chosen PDF viewer.
 */
export async function openInvoicePdf(filePath: string): Promise<boolean> {
  if (!filePath) {
    throw new Error('Invoice file path is missing.');
  }

  const blobUtil = getBlobUtil();
  if (blobUtil && blobUtil.android) {
    try {
      await blobUtil.android.actionViewIntent(
        filePath,
        'application/pdf'
      );
      return true;
    } catch (err: any) {
      console.error('Error opening PDF with actionViewIntent:', err);
      throw new Error(err?.message || 'Could not launch PDF viewer.');
    }
  }

  return false;
}
