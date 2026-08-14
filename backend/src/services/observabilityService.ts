import { rootLogger } from '../utils/logger';
import { getOpenExceptionsCount } from './reconciliationService';

/**
 * Observability & Golden Signals Service (Handbook Module 5)
 * 
 * Tracks the Four Golden Signals:
 * 1. Latency: Response duration distribution (p50, p90, p99, avg)
 * 2. Traffic: Request throughput and volume over time windows
 * 3. Error Rate: Fraction of requests that fail (4xx client, 5xx server)
 * 4. Saturation: System load indicators (exception queue depth, open circuit breakers)
 * 
 * Also provides lightweight alerting on symptom-based thresholds (not raw CPU).
 */

export interface GoldenSignals {
  latency: {
    avg_ms: number;
    p50_ms: number;
    p90_ms: number;
    p99_ms: number;
    sample_count: number;
  };
  traffic: {
    total_requests: number;
    requests_last_minute: number;
    requests_per_second: number;
  };
  error_rate: {
    total_errors: number;
    client_error_count_4xx: number;
    server_error_count_5xx: number;
    error_percentage: number;
  };
  saturation: {
    open_reconciliation_exceptions: number;
    active_circuit_breakers_open: number;
    memory_heap_used_mb: number;
    system_status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  };
}

export interface AlertTrigger {
  id: string;
  symptom: string;
  severity: 'WARNING' | 'CRITICAL';
  current_value: number;
  threshold: number;
  message: string;
  triggered_at: string;
}

export type AlertListener = (alert: AlertTrigger) => void;

class ObservabilityService {
  private requestDurations: number[] = [];
  private readonly maxSamples = 1000;
  private totalRequests = 0;
  private clientErrors4xx = 0;
  private serverErrors5xx = 0;
  private recentTimestamps: number[] = [];
  private openCircuitBreakers = 0;
  private alertListeners: AlertListener[] = [];
  private activeAlerts: AlertTrigger[] = [];

  // Alert Thresholds (Handbook M5: Alert on symptoms, not causes)
  private exceptionQueueThreshold = 5; // e.g. > 5 open exceptions triggers alert
  private p99LatencyThresholdMs = 2000; // e.g. p99 > 2000ms triggers alert
  private errorRateThreshold = 0.15; // e.g. > 15% error rate triggers alert

  constructor() {}

  /**
   * Records completed HTTP request telemetry
   */
  public recordRequest(statusCode: number, durationMs: number): void {
    const now = Date.now();
    this.totalRequests++;
    this.recentTimestamps.push(now);

    // Keep rolling 60-second window for traffic calculation
    const oneMinAgo = now - 60_000;
    while (this.recentTimestamps.length > 0 && this.recentTimestamps[0] < oneMinAgo) {
      this.recentTimestamps.shift();
    }

    // Keep rolling duration samples
    this.requestDurations.push(durationMs);
    if (this.requestDurations.length > this.maxSamples) {
      this.requestDurations.shift();
    }

    // Classify error status
    if (statusCode >= 500) {
      this.serverErrors5xx++;
    } else if (statusCode >= 400) {
      this.clientErrors4xx++;
    }
  }

  public setOpenCircuitBreakers(count: number): void {
    this.openCircuitBreakers = count;
  }

  public setExceptionQueueThreshold(threshold: number): void {
    this.exceptionQueueThreshold = threshold;
  }

  public onAlert(listener: AlertListener): () => void {
    this.alertListeners.push(listener);
    return () => {
      this.alertListeners = this.alertListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Computes the live Golden Signals
   */
  public async getGoldenSignals(): Promise<GoldenSignals> {
    const now = Date.now();
    const oneMinAgo = now - 60_000;
    while (this.recentTimestamps.length > 0 && this.recentTimestamps[0] < oneMinAgo) {
      this.recentTimestamps.shift();
    }
    const requestsLastMin = this.recentTimestamps.length;
    const rps = Math.round((requestsLastMin / 60) * 100) / 100;

    // Latency percentiles
    let avg = 0;
    let p50 = 0;
    let p90 = 0;
    let p99 = 0;

    if (this.requestDurations.length > 0) {
      const sorted = [...this.requestDurations].sort((a, b) => a - b);
      const sum = sorted.reduce((acc, v) => acc + v, 0);
      avg = Math.round((sum / sorted.length) * 100) / 100;
      p50 = sorted[Math.floor(sorted.length * 0.50)] || 0;
      p90 = sorted[Math.floor(sorted.length * 0.90)] || 0;
      p99 = sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1] || 0;
    }

    // Error percentage
    const totalErrors = this.clientErrors4xx + this.serverErrors5xx;
    const errorPct =
      this.totalRequests > 0
        ? Math.round((totalErrors / this.totalRequests) * 10000) / 100
        : 0;

    // Saturation metrics
    let openExceptions = 0;
    try {
      openExceptions = await getOpenExceptionsCount();
    } catch {
      openExceptions = 0;
    }

    const memoryUsage = process.memoryUsage();
    const heapUsedMb = Math.round((memoryUsage.heapUsed / (1024 * 1024)) * 100) / 100;

    let systemStatus: GoldenSignals['saturation']['system_status'] = 'HEALTHY';
    if (this.openCircuitBreakers > 0 || errorPct > 10 || openExceptions > 10) {
      systemStatus = 'DEGRADED';
    }
    if (errorPct > 30 || this.openCircuitBreakers > 2) {
      systemStatus = 'UNHEALTHY';
    }

    return {
      latency: {
        avg_ms: avg,
        p50_ms: p50,
        p90_ms: p90,
        p99_ms: p99,
        sample_count: this.requestDurations.length,
      },
      traffic: {
        total_requests: this.totalRequests,
        requests_last_minute: requestsLastMin,
        requests_per_second: rps,
      },
      error_rate: {
        total_errors: totalErrors,
        client_error_count_4xx: this.clientErrors4xx,
        server_error_count_5xx: this.serverErrors5xx,
        error_percentage: errorPct,
      },
      saturation: {
        open_reconciliation_exceptions: openExceptions,
        active_circuit_breakers_open: this.openCircuitBreakers,
        memory_heap_used_mb: heapUsedMb,
        system_status: systemStatus,
      },
    };
  }

  /**
   * Checks symptom-based alert thresholds and fires notifications
   */
  public async checkAlertThresholds(): Promise<AlertTrigger[]> {
    const signals = await this.getGoldenSignals();
    const newAlerts: AlertTrigger[] = [];
    const now = new Date().toISOString();

    // 1. Exception queue depth alert
    if (signals.saturation.open_reconciliation_exceptions >= this.exceptionQueueThreshold) {
      newAlerts.push({
        id: `alert_exc_${Date.now()}`,
        symptom: 'exception_queue_depth',
        severity: 'WARNING',
        current_value: signals.saturation.open_reconciliation_exceptions,
        threshold: this.exceptionQueueThreshold,
        message: `Reconciliation exception queue depth is high (${signals.saturation.open_reconciliation_exceptions} >= threshold ${this.exceptionQueueThreshold})`,
        triggered_at: now,
      });
    }

    // 2. High latency alert (p99)
    if (signals.latency.sample_count >= 10 && signals.latency.p99_ms > this.p99LatencyThresholdMs) {
      newAlerts.push({
        id: `alert_lat_${Date.now()}`,
        symptom: 'high_p99_latency',
        severity: 'CRITICAL',
        current_value: signals.latency.p99_ms,
        threshold: this.p99LatencyThresholdMs,
        message: `API p99 latency elevated (${signals.latency.p99_ms}ms > threshold ${this.p99LatencyThresholdMs}ms)`,
        triggered_at: now,
      });
    }

    // 3. Error rate alert
    if (signals.traffic.total_requests >= 20 && signals.error_rate.error_percentage > (this.errorRateThreshold * 100)) {
      newAlerts.push({
        id: `alert_err_${Date.now()}`,
        symptom: 'high_error_rate',
        severity: 'CRITICAL',
        current_value: signals.error_rate.error_percentage,
        threshold: this.errorRateThreshold * 100,
        message: `HTTP error rate exceeded threshold (${signals.error_rate.error_percentage}% > ${this.errorRateThreshold * 100}%)`,
        triggered_at: now,
      });
    }

    // 4. Circuit Breaker tripped alert
    if (signals.saturation.active_circuit_breakers_open > 0) {
      newAlerts.push({
        id: `alert_cb_${Date.now()}`,
        symptom: 'circuit_breaker_open',
        severity: 'CRITICAL',
        current_value: signals.saturation.active_circuit_breakers_open,
        threshold: 1,
        message: `Payment rail circuit breaker tripped (${signals.saturation.active_circuit_breakers_open} open)`,
        triggered_at: now,
      });
    }

    this.activeAlerts = newAlerts;

    // Dispatch to registered alert listeners & structured logger
    for (const alert of newAlerts) {
      rootLogger.warn(`[ALERT] ${alert.severity}: ${alert.message}`, {
        symptom: alert.symptom,
        current_value: alert.current_value,
        threshold: alert.threshold,
      });

      for (const listener of this.alertListeners) {
        try {
          listener(alert);
        } catch (err) {
          rootLogger.error('Error in alert listener callback', {
            error: (err as Error).message,
          });
        }
      }
    }

    return newAlerts;
  }

  public getActiveAlerts(): AlertTrigger[] {
    return [...this.activeAlerts];
  }

  public reset(): void {
    this.requestDurations = [];
    this.totalRequests = 0;
    this.clientErrors4xx = 0;
    this.serverErrors5xx = 0;
    this.recentTimestamps = [];
    this.openCircuitBreakers = 0;
    this.activeAlerts = [];
  }
}

export const observabilityService = new ObservabilityService();
