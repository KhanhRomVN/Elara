export interface Account {
  id: string;
  provider_id: string;
  email: string;
  credential: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface AccountStats {
  id: string;
  email: string;
  provider_id: string;
  total_requests: number;
  successful_requests: number;
  total_tokens: number;
}

export interface FlatAccount extends Account {
  total_requests?: number;
  successful_requests?: number;
  total_tokens?: number;
  max_req_conversation?: number;
  max_token_conversation?: number;
  isActive?: boolean;
}
