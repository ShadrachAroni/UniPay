import crypto from 'crypto';
const uuidv4 = () => crypto.randomUUID();
import { generateLoopSignature } from './loop-signing.js';
import { LoopAuthClient } from './loop-auth.client.js';
import { logger } from '../../utils/logger.js';
import { ProviderUnavailableError, InvalidProviderResponseError } from '../../errors/payment.errors.js';

export interface LoopApiClientConfig {
  baseUrl?: string;
  merchantTill: string;
  secretKey: string;
  callBackUrl?: string;
  authClient: LoopAuthClient;
}

export interface LoopPromptRequestInput {
  amount: number;
  payerPhone: string;
  orderReference: string;
  idempotencyKey: string;
  callBackUrl?: string;
}

export interface LoopPromptResponseData {
  statusCode: number;
  message: string;
  data: {
    serviceTransactionStatus?: string;
    requestReference?: string;
    txnReference?: string;
    response?: {
      transactionRef?: string;
      rspMessage?: string;
      orderNo?: string;
      rspCode?: string;
      loopRefNo?: string;
      totalAmount?: string;
    };
  };
}

export interface LoopInquiryResponseData {
  statusCode: number;
  message: string;
  data: {
    serviceTransactionStatus?: string;
    requestReference?: string;
    txnReference?: string;
    response?: {
      status?: string;
      finalState?: boolean;
      amount?: string;
      currency?: string;
      transactionRef?: string;
      txnReference?: string;
      resultCode?: string;
      resultDesc?: string;
    };
  };
}

export class LoopApiClient {
  private baseUrl: string;
  private merchantTill: string;
  private secretKey: string;
  private defaultCallBackUrl: string;
  private authClient: LoopAuthClient;

  constructor(config: LoopApiClientConfig) {
    this.baseUrl = config.baseUrl || process.env.LOOP_BASE_URL || 'https://sandbox.loop.co.ke';
    this.merchantTill = config.merchantTill || process.env.LOOP_MERCHANT_TILL || '133239';
    this.secretKey = config.secretKey || process.env.LOOP_SECRET_KEY || 'hyqd7bwMr9Kv-C5PW4n7uF4TiMnMp_hyvyhYYkYlcU8';
    this.defaultCallBackUrl = config.callBackUrl || process.env.LOOP_CALLBACK_URL || 'https://sandbox.unipay.co.ke/api/v1/webhooks/loop';
    this.authClient = config.authClient;
  }

  async requestToPay(input: LoopPromptRequestInput): Promise<LoopPromptResponseData> {
    const token = await this.authClient.getAccessToken();
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = uuidv4().toLowerCase();
    const signature = generateLoopSignature({
      merchantTill: this.merchantTill,
      timestamp,
      nonce,
      secretKey: this.secretKey,
    });

    const payload = {
      serviceCode: 'NEO_MRCHNT_RTP',
      txnReference: input.idempotencyKey,
      requestParameters: {
        merchantTill: this.merchantTill,
        mobileNo: input.payerPhone,
        amount: input.amount.toFixed(2),
        reason: input.orderReference,
        callBackUrl: input.callBackUrl || this.defaultCallBackUrl,
        timestamp,
        nonce,
        signature,
      },
    };

    const url = `${this.baseUrl}/gateway/loop-prompt/2/services/process-request`;
    const start = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Loop-Version': '2024-01',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new ProviderUnavailableError('loop', `HTTP ${response.status} on requestToPay: ${errText}`);
      }

      const resData = (await response.json()) as LoopPromptResponseData;
      logger.info('Received response from LOOP Prompt API', {
        adapter_key: 'loop',
        operation: 'requestToPay',
        duration_ms: Date.now() - start,
        status_code: resData.statusCode,
      });

      return resData;
    } catch (err) {
      if (err instanceof ProviderUnavailableError) throw err;
      throw new ProviderUnavailableError('loop', `Network error during requestToPay: ${(err as Error).message}`);
    }
  }

  async transactionInquiry(originalTxnReference: string): Promise<LoopInquiryResponseData> {
    const token = await this.authClient.getAccessToken();
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = uuidv4().toLowerCase();
    const envelopeTxnRef = uuidv4().toLowerCase(); // Envelope reference MUST be fresh on every inquiry poll!

    const signature = generateLoopSignature({
      merchantTill: this.merchantTill,
      timestamp,
      nonce,
      secretKey: this.secretKey,
    });

    const payload = {
      serviceCode: 'MRCHNT_TXN_INQUIRY',
      txnReference: envelopeTxnRef,
      requestParameters: {
        merchantTill: this.merchantTill,
        txnReference: originalTxnReference,
        timestamp,
        nonce,
        signature,
      },
    };

    const url = `${this.baseUrl}/gateway/transaction-inquiry/1.0.0/services/process-request`;
    const start = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Loop-Version': '2024-01',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new ProviderUnavailableError('loop', `HTTP ${response.status} on transactionInquiry: ${errText}`);
      }

      const resData = (await response.json()) as LoopInquiryResponseData;
      logger.info('Received response from LOOP Transaction Inquiry API', {
        adapter_key: 'loop',
        operation: 'transactionInquiry',
        duration_ms: Date.now() - start,
        status_code: resData.statusCode,
      });

      return resData;
    } catch (err) {
      if (err instanceof ProviderUnavailableError) throw err;
      throw new ProviderUnavailableError('loop', `Network error during transactionInquiry: ${(err as Error).message}`);
    }
  }
}
