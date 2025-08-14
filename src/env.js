/**
 * Environment detection and configuration for the extension
 */

export const Environment = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production'
};

let currentEnvironment = null;

export function getEnvironment() {
  if (currentEnvironment === null) {
    currentEnvironment = detectEnvironment();
  }
  return currentEnvironment;
}

function detectEnvironment() {
  try {
    const manifest = chrome.runtime.getManifest();
    
    // In production (web store), extensions have an update_url
    // In development (unpacked), this property is not present
    if (manifest.update_url) {
      return Environment.PRODUCTION;
    } else {
      return Environment.DEVELOPMENT;
    }
  } catch (error) {
    // Fallback to development if detection fails
    return Environment.DEVELOPMENT;
  }
}

export function isDevelopment() {
  return getEnvironment() === Environment.DEVELOPMENT;
}

export function isProduction() {
  return getEnvironment() === Environment.PRODUCTION;
}