import { useCallback } from 'react';
import { useDemoAuth } from '../context/DemoAuthContext';

export function useAdminApi() {
  const { getAuthHeaders: getDemoHeaders, currentPersona } = useDemoAuth();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

  const getAuthHeaders = useCallback(
    async (extraHeaders: Record<string, string> = {}): Promise<Record<string, string>> => {
      // If current persona is an admin persona, use it directly; otherwise use demo/clerk headers
      const adminToken = currentPersona.isAdmin ? currentPersona.id : 'admin_super';
      const baseHeaders = await getDemoHeaders(extraHeaders);

      // Ensure an admin token is passed if in demo mode
      if (
        !baseHeaders.Authorization ||
        baseHeaders.Authorization.includes('test_user_demo') ||
        !currentPersona.isAdmin
      ) {
        baseHeaders.Authorization = `Bearer ${adminToken}`;
      }

      return {
        ...baseHeaders,
        ...extraHeaders,
      };
    },
    [getDemoHeaders, currentPersona.isAdmin, currentPersona.id]
  );

  return {
    apiUrl,
    getAuthHeaders,
  };
}

