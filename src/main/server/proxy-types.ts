export interface ProxyHandler {
  onRequest?: (ctx: any, callback: any) => void | Promise<void>;
  onRequestData?: (ctx: any, chunk: Buffer, callback: any) => void | Promise<void>;
  onResponse?: (ctx: any, callback: any) => void | Promise<void>; // Basic response headers check
  onResponseBody?: (ctx: any, body: string) => void | Promise<void>; // Processed body
}
