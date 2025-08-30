/**
 * Debug logging utility with environment-aware log levels
 */

import { isDevelopment, isTest } from './env.js';

const LogLevel = {
  LOG: 'log',
  WARN: 'warn',
  ERROR: 'error'
};

class Logger {
  constructor(scope = '') {
    this.scope = scope;
    this.isDev = null; // Will be lazy-loaded on first use
    this.isTestEnv = null; // Will be lazy-loaded on first use
  }

  async _ensureEnvironment() {
    if (this.isDev === null || this.isTestEnv === null) {
      this.isDev = await isDevelopment();
      this.isTestEnv = await isTest();
    }
  }

  _formatMessage(...args) {
    if (this.scope) {
      return [`[${this.scope}]`, ...args];
    }
    return args;
  }

  log(...args) {
    // Use async IIFE to avoid making all log calls async
    this._ensureEnvironment().then(() => {
      // Don't log anything in test environment unless explicitly enabled
      if (this.isTestEnv) return;

      if (this.isDev) {
        console.log(...this._formatMessage(...args));
      }
    }).catch(() => {
      // Silent fallback - don't spam console on environment detection failures
    });
  }

  warn(...args) {
    this._ensureEnvironment().then(() => {
      // Show warnings in test environment only for errors that might affect tests
      if (!this.isTestEnv) {
        console.warn(...this._formatMessage(...args));
      }
    }).catch(() => {
      // Silent fallback
    });
  }

  error(...args) {
    this._ensureEnvironment().then(() => {
      // Show errors in test environment only for critical errors
      if (!this.isTestEnv) {
        console.error(...this._formatMessage(...args));
      }
    }).catch(() => {
      // Silent fallback
    });
  }

  info(...args) {
    this._ensureEnvironment().then(() => {
      // Don't log info in test environment
      if (this.isTestEnv) return;

      if (this.isDev) {
        console.info(...this._formatMessage(...args));
      }
    }).catch(() => {
      // Silent fallback
    });
  }

  debug(...args) {
    this._ensureEnvironment().then(() => {
      // Don't log debug in test environment
      if (this.isTestEnv) return;

      if (this.isDev) {
        console.debug(...this._formatMessage(...args));
      }
    }).catch(() => {
      // Silent fallback
    });
  }
}

export { Logger, LogLevel };