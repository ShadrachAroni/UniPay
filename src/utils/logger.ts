export interface LogContext {
  trace_id?: string;
  user_id?: string;
  adapter_key?: string;
  operation?: string;
  duration_ms?: number;
  outcome?: 'success' | 'failure' | 'circuit_open' | 'retry';
  circuit_state?: string;
  retry_attempt?: number;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  'authorization',
  'api_key',
  'apikey',
  'secret',
  'token',
  'password',
  'id_number',
  'id_document_url',
  'phone',
  'payer_phone',
  'payerphone',
  'email',
  'payer_email',
  'payeremail',
  'credential',
]);

function redactValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  
  const lowerKey = key.toLowerCase();
  if (SENSITIVE_KEYS.has(lowerKey)) {
    if (typeof value === 'string') {
      if (lowerKey.includes('phone')) {
        return value.length > 4 ? `${value.slice(0, 3)}***${value.slice(-3)}` : '***';
      }
      if (lowerKey.includes('email')) {
        const parts = value.split('@');
        return parts.length === 2 ? `${parts[0][0]}***@${parts[1]}` : '***';
      }
      return '[REDACTED]';
    }
    return '[REDACTED]';
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const redactedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      redactedObj[k] = redactValue(k, v);
    }
    return redactedObj;
  }

  if (Array.isArray(value)) {
    return value.map((item, idx) => redactValue(`${key}[${idx}]`, item));
  }

  return value;
}

export class Logger {
  private level: 'info' | 'warn' | 'error' | 'debug' = 'info';

  private emit(level: string, message: string, context?: LogContext) {
    const time = new Date().toISOString();
    const cleanContext = context ? (redactValue('context', context) as LogContext) : {};
    const logObject = {
      level,
      time,
      message,
      ...cleanContext,
    };
    console.log(JSON.stringify(logObject));
  }

  info(message: string, context?: LogContext) {
    this.emit('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.emit('warn', message, context);
  }

  error(message: string, context?: LogContext) {
    this.emit('error', message, context);
  }

  debug(message: string, context?: LogContext) {
    this.emit('debug', message, context);
  }
}

export const logger = new Logger();
