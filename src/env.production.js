/**
 * Environment detection and configuration for the extension - PRODUCTION VERSION
 * This file is used only in production builds and always returns PRODUCTION environment
 */

export const Environment = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test'
};

let currentEnvironment = null;

export function getEnvironment() {
  if (currentEnvironment === null) {
    currentEnvironment = detectEnvironment();
  }
  return currentEnvironment;
}

function detectEnvironment() {
  // Check if we're in a test environment first (for any tests that might run against production build)
  if (typeof global !== 'undefined' && global.chrome && global.chrome.__testMode) {
    return Environment.TEST;
  }

  // Check for Jest test environment
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
    return Environment.TEST;
  }

  // Check for common test globals
  if (typeof jest !== 'undefined' || typeof describe !== 'undefined' || typeof it !== 'undefined') {
    return Environment.TEST;
  }

  // Always return PRODUCTION in production builds
  return Environment.PRODUCTION;
}

export function isDevelopment() {
  return getEnvironment() === Environment.DEVELOPMENT;
}

export function isProduction() {
  return getEnvironment() === Environment.PRODUCTION;
}

export function isTest() {
  return getEnvironment() === Environment.TEST;
}
