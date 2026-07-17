export interface SubscriberTable {
  chat_id: string;
  active: number;
  language: string | null;
  created_at: string;
  updated_at: string;
}

export interface GiveawayTable {
  id: string;
  store: string;
  external_id: string;
  title: string;
  url: string;
  image_url: string | null;
  image_urls: string | null;
  description: string | null;
  description_en: string | null;
  description_ru: string | null;
  original_price: number | null;
  currency: string | null;
  starts_at: string | null;
  ends_at: string | null;
  kind: string;
  first_seen_at: string;
  last_checked_at: string;
  active: number;
  notification_eligible: number;
}

export interface DeliveryTable {
  id: string;
  giveaway_id: string;
  chat_id: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at: string | null;
  attempts: number;
  last_error: string | null;
}

export interface AppStateTable {
  key: string;
  value: string;
  updated_at: string;
}

export interface DatabaseSchema {
  subscribers: SubscriberTable;
  giveaways: GiveawayTable;
  deliveries: DeliveryTable;
  app_state: AppStateTable;
}
