// The one place the web app creates an API client (WEB-3). In development the API is on the same origin, under
// /api; in production it's on its own domain, from VITE_API_ORIGIN at build time (ADR-0023, FND-7).
import { createApiClient, type ApiClient } from '@parking/api-client';
import { apiOrigin } from '../config.ts';

export const apiClient: ApiClient = createApiClient({ baseUrl: apiOrigin });
