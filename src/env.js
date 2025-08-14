/**
 * Environment detection and configuration for the extension
 */

export const Environment = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production'
};

let currentEnvironment = null;

export async function getEnvironment() {
  if (currentEnvironment === null) {
    currentEnvironment = await detectEnvironment();
  }
  return currentEnvironment;
}

async function detectEnvironment() {
  try {
    // Use chrome.management.getSelf() for more robust detection
    const extensionInfo = await chrome.management.getSelf();
    
    // installType directly tells us if it's development or production
    if (extensionInfo.installType === 'development') {
      return Environment.DEVELOPMENT;
    } else {
      return Environment.PRODUCTION;
    }
  } catch (error) {
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
    } catch (manifestError) {
      // Final fallback to development if all detection fails
      return Environment.DEVELOPMENT;
    }
  }
}

export async function isDevelopment() {
  return (await getEnvironment()) === Environment.DEVELOPMENT;
}

export async function isProduction() {
  return (await getEnvironment()) === Environment.PRODUCTION;
}