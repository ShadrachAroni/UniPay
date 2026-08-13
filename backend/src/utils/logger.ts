/**
 * UniPay Structured JSON Logger (Handbook M5)
 * Requirements:
 * - Emits JSON lines with level, time, trace_id, user_id, route, message
 * - Enforces PII redaction (Kenyan IDs, phone numbers, emails, document URLs)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  trace_id?: string;
  user_id?: string;
  route?: string;
  [key: string]: unknown;
}

// Regex patterns for sensitive data redaction
const PII_PATTERNS = [
  // Email regex
  {
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replace: '[REDACTED_EMAIL]',
  },
  // Phone numbers (e.g. +254712345678, 0712345678, 254712345678)
  {
    regex: /(?:\+?254|0)[17]\d{8}/g,
    replace: '[REDACTED_PHONE]',
  },
  // Kenyan National ID numbers (6-8 digits in typical ID contexts)
  {
    regex: /\b(?:id_number|national_id|id)\s*[:=]\s*["']?\d{6,9}["']?/gi,
    replace: 'id:[REDACTED_ID]',
  },
  // Document URLs (S3/Supabase storage URLs with docs/passports)
  {
    regex: /https?:\/\/[^\s"']+\/(?:documents|passports|ids|kyc)\/[^\s"']+/gi,
    replace: '[REDACTED_DOC_URL]',
  },
];

export function redactPII(input: unknown): unknown {
  if (typeof input === 'string') {
    let sanitized = input;
    for (const pattern of PII_PATTERNS) {
      sanitized = sanitized.replace(pattern.regex, pattern.replace);
    }
    return sanitized;
  }

  if (Array.isArray(input)) {
    return input.map(redactPII);
  }

  if (input !== null && typeof input === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('key') ||
        lowerKey.includes('token') ||
        lowerKey.includes('id_number') ||
        lowerKey.includes('national_id')
      ) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = redactPII(value);
      }
    }
    return output;
  }

  return input;
}

export class Logger {
  private baseContext: LogContext;

  constructor(baseContext: LogContext = {}) {
    this.baseContext = baseContext;
  }

  public child(context: LogContext): Logger {
    return new Logger({
      ...this.baseContext,
      ...context,
    });
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const payload = {
      level,
      time: new Date().toISOString(),
      trace_id: this.baseContext.trace_id || 'no-trace',
      user_id: this.baseContext.user_id || 'anonymous',
      route: this.baseContext.route || 'internal',
      message: redactPII(message),
      ...(data ? (redactPII(data) as Record<string, unknown>) : {}),
    };

    const formatted = JSON.stringify(payload);
    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  public debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  public info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  public warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  public error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }
}

export const rootLogger = new Logger();
