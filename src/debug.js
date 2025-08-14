/**
 * Debug logging utility with environment-aware log levels
 */

import { isDevelopment } from './env.js';

const LogLevel = {
  LOG: 'log',
  WARN: 'warn', 
  ERROR: 'error'
};

class Logger {
  constructor() {
    this.isDev = isDevelopment();
  }

  log(...args) {
    if (this.isDev) {
      console.log(...args);
    }
  }

  warn(...args) {
    console.warn(...args);
  }

  error(...args) {
    console.error(...args);
  }

  info(...args) {
    if (this.isDev) {
      console.info(...args);
    }
  }

  debug(...args) {
    if (this.isDev) {
      console.debug(...args);
    }
  }
}

export const logger = new Logger();
export { LogLevel };