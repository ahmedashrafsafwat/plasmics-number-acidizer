// Set default test environment
process.env.ENVIRONMENT = process.env.ENVIRONMENT || 'test';
process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
process.env.COUNTER_TABLE_NAME = process.env.COUNTER_TABLE_NAME || 'NumberAcidizer-test';
process.env.AUDIT_TABLE_NAME = process.env.AUDIT_TABLE_NAME || 'NumberAcidizer-audit-test';
process.env.CONNECTIONS_TABLE_NAME =
  process.env.CONNECTIONS_TABLE_NAME || 'WebSocketConnections-test';

// Increase timeout for E2E tests
jest.setTimeout(30000);

// Global test utilities
global.console = {
  ...console,
  // Suppress console logs during tests unless DEBUG is set
  log: process.env.DEBUG ? console.log : jest.fn(),
  error: console.error,
  warn: console.warn,
  info: process.env.DEBUG ? console.info : jest.fn(),
  debug: process.env.DEBUG ? console.debug : jest.fn(),
};
