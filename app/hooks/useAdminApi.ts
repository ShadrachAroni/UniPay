import { useAuth } from '@clerk/expo';

export function useAdminApi() {
  const { getToken } = useAuth();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const isDev = process.env.NODE_ENV !== 'production';

  const getAuthHeaders = async (
    extraHeaders: Record<string, string> = {}
  ): Promise<Record<string, string>> => {
    const sessionToken = await getToken();
    const fallbackToken = isDev ? process.env.EXPO_PUBLIC_ADMIN_TEST_TOKEN : undefined;
    const bearer = sessionToken || fallbackToken;

    if (!bearer) {
      throw new Error('Admin authentication token is unavailable.');
    }

    return {
      ...extraHeaders,
      Authorization: `Bearer ${bearer}`,
    };
  };

  return {
    apiUrl,
    getAuthHeaders,
  };
}
