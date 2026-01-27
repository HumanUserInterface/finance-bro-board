export type Urgency = 'low' | 'medium' | 'high';

export interface PurchaseRequest {
  id: string;
  item: string;
  price: number;
  currency: string;
  category: string;
  description?: string;
  url?: string;
  urgency: Urgency;
  context?: string;
  timestamp: Date;
}

export interface PurchaseInput {
  item: string;
  price: number;
  currency?: string;
  category: string;
  description?: string;
  url?: string;
  urgency: Urgency;
  context?: string;
}
