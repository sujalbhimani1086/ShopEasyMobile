import { API_ENDPOINTS } from '../config/api';
import { fetchWithFallback } from './api';
import type {
  FaqCategory,
  SupportTicket,
  SupportMessage,
} from '../types/support';

function buildAuthHeaders(token: string) {
  const clean = token.trim();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Cookie: `token=${clean}`,
    Authorization: `Bearer ${clean}`,
  };
}

export async function getFaqs(): Promise<FaqCategory[]> {
  try {
    const res = await fetchWithFallback(API_ENDPOINTS.supportFaqs, {
      method: 'GET',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.faqs) ? data.faqs : [];
  } catch {
    return [];
  }
}

export async function getSupportTickets(token: string): Promise<SupportTicket[]> {
  if (!token) throw new Error('Authentication required.');

  const res = await fetchWithFallback(API_ENDPOINTS.supportTickets, {
    method: 'GET',
    headers: buildAuthHeaders(token),
  });

  if (!res.ok) {
    throw new Error(`Failed to load tickets: HTTP ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data?.tickets) ? data.tickets : [];
}

export async function createSupportTicket(
  payload: {
    subject: string;
    category: string;
    message: string;
    orderId?: number | null;
  },
  token: string
): Promise<SupportTicket> {
  if (!token) throw new Error('Authentication required.');

  const res = await fetchWithFallback(API_ENDPOINTS.supportTickets, {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || 'Could not create support ticket.');
  }

  return data.ticket;
}

export async function getTicketDetails(
  ticketId: number,
  token: string
): Promise<SupportTicket> {
  if (!token) throw new Error('Authentication required.');

  const res = await fetchWithFallback(API_ENDPOINTS.supportTicket(ticketId), {
    method: 'GET',
    headers: buildAuthHeaders(token),
  });

  if (!res.ok) {
    throw new Error(`Failed to load ticket details: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.ticket;
}

export async function sendTicketMessage(
  ticketId: number,
  message: string,
  token: string
): Promise<SupportMessage> {
  if (!token) throw new Error('Authentication required.');

  const res = await fetchWithFallback(API_ENDPOINTS.supportTicketMessages(ticketId), {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body: JSON.stringify({ message }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || 'Could not send message.');
  }

  return data.supportMessage;
}
