export interface NotificationItem {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: 'ORDER' | 'PAYMENT' | 'PROMO' | 'SUPPORT' | string;
  data?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}
