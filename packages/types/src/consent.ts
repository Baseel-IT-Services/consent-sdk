export type ConsentStatus = 'granted' | 'denied';

export interface ConsentChangePayload {
  status: ConsentStatus;
  timestamp: number;
  source: 'user' | 'system';
}
