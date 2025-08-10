/**
 * Comprehensive error handling and logging utilities for Horizon Indexer
 */

export interface IndexerError {
  code: string;
  message: string;
  context?: any;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class IndexerErrorHandler {
  private static logError(error: IndexerError) {
    const logMessage = `[${error.severity.toUpperCase()}] ${error.code}: ${error.message}`;
    
    if (error.severity === 'critical') {
      console.error('🚨', logMessage, error.context || '');
    } else if (error.severity === 'high') {
      console.error('⚠️', logMessage, error.context || '');
    } else if (error.severity === 'medium') {
      console.warn('⚡', logMessage, error.context || '');
    } else {
      console.info('ℹ️', logMessage, error.context || '');
    }
  }

  static handleRpcError(error: any, operation: string): IndexerError {
    const indexerError: IndexerError = {
      code: 'RPC_ERROR',
      message: `RPC operation failed: ${operation}`,
      context: {
        originalError: error.message,
        operation,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date(),
      severity: error.message?.includes('timeout') ? 'medium' : 'high'
    };

    this.logError(indexerError);
    return indexerError;
  }

  static handleDatabaseError(error: any, operation: string): IndexerError {
    const indexerError: IndexerError = {
      code: 'DATABASE_ERROR',
      message: `Database operation failed: ${operation}`,
      context: {
        originalError: error.message,
        operation,
        sqlState: error.code,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date(),
      severity: error.message?.includes('connection') ? 'critical' : 'high'
    };

    this.logError(indexerError);
    return indexerError;
  }

  static handleApiError(error: any, endpoint: string): IndexerError {
    const indexerError: IndexerError = {
      code: 'API_ERROR',
      message: `API endpoint failed: ${endpoint}`,
      context: {
        originalError: error.message,
        endpoint,
        stack: error.stack,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date(),
      severity: 'medium'
    };

    this.logError(indexerError);
    return indexerError;
  }

  static handleValidationError(error: any, context: string): IndexerError {
    const indexerError: IndexerError = {
      code: 'VALIDATION_ERROR',
      message: `Data validation failed: ${context}`,
      context: {
        originalError: error.message,
        validationContext: context,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date(),
      severity: 'low'
    };

    this.logError(indexerError);
    return indexerError;
  }

  static logInfo(message: string, context?: any) {
    console.info(`ℹ️ [INFO] ${message}`, context || '');
  }

  static logSuccess(message: string, context?: any) {
    console.info(`✅ [SUCCESS] ${message}`, context || '');
  }

  static logWarning(message: string, context?: any) {
    console.warn(`⚠️ [WARNING] ${message}`, context || '');
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static timers: Map<string, number> = new Map();

  static startTimer(operation: string) {
    this.timers.set(operation, Date.now());
  }

  static endTimer(operation: string): number {
    const startTime = this.timers.get(operation);
    if (!startTime) {
      console.warn(`⚠️ Timer not found for operation: ${operation}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(operation);

    if (duration > 10000) { // 10 seconds
      console.warn(`🐌 Slow operation detected: ${operation} took ${duration}ms`);
    } else if (duration > 5000) { // 5 seconds
      console.info(`⏱️ Operation ${operation} took ${duration}ms`);
    }

    return duration;
  }

  static async measureAsync<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    this.startTimer(operation);
    try {
      const result = await fn();
      const duration = this.endTimer(operation);
      IndexerErrorHandler.logSuccess(`${operation} completed in ${duration}ms`);
      return result;
    } catch (error) {
      this.endTimer(operation);
      throw error;
    }
  }
}

/**
 * Rate limiting utilities
 */
export class RateLimiter {
  private static requests: Map<string, number[]> = new Map();

  static canProceed(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove requests outside the window
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      IndexerErrorHandler.logWarning(`Rate limit exceeded for ${key}`);
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    return true;
  }

  static getRemainingRequests(key: string, maxRequests: number, windowMs: number): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(time => now - time < windowMs);
    return Math.max(0, maxRequests - validRequests.length);
  }
}