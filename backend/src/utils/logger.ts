import pino from 'pino';

// Create logger configuration based on environment
const createLogger = () => {
  const isLocal = process.env.ENVIRONMENT === 'local';
  const logLevel = process.env.LOG_LEVEL || (isLocal ? 'debug' : 'info');

  const config: pino.LoggerOptions = {
    level: logLevel,
    // Pretty print for local development
    ...(isLocal && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'hostname,pid',
        },
      },
    }),
    // Structured JSON for production (CloudWatch)
    ...(!isLocal && {
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    }),
  };

  return pino(config);
};

// Singleton logger instance
export const logger = createLogger();

// Helper function to create child loggers with context
export const createChildLogger = (context: Record<string, any>) => {
  return logger.child(context);
};

// Request logger for Lambda functions
export const createRequestLogger = (requestId: string, functionName?: string) => {
  return logger.child({
    requestId,
    ...(functionName && { function: functionName }),
  });
};

export default logger;