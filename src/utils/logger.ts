import pino from 'pino';

function createLogger() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isDev = nodeEnv === 'development';
  return pino({
    level: isDev ? 'debug' : 'info',
    transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
  });
}

export const logger = createLogger();
