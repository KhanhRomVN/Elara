import { getApiBaseUrl } from '../utils/apiUrl';

/**
 * Provider Configuration
 *
 * This module provides provider data fetching and caching.
 * Provider data is sourced from the /v1/providers API.
 * Icons are fetched as favicons from provider websites.
 */

export interface ProviderRoutes {
  is_search?: boolean;
  is_upload?: boolean;
}

export interface ProviderConfig {
  id: string;
  provider_id: string;
  name: string;
  provider_name: string;
  icon: string;
  active: boolean;
  website?: string;
  is_search?: boolean;
  is_upload?: boolean;
  is_enabled?: boolean;
  auth_methods?: string[];
  detail_fetch_required?: boolean;
  color?: string;
  conflict_search_with_upload?: boolean;
  is_temperature?: boolean;
}

// Cache for provider data
let cachedProviders: ProviderConfig[] | null = null;

/**
 * Get favicon URL from a website URL
 * Uses Google's favicon service for reliability
 */
export function getFaviconUrl(websiteUrl?: string): string {
  if (!websiteUrl) {
    return 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
  }

  try {
    const url = new URL(websiteUrl);
    // Use Google's favicon service which is more reliable
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
  } catch {
    return 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
  }
}

/**
 * Fetch providers from API
 */
export async function fetchProviders(port: number = 11434): Promise<ProviderConfig[]> {
  try {
    const baseUrl = getApiBaseUrl(port);
    const res = await fetch(`${baseUrl}/v1/providers`);
    if (!res.ok) {
      console.error('[providers] Failed to fetch providers:', res.status);
      return cachedProviders || [];
    }

    const data = await res.json();
    // API returns raw array of providers
    const apiProviders = Array.isArray(data) ? data : data.data || [];

    // Transform API response to ProviderConfig format
    cachedProviders = apiProviders.map((p: any) => {
      const originalIcon = getFaviconUrl(p.website);
      const proxyIconUrl = `${baseUrl}/v1/accounts/proxy-icon?url=${encodeURIComponent(originalIcon)}`;

      return {
        id: p.provider_id,
        provider_id: p.provider_id,
        name: p.provider_name,
        provider_name: p.provider_name,
        icon: proxyIconUrl,
        active: p.is_enabled ?? false,
        is_enabled: p.is_enabled ?? false,
        website: p.website,
        is_search: p.is_search,
        is_upload: p.is_upload,
        auth_methods: p.auth_methods || (p.auth_method ? [p.auth_method] : []),
        detail_fetch_required: p.detail_fetch_required ?? false,
        color: p.color,
        conflict_search_with_upload: p.conflict_search_with_upload,
        is_temperature: p.is_temperature ?? false,
      };
    });

    return cachedProviders || [];
  } catch (e) {
    console.error('[providers] Error fetching providers:', e);
    return cachedProviders || [];
  }
}

/**
 * Get cached providers (synchronous)
 */
export function getCachedProviders(): ProviderConfig[] {
  return cachedProviders || [];
}

/**
 * Find a provider by ID (case-insensitive)
 */
export function findProvider(
  providers: ProviderConfig[],
  providerId: string,
): ProviderConfig | undefined {
  const normalizedId = providerId.toLowerCase();
  return providers.find((p) => p.provider_id.toLowerCase() === normalizedId);
}

/**
 * Legacy export for backward compatibility
 * Components should migrate to fetchProviders()
 * @deprecated Use fetchProviders() instead
 */
export const providers: ProviderConfig[] = [];
