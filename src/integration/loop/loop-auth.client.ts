import { logger } from '../../utils/logger.js';
import { ProviderUnavailableError } from '../../errors/payment.errors.js';

export interface LoopAuthConfig {
  baseUrl?: string;
  clientId: string;
  clientSecret: string;
}

export interface LoopTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

export class LoopAuthClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: LoopAuthConfig) {
    this.baseUrl = config.baseUrl || process.env.LOOP_BASE_URL || 'https://sandbox.loop.co.ke';
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    // Return cached token if valid with 60-second safety margin
    if (this.cachedToken && now < this.tokenExpiresAt - 60000) {
      return this.cachedToken;
    }

    const authHeader = `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`;
    const tokenUrlPrimary = `${this.baseUrl}/gateway/auth/1.0/oauth2/token`;
    const tokenUrlFallback = `${this.baseUrl}/oauth2/token`;

    let lastError: Error | null = null;

    for (const url of [tokenUrlPrimary, tokenUrlFallback]) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        });

        if (!response.ok) {
          const errBody = await response.text();
          logger.warn(`LOOP Auth token request to ${url} failed with status ${response.status}`, {
            adapter_key: 'loop',
            operation: 'getAccessToken',
          });
          lastError = new Error(`HTTP ${response.status}: ${errBody}`);
          continue; // Try fallback URL if primary fails
        }

        const data = (await response.json()) as LoopTokenResponse;
        if (!data.access_token) {
          throw new Error('Response did not contain access_token');
        }

        this.cachedToken = data.access_token;
        const expiresInMs = (data.expires_in || 900) * 1000;
        this.tokenExpiresAt = Date.now() + expiresInMs;

        logger.info('Successfully obtained LOOP Bearer token', {
          adapter_key: 'loop',
          operation: 'getAccessToken',
          expires_in: data.expires_in,
        });

        return this.cachedToken;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw new ProviderUnavailableError(
      'loop',
      `OAuth authentication failed against LOOP endpoints: ${lastError?.message}`
    );
  }

  clearTokenCache(): void {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }
}
