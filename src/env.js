/**
 * Environment detection and configuration for the extension
 */

export const Environment = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test'
};

let currentEnvironment = null;

export async function getEnvironment() {
  if (currentEnvironment === null) {
    currentEnvironment = await detectEnvironment();
  }
  return currentEnvironment;
}

async function detectEnvironment() {
  // Check if we're in a test environment first
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

  try {
    // Use chrome.management.getSelf() for more robust detection
    const extensionInfo = await chrome.management.getSelf();

    // installType directly tells us if it's development or production
    if (extensionInfo.installType === 'development') {
      return Environment.DEVELOPMENT;
    } else {
      return Environment.PRODUCTION;
    }
  } catch {
    // Fallback to manifest-based detection if management API fails
    try {
      const manifest = chrome.runtime.getManifest();

      // In production (web store), extensions have an update_url
      // In development (unpacked), this property is not present
      if (manifest.update_url) {
        return Environment.PRODUCTION;
      } else {
        return Environment.DEVELOPMENT;
      }
    } catch {
      // If Chrome APIs are not available, we're likely in a test environment
      return Environment.TEST;
    }
  }
}

export async function isDevelopment() {
  return (await getEnvironment()) === Environment.DEVELOPMENT;
}

export async function isProduction() {
  return (await getEnvironment()) === Environment.PRODUCTION;
}

export async function isTest() {
  return (await getEnvironment()) === Environment.TEST;
}
