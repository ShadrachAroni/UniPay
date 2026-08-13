"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = void 0;
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
function redactValue(key, value) {
    if (value === null || value === undefined)
        return value;
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
        const redactedObj = {};
        for (const [k, v] of Object.entries(value)) {
            redactedObj[k] = redactValue(k, v);
        }
        return redactedObj;
    }
    if (Array.isArray(value)) {
        return value.map((item, idx) => redactValue(`${key}[${idx}]`, item));
    }
    return value;
}
class Logger {
    level = 'info';
    emit(level, message, context) {
        const time = new Date().toISOString();
        const cleanContext = context ? redactValue('context', context) : {};
        const logObject = {
            level,
            time,
            message,
            ...cleanContext,
        };
        console.log(JSON.stringify(logObject));
    }
    info(message, context) {
        this.emit('info', message, context);
    }
    warn(message, context) {
        this.emit('warn', message, context);
    }
    error(message, context) {
        this.emit('error', message, context);
    }
    debug(message, context) {
        this.emit('debug', message, context);
    }
}
exports.Logger = Logger;
exports.logger = new Logger();
