export interface TrackingTimelineStage {
  stageKey: string;
  title: string;
  description: string;
  timestamp?: string | null;
  isCompleted: boolean;
  isCurrent: boolean;
}

export interface TrackingEvent {
  id: number;
  orderId: number;
  status: string;
  title: string;
  description?: string | null;
  location?: string | null;
  timestamp: string;
}

export interface OrderTrackingResponse {
  orderId: number;
  orderNumber: string;
  status: string;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  orderDate: string;
  estimatedDeliveryDate: string;
  currentStageIndex: number;
  isCancelled: boolean;
  shippingAddress: {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    pincode?: string | null;
  };
  items: {
    id: number;
    productName: string;
    productImage?: string | null;
    quantity: number;
    price: number;
  }[];
  trackingEvents: TrackingEvent[];
  timeline: TrackingTimelineStage[];
}
