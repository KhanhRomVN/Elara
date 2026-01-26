export interface Model {
  id: string;
  name: string;
  is_thinking: boolean;
  context_length: number | null;
}

export interface Provider {
  provider_id: string;
  provider_name: string;
  is_enabled: boolean;
  website?: string;
  models?: Model[];
}

export interface FlatModel {
  model_id: string;
  model_name: string;
  provider_id: string;
  provider_name: string;
  is_enabled: boolean;
  sequence?: number;
  success_rate?: number;
  max_req_conversation?: number;
  max_token_conversation?: number;
  website?: string; // Cache website for favicon
  usage_requests?: number;
  usage_tokens?: number;
}

export interface ModelSequence {
  model_id: string;
  provider_id: string;
  sequence: number;
}

export type SortKey =
  | 'success_rate'
  | 'max_req_conversation'
  | 'max_token_conversation'
  | 'usage_requests'
  | 'usage_tokens'
  | '';
export type SortDirection = 'asc' | 'desc' | 'none';
export type StatsPeriod = 'day' | 'week' | 'month' | 'year';
