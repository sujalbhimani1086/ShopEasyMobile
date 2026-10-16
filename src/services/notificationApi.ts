import { API_ENDPOINTS } from '../config/api';
import { fetchWithFallback } from './api';
import type { NotificationsResponse } from '../types/notification';

function buildAuthHeaders(token: string) {
  const clean = token.trim();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Cookie: `token=${clean}`,
    Authorization: `Bearer ${clean}`,
  };
}

export async function getNotifications(
  token: string,
  limit = 50
): Promise<NotificationsResponse> {
  if (!token) return { notifications: [], unreadCount: 0 };

  const res = await fetchWithFallback(API_ENDPOINTS.notifications(limit), {
    method: 'GET',
    headers: buildAuthHeaders(token),
  });

  if (!res.ok) {
    throw new Error(`Failed to load notifications: HTTP ${res.status}`);
  }

  const data = await res.json();
  const rawList = Array.isArray(data?.notifications) ? data.notifications : [];
  const uniqueList = rawList.filter(
    (item: any, index: number, self: any[]) => index === self.findIndex((t) => t.id === item.id)
  );

  const count =
    typeof data?.unreadCount === 'number' && Number.isFinite(data.unreadCount)
      ? Math.max(0, data.unreadCount)
      : uniqueList.filter((n: any) => !n.isRead).length;

  return {
    notifications: uniqueList,
    unreadCount: count,
  };
}

export async function markNotificationRead(id: number, token: string): Promise<void> {
  if (!token) return;

  const res = await fetchWithFallback(API_ENDPOINTS.notificationRead(id), {
    method: 'PATCH',
    headers: buildAuthHeaders(token),
  });

  if (!res.ok) {
    throw new Error(`Failed to mark notification as read: HTTP ${res.status}`);
  }
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  if (!token) return;

  const res = await fetchWithFallback(API_ENDPOINTS.notificationsReadAll, {
    method: 'PATCH',
    headers: buildAuthHeaders(token),
  });

  if (!res.ok) {
    throw new Error(`Failed to mark all notifications as read: HTTP ${res.status}`);
  }
}

export async function dismissNotification(id: number, token: string): Promise<void> {
  if (!token) return;

  const res = await fetchWithFallback(API_ENDPOINTS.dismissNotification(id), {
    method: 'DELETE',
    headers: buildAuthHeaders(token),
  });

  if (!res.ok) {
    throw new Error(`Failed to dismiss notification: HTTP ${res.status}`);
  }
}

export async function registerPushToken(
  token: string,
  deviceToken: string,
  platform = 'android'
): Promise<void> {
  if (!token || !deviceToken) return;

  try {
    await fetchWithFallback(API_ENDPOINTS.registerPushToken, {
      method: 'POST',
      headers: buildAuthHeaders(token),
      body: JSON.stringify({ token: deviceToken, platform }),
    });
  } catch (err) {
    console.warn('Could not register push token:', err);
  }
}
