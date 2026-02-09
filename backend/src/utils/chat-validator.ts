import { Request, Response, NextFunction } from 'express';
import { ChatRequest } from '../types';
import fetch from 'node-fetch';

let providersCache: any[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const fetchProviders = async () => {
  const now = Date.now();
  if (providersCache && now - lastFetchTime < CACHE_TTL) {
    return providersCache;
  }

  try {
    // Determine source: local file or remote?
    // User mentioned "https://raw.githubusercontent.com/KhanhRomVN/Elara/main/provider.json"
    // But we also have a local provider.json. Using remote as requested.
    const res = await fetch(
      'https://raw.githubusercontent.com/KhanhRomVN/Elara/main/provider.json',
    );
    if (res.ok) {
      providersCache = await res.json();
      lastFetchTime = now;
    }
  } catch (error) {
    console.error('Failed to fetch providers for validation:', error);
    // Fallback to empty or keep old cache
  }
  return providersCache || [];
};

export const validateChatRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const body = req.body as ChatRequest;
  const { modelId, search } = body;

  // Account/Provider resolution is tricky here because it usually happens inside the controller strategies.
  // However, we can try to infer provider from model or query params like the controller does,
  // OR we can move this validation INSIDE the controller after account resolution.
  // Given the complexity of account resolution (4 strategies), it is safer to perform validation
  // *inside* the controller or as a distinct step *after* determining the account.

  // But strictly speaking, if we want to validate *request structure* (types), we can do it here.
  // If we want to validate *permissions* (search allowed?), we need the provider.

  // Let's implement a "pre-validation" for structure, and a helper function for permission validation
  // that can be called inside the controller.

  // For now, let's just export the helper.
  next();
};

export const validateProviderCapabilities = async (
  providerId: string,
  features: { search?: boolean },
) => {
  const providers = await fetchProviders();
  const providerConfig = providers.find(
    (p: any) => p.provider_id.toLowerCase() === providerId.toLowerCase(),
  );

  if (!providerConfig) return null; // Provider detection failed or config missing?

  if (features.search && providerConfig.is_search === false) {
    return `Provider '${providerConfig.provider_name}' does not support search.`;
  }

  return null; // OK
};
