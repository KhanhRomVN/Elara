export interface OpenCodeConfig {
  plugin?: string[];
  provider?: {
    anthropic?: {
      baseURL?: string;
      apiKey?: string;
      [key: string]: any;
    };
    openai?: {
      baseURL?: string;
      apiKey?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}
