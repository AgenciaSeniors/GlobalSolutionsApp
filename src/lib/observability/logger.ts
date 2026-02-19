// src/lib/observability/logger.ts
import pino from 'pino';

export interface LogMeta {
  service?: string;
  traceId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown; // Permite metadatos adicionales sin usar 'any'
}

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'global-solutions-api',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: { colorize: true },
      }
    : undefined,
  formatters: {
    level: (label: string) => ({ level: label }),
  },
});

export const logWithContext = (meta: LogMeta) => logger.child(meta);