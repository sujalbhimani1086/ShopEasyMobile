export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqCategory {
  category: string;
  items: FaqItem[];
}

export interface SupportMessage {
  id: number;
  ticketId: number;
  senderId?: number | null;
  senderType: 'USER' | 'AGENT' | 'SYSTEM' | string;
  senderName?: string | null;
  message: string;
  createdAt: string;
}

export interface SupportTicket {
  id: number;
  ticketNumber: string;
  subject: string;
  category: string;
  orderId?: number | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  messagesCount: number;
  lastMessage?: string | null;
  lastMessageTime?: string | null;
  messages?: SupportMessage[];
}

export interface TicketsResponse {
  tickets: SupportTicket[];
}

export interface TicketDetailResponse {
  ticket: SupportTicket;
}
