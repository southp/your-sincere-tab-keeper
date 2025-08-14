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
  constructor(scope = '') {
    this.isDev = isDevelopment();
    this.scope = scope;
  }

  _formatMessage(...args) {
    if (this.scope) {
      return [`[${this.scope}]`, ...args];
    }
    return args;
  }

  log(...args) {
    if (this.isDev) {
      console.log(...this._formatMessage(...args));
    }
  }

  warn(...args) {
    console.warn(...this._formatMessage(...args));
  }

  error(...args) {
    console.error(...this._formatMessage(...args));
  }

  info(...args) {
    if (this.isDev) {
      console.info(...this._formatMessage(...args));
    }
  }

  debug(...args) {
    if (this.isDev) {
      console.debug(...this._formatMessage(...args));
    }
  }
}

export { Logger, LogLevel };