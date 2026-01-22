import { useQuery } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Theme } from '@/cunningham/';
import { api } from '@/lib/api-client';

interface ConfigResponse {
  AI_FEATURE_ENABLED?: boolean;
  COLLABORATION_WS_URL?: string;
  CRISP_WEBSITE_ID?: string;
  ENVIRONMENT: string;
  FRONTEND_CSS_URL?: string;
  FRONTEND_HOMEPAGE_FEATURE_ENABLED?: boolean;
  FRONTEND_THEME?: Theme;
  LANGUAGES: [string, string][];
  LANGUAGE_CODE: string;
  MEDIA_BASE_URL?: string;
  SENTRY_DSN?: string;
}

const LOCAL_STORAGE_KEY = 'docs_config';

function getCachedTranslation() {
  if (typeof window === 'undefined') return undefined;
  try {
    const jsonString = localStorage.getItem(LOCAL_STORAGE_KEY);
    return jsonString ? (JSON.parse(jsonString) as ConfigResponse) : undefined;
  } catch {
    return undefined;
  }
}

function setCachedTranslation(translations: ConfigResponse) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(translations));
}

export const getConfig = async (): Promise<ConfigResponse> => {
  // fetchAPI now uses NEXT_PUBLIC_API_BASE_URL for all config requests
  const response = await fetchAPI('config');
  if (!response.ok) {
    throw new APIError('Failed to get the doc', await errorCauses(response));
  }

  const config = response.json() as Promise<ConfigResponse>;
  setCachedTranslation(await config);

  return config;
};

export const KEY_CONFIG = 'config';

export function useConfig() {
  const cachedData = getCachedTranslation();
  const oneHour = 1000 * 60 * 60;

  const response = useQuery<ConfigResponse, APIError, ConfigResponse>({
    queryKey: [KEY_CONFIG],
    queryFn: () => getConfig(),
    initialData: cachedData,
    staleTime: oneHour,
    initialDataUpdatedAt: Date.now() - oneHour, // Force initial data to be considered stale
  });

  return response;
}
